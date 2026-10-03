// functions/img/[[path]].js
// GET /img/images/{id}.webp — proxies image files from R2 with long cache

export async function onRequestGet(context) {
  const { env, params } = context;
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status: 404 });

  try {
    const object = await env.BUCKET.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/webp');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.etag ?? '');
    return new Response(object.body, { headers });
  } catch (err) {
    console.error('Image serve error:', err);
    return new Response('Error', { status: 500 });
  }
}
