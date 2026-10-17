import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../static/lab/home.js', import.meta.url), 'utf8');
const token = 'A'.repeat(43);

function fixture(hash = '', loggedIn = false, logoutFails = false) {
  class Element {
    constructor(id = '') { this.id = id; this.hidden = false; this.value = ''; this.textContent = ''; this.dataset = {}; this.listeners = []; this.disabled = false; }
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }
    dispatch(type, event = {}) { for (const listener of this.listeners.filter(x => x.type === type)) listener.fn({ preventDefault() {}, ...event }); }
    insertAdjacentElement() {}
    scrollIntoView() {}
    focus() {}
  }
  const ids = ['lab-notice','lab-status','lab-active','lab-gift-panel','lab-gift-claim','lab-account','lab-account-signed','lab-account-login','lab-account-logout','lab-account-email','lab-account-expiry','lab-account-email-input','lab-account-login-status','lab-code','lab-activate'];
  const elements = new Map(ids.map(id => [id, new Element(id)]));
  elements.get('lab-gift-panel').hidden = true; elements.get('lab-account-signed').hidden = true; elements.get('lab-account-logout').hidden = true;
  const storage = new Map();
  const sessionStorage = { get length() { return storage.size; }, getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i] ?? null };
  let account = loggedIn ? { ok: true, email: 'user@example.test', premium: true, expires_at: 2000000000 } : null;
  const calls = [];
  const windowListeners = {};
  const document = { createElement: () => new Element(), getElementById: id => elements.get(id) || null, querySelectorAll: () => [], addEventListener() {} };
  const context = {
    window: { addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); } }, document, location: { pathname: '/lab/', search: '', hash }, history: { replaceState(_s, _t, url) { context.location.hash = String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : ''; } },
    sessionStorage, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout,
    LabAuth: {
      session: async () => account,
      accountSession: async () => account,
      accountLogin: async () => ({ ok: true }),
      accountVerify: async () => ({ ok: true, pending_gift: token }),
      accountLogout: async () => { if (logoutFails) return { ok: false, error: 'network_error', network_error: true }; account = null; return { ok: true }; },
      accountRedeem: async keys => ({ ok: true, redeemed: keys.length, added_days: keys.length * 30 }),
      promoInfo: async value => { calls.push(['info', value]); return { ok: true, available: true }; },
      promoClaim: async value => { calls.push(['claim', value]); return { ok: true, expires_at: 2000000000 }; },
      activateBatch: async () => ({ ok: true, redeemed: 1, added_days: 30 }),
      req: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    },
  };
  context.window.document = document; context.window.location = context.location; context.window.LabAuth = context.LabAuth; context.window.sessionStorage = sessionStorage;
  vm.createContext(context); vm.runInContext(source, context, { filename: 'home.js' });
  return { elements, storage, calls, context, windowListeners };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

test('ordinary lab entry keeps gift image hidden and does not consume a code', async () => {
  const { elements, calls } = fixture(); await settle();
  assert.equal(elements.get('lab-gift-panel').hidden, true);
  assert.equal(calls.length, 0);
});

test('a new invalid gift link clears a previously visible gift instead of claiming the old code', async () => {
 const {elements,context,windowListeners,calls}=fixture(`#gift=${token}`,true);await settle();
 context.LabAuth.promoInfo=async()=>({ok:true,available:false});
 context.location.hash=`#gift=${'Z'.repeat(43)}`;windowListeners.hashchange[0]();await settle();
 assert.equal(elements.get('lab-gift-panel').hidden,true);elements.get('lab-gift-claim').dispatch('click');await settle();assert.equal(calls.filter(x=>x[0]==='claim').length,0);
});

test('valid gift preview does not claim until the image is clicked', async () => {
  const { elements, calls } = fixture(`#gift=${token}`); await settle();
  assert.equal(elements.get('lab-gift-panel').hidden, false);
  assert.deepEqual(calls, [['info', token]]);
  elements.get('lab-gift-claim').dispatch('click'); await settle();
  assert.deepEqual(calls, [['info', token]]);
  assert.equal(elements.get('lab-account-login-status').textContent.includes('メールアドレス'), true);
});

test('logged-in gift click claims once and removes the image without a success message', async () => {
  const { elements, calls } = fixture(`#gift=${token}`, true); await settle();
  assert.equal(elements.get('lab-gift-panel').hidden, false);
  elements.get('lab-gift-claim').dispatch('click'); await settle();
  assert.deepEqual(calls, [['info', token], ['claim', token]]);
  assert.equal(elements.get('lab-gift-panel').hidden, true);
  assert.equal(elements.get('lab-account-login-status').textContent, '');
});

test('login link carries pending gift intent into a fresh browser and resumes claim', async () => {
  const { elements, calls } = fixture(`#login=${token}`, true); await settle();
  assert.deepEqual(calls, [['info', token], ['claim', token]]);
  assert.equal(elements.get('lab-gift-panel').hidden, true);
});

test('a different gift link clears an old unclicked gift intent', async () => {
  const { elements, storage, context, windowListeners } = fixture(`#gift=${token}`); await settle();
  elements.get('lab-gift-claim').dispatch('click'); await settle();
  const other = 'B'.repeat(43); context.location.hash = `#gift=${other}`; windowListeners.hashchange[0](); await settle();
  assert.equal(storage.get('lab_pending_gift_intent') ?? null, null);
  assert.equal(elements.get('lab-gift-panel').hidden, false);
});

test('hashchange login verifies and resumes a pending gift', async () => {
  const { elements, calls, context, windowListeners } = fixture('', true); await settle();
  context.location.hash = `#login=${token}`; windowListeners.hashchange[0](); await settle();
  assert.deepEqual(calls, [['info', token], ['claim', token]]);
  assert.equal(elements.get('lab-gift-panel').hidden, true);
});

test('logout failure stays visible to a logged-in customer', async () => {
  const { elements } = fixture('', true, true); await settle();
  elements.get('lab-account-logout').dispatch('click'); await settle();
  assert.match(elements.get('lab-account-login-status').textContent, /通信エラー/);
});
