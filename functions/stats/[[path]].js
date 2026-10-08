export async function onRequest({ request, env }) {
  if (!env.SITE_STATS) return new Response('Statistics unavailable', { status: 503 });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/stats\/?/, '/');
  if (!['/', '/admin', '/tracker.js', '/collect', '/api/report', '/healthz'].includes(path)) {
    return new Response('Not found', { status: 404 });
  }
  url.pathname = path === '/' ? '/admin' : path;
  return env.SITE_STATS.fetch(new Request(url, request));
}
