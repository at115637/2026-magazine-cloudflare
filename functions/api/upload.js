// functions/api/upload.js
// POST /api/upload  (multipart/form-data, field: image — WebP from client)
// Stores one image in R2, returns its r2_key. Protected.

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try { formData = await request.formData(); }
  catch { return json({ error: 'Invalid form data' }, 400); }

  const imageFile = formData.get('image');
  if (!imageFile || typeof imageFile === 'string') {
    return json({ error: 'No image provided' }, 400);
  }

  const buffer = await imageFile.arrayBuffer();
  if (buffer.byteLength === 0) return json({ error: 'Image is empty' }, 400);

  const r2Key = `images/mag-${crypto.randomUUID()}.webp`;

  try {
    await env.BUCKET.put(r2Key, buffer, {
      httpMetadata: { contentType: 'image/webp' }
    });
    return json({ success: true, r2_key: r2Key });
  } catch (err) {
    console.error('Upload error:', err);
    return json({ error: 'Upload failed' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
