const PUBLIC = new Map([
  ['/activate','POST'], ['/auth/challenge','POST'], ['/status','POST'],
  ['/draw','POST'], ['/delivery','POST'], ['/lab/session','POST'], ['/health','GET']
]);
export async function onRequest({request,env}) {
  const incoming=new URL(request.url);
  const path=incoming.pathname.slice('/lab/api'.length);
  const method=PUBLIC.get(path);
  if (!method) return error('not_found',404);
  if (request.method!==method) return error('method_not_allowed',405);
  if (request.headers.get('Origin') && request.headers.get('Origin')!==incoming.origin) return error('origin_not_allowed',403);
  if (!env.FATE_BACKEND||!env.FATE_PROXY_SECRET) return error('service_unavailable',503);
  const headers=new Headers({'Content-Type':'application/json','x-fate-proxy-auth':env.FATE_PROXY_SECRET});
  headers.set('x-fate-client-ip',request.headers.get('CF-Connecting-IP')||'unknown');
  const url=new URL('/api'+path,'https://fate-backend.internal');url.search=incoming.search;
  try {
    const upstream=await env.FATE_BACKEND.fetch(new Request(url,{
      method,headers,body:method==='GET'?undefined:request.body,redirect:'manual',duplex:'half'
    }));
    const responseHeaders=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    const cookie=upstream.headers.get('Set-Cookie');
    if (cookie && /^lab_session=/.test(cookie)) responseHeaders.set('Set-Cookie',cookie);
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }catch{return error('upstream_unavailable',502)}
}
function error(error,status){return Response.json({error},{status,headers:{'Cache-Control':'no-store'}})}
