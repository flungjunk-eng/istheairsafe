#!/usr/bin/env node
/**
 * IsTheAirSafe — City Discovery Script
 * 
 * Queries the WAQI search API to discover and validate stations for a list
 * of cities, then merges valid results into src/data/cities.json.
 * 
 * Usage:
 *   node scripts/discover-cities.js
 *   node scripts/discover-cities.js --dry-run       # preview without writing
 *   node scripts/discover-cities.js --only-new      # skip cities already in JSON
 *   node scripts/discover-cities.js --concurrency 5 # parallel requests (default: 3)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CITIES_JSON = path.join(__dirname, '../src/data/cities.json');

// ── Config ────────────────────────────────────────────────────────────────────
const TOKEN       = process.env.WAQI_TOKEN || '6b97c65aea3005ad7c1d7bc0f0dcac33aab2c0e4';
const DRY_RUN     = process.argv.includes('--dry-run');
const ONLY_NEW    = process.argv.includes('--only-new');
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3');
const DELAY_MS    = 350; // be polite to the API

// ── City seed list ────────────────────────────────────────────────────────────
// Add any city you want to discover here.
// Format: { name, state?, country, countrySlug }
// countrySlug should be the 2-letter ISO code in lowercase.
const CITIES_TO_DISCOVER = [
  // ── USA ──────────────────────────────────────────────────────────────────
  { name: 'Spokane',          state: 'Washington',       country: 'United States', countrySlug: 'us' },
  { name: 'Boise',            state: 'Idaho',            country: 'United States', countrySlug: 'us' },
  { name: 'Richmond',         state: 'Virginia',         country: 'United States', countrySlug: 'us' },
  { name: 'Birmingham',       state: 'Alabama',          country: 'United States', countrySlug: 'us' },
  { name: 'St. Louis',        state: 'Missouri',         country: 'United States', countrySlug: 'us' },
  { name: 'Cincinnati',       state: 'Ohio',             country: 'United States', countrySlug: 'us' },
  { name: 'Hartford',         state: 'Connecticut',      country: 'United States', countrySlug: 'us' },
  { name: 'Providence',       state: 'Rhode Island',     country: 'United States', countrySlug: 'us' },
  { name: 'Baton Rouge',      state: 'Louisiana',        country: 'United States', countrySlug: 'us' },
  { name: 'Des Moines',       state: 'Iowa',             country: 'United States', countrySlug: 'us' },
  { name: 'Fargo',            state: 'North Dakota',     country: 'United States', countrySlug: 'us' },
  { name: 'Sioux Falls',      state: 'South Dakota',     country: 'United States', countrySlug: 'us' },
  { name: 'Anchorage',        state: 'Alaska',           country: 'United States', countrySlug: 'us' },
  { name: 'Lubbock',          state: 'Texas',            country: 'United States', countrySlug: 'us' },
  { name: 'Knoxville',        state: 'Tennessee',        country: 'United States', countrySlug: 'us' },
  { name: 'Chattanooga',      state: 'Tennessee',        country: 'United States', countrySlug: 'us' },
  { name: 'Jackson',          state: 'Mississippi',      country: 'United States', countrySlug: 'us' },
  { name: 'Little Rock',      state: 'Arkansas',         country: 'United States', countrySlug: 'us' },
  { name: 'Wichita',          state: 'Kansas',           country: 'United States', countrySlug: 'us' },
  { name: 'Madison',          state: 'Wisconsin',        country: 'United States', countrySlug: 'us' },
  { name: 'Grand Rapids',     state: 'Michigan',         country: 'United States', countrySlug: 'us' },
  { name: 'Akron',            state: 'Ohio',             country: 'United States', countrySlug: 'us' },
  { name: 'Lexington',        state: 'Kentucky',         country: 'United States', countrySlug: 'us' },
  { name: 'Greensboro',       state: 'North Carolina',   country: 'United States', countrySlug: 'us' },
  { name: 'Durham',           state: 'North Carolina',   country: 'United States', countrySlug: 'us' },
  { name: 'Norfolk',          state: 'Virginia',         country: 'United States', countrySlug: 'us' },
  { name: 'Stockton',         state: 'California',       country: 'United States', countrySlug: 'us' },
  { name: 'Riverside',        state: 'California',       country: 'United States', countrySlug: 'us' },
  { name: 'Santa Ana',        state: 'California',       country: 'United States', countrySlug: 'us' },
  { name: 'Anaheim',          state: 'California',       country: 'United States', countrySlug: 'us' },
  { name: 'Chula Vista',      state: 'California',       country: 'United States', countrySlug: 'us' },
  { name: 'Chandler',         state: 'Arizona',          country: 'United States', countrySlug: 'us' },
  { name: 'Scottsdale',       state: 'Arizona',          country: 'United States', countrySlug: 'us' },
  { name: 'Tempe',            state: 'Arizona',          country: 'United States', countrySlug: 'us' },
  { name: 'Gilbert',          state: 'Arizona',          country: 'United States', countrySlug: 'us' },
  { name: 'Henderson',        state: 'Nevada',           country: 'United States', countrySlug: 'us' },
  { name: 'Reno',             state: 'Nevada',           country: 'United States', countrySlug: 'us' },
  { name: 'St. Paul',         state: 'Minnesota',        country: 'United States', countrySlug: 'us' },
  { name: 'Orlando',          state: 'Florida',          country: 'United States', countrySlug: 'us' },
  { name: 'Fort Lauderdale',  state: 'Florida',          country: 'United States', countrySlug: 'us' },
  { name: 'St. Petersburg',   state: 'Florida',          country: 'United States', countrySlug: 'us' },
  { name: 'Tallahassee',      state: 'Florida',          country: 'United States', countrySlug: 'us' },
  { name: 'Cape Coral',       state: 'Florida',          country: 'United States', countrySlug: 'us' },
  { name: 'North Las Vegas',  state: 'Nevada',           country: 'United States', countrySlug: 'us' },
  { name: 'Laredo',           state: 'Texas',            country: 'United States', countrySlug: 'us' },
  { name: 'Corpus Christi',   state: 'Texas',            country: 'United States', countrySlug: 'us' },
  { name: 'Garland',          state: 'Texas',            country: 'United States', countrySlug: 'us' },
  { name: 'Plano',            state: 'Texas',            country: 'United States', countrySlug: 'us' },
  { name: 'Irvine',           state: 'California',       country: 'United States', countrySlug: 'us' },

  // ── Canada ───────────────────────────────────────────────────────────────
  { name: 'Quebec City',      state: 'Quebec',           country: 'Canada', countrySlug: 'ca' },
  { name: 'Winnipeg',         state: 'Manitoba',         country: 'Canada', countrySlug: 'ca' },
  { name: 'Hamilton',         state: 'Ontario',          country: 'Canada', countrySlug: 'ca' },
  { name: 'Kitchener',        state: 'Ontario',          country: 'Canada', countrySlug: 'ca' },
  { name: 'London Ontario',   state: 'Ontario',          country: 'Canada', countrySlug: 'ca' },
  { name: 'Halifax',          state: 'Nova Scotia',      country: 'Canada', countrySlug: 'ca' },
  { name: 'Victoria',         state: 'British Columbia', country: 'Canada', countrySlug: 'ca' },
  { name: 'Saskatoon',        state: 'Saskatchewan',     country: 'Canada', countrySlug: 'ca' },
  { name: 'Regina',           state: 'Saskatchewan',     country: 'Canada', countrySlug: 'ca' },

  // ── UK & Ireland ─────────────────────────────────────────────────────────
  { name: 'Leeds',            state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Sheffield',        state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Liverpool',        state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Bristol',          state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Cardiff',          state: 'Wales',            country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Belfast',          state: 'Northern Ireland', country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Nottingham',       state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Leicester',        state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Newcastle',        state: 'England',          country: 'United Kingdom', countrySlug: 'uk' },
  { name: 'Cork',             state: 'Munster',          country: 'Ireland',        countrySlug: 'ie' },

  // ── Europe ───────────────────────────────────────────────────────────────
  { name: 'Toulouse',         state: 'Occitanie',        country: 'France',       countrySlug: 'fr' },
  { name: 'Bordeaux',         state: 'Nouvelle-Aquitaine', country: 'France',     countrySlug: 'fr' },
  { name: 'Nice',             state: 'PACA',             country: 'France',       countrySlug: 'fr' },
  { name: 'Nantes',           state: 'Pays de la Loire', country: 'France',       countrySlug: 'fr' },
  { name: 'Strasbourg',       state: 'Grand Est',        country: 'France',       countrySlug: 'fr' },
  { name: 'Cologne',          state: 'North Rhine-Westphalia', country: 'Germany', countrySlug: 'de' },
  { name: 'Stuttgart',        state: 'Baden-Württemberg', country: 'Germany',     countrySlug: 'de' },
  { name: 'Düsseldorf',       state: 'North Rhine-Westphalia', country: 'Germany', countrySlug: 'de' },
  { name: 'Dortmund',         state: 'North Rhine-Westphalia', country: 'Germany', countrySlug: 'de' },
  { name: 'Leipzig',          state: 'Saxony',           country: 'Germany',      countrySlug: 'de' },
  { name: 'Dresden',          state: 'Saxony',           country: 'Germany',      countrySlug: 'de' },
  { name: 'Valencia',         state: 'Valencian Community', country: 'Spain',     countrySlug: 'es' },
  { name: 'Bilbao',           state: 'Basque Country',   country: 'Spain',        countrySlug: 'es' },
  { name: 'Zaragoza',         state: 'Aragon',           country: 'Spain',        countrySlug: 'es' },
  { name: 'Malaga',           state: 'Andalusia',        country: 'Spain',        countrySlug: 'es' },
  { name: 'Turin',            state: 'Piedmont',         country: 'Italy',        countrySlug: 'it' },
  { name: 'Palermo',          state: 'Sicily',           country: 'Italy',        countrySlug: 'it' },
  { name: 'Florence',         state: 'Tuscany',          country: 'Italy',        countrySlug: 'it' },
  { name: 'Venice',           state: 'Veneto',           country: 'Italy',        countrySlug: 'it' },
  { name: 'Bologna',          state: 'Emilia-Romagna',   country: 'Italy',        countrySlug: 'it' },
  { name: 'Gothenburg',       state: 'Västra Götaland',  country: 'Sweden',       countrySlug: 'se' },
  { name: 'Malmo',            state: 'Skåne',            country: 'Sweden',       countrySlug: 'se' },
  { name: 'Antwerp',          state: 'Antwerp Province', country: 'Belgium',      countrySlug: 'be' },
  { name: 'The Hague',        state: 'South Holland',    country: 'Netherlands',  countrySlug: 'nl' },
  { name: 'Utrecht',          state: 'Utrecht',          country: 'Netherlands',  countrySlug: 'nl' },
  { name: 'Eindhoven',        state: 'North Brabant',    country: 'Netherlands',  countrySlug: 'nl' },
  { name: 'Porto',            state: 'Norte',            country: 'Portugal',     countrySlug: 'pt' },
  { name: 'Thessaloniki',     state: 'Central Macedonia', country: 'Greece',      countrySlug: 'gr' },
  { name: 'Krakow',           state: 'Lesser Poland',    country: 'Poland',       countrySlug: 'pl' },
  { name: 'Lodz',             state: 'Łódź Voivodeship', country: 'Poland',       countrySlug: 'pl' },
  { name: 'Wroclaw',          state: 'Lower Silesia',    country: 'Poland',       countrySlug: 'pl' },
  { name: 'Poznan',           state: 'Greater Poland',   country: 'Poland',       countrySlug: 'pl' },
  { name: 'Gdansk',           state: 'Pomerania',        country: 'Poland',       countrySlug: 'pl' },
  { name: 'Brno',             state: 'South Moravian',   country: 'Czech Republic', countrySlug: 'cz' },
  { name: 'Ostrava',          state: 'Moravian-Silesian', country: 'Czech Republic', countrySlug: 'cz' },
  { name: 'Debrecen',         state: 'Hajdú-Bihar',      country: 'Hungary',      countrySlug: 'hu' },
  { name: 'Cluj-Napoca',      state: 'Cluj',             country: 'Romania',      countrySlug: 'ro' },
  { name: 'Timisoara',        state: 'Timiș',            country: 'Romania',      countrySlug: 'ro' },
  { name: 'Iasi',             state: 'Iași',             country: 'Romania',      countrySlug: 'ro' },
  { name: 'Zurich',           state: 'Zurich',           country: 'Switzerland',  countrySlug: 'ch' },
  { name: 'Basel',            state: 'Basel-City',       country: 'Switzerland',  countrySlug: 'ch' },
  { name: 'Bern',             state: 'Bern',             country: 'Switzerland',  countrySlug: 'ch' },
{ name: 'Tbilisi',    state: 'Tbilisi',    country: 'Georgia',  countrySlug: 'ge' },
{ name: 'Katowice',   state: 'Silesia',    country: 'Poland',   countrySlug: 'pl' },

  // ── Russia & Eastern Europe ──────────────────────────────────────────────
  { name: 'Kazan',            state: 'Tatarstan',        country: 'Russia',       countrySlug: 'ru' },
  { name: 'Nizhny Novgorod',  state: 'Nizhny Novgorod Oblast', country: 'Russia', countrySlug: 'ru' },
  { name: 'Samara',           state: 'Samara Oblast',    country: 'Russia',       countrySlug: 'ru' },
  { name: 'Omsk',             state: 'Omsk Oblast',      country: 'Russia',       countrySlug: 'ru' },
  { name: 'Rostov-on-Don',    state: 'Rostov Oblast',    country: 'Russia',       countrySlug: 'ru' },
  { name: 'Ufa',              state: 'Bashkortostan',    country: 'Russia',       countrySlug: 'ru' },
  { name: 'Krasnoyarsk',      state: 'Krasnoyarsk Krai', country: 'Russia',       countrySlug: 'ru' },
  { name: 'Perm',             state: 'Perm Krai',        country: 'Russia',       countrySlug: 'ru' },
  { name: 'Volgograd',        state: 'Volgograd Oblast', country: 'Russia',       countrySlug: 'ru' },
  { name: 'Lviv',             state: 'Lviv Oblast',      country: 'Ukraine',      countrySlug: 'ua' },
  { name: 'Kharkiv',          state: 'Kharkiv Oblast',   country: 'Ukraine',      countrySlug: 'ua' },
  { name: 'Odessa',           state: 'Odessa Oblast',    country: 'Ukraine',      countrySlug: 'ua' },

  // ── China (more cities) ───────────────────────────────────────────────────
  { name: 'Chongqing',        state: 'Chongqing',        country: 'China', countrySlug: 'cn' },
  { name: 'Dongguan',         state: 'Guangdong',        country: 'China', countrySlug: 'cn' },
  { name: 'Foshan',           state: 'Guangdong',        country: 'China', countrySlug: 'cn' },
  { name: 'Wenzhou',          state: 'Zhejiang',         country: 'China', countrySlug: 'cn' },
  { name: 'Jinan',            state: 'Shandong',         country: 'China', countrySlug: 'cn' },
  { name: 'Urumqi',           state: 'Xinjiang',         country: 'China', countrySlug: 'cn' },
  { name: 'Lanzhou',          state: 'Gansu',            country: 'China', countrySlug: 'cn' },
  { name: 'Taiyuan',          state: 'Shanxi',           country: 'China', countrySlug: 'cn' },
  { name: 'Shijiazhuang',     state: 'Hebei',            country: 'China', countrySlug: 'cn' },
  { name: 'Hefei',            state: 'Anhui',            country: 'China', countrySlug: 'cn' },
  { name: 'Nanchang',         state: 'Jiangxi',          country: 'China', countrySlug: 'cn' },
  { name: 'Guiyang',          state: 'Guizhou',          country: 'China', countrySlug: 'cn' },

  // ── Japan ─────────────────────────────────────────────────────────────────
  { name: 'Sendai',           state: 'Miyagi',           country: 'Japan', countrySlug: 'jp' },
  { name: 'Kitakyushu',       state: 'Fukuoka',          country: 'Japan', countrySlug: 'jp' },
  { name: 'Kawasaki',         state: 'Kanagawa',         country: 'Japan', countrySlug: 'jp' },
  { name: 'Yokohama',         state: 'Kanagawa',         country: 'Japan', countrySlug: 'jp' },
  { name: 'Chiba',            state: 'Chiba',            country: 'Japan', countrySlug: 'jp' },
  { name: 'Niigata',          state: 'Niigata',          country: 'Japan', countrySlug: 'jp' },
  { name: 'Shizuoka',         state: 'Shizuoka',         country: 'Japan', countrySlug: 'jp' },
  { name: 'Okayama',          state: 'Okayama',          country: 'Japan', countrySlug: 'jp' },
  { name: 'Kumamoto',         state: 'Kumamoto',         country: 'Japan', countrySlug: 'jp' },

  // ── South Korea ───────────────────────────────────────────────────────────
  { name: 'Ulsan',            state: 'Ulsan',            country: 'South Korea', countrySlug: 'kr' },
  { name: 'Suwon',            state: 'Gyeonggi',         country: 'South Korea', countrySlug: 'kr' },

  // ── India (more cities) ───────────────────────────────────────────────────
  { name: 'Surat',            state: 'Gujarat',          country: 'India', countrySlug: 'in' },
  { name: 'Jaipur',           state: 'Rajasthan',        country: 'India', countrySlug: 'in' },
  { name: 'Lucknow',          state: 'Uttar Pradesh',    country: 'India', countrySlug: 'in' },
  { name: 'Kanpur',           state: 'Uttar Pradesh',    country: 'India', countrySlug: 'in' },
  { name: 'Nagpur',           state: 'Maharashtra',      country: 'India', countrySlug: 'in' },
  { name: 'Visakhapatnam',    state: 'Andhra Pradesh',   country: 'India', countrySlug: 'in' },
  { name: 'Bhopal',           state: 'Madhya Pradesh',   country: 'India', countrySlug: 'in' },
  { name: 'Patna',            state: 'Bihar',            country: 'India', countrySlug: 'in' },
  { name: 'Coimbatore',       state: 'Tamil Nadu',       country: 'India', countrySlug: 'in' },
  { name: 'Vadodara',         state: 'Gujarat',          country: 'India', countrySlug: 'in' },
  { name: 'Guwahati',         state: 'Assam',            country: 'India', countrySlug: 'in' },
  { name: 'Chandigarh',       state: 'Punjab',           country: 'India', countrySlug: 'in' },
  { name: 'Varanasi',         state: 'Uttar Pradesh',    country: 'India', countrySlug: 'in' },
  { name: 'Agra',             state: 'Uttar Pradesh',    country: 'India', countrySlug: 'in' },
  { name: 'Amritsar',         state: 'Punjab',           country: 'India', countrySlug: 'in' },
  { name: 'Indore',           state: 'Madhya Pradesh',   country: 'India', countrySlug: 'in' },
  { name: 'Thiruvananthapuram', state: 'Kerala',         country: 'India', countrySlug: 'in' },
  { name: 'Kochi',            state: 'Kerala',           country: 'India', countrySlug: 'in' },

  // ── Southeast Asia ────────────────────────────────────────────────────────
  { name: 'Quezon City',      state: 'Metro Manila',     country: 'Philippines', countrySlug: 'ph' },
  { name: 'Pattaya',          state: 'Chonburi',         country: 'Thailand',    countrySlug: 'th' },
  { name: 'Phuket',           state: 'Phuket',           country: 'Thailand',    countrySlug: 'th' },
  { name: 'Nonthaburi',       state: 'Nonthaburi',       country: 'Thailand',    countrySlug: 'th' },
  { name: 'Hue',              state: 'Thua Thien Hue',   country: 'Vietnam',     countrySlug: 'vn' },
  { name: 'Can Tho',          state: 'Can Tho',          country: 'Vietnam',     countrySlug: 'vn' },
  { name: 'Semarang',         state: 'Central Java',     country: 'Indonesia',   countrySlug: 'id' },
  { name: 'Palembang',        state: 'South Sumatra',    country: 'Indonesia',   countrySlug: 'id' },
  { name: 'Yogyakarta',       state: 'Special Region',   country: 'Indonesia',   countrySlug: 'id' },
  { name: 'Ipoh',             state: 'Perak',            country: 'Malaysia',    countrySlug: 'my' },

  // ── Middle East ───────────────────────────────────────────────────────────
  { name: 'Sharjah',          state: 'Sharjah',          country: 'United Arab Emirates', countrySlug: 'ae' },
  { name: 'Dammam',           state: 'Eastern Province', country: 'Saudi Arabia',         countrySlug: 'sa' },
  { name: 'Mecca',            state: 'Mecca Region',     country: 'Saudi Arabia',         countrySlug: 'sa' },
  { name: 'Medina',           state: 'Al-Madinah',       country: 'Saudi Arabia',         countrySlug: 'sa' },
  { name: 'Manama',           state: 'Capital',          country: 'Bahrain',              countrySlug: 'bh' },
  { name: 'Muscat',           state: 'Muscat',           country: 'Oman',                 countrySlug: 'om' },
  { name: 'Sanaa',            state: 'Amanat Al Asimah', country: 'Yemen',                countrySlug: 'ye' },
  { name: 'Tripoli',          state: 'Tripoli District', country: 'Libya',                countrySlug: 'ly' },

  // ── Africa ────────────────────────────────────────────────────────────────
  { name: 'Marrakech',        state: 'Marrakech-Safi',   country: 'Morocco',    countrySlug: 'ma' },
  { name: 'Fes',              state: 'Fès-Meknès',       country: 'Morocco',    countrySlug: 'ma' },
  { name: 'Rabat',            state: 'Rabat-Salé-Kénitra', country: 'Morocco',  countrySlug: 'ma' },
  { name: 'Port Harcourt',    state: 'Rivers',           country: 'Nigeria',    countrySlug: 'ng' },
  { name: 'Kano',             state: 'Kano',             country: 'Nigeria',    countrySlug: 'ng' },
  { name: 'Ibadan',           state: 'Oyo',              country: 'Nigeria',    countrySlug: 'ng' },
  { name: 'Kumasi',           state: 'Ashanti',          country: 'Ghana',      countrySlug: 'gh' },
  { name: 'Mombasa',          state: 'Mombasa County',   country: 'Kenya',      countrySlug: 'ke' },
  { name: 'Dar es Salaam',    state: 'Dar es Salaam',    country: 'Tanzania',   countrySlug: 'tz' },
  { name: 'Kampala',          state: 'Central Region',   country: 'Uganda',     countrySlug: 'ug' },
  { name: 'Kigali',           state: 'Kigali',           country: 'Rwanda',     countrySlug: 'rw' },
  { name: 'Abidjan',          state: 'Abidjan District', country: "Côte d'Ivoire", countrySlug: 'ci' },
  { name: 'Conakry',          state: 'Conakry',          country: 'Guinea',     countrySlug: 'gn' },
  { name: 'Bamako',           state: 'Bamako',           country: 'Mali',       countrySlug: 'ml' },
  { name: 'Ouagadougou',      state: 'Centre',           country: 'Burkina Faso', countrySlug: 'bf' },
  { name: 'Douala',           state: 'Littoral',         country: 'Cameroon',   countrySlug: 'cm' },
  { name: 'Yaounde',          state: 'Centre',           country: 'Cameroon',   countrySlug: 'cm' },
  { name: 'Antananarivo',     state: 'Analamanga',       country: 'Madagascar', countrySlug: 'mg' },

  // ── Latin America ─────────────────────────────────────────────────────────
  { name: 'Recife',           state: 'Pernambuco',       country: 'Brazil',      countrySlug: 'br' },
  { name: 'Porto Alegre',     state: 'Rio Grande do Sul', country: 'Brazil',     countrySlug: 'br' },
  { name: 'Curitiba',         state: 'Paraná',           country: 'Brazil',      countrySlug: 'br' },
  { name: 'Belem',            state: 'Pará',             country: 'Brazil',      countrySlug: 'br' },
  { name: 'Campinas',         state: 'São Paulo',        country: 'Brazil',      countrySlug: 'br' },
  { name: 'Cali',             state: 'Valle del Cauca',  country: 'Colombia',    countrySlug: 'co' },
  { name: 'Barranquilla',     state: 'Atlántico',        country: 'Colombia',    countrySlug: 'co' },
  { name: 'Quito',            state: 'Pichincha',        country: 'Ecuador',     countrySlug: 'ec' },
  { name: 'Guayaquil',        state: 'Guayas',           country: 'Ecuador',     countrySlug: 'ec' },
  { name: 'La Paz',           state: 'La Paz',           country: 'Bolivia',     countrySlug: 'bo' },
  { name: 'Santa Cruz',       state: 'Santa Cruz',       country: 'Bolivia',     countrySlug: 'bo' },
  { name: 'Asuncion',         state: 'Asunción',         country: 'Paraguay',    countrySlug: 'py' },
  { name: 'Montevideo',       state: 'Montevideo',       country: 'Uruguay',     countrySlug: 'uy' },
  { name: 'San Jose',         state: 'San José',         country: 'Costa Rica',  countrySlug: 'cr' },
  { name: 'Guatemala City',   state: 'Guatemala',        country: 'Guatemala',   countrySlug: 'gt' },
  { name: 'Tegucigalpa',      state: 'Francisco Morazán', country: 'Honduras',  countrySlug: 'hn' },
  { name: 'San Salvador',     state: 'San Salvador',     country: 'El Salvador', countrySlug: 'sv' },
  { name: 'Managua',          state: 'Managua',          country: 'Nicaragua',   countrySlug: 'ni' },
  { name: 'Panama City',      state: 'Panama Province',  country: 'Panama',      countrySlug: 'pa' },
  { name: 'Havana',           state: 'La Habana',        country: 'Cuba',        countrySlug: 'cu' },
  { name: 'Santo Domingo',    state: 'Distrito Nacional', country: 'Dominican Republic', countrySlug: 'do' },
  { name: 'Port-au-Prince',   state: 'Ouest',            country: 'Haiti',       countrySlug: 'ht' },
  { name: 'San Juan',         state: 'Puerto Rico',      country: 'United States', countrySlug: 'us' },
  { name: 'Kingston',         state: 'Kingston',         country: 'Jamaica',     countrySlug: 'jm' },
  { name: 'Mendoza',          state: 'Mendoza',          country: 'Argentina',   countrySlug: 'ar' },
  { name: 'Rosario',          state: 'Santa Fe',         country: 'Argentina',   countrySlug: 'ar' },

  // ── Oceania ───────────────────────────────────────────────────────────────
  { name: 'Gold Coast',       state: 'Queensland',       country: 'Australia', countrySlug: 'au' },
  { name: 'Canberra',         state: 'ACT',              country: 'Australia', countrySlug: 'au' },
  { name: 'Newcastle',        state: 'New South Wales',  country: 'Australia', countrySlug: 'au' },
  { name: 'Wollongong',       state: 'New South Wales',  country: 'Australia', countrySlug: 'au' },
  { name: 'Hobart',           state: 'Tasmania',         country: 'Australia', countrySlug: 'au' },
  { name: 'Darwin',           state: 'Northern Territory', country: 'Australia', countrySlug: 'au' },
  { name: 'Christchurch',     state: 'Canterbury',       country: 'New Zealand', countrySlug: 'nz' },

  // ── Central & South Asia ──────────────────────────────────────────────────
  { name: 'Bishkek',          state: 'Chuy',             country: 'Kyrgyzstan',   countrySlug: 'kg' },
  { name: 'Ashgabat',         state: 'Ashgabat',         country: 'Turkmenistan', countrySlug: 'tm' },
  { name: 'Dushanbe',         state: 'Dushanbe',         country: 'Tajikistan',   countrySlug: 'tj' },
  { name: 'Nur-Sultan',       state: 'Akmola',           country: 'Kazakhstan',   countrySlug: 'kz' },
  { name: 'Dhaka',            state: 'Dhaka',            country: 'Bangladesh',   countrySlug: 'bd' },
  { name: 'Chittagong',       state: 'Chattogram',       country: 'Bangladesh',   countrySlug: 'bd' },
  { name: 'Yangon',           state: 'Yangon Region',    country: 'Myanmar',      countrySlug: 'mm' },
  { name: 'Mandalay',         state: 'Mandalay Region',  country: 'Myanmar',      countrySlug: 'mm' },
  { name: 'Colombo',          state: 'Western Province', country: 'Sri Lanka',    countrySlug: 'lk' },
  { name: 'Kabul',            state: 'Kabul',            country: 'Afghanistan',  countrySlug: 'af' },
  { name: 'Karachi',          state: 'Sindh',            country: 'Pakistan',     countrySlug: 'pk' },
  { name: 'Dhaka',            state: 'Dhaka',            country: 'Bangladesh',   countrySlug: 'bd' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõöø]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchWAQI(cityName) {
  const url = `https://api.waqi.info/search/?token=${TOKEN}&keyword=${encodeURIComponent(cityName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok' || !data.data?.length) return null;

  // Prefer stations with 'city' type and an AQI reading
  const stations = data.data;
  const best = stations.find(s => typeof s.aqi === 'number' && s.aqi !== '-')
             || stations[0];

  return {
    stationUid:  `@${best.uid}`,
    stationName: best.station?.name || '',
    aqi:         best.aqi,
    lat:         best.station?.geo?.[0],
    lon:         best.station?.geo?.[1],
  };
}

function buildCityEntry(seed, station) {
  const baseSlug = toSlug(seed.name);
  const slug = seed.state
    ? `${baseSlug}-${seed.countrySlug}`
    : baseSlug;

  return {
    name:        seed.name,
    slug:        slug,
    state:       seed.state || '',
    country:     seed.country,
    countrySlug: seed.countrySlug,
    waqiId:      station.stationUid,
    url:         `/air-quality/${seed.countrySlug}/${slug}`,
  };
}

// ── Batch runner ──────────────────────────────────────────────────────────────
async function processBatch(batch, existing) {
  const results = { added: [], skipped: [], failed: [] };

  for (const seed of batch) {
    const slug = `${toSlug(seed.name)}-${seed.countrySlug}`;

    // Skip if already in JSON
    if (ONLY_NEW && existing.some(c => c.slug === slug || c.name === seed.name && c.countrySlug === seed.countrySlug)) {
      results.skipped.push(seed.name);
      continue;
    }

    try {
      const station = await searchWAQI(seed.name);
      if (!station) {
        results.failed.push({ name: seed.name, reason: 'No station found' });
        process.stdout.write(`  ✗ ${seed.name} — no station\n`);
      } else {
        const entry = buildCityEntry(seed, station);
        results.added.push(entry);
        process.stdout.write(`  ✓ ${seed.name} → ${entry.waqiId} (AQI: ${station.aqi})\n`);
      }
    } catch (err) {
      results.failed.push({ name: seed.name, reason: err.message });
      process.stdout.write(`  ✗ ${seed.name} — ${err.message}\n`);
    }

    await sleep(DELAY_MS);
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌍 IsTheAirSafe — City Discovery`);
  console.log(`   Token:       ${TOKEN.slice(0, 8)}...`);
  console.log(`   Dry run:     ${DRY_RUN}`);
  console.log(`   Only new:    ${ONLY_NEW}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Cities to check: ${CITIES_TO_DISCOVER.length}\n`);

  // Load existing cities
  const existing = JSON.parse(fs.readFileSync(CITIES_JSON, 'utf8'));
  console.log(`📦 Existing cities: ${existing.length}\n`);

  // Deduplicate seed list
  const seen = new Set();
  const seeds = CITIES_TO_DISCOVER.filter(c => {
    const key = `${c.name}|${c.countrySlug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Process in batches (sequential for API politeness)
  const allAdded   = [];
  const allFailed  = [];
  const allSkipped = [];

  for (let i = 0; i < seeds.length; i += CONCURRENCY) {
    const batch = seeds.slice(i, i + CONCURRENCY);
    console.log(`[${i + 1}–${Math.min(i + CONCURRENCY, seeds.length)} / ${seeds.length}]`);
    const { added, failed, skipped } = await processBatch(batch, existing);
    allAdded.push(...added);
    allFailed.push(...failed);
    allSkipped.push(...skipped);
  }

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Found:   ${allAdded.length} new cities`);
  console.log(`⏭️  Skipped: ${allSkipped.length} (already in JSON)`);
  console.log(`❌ Failed:  ${allFailed.length} (no station data)`);

  if (allFailed.length) {
    console.log(`\nFailed cities:`);
    allFailed.forEach(f => console.log(`  - ${f.name}: ${f.reason}`));
  }

  if (allAdded.length === 0) {
    console.log('\nNo new cities to add. Done.');
    return;
  }

  // Merge and write
  if (!DRY_RUN) {
    // Deduplicate by slug before merging
    const existingSlugs = new Set(existing.map(c => c.slug));
    const uniqueNew = allAdded.filter(c => !existingSlugs.has(c.slug));

    const merged = [...existing, ...uniqueNew];
    fs.writeFileSync(CITIES_JSON, JSON.stringify(merged, null, 2));
    console.log(`\n✨ Written ${merged.length} total cities to cities.json (+${uniqueNew.length} new)`);
    console.log(`\n⚠️  Remember to regenerate sitemap.xml:\n   node scripts/generate-sitemap.js\n`);
  } else {
    console.log('\n🔍 Dry run — no files written. Remove --dry-run to apply.');
    console.log('\nWould add:');
    allAdded.forEach(c => console.log(`  ${c.name} (${c.country}) → ${c.waqiId}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
