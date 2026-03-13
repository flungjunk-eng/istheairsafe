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
  { url: '/',              priority: '1.0', changefreq: 'daily'  },
  { url: '/rankings',      priority: '0.9', changefreq: 'hourly' },
  { url: '/health-guide',  priority: '0.8', changefreq: 'monthly' },
  { url: '/aqi-explained', priority: '0.8', changefreq: 'monthly' },
  { url: '/about',         priority: '0.6', changefreq: 'monthly' },
];

function urlEntry({ url, priority, changefreq }) {
  return `  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const staticEntries = staticPages.map(urlEntry).join('\n');
const cityEntries   = cities.map(c => urlEntry({
  url:        c.url,
  priority:   '0.8',
  changefreq: 'hourly',
})).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${cityEntries}
</urlset>`;

fs.writeFileSync(SITEMAP_PATH, sitemap);
console.log(`✅ Sitemap written: ${staticPages.length} static + ${cities.length} city URLs = ${staticPages.length + cities.length} total`);
console.log(`   → ${SITEMAP_PATH}`);
