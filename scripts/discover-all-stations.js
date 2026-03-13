#!/usr/bin/env node
/**
 * IsTheAirSafe — Geographic Station Discovery
 * 
 * Queries the WAQI map API using geographic bounding boxes to find every
 * monitored station on earth, then merges valid city-level entries into
 * src/data/cities.json.
 * 
 * The WAQI map API returns all stations within a lat/lon bounding box.
 * We tile the world into overlapping grid cells and sweep each one.
 * 
 * Usage:
 *   node scripts/discover-all-stations.js                    # full world sweep
 *   node scripts/discover-all-stations.js --region asia
 *   node scripts/discover-all-stations.js --region europe
 *   node scripts/discover-all-stations.js --region americas
 *   node scripts/discover-all-stations.js --region africa
 *   node scripts/discover-all-stations.js --region oceania
 *   node scripts/discover-all-stations.js --dry-run          # preview only
 *   node scripts/discover-all-stations.js --min-aqi 0        # include all stations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CITIES_JSON  = path.join(__dirname, '../src/data/cities.json');
const CACHE_FILE   = path.join(__dirname, '../scripts/.station-cache.json');

const TOKEN    = process.env.WAQI_TOKEN || '6b97c65aea3005ad7c1d7bc0f0dcac33aab2c0e4';
const DRY_RUN  = process.argv.includes('--dry-run');
const _regionIdx = process.argv.indexOf('--region');
const REGION   = process.argv.find(a => a.startsWith('--region='))?.split('=')[1]
              || (_regionIdx !== -1 ? process.argv[_regionIdx + 1] : undefined);
const DELAY_MS = 250;

// ── Region bounding boxes ─────────────────────────────────────────────────────
// Format: [latMin, lonMin, latMax, lonMax]
const REGIONS = {
  europe:   { bounds: [35, -25, 72, 45],   label: 'Europe' },
  asia:     { bounds: [5, 60, 55, 145],    label: 'Asia' },
  seasia:   { bounds: [-10, 95, 28, 142],  label: 'Southeast Asia' },
  mideast:  { bounds: [15, 32, 42, 63],    label: 'Middle East' },
  americas: { bounds: [-55, -125, 55, -35], label: 'Americas' },
  namerica: { bounds: [25, -125, 55, -60], label: 'North America' },
  samerica: { bounds: [-55, -82, 12, -35], label: 'South America' },
  africa:   { bounds: [-35, -20, 38, 52],  label: 'Africa' },
  oceania:  { bounds: [-47, 110, -10, 180], label: 'Oceania' },
  russia:   { bounds: [50, 30, 72, 140],   label: 'Russia' },
  world:    { bounds: [-60, -180, 75, 180], label: 'World' },
};

// Tile size in degrees — smaller = more API calls but fewer missed stations
const TILE_SIZE = 8;

// ── Country data ──────────────────────────────────────────────────────────────
// Maps country names from WAQI to ISO slugs
const COUNTRY_SLUG_MAP = {
  'USA': 'us', 'United States': 'us', 'US': 'us',
  'China': 'cn', "People's Republic of China": 'cn',
  'India': 'in', 'Japan': 'jp', 'South Korea': 'kr', 'Korea': 'kr',
  'Germany': 'de', 'France': 'fr', 'United Kingdom': 'uk', 'UK': 'uk',
  'Italy': 'it', 'Spain': 'es', 'Poland': 'pl', 'Netherlands': 'nl',
  'Belgium': 'be', 'Sweden': 'se', 'Norway': 'no', 'Denmark': 'dk',
  'Finland': 'fi', 'Switzerland': 'ch', 'Austria': 'at', 'Portugal': 'pt',
  'Czech Republic': 'cz', 'Czechia': 'cz', 'Romania': 'ro', 'Hungary': 'hu',
  'Greece': 'gr', 'Bulgaria': 'bg', 'Croatia': 'hr', 'Slovakia': 'sk',
  'Ireland': 'ie', 'Luxembourg': 'lu', 'Slovenia': 'si', 'Estonia': 'ee',
  'Latvia': 'lv', 'Lithuania': 'lt', 'Serbia': 'rs', 'Ukraine': 'ua',
  'Russia': 'ru', 'Turkey': 'tr', 'Israel': 'il', 'Iran': 'ir',
  'Saudi Arabia': 'sa', 'UAE': 'ae', 'United Arab Emirates': 'ae',
  'Kuwait': 'kw', 'Qatar': 'qa', 'Bahrain': 'bh', 'Oman': 'om',
  'Jordan': 'jo', 'Lebanon': 'lb', 'Iraq': 'iq', 'Egypt': 'eg',
  'Pakistan': 'pk', 'Bangladesh': 'bd', 'Sri Lanka': 'lk',
  'Nepal': 'np', 'Myanmar': 'mm', 'Thailand': 'th', 'Vietnam': 'vn',
  'Malaysia': 'my', 'Indonesia': 'id', 'Philippines': 'ph',
  'Singapore': 'sg', 'Cambodia': 'kh', 'Laos': 'la',
  'Australia': 'au', 'New Zealand': 'nz',
  'Canada': 'ca', 'Mexico': 'mx', 'Brazil': 'br', 'Argentina': 'ar',
  'Colombia': 'co', 'Chile': 'cl', 'Peru': 'pe', 'Venezuela': 've',
  'Ecuador': 'ec', 'Bolivia': 'bo', 'Uruguay': 'uy', 'Paraguay': 'py',
  'Nigeria': 'ng', 'South Africa': 'za', 'Kenya': 'ke', 'Ethiopia': 'et',
  'Ghana': 'gh', 'Tanzania': 'tz', 'Morocco': 'ma', 'Algeria': 'dz',
  'Tunisia': 'tn', 'Libya': 'ly', 'Senegal': 'sn', 'Uganda': 'ug',
  'Zimbabwe': 'zw', 'Zambia': 'zm', 'Rwanda': 'rw', 'Cameroon': 'cm',
  'Kazakhstan': 'kz', 'Uzbekistan': 'uz', 'Kyrgyzstan': 'kg',
  'Mongolia': 'mn', 'Georgia': 'ge', 'Armenia': 'am', 'Azerbaijan': 'az',
  'North Macedonia': 'mk', 'Albania': 'al', 'Bosnia': 'ba',
  'Kosovo': 'xk', 'Montenegro': 'me', 'Moldova': 'md',
  'Cuba': 'cu', 'Dominican Republic': 'do', 'Haiti': 'ht',
  'Jamaica': 'jm', 'Costa Rica': 'cr', 'Panama': 'pa',
  'Guatemala': 'gt', 'Honduras': 'hn', 'El Salvador': 'sv', 'Nicaragua': 'ni',
  'Puerto Rico': 'us',
  'Hong Kong': 'hk', 'Macau': 'mo', 'Taiwan': 'tw',
  'Kosovo': 'xk',
};

function getCountrySlug(countryName) {
  if (!countryName) return 'xx';
  return COUNTRY_SLUG_MAP[countryName] || countryName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSlug(str) {
  if (!str) return 'unknown';
  return str
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõöø]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
    .replace(/[ß]/g, 'ss').replace(/[ğ]/g, 'g').replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i').replace(/[ě]/g, 'e').replace(/[ř]/g, 'r')
    .replace(/[ž]/g, 'z').replace(/[š]/g, 's').replace(/[č]/g, 'c')
    .replace(/[ý]/g, 'y').replace(/[ů]/g, 'u').replace(/[ő]/g, 'o')
    .replace(/[ő]/g, 'o').replace(/[ä]/g, 'ae').replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue').replace(/[ą]/g, 'a').replace(/[ę]/g, 'e')
    .replace(/[ś]/g, 's').replace(/[ź]/g, 'z').replace(/[ń]/g, 'n')
    .replace(/[ó]/g, 'o').replace(/[ł]/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Generate grid tiles for a bounding box
function generateTiles(latMin, lonMin, latMax, lonMax, tileSize = TILE_SIZE) {
  const tiles = [];
  for (let lat = latMin; lat < latMax; lat += tileSize) {
    for (let lon = lonMin; lon < lonMax; lon += tileSize) {
      tiles.push({
        lat1: lat,
        lon1: lon,
        lat2: Math.min(lat + tileSize, latMax),
        lon2: Math.min(lon + tileSize, lonMax),
      });
    }
  }
  return tiles;
}

// ── WAQI map API ──────────────────────────────────────────────────────────────
async function fetchStationsInBounds(lat1, lon1, lat2, lon2) {
  const url = `https://api.waqi.info/map/bounds/?token=${TOKEN}&latlng=${lat1},${lon1},${lat2},${lon2}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') return [];
    return data.data || [];
  } catch (err) {
    console.error(`  ✗ Bounds fetch failed (${lat1},${lon1},${lat2},${lon2}): ${err.message}`);
    return [];
  }
}

// Get full station detail (city name, country, etc.)
async function fetchStationDetail(uid) {
  const url = `https://api.waqi.info/feed/@${uid}/?token=${TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'ok') return null;
    return data.data;
  } catch {
    return null;
  }
}

// ── Parse station into city entry ─────────────────────────────────────────────
function parseStationName(stationName) {
  // WAQI station names are often like "City, State" or "City, Country"
  // or "Station Name - City" or just "City"
  if (!stationName) return { city: 'Unknown', state: '' };

  // Remove common suffixes
  let name = stationName
    .replace(/\s*-\s*(US Embassy|Embassy|Consulate|Airport|Station|Monitor|AQI|CPCB|CAAQMS|IMD)\b.*/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim();

  // Split on comma to get city/state
  const parts = name.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] };
  }
  return { city: parts[0], state: '' };
}

