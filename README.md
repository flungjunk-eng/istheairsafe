# IsTheAirSafe.com

Real-time air quality index (AQI) for 250+ cities worldwide, built with Astro + Cloudflare Pages.

## Features

- 🌍 **250+ cities** across 60+ countries
- 📊 **Live AQI data** from the World Air Quality Index (WAQI) network
- 🌤️ **Weather integration** via Open-Meteo (free, no API key needed)
- 💨 **Pollutant breakdown**: PM2.5, PM10, O3, NO2, SO2, CO
- 📅 **7-day AQI forecast**
- 💚 **Health guidance** based on AQI level
- 🔍 **City search** with instant results
- 📈 **Live rankings** page
- 🗺️ **Sitemap** with all 250+ city URLs
- ⚡ **Cloudflare Pages** SSR deployment

## Tech Stack

- [Astro](https://astro.build) v4 — hybrid SSR/static
- [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter
- [React](https://react.dev) for interactive components
- [WAQI API](https://aqicn.org/api/) for air quality data
- [Open-Meteo](https://open-meteo.com) for weather data (free, no key)

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get a WAQI API token

Register for a free token at [aqicn.org/data-platform/token/](https://aqicn.org/data-platform/token/)

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set WAQI_TOKEN=your_actual_token
```

### 4. Run development server

```bash
npm run dev
```

Visit [http://localhost:4321](http://localhost:4321)

### 5. Build for production

```bash
npm run build
```

## Cloudflare Pages Deployment

### Option A: GitHub Integration (recommended)

1. Push this repo to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create a project
3. Connect your GitHub repo
4. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: 18 or 20
5. Add environment variable:
   - `WAQI_TOKEN` → your WAQI API token
6. Deploy!

### Option B: Direct Upload (Wrangler CLI)

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build
npm run build

# Deploy
wrangler pages deploy dist --project-name istheairsafe
```

### Environment Variables (Cloudflare)

Set in Cloudflare Pages dashboard → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `WAQI_TOKEN` | Your WAQI API token from aqicn.org |

## Project Structure

```
istheairsafe/
├── astro.config.mjs        # Astro config with Cloudflare adapter
├── .env.example            # Environment variable template
├── src/
│   ├── data/
│   │   └── cities.json     # 250+ city definitions
│   ├── utils/
│   │   └── waqi.js         # WAQI + Open-Meteo fetch utilities
│   ├── layouts/
│   │   └── Base.astro      # HTML shell with fonts, SEO, JSON-LD
│   ├── components/
│   │   ├── AqiDial.jsx     # SVG AQI gauge (React)
│   │   └── CitySearch.jsx  # Search with autocomplete (React)
│   └── pages/
│       ├── index.astro         # Homepage with search
│       ├── rankings.astro      # Live city rankings (SSR)
│       └── air-quality/
│           └── [...slug].astro # Dynamic city pages (SSR)
└── public/
    ├── favicon.svg
    └── sitemap.xml         # Auto-generated from cities.json
```

## AQI Scale

| AQI | Category | Health Implication |
|-----|----------|--------------------|
| 0–50 | Good | Air quality is satisfactory |
| 51–100 | Moderate | Acceptable; some pollutants may affect sensitive people |
| 101–150 | Unhealthy for Sensitive Groups | Sensitive groups may experience effects |
| 151–200 | Unhealthy | General public may experience effects |
| 201–300 | Very Unhealthy | Health alert for everyone |
| 301–500 | Hazardous | Emergency conditions; everyone affected |

## Adding More Cities

Edit `src/data/cities.json` and add entries following this schema:

```json
{
  "name": "City Name",
  "slug": "city-name-state",
  "state": "State/Region",
  "country": "Country Name",
  "countrySlug": "country-code",
  "waqiId": "city name as used in WAQI API",
  "url": "/air-quality/country-code/city-slug"
}
```

After adding cities, regenerate the sitemap:

```bash
node -e "
const cities = require('./src/data/cities.json');
const urls = cities.map(c => \`  <url><loc>https://istheairsafe.com\${c.url}</loc></url>\`).join('\n');
require('fs').writeFileSync('public/sitemap.xml', \`<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n\${urls}\n</urlset>\`);
console.log('Sitemap regenerated with', cities.length, 'cities');
"
```

## Data Sources

- **Air Quality**: [World Air Quality Index (WAQI)](https://waqi.info) — requires free API token
- **Weather**: [Open-Meteo](https://open-meteo.com) — completely free, no API key needed


## Expanding the City List

The project ships with 258 cities. To add more:

### Automatic discovery (recommended)

The discovery script queries the WAQI search API to find and validate stations,
then writes verified entries directly into `cities.json`.

```bash
# Preview what would be added (no files changed)
npm run discover-cities:dry

# Add only cities not already in cities.json
npm run discover-cities:new

# Discover all cities in the seed list (re-validates existing ones)
npm run discover-cities
```

Then regenerate the sitemap:

```bash
npm run generate-sitemap
```

### Adding cities manually

Edit `scripts/discover-cities.js` and add entries to the `CITIES_TO_DISCOVER` array:

```js
{ name: 'Tbilisi', state: 'Tbilisi', country: 'Georgia', countrySlug: 'ge' },
```

Then run `npm run discover-cities:new` — the script will look up the correct WAQI
station ID and append a verified entry to `cities.json`.

### Why use the discovery script?

The WAQI API resolves cities by station UID (`@12345`), not city names. Guessing
names leads to the "no data" bugs seen with `"hochiminh"` and `"buenos aires"`.
The script always uses the `@uid` format from the search API, which is guaranteed
to resolve correctly.

### After adding cities

Always run `npm run generate-sitemap` to keep `public/sitemap.xml` up to date.

## License

MIT
