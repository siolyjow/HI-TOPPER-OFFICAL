import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as resource} from '../functions/lab/[game]/runtime/[[path]].js';
import {onRequest as api} from '../functions/lab/api/[[path]].js';
test('all protected game proxies forward only account and relevant game cookies',async()=>{
 for(const slug of ['fate','chikoku','kacho','ni-gyu','destroyer']){
  let incoming;
  const r=await resource({request:new Request(`https://www.hitopper.top/lab/${slug}/runtime/`,{headers:{Cookie:`lab_account=opaque; lab_session=device; fid=free; customer_session=private; lab_trial_${slug.replaceAll('-','_')}=trial; lab_trial_other=other`}}),env:{FATE_PROXY_SECRET:'proxy',FATE_BACKEND:{fetch:async request=>{incoming=request;return new Response('game')}}}});
  assert.equal(r.status,200);assert.equal(incoming.headers.get('x-fate-proxy-auth'),'proxy');assert.ok(incoming.headers.get('Cookie').includes('lab_account=opaque'));assert.ok(!incoming.headers.get('Cookie').includes('customer_session'));assert.ok(!incoming.headers.get('Cookie').includes('lab_trial_other'));assert.equal(r.headers.get('Vary'),'Cookie');assert.ok(r.headers.get('Cache-Control').includes('no-store'));
 }
});
test('account API proxy preserves private session cookie scope',async()=>{
 let cookie;
 const r=await api({
  request:new Request('https://www.hitopper.top/lab/api/account/verify',{method:'POST',headers:{Origin:'https://www.hitopper.top',Cookie:'lab_account=old; customer_session=unrelated','Content-Type':'application/json'},body:'{}'}),
  env:{FATE_PROXY_SECRET:'proxy',FATE_BACKEND:{fetch:async request=>{
   cookie=request.headers.get('Cookie');
   return Response.json({ok:true},{headers:{'Set-Cookie':'lab_account=new; Path=/lab/; HttpOnly; Secure; SameSite=Lax'}});
  }}}
 });
 assert.equal(r.status,200);assert.equal(cookie,'lab_account=old');assert.ok(r.headers.get('Set-Cookie').includes('Path=/lab/;'));assert.ok(r.headers.get('Set-Cookie').includes('HttpOnly'));
});