function buildEntry(station, detail) {
  const stationName = detail?.city?.name || station.station?.name || '';
  const { city, state } = parseStationName(stationName);

  // Try to get country from detail
  const geo = detail?.city?.geo || station.station?.geo || [];
  const lat = geo[0] || null;
  const lon = geo[1] || null;

  // Country from station URL or name
  const url = detail?.city?.url || '';
  let country = '';
  let countrySlug = 'xx';

  // Try to extract country from WAQI city URL (e.g. "china/beijing")
  const urlParts = url.replace('https://aqicn.org/city/', '').split('/');
  if (urlParts.length >= 2) {
    const possibleCountry = urlParts[0];
    // Map common WAQI country slugs
    const slugToCountry = {
      'china': 'China', 'india': 'India', 'usa': 'United States',
      'germany': 'Germany', 'france': 'France', 'uk': 'United Kingdom',
      'japan': 'Japan', 'korea': 'South Korea', 'australia': 'Australia',
      'canada': 'Canada', 'brazil': 'Brazil', 'russia': 'Russia',
      'spain': 'Spain', 'italy': 'Italy', 'poland': 'Poland',
      'netherlands': 'Netherlands', 'turkey': 'Turkey', 'mexico': 'Mexico',
      'thailand': 'Thailand', 'vietnam': 'Vietnam', 'indonesia': 'Indonesia',
      'pakistan': 'Pakistan', 'bangladesh': 'Bangladesh', 'egypt': 'Egypt',
      'iran': 'Iran', 'saudi-arabia': 'Saudi Arabia', 'uae': 'UAE',
      'south-africa': 'South Africa', 'nigeria': 'Nigeria', 'kenya': 'Kenya',
      'malaysia': 'Malaysia', 'singapore': 'Singapore', 'philippines': 'Philippines',
      'taiwan': 'Taiwan', 'hong-kong': 'Hong Kong',
    };
    country = slugToCountry[possibleCountry] || possibleCountry;
    countrySlug = getCountrySlug(country) || possibleCountry.replace(/-/g, '').slice(0, 3);
  }

  const citySlug = toSlug(city);
  const slug = state ? `${citySlug}-${countrySlug}` : citySlug;

  return {
    name:        city,
    slug:        slug,
    state:       state || '',
    country:     country,
    countrySlug: countrySlug,
    waqiId:      `@${station.uid}`,
    url:         `/air-quality/${countrySlug}/${slug}`,
    lat,
    lon,
  };
}

