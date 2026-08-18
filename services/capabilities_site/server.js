const { createServer } = require('http');
const { parse } = require('url');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

function serveStatic(req, res) {
  const parsedUrl = parse(req.url, true);
  let filePath = join(PUBLIC_DIR, parsedUrl.pathname);

  if (parsedUrl.pathname === '/') {
    filePath = join(PUBLIC_DIR, 'index.html');
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

const server = createServer((req, res) => {
  if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
});

server.listen(PORT, () => {
  console.log(`Capabilities site server running on port ${PORT}`);
});