const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.m': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Starts a local HTTP server serving the static Next.js export.
 * @param {string} staticDir - Directory containing the exported web assets
 * @param {number} [preferredPort=0] - Port to listen on (0 for dynamic assignment)
 * @returns {Promise<{ server: http.Server, port: number, origin: string, close: () => Promise<void> }>}
 */
function startStaticServer(staticDir, preferredPort = 0) {
  return new Promise((resolve, reject) => {
    const resolvedDir = path.resolve(staticDir);

    if (!fs.existsSync(resolvedDir)) {
      return reject(new Error(`Static directory not found: ${resolvedDir}`));
    }

    const server = http.createServer((req, res) => {
      // Bounded request method handling
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Method Not Allowed');
        return;
      }

      const parsedUrl = url.parse(req.url);
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(parsedUrl.pathname);
      } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Bad Request');
        return;
      }

      // Safe normalization against directory traversal
      let safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
      let fullPath = path.join(resolvedDir, safePath);

      // Verify resolved path stays strictly within resolvedDir
      if (!fullPath.startsWith(resolvedDir)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Forbidden');
        return;
      }

      // Check if file exists or requires Next.js routing resolution
      let targetFile = null;

      try {
        const stat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;

        if (stat && stat.isDirectory()) {
          // If directory, check for index.html
          const dirIndex = path.join(fullPath, 'index.html');
          if (fs.existsSync(dirIndex)) {
            targetFile = dirIndex;
          }
        } else if (stat && stat.isFile()) {
          targetFile = fullPath;
        } else {
          // Try adding .html extension (e.g., /docs -> docs.html)
          const withHtml = `${fullPath}.html`;
          if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
            targetFile = withHtml;
          } else {
            // Check 404 page
            const notFound = path.join(resolvedDir, '404.html');
            if (fs.existsSync(notFound)) {
              targetFile = notFound;
              res.statusCode = 404;
            }
          }
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Internal Server Error');
        return;
      }

      if (!targetFile || !fs.existsSync(targetFile)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('File Not Found');
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Security and cache headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');

      // Static assets can be cached aggressively; HTML should revalidate
      if (ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

      if (req.method === 'HEAD') {
        res.statusCode = res.statusCode || 200;
        res.end();
        return;
      }

      const stream = fs.createReadStream(targetFile);
      stream.on('error', (err) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Error streaming file');
        }
      });
      stream.pipe(res);
    });

    server.on('error', reject);

    // Bind strictly to loopback interface 127.0.0.1
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      const origin = `http://127.0.0.1:${port}`;
      console.log(`[desktop-server] Production server listening at ${origin} (root: ${resolvedDir})`);
      resolve({
        server,
        port,
        origin,
        close: () => new Promise((resClose) => server.close(resClose)),
      });
    });
  });
}

module.exports = {
  startStaticServer,
  MIME_TYPES,
};
