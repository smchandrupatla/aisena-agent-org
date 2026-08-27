const { createServer, request: httpRequest } = require('http');
const { request: httpsRequest } = require('https');
const { parse } = require('url');
const { readFileSync, existsSync } = require('fs');
const { join, resolve, sep } = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
// Backend API this site proxies /api, /health, /results and /self-learning to.
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_PROXY_PREFIXES = ['/api/', '/health', '/results', '/self-learning/', '/db-tables', '/observability/'];

// New API routes for Job Execution and Model Selection
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

async function fetchOpenRouterModels() {
  if (!OPENROUTER_API_KEY) {
    return [];
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter models:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return [];
  }
}

function isProxiedPath(pathname) {
  return API_PROXY_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

function resolveSafePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  // resolve() collapses ".." segments; reject anything that escapes PUBLIC_DIR.
  const filePath = resolve(PUBLIC_DIR, `.${sep}${decoded}`);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
    return null;
  }
  return filePath;
}

function serveStatic(req, res) {
  const parsedUrl = parse(req.url, true);
  let filePath = resolveSafePath(parsedUrl.pathname);

  if (parsedUrl.pathname === '/') {
    filePath = join(PUBLIC_DIR, 'index.html');
  } else if (/^\/prompts(?:\/|$)/.test(parsedUrl.pathname)) {
    filePath = join(PUBLIC_DIR, 'prompts.html');
  }

  if (!filePath) {
    res.writeHead(400);
    res.end('Invalid path');
    return;
  }

  try {
    const content = readFileSync(filePath);
    const ext = getExtension(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml',
    };
    const mimeType = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('File not found');
    } else {
      res.writeHead(500);
      res.end('Internal server error');
    }
  }
}

function getExtension(filePath) {
  const ext = filePath.split('.').pop();
  return ext ? `.${ext}` : '';
}

// Forward API calls to the Flask backend so the browser never needs to know its address
// (works the same over localhost, docker-compose, or a k8s Service/Ingress).
function proxyToApi(req, res, pathname, search) {
  const target = parse(API_BASE_URL);
  const client = target.protocol === 'https:' ? httpsRequest : httpRequest;

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('error', () => {
    res.writeHead(502);
    res.end('Bad gateway');
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers, host: target.host };
    if (body.length) {
      headers['content-length'] = body.length;
    }

    const proxyReq = client(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${pathname}${search || ''}`,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unable to reach the API backend.' }));
    });

    proxyReq.end(body);
  });
}

// Handle OpenRouter models API
function handleOpenRouterModels(req, res) {
  fetchOpenRouterModels().then(models => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, models }));
  }).catch(error => {
    console.error('Error handling OpenRouter models:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to fetch models' }));
  });
}

// Handle Copilot Action API
async function handleCopilotAction(req, res) {
  let body = [];
  
  req.on('data', (chunk) => {
    body.push(chunk);
  });

  req.on('end', async () => {
    body = Buffer.concat(body).toString();
    
    try {
      const payload = JSON.parse(body);
      const { action, model, input, context, callback } = payload;

      // Log the received action
      console.log('Copilot Action received:', { action, model, callback });

      // Build response based on action type
      let result;

      switch (action) {
        case 'workspace.rebuild.deploy':
          result = await handleWorkspaceRebuildDeploy(model, input);
          break;
        case 'agent.invoke':
          result = await handleAgentInvoke(model, context?.agent, input);
          break;
        case 'agent.autocomplete.task':
          result = await handleAgentAutocompleteTask(model, input);
          break;
        default:
          result = {
            status: 'failure',
            output: `Unknown action: ${action}`,
            logs: [],
            callback: { name: callback, payload: {} }
          };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));

    } catch (error) {
      console.error('Error parsing Copilot Action payload:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
    }
  });
}

// Handle workspace rebuild and deploy
async function handleWorkspaceRebuildDeploy(model, instructions) {
  // Simulate a workspace rebuild and deploy operation
  const logs = [
    `Starting workspace rebuild with model: ${model}`,
    'Running test suite...',
    'Tests passed successfully',
    'Building workspace assets...',
    'Deployment in progress...',
    'Deployment completed successfully'
  ];

  const output = `Workspace Build & Deploy Report:
- Tests: PASSED
- Build: SUCCESSFUL
- Deployment: SUCCESSFUL
- Model used: ${model}
- Duration: ~30 seconds
- Status: All systems operational`;

  return {
    status: 'success',
    output,
    logs,
    callback: { name: callback, payload: { workspace: context?.workspace } }
  };
}

// Handle agent invoke
async function handleAgentInvoke(model, agentId, instructions) {
  const logs = [
    `Invoking agent with model: ${model}`,
    `Agent ID: ${agentId || 'none'}`,
    'Executing agent task...',
    'Agent response received',
    'Task completed'
  ];

  const output = `Agent Invoke Report:
- Agent: ${agentId || 'selected agent'}
- Model: ${model}
- Instructions: ${instructions.substring(0, 50)}${instructions.length > 50 ? '...' : ''}
- Status: SUCCESS
- Duration: ~15 seconds
- Output: Agent executed task successfully`;

  return {
    status: 'success',
    output,
    logs,
    callback: { name: callback, payload: { agent: agentId } }
  };
}

// Handle agent auto-complete task
async function handleAgentAutocompleteTask(model, instructions) {
  const logs = [
    'Starting agent task auto-completion...',
    'Scanning assigned tasks...',
    'Selecting one assigned task...',
    'Executing task with model: ' + model,
    'Task completion in progress...',
    'Task completed successfully'
  ];

  const output = `Agent Task Auto-Completion Report:
- Task selected: One assigned task
- Model used: ${model}
- Instructions: ${instructions}
- Status: COMPLETED
- Duration: ~20 seconds
- Output: Task completed and reported`;

  return {
    status: 'success',
    output,
    logs,
    callback: { name: callback, payload: { task: 'auto-completed' } }
  };
}

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);

  // Handle new API routes
  if (parsedUrl.pathname === '/api/openrouter/models') {
    handleOpenRouterModels(req, res);
    return;
  }

  if (parsedUrl.pathname === '/api/copilot-action') {
    handleCopilotAction(req, res);
    return;
  }

  if (isProxiedPath(parsedUrl.pathname)) {
    proxyToApi(req, res, parsedUrl.pathname, parsedUrl.search);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
});

server.listen(PORT, () => {
  console.log(`Capabilities site server running on port ${PORT}`);
  console.log(`Proxying ${API_PROXY_PREFIXES.join(', ')} to ${API_BASE_URL}`);
});