// Simple dev server for Bun
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Try to serve the file
    const filePath = '.' + pathname;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      // Determine content type
      let contentType = 'application/octet-stream';
      if (pathname.endsWith('.html')) contentType = 'text/html; charset=utf-8';
      else if (pathname.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
      else if (pathname.endsWith('.ts')) {
        // Bundle TypeScript with all dependencies
        const result = await Bun.build({
          entrypoints: [filePath],
          format: 'esm',
          target: 'browser',
          minify: false,
          sourcemap: 'inline',
        });
        if (result.success && result.outputs.length > 0) {
          const code = await result.outputs[0].text();
          return new Response(code, {
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
          });
        } else {
          console.error('Build failed:', result.logs);
          return new Response('Build failed: ' + result.logs.join('\n'), { status: 500 });
        }
      }
      else if (pathname.endsWith('.json')) contentType = 'application/json; charset=utf-8';
      else if (pathname.endsWith('.css')) contentType = 'text/css; charset=utf-8';
      else if (pathname.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (pathname.endsWith('.png')) contentType = 'image/png';

      return new Response(file, {
        headers: { 'Content-Type': contentType },
      });
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Dev server running at http://localhost:${server.port}`);
