export const prerender = false;

import cities from '../../data/cities.json';

const CACHE_TTL = 300; // 5 minutes

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
  const cityDefs = slugs.map(slug => cities.find(c => c.slug === slug)).filter(Boolean);

  // Build a stable cache URL from sorted slugs
  const cacheUrl = `https://istheairsafe.com/api/aqi?slugs=${[...slugs].sort().join(',')}`;
  const cacheRequest = new Request(cacheUrl);
  const cache = caches.default;

  // --- Try Cache API first ---
  const cached = await cache.match(cacheRequest);
  if (cached) {
    // Clone and add HIT header
    const body = await cached.text();
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Cache': 'HIT',
      },
    });
  }

  // --- Cache miss: fetch from WAQI ---
  const results = await fetchFromWaqi(cityDefs, token);
  const body = JSON.stringify(results);

  // Store in Cache API
  const responseToCache = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
  await cache.put(cacheRequest, responseToCache);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      'X-Cache': 'MISS',
    },
  });
}
