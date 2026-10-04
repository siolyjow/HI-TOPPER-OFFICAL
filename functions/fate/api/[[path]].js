const PUBLIC_ENDPOINTS = new Map([
  ['/activate', 'POST'], ['/auth/challenge', 'POST'], ['/status', 'POST'],
  ['/draw', 'POST'], ['/delivery', 'POST'], ['/health', 'GET'],
]);

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url);
  const path = incoming.pathname.slice('/fate/api'.length);
  const method = PUBLIC_ENDPOINTS.get(path);
  if (!method) return error('not_found', 404);
  if (request.method !== method) return error('method_not_allowed', 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== incoming.origin) return error('origin_not_allowed', 403);
  if (!env.FATE_BACKEND || !env.FATE_PROXY_SECRET) return error('service_unavailable', 503);

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const cookie = (request.headers.get('Cookie') || '').split(';').find(v => /^\s*fid=/.test(v));
  if (cookie) headers.set('Cookie', cookie.trim());
  headers.set('x-fate-proxy-auth', env.FATE_PROXY_SECRET);
  headers.set('x-fate-client-ip', request.headers.get('CF-Connecting-IP') || 'unknown');
  const target = new URL('/api' + path, 'https://fate-backend.internal');
  target.search = incoming.search;
  let upstream;
  try {
    upstream = await env.FATE_BACKEND.fetch(new Request(target, {
      method, headers, body: method === 'GET' ? undefined : request.body, redirect: 'manual', duplex: 'half',
    }));
  } catch {
    return error('upstream_unavailable', 502);
  }
  const responseHeaders = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  });
  const setCookie = upstream.headers.get('Set-Cookie');
  if (setCookie) responseHeaders.set('Set-Cookie', setCookie.replace(/Path=\/(?:;|$)/i, 'Path=/fate/;'));
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function error(code, status) {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
