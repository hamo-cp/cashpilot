import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const port = Number(process.argv[2] || 3000);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const path = resolve(root, '.' + requested);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!statSync(path).isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(path).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CashPilot test server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
