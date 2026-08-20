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

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);

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