// ── Main sweep ────────────────────────────────────────────────────────────────
async function sweep(regionKey) {
  const regionDef = REGIONS[regionKey] || REGIONS.world;
  const [latMin, lonMin, latMax, lonMax] = regionDef.bounds;

  console.log(`\n🌍 Sweeping: ${regionDef.label}`);
  console.log(`   Bounds: ${latMin},${lonMin} → ${latMax},${lonMax}`);

  const tiles = generateTiles(latMin, lonMin, latMax, lonMax);
  console.log(`   Tiles: ${tiles.length}\n`);

  const allStations = new Map(); // uid → station

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    process.stdout.write(`  [${i + 1}/${tiles.length}] (${tile.lat1},${tile.lon1})→(${tile.lat2},${tile.lon2}) `);

    const stations = await fetchStationsInBounds(tile.lat1, tile.lon1, tile.lat2, tile.lon2);
    let newCount = 0;
    for (const s of stations) {
      if (!allStations.has(s.uid)) {
        allStations.set(s.uid, s);
        newCount++;
      }
    }
    process.stdout.write(`→ ${stations.length} stations (${newCount} new)\n`);
    await sleep(DELAY_MS);
  }

  console.log(`\n📡 Total unique stations found: ${allStations.size}`);
  return allStations;
}

