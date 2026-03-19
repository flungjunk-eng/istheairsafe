export const prerender = false;

import cities from '../../data/cities.json';

const KV_TTL = 15 * 60; // 15 minutes

async function fetchFromWaqi(cityDefs, token) {
  const BATCH = 10;
  const DELAY = 250;
  const results = {};

  for (let i = 0; i < cityDefs.length; i += BATCH) {
    const batch = cityDefs.slice(i, i + BATCH);
    const fetched = await Promise.all(batch.map(async city => {
      const id = city.waqiId;
      const encodedId = id.startsWith('@') ? id : encodeURIComponent(id);
      try {
        const res = await fetch(`https://api.waqi.info/feed/${encodedId}/?token=${token}`, {
          signal: AbortSignal.timeout(7000),
        });
        const data = await res.json();
        if (data.status !== 'ok') return { slug: city.slug, aqi: null };
        return { slug: city.slug, aqi: data.data?.aqi ?? null };
      } catch {
        return { slug: city.slug, aqi: null };
      }
    }));
    for (const r of fetched) results[r.slug] = r.aqi;
    if (i + BATCH < cityDefs.length) await new Promise(r => setTimeout(r, DELAY));
  }

  return results;
}

export async function GET({ request, locals }) {
  const url = new URL(request.url);
  const slugsParam = url.searchParams.get('slugs') || '';
  const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 60);

  if (!slugs.length) {
    return new Response(JSON.stringify({ error: 'No slugs provided' }), { status: 400 });
  }

  const token = locals?.runtime?.env?.WAQI_TOKEN || import.meta.env.WAQI_TOKEN || 'demo';
  const kv = locals?.runtime?.env?.AQI_CACHE;
  const cityDefs = slugs.map(slug => cities.find(c => c.slug === slug)).filter(Boolean);

  // Build a short stable cache key
  const slugKey = [...slugs].sort().join(',');
  const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(slugKey));
  const cacheKey = `aqi:${[...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16)}`;

  // --- Try KV cache ---
  if (kv) {
    try {
      const raw = await kv.get(cacheKey);
      if (raw) {
        return new Response(raw, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch(e) {
      console.error('[KV] Read error:', e.message);
    }

    // Miss — fetch from WAQI then write to KV
    const results = await fetchFromWaqi(cityDefs, token);
    const body = JSON.stringify(results);

    try {
      await kv.put(cacheKey, body, { expirationTtl: KV_TTL });
    } catch(e) {
      console.error('[KV] Write error:', e.message);
    }

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS',
      },
    });
  }

  // --- No KV — fetch directly ---
  const results = await fetchFromWaqi(cityDefs, token);
  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'BYPASS',
    },
  });
}
