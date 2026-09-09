import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeHtmlEntities } from './text';

test('decodes named and numeric entities as plain text', () => {
  assert.equal(decodeHtmlEntities('Tom &amp; Jerry &copy; &#39; &#x1F3AE;'), "Tom & Jerry © ' 🎮");
  assert.equal(decodeHtmlEntities(''), '');
  assert.equal(decodeHtmlEntities('&unknown;'), '&unknown;');
});

test('nested entities are decoded only once', () => {
  assert.equal(decodeHtmlEntities('&amp;lt;script&amp;gt;'), '&lt;script&gt;');
  assert.equal(decodeHtmlEntities('&amp;#39; &amp;quot;'), '&#39; &quot;');
});

test('markup stays inert text even when a DOM is available', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    get() { throw new Error('Entity decoding must not access the DOM'); },
  });
  try {
    const markup = '</textarea><img src=x onerror=alert(1)>';
    assert.equal(decodeHtmlEntities(markup), markup);
    assert.equal(decodeHtmlEntities('&lt;img src=x&gt;'), '<img src=x>');
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
