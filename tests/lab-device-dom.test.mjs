import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../static/lab/device.js', import.meta.url), 'utf8');

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fixture(pathname = '/lab/fate/runtime/index.html') {
  const values = new Map([['privateKey', { privateKey: true }], ['publicJwk', { kty: 'EC', crv: 'P-256' }]]);
  const elements = new Map(['key', 'redeem', 'go', 'keybox', 'deliverybox', 'result'].map(id => [id, {
    id, value: id === 'key' ? 'Abc123456789' : '', hidden: id.endsWith('box'), dataset: {}, listeners: [], onclick: null,
    addEventListener(type, fn, options) { this.listeners.push({ type, fn, capture: Boolean(options?.capture) }); },
  }]));
  let domReady;
  const document = {
    readyState: 'loading',
    getElementById(id) { return elements.get(id) || null; },
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady = fn; },
  };
  const calls = [];
  const localStore = new Map();
  const indexedDB = { open() {
    const request = { result: {
      objectStoreNames: { contains: () => true },
      transaction() { return { objectStore() { return {
        get(key) { const read = {}; queueMicrotask(() => { read.result = values.get(key); read.onsuccess?.(); }); return read; },
        put(value, key) { values.set(key, value); const tx = this; queueMicrotask(() => tx.oncomplete?.()); },
      }; } }; },
    } };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  } };
  const context = {
    window: { T: () => ({ bad: 'bad', net: 'network', activationError: 'activation failed' }) },
    document, location: { pathname }, indexedDB,
    localStorage: { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)) },
    crypto: { randomUUID: () => 'install-id', subtle: {
      sign: async () => new Uint8Array([1, 2, 3]),
      generateKey: async () => ({ publicKey: {}, privateKey: {} }),
      exportKey: async () => ({ kty: 'EC', crv: 'P-256' }),
      importKey: async () => ({ privateKey: true }),
    } },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    TextEncoder,
    fetch: async (url, init) => {
      const path = String(url);
      calls.push({ path, body: init?.body ? JSON.parse(init.body) : null });
      if (path.endsWith('/activation/challenge')) return response(404, { error: 'device_not_found' });
      if (path.endsWith('/activate/batch')) return response(200, { ok: true, device_id: 'device-1', redeemed: 1, added_days: 30 });
      throw new Error(`unexpected request ${path}`);
    },
  };
  context.window.document = document;
  context.window.location = context.location;
  context.window.localStorage = context.localStorage;
  context.window.crypto = context.crypto;
  context.window.fetch = context.fetch;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'device.js' });
  domReady();
  return { context, elements, calls };
}

test('Fate DOM adapter uses batch activation and leaves the existing onclick binding present', async () => {
  const { elements, calls } = fixture();
  const redeem = elements.get('redeem');
  let oldHandlerCalled = false;
  redeem.onclick = () => { oldHandlerCalled = true; };
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  const adapter = redeem.listeners.find(listener => listener.capture);
  const pending = adapter.fn(event);
  await pending;
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(oldHandlerCalled, false);
  assert.deepEqual(calls.map(call => call.path.split('/').pop()), ['challenge', 'batch']);
  assert.deepEqual(calls[1].body.license_keys, ['Abc123456789']);
  assert.equal(elements.get('key').value, '');
  assert.equal(elements.get('keybox').hidden, true);
});

test('Fate adapter does not bind to another Lab game even when the ids are present', () => {
  const { elements } = fixture('/lab/chikoku/runtime/index.html');
  assert.equal(elements.get('redeem').listeners.length, 0);
});
