#!/usr/bin/env node
/**
 * IsTheAirSafe — Sitemap Generator
 * Regenerates public/sitemap.xml from src/data/cities.json
 * 
 * Usage:
 *   node scripts/generate-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CITIES_JSON  = path.join(__dirname, '../src/data/cities.json');
const SITEMAP_PATH = path.join(__dirname, '../public/sitemap.xml');
const SITE_URL     = 'https://istheairsafe.com';

const cities = JSON.parse(fs.readFileSync(CITIES_JSON, 'utf8'));
const now    = new Date().toISOString().split('T')[0];

const staticPages = [
  { url: '/',              priority: '1.0', changefreq: 'daily'   },
  { url: '/rankings',      priority: '0.9', changefreq: 'hourly'  },
  { url: '/countries',     priority: '0.8', changefreq: 'weekly'  },
  { url: '/states',        priority: '0.8', changefreq: 'weekly'  },
  { url: '/health-guide',  priority: '0.8', changefreq: 'monthly' },
  { url: '/aqi-explained', priority: '0.8', changefreq: 'monthly' },
  { url: '/about',         priority: '0.6', changefreq: 'monthly' },
];

// Country pages
const countryMap = new Map();
for (const city of cities) {
  if (!countryMap.has(city.countrySlug)) countryMap.set(city.countrySlug, true);
}
const countryPages = [...countryMap.keys()].map(slug => ({
  url: `/countries/${slug}`, priority: '0.7', changefreq: 'daily',
}));

// US state pages
const stateMap = new Map();
for (const city of cities) {
  if (city.countrySlug !== 'us' || !city.state) continue;
  const slug = city.state.toLowerCase().replace(/\s+/g, '-');
  if (!stateMap.has(slug)) stateMap.set(slug, true);
}
const statePages = [...stateMap.keys()].map(slug => ({
  url: `/states/${slug}`, priority: '0.7', changefreq: 'daily',
}));

function urlEntry({ url, priority, changefreq }) {
  return `  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const staticEntries  = staticPages.map(urlEntry).join('\n');
const countryEntries = countryPages.map(urlEntry).join('\n');
const stateEntries   = statePages.map(urlEntry).join('\n');
const cityEntries    = cities.map(c => urlEntry({
  url:        c.url,
  priority:   '0.8',
  changefreq: 'hourly',
})).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${countryEntries}
${stateEntries}
${cityEntries}
</urlset>`;

fs.writeFileSync(SITEMAP_PATH, sitemap);
console.log(`✅ Sitemap written: ${staticPages.length} static + ${countryPages.length} country + ${statePages.length} state + ${cities.length} city = ${staticPages.length + countryPages.length + statePages.length + cities.length} total URLs`);
console.log(`   → ${SITEMAP_PATH}`);