// ── Filter & enrich stations ──────────────────────────────────────────────────
async function enrichStations(stations, existingUids) {
  const entries = [];
  const skipped = [];
  const failed  = [];

  const stationList = [...stations.values()].filter(s => {
    // Skip stations with no AQI
    if (s.aqi === '-' || s.aqi === null || s.aqi === undefined) return false;
    // Skip already known stations
    if (existingUids.has(`@${s.uid}`)) return false;
    return true;
  });

  console.log(`\n🔍 Enriching ${stationList.length} new stations (fetching city/country details)...`);
  console.log(`   This will take ~${Math.ceil(stationList.length * DELAY_MS / 60000)} minutes\n`);

  for (let i = 0; i < stationList.length; i++) {
    const station = stationList[i];

    if (i % 50 === 0) {
      console.log(`  [${i}/${stationList.length}] Processing...`);
    }

    const detail = await fetchStationDetail(station.uid);
    if (!detail) {
      failed.push(station.uid);
      await sleep(DELAY_MS);
      continue;
    }

    const entry = buildEntry(station, detail);

    // Skip entries with no useful city name
    if (!entry.name || entry.name === 'Unknown' || entry.name.length < 2) {
      skipped.push(station.uid);
      await sleep(DELAY_MS);
      continue;
    }

    entries.push(entry);
    await sleep(DELAY_MS);
  }

  return { entries, skipped, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌬  IsTheAirSafe — Geographic Station Discovery`);
  console.log(`   Token:    ${TOKEN.slice(0, 8)}...`);
  console.log(`   Dry run:  ${DRY_RUN}`);
  console.log(`   Region:   ${REGION || 'world (full sweep)'}\n`);

  // Load existing
  const existing = JSON.parse(fs.readFileSync(CITIES_JSON, 'utf8'));
  const existingUids = new Set(existing.map(c => c.waqiId));
  console.log(`📦 Existing cities: ${existing.length}`);

  // Determine which regions to sweep
  let regionsToSweep;
  if (REGION && REGION !== 'world') {
    if (!REGIONS[REGION]) {
      console.error(`Unknown region: ${REGION}`);
      console.log(`Available: ${Object.keys(REGIONS).join(', ')}`);
      process.exit(1);
    }
    regionsToSweep = [REGION];
  } else {
    // Full world — sweep major regions separately for better coverage
    regionsToSweep = ['namerica', 'samerica', 'europe', 'africa', 'mideast', 'russia', 'asia', 'seasia', 'oceania'];
  }

  // Sweep all regions
  const allStations = new Map();
  for (const r of regionsToSweep) {
    const stations = await sweep(r);
    for (const [uid, s] of stations) {
      allStations.set(uid, s);
    }
    // Pause between regions
    if (regionsToSweep.indexOf(r) < regionsToSweep.length - 1) {
      console.log('\n  Pausing 2s between regions...');
      await sleep(2000);
    }
  }

  console.log(`\n📊 Total unique stations across all regions: ${allStations.size}`);
  console.log(`   Already in cities.json: ${existingUids.size}`);
  const newCount = [...allStations.values()].filter(s => !existingUids.has(`@${s.uid}`) && s.aqi !== '-').length;
  console.log(`   New stations to process: ${newCount}`);

  if (newCount === 0) {
    console.log('\n✅ No new stations found. cities.json is up to date.');
    return;
  }

  // Enrich with city/country details
  const { entries, skipped, failed } = await enrichStations(allStations, existingUids);

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ New city entries:  ${entries.length}`);
  console.log(`⏭️  Skipped (no name): ${skipped.length}`);
  console.log(`❌ Failed (API error): ${failed.length}`);

  if (DRY_RUN) {
    console.log('\n🔍 Dry run — no files written.');
    console.log('\nSample of what would be added:');
    entries.slice(0, 20).forEach(e => console.log(`  ${e.name}, ${e.country} → ${e.waqiId}`));
    if (entries.length > 20) console.log(`  ... and ${entries.length - 20} more`);
    return;
  }

  // Deduplicate by waqiId and slug before writing
  const existingSlugs  = new Set(existing.map(c => c.slug));
  const existingWaqiIds = new Set(existing.map(c => c.waqiId));

  const uniqueNew = entries.filter(e =>
    !existingWaqiIds.has(e.waqiId) && !existingSlugs.has(e.slug)
  );

  // Remove lat/lon from final output (not needed in cities.json)
  const clean = uniqueNew.map(({ lat, lon, ...rest }) => rest);

  const merged = [...existing, ...clean];
  fs.writeFileSync(CITIES_JSON, JSON.stringify(merged, null, 2));

  console.log(`\n✨ Written ${merged.length} total cities (+${clean.length} new)`);
  console.log(`\n⚠️  Run next:`);
  console.log(`   node scripts/generate-sitemap.js`);
  console.log(`   git add src/data/cities.json public/sitemap.xml`);
  console.log(`   git commit -m "feat: add ${clean.length} cities from station sweep"`);
  console.log(`   git push\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
