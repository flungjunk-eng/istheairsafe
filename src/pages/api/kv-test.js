export const prerender = false;

export async function GET({ locals }) {
  const kv = locals?.runtime?.env?.AQI_CACHE;

  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), { status: 500 });
  }

  const key = 'kv-test';
  const value = `hello-${Date.now()}`;

  // Write
  try {
    await kv.put(key, value, { expirationTtl: 60 });
  } catch(e) {
    return new Response(JSON.stringify({ step: 'write', error: e.message }), { status: 500 });
  }

  // Read back immediately
  let readBack = null;
  try {
    readBack = await kv.get(key);
  } catch(e) {
    return new Response(JSON.stringify({ step: 'read', error: e.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    written: value,
    readBack,
    match: value === readBack,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
