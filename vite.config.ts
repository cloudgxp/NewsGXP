import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const ALLOWED_FEEDS: Record<string, { url: string; name: string }> = {
  crunchyroll: {
    url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    name: 'Crunchyroll',
  },
  playstation: {
    url: 'https://blog.playstation.com/feed/',
    name: 'PlayStation Blog',
  },
};

function feedDevPlugin() {
  return {
    name: 'newsgxp-feed-gateway-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const match = url.pathname.match(/^\/api\/feed\/([^/]+)/);
        if (!match) return next();

        const providerId = match[1];
        const feedConfig = ALLOWED_FEEDS[providerId];
        if (!feedConfig) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Unsupported or unknown news provider' }));
          return;
        }

        try {
          const upstream = await fetch(feedConfig.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
          });
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: `Upstream returned HTTP ${upstream.status}` }));
            return;
          }
          const text = await upstream.text();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(text);
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message || 'Fetch failed' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), feedDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
