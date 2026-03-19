export const prerender = false;

import cities from '../../data/cities.json';

const KV_TTL = 5 * 60; // 5 minutes in seconds

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
  const kv = locals?.runtime?.env?.AQI_CACHE; // KV namespace binding

  const cityDefs = slugs.map(slug => cities.find(c => c.slug === slug)).filter(Boolean);

  // --- Try KV cache first ---
  if (kv) {
    // Each unique sorted slug set gets its own cache key
    const cacheKey = `aqi:${[...slugs].sort().join(',')}`;

    try {
      const cached = await kv.get(cacheKey, { type: 'json' });
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch (e) {
      // KV read failed — fall through to live fetch
      console.error('[KV] Read error:', e.message);
    }

    // Cache miss — fetch from WAQI
    const results = await fetchFromWaqi(cityDefs, token);

    // Write to KV in the background (don't await — keeps response fast)
    const cacheKeyToWrite = `aqi:${[...slugs].sort().join(',')}`;
    kv.put(cacheKeyToWrite, JSON.stringify(results), { expirationTtl: KV_TTL }).catch(e => {
      console.error('[KV] Write error:', e.message);
    });

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS',
      },
    });
  }

  // --- No KV available — fetch directly (fallback) ---
  const results = await fetchFromWaqi(cityDefs, token);

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'BYPASS',
    },
  });
}
