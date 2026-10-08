const GAMES=new Set(['fate','chikoku','kacho','ni-gyu','destroyer']);
export async function onRequest({request,env}) {
  const incoming=new URL(request.url);
  if (!['GET','HEAD'].includes(request.method)) return deny('method_not_allowed',405);
  if (!env.FATE_BACKEND||!env.FATE_PROXY_SECRET) return deny('service_unavailable',503);
  const match=/^\/lab\/([a-z-]+)\/runtime\/(.*)$/.exec(incoming.pathname);
  if(!match || !GAMES.has(match[1])) return deny('not_found',404);
  const resource=match[2]||'index.html';
  // Reject encodings, dotfiles and traversals. Query strings are not used as auth.
  if(resource.length>240 || resource.includes('..') || resource.includes('\\') || /%2e|%2f|%5c/i.test(incoming.pathname) || resource.split('/').some(p=>!p||p.startsWith('.')))return deny('not_found',404);
  const target=new URL('/api/lab/assets/'+match[1]+'/'+resource,'https://fate-backend.internal');
  const headers=new Headers({'x-fate-proxy-auth':env.FATE_PROXY_SECRET});
  const trialCookie=match[1].replace(/-/g,'_');
  const cookie=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>{const name=v.slice(0,v.indexOf('='));return name==='fid'||name==='lab_session'||name===`lab_trial_${trialCookie}`}).join('; ');
  if(cookie) headers.set('Cookie',cookie);
  try {
    const response=await env.FATE_BACKEND.fetch(new Request(target,{method:request.method,headers,redirect:'manual'}));
    const h=new Headers(response.headers);
    h.set('Cache-Control','private, no-store, max-age=0');h.set('Vary','Cookie');h.set('X-Robots-Tag','noindex, noarchive');h.set('X-Content-Type-Options','nosniff');h.delete('ETag');h.delete('Last-Modified');
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:h});
  }catch{return deny('upstream_unavailable',502)}
}
function deny(error,status){return Response.json({error},{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})}
