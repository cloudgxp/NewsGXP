import { onRequestGet } from './functions/api/feed/[provider]';

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/feed\/([^/]+)/);

    if (match) {
      const provider = match[1];
      return onRequestGet({
        request,
        params: { provider },
        env,
      });
    }

    // Serve static assets from Vite build
    return env.ASSETS.fetch(request);
  },
};
