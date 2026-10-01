const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');
const express = require('express');

test('all new providers return valid status and body from feed gateway', async () => {
  const originalListen = express.application.listen;
  let server;
  express.application.listen = function () {
    server = originalListen.call(this, 0, '127.0.0.1');
    return server;
  };
  process.env.NODE_ENV = 'production';

  try {
    delete require.cache[require.resolve('../dist/server.cjs')];
    require('../dist/server.cjs');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;

    // Test OpenAI
    const openaiRes = await fetch(`${base}/api/feed/openai`);
    assert.equal(openaiRes.status, 200);
    const openaiText = await openaiRes.text();
    assert.ok(openaiText.includes('<rss') || openaiText.includes('<channel'), 'OpenAI should return RSS');
    assert.ok(openaiText.includes('OpenAI'), 'OpenAI text contains OpenAI');

    // Test Google Blog
    const googleRes = await fetch(`${base}/api/feed/google`);
    assert.equal(googleRes.status, 200);
    const googleText = await googleRes.text();
    assert.ok(googleText.includes('<rss') || googleText.includes('<channel'), 'Google should return RSS');

    // Test Microsoft Skills Hub
    const msRes = await fetch(`${base}/api/feed/microsoft-skills`);
    assert.equal(msRes.status, 200);
    const msText = await msRes.text();
    assert.ok(msText.includes('<rss') || msText.includes('<channel'), 'MS Skills should return RSS');

    // Test Claude
    const claudeRes = await fetch(`${base}/api/feed/claude`);
    assert.equal(claudeRes.status, 200);
    const claudeText = await claudeRes.text();
    assert.ok(claudeText.includes('Claude'), 'Claude should contain Claude');
    assert.ok(claudeText.includes('/blog/'), 'Claude should contain blog links');

    console.log('All 4 new provider gateway endpoints verified successfully!');
  } finally {
    express.application.listen = originalListen;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
