const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');
const express = require('express');

// Run after npm run build; exercise the production server with mocked upstreams.
test('feed aliases and fresh requests share a budget before upstream fetching', async () => {
  const originalListen = express.application.listen;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.NODE_ENV;
  let server;
  let upstreamCalls = 0;
  express.application.listen = function () {
    server = originalListen.call(this, 0, '127.0.0.1');
    return server;
  };
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response('<rss/>', { status: 200 });
  };
  process.env.NODE_ENV = 'production';
  try {
    require('../dist/server.cjs');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const routes = ['/api/feed/xbox', '/api/proxy/crunchyroll/rss', '/api/proxy/playstation/rss'];
    for (let i = 0; i < 60; i++) {
      const response = await originalFetch(`${base}${routes[i % routes.length]}?fresh=1`);
      assert.equal(response.status, 200);
      await response.text();
    }
    assert.equal(upstreamCalls, 60);
    for (const route of routes) {
      const response = await originalFetch(`${base}${route}?fresh=true`);
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers.get('retry-after')) > 0);
      assert.match((await response.json()).error, /Too many feed requests/);
    }
    assert.equal(upstreamCalls, 60, 'blocked requests must not call upstream');
    const health = await originalFetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    await health.text();
  } finally {
    express.application.listen = originalListen;
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
