// functions/api/auth.js
// POST /api/auth  { password: string }  → { token } or 401

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { password } = body ?? {};
  if (!password || typeof password !== 'string') {
    return json({ error: 'Missing password' }, 400);
  }

  const inputHash  = await sha256(password);
  const storedHash = await sha256(env.ADMIN_PASSWORD);
  if (inputHash !== storedHash) {
    return json({ error: 'Invalid password' }, 401);
  }

  const token = await createToken(env.JWT_SECRET);
  return json({ token });
}

async function createToken(secret) {
  const payload = { iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = await hmacSign(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
