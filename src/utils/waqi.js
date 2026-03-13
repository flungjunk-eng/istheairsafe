/**
 * Fetches live AQI data from WAQI API and weather from Open-Meteo
 */

export const AQI_LEVELS = [
  { min: 0,   max: 50,  label: 'Good',                        color: '#4ade80', bg: '#f0fdf4', text: '#166534', advice: 'Air quality is satisfactory, and air pollution poses little or no risk.' },
  { min: 51,  max: 100, label: 'Moderate',                    color: '#facc15', bg: '#fefce8', text: '#854d0e', advice: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.' },
  { min: 101, max: 150, label: 'Unhealthy for Sensitive Groups', color: '#fb923c', bg: '#fff7ed', text: '#9a3412', advice: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.' },
  { min: 151, max: 200, label: 'Unhealthy',                   color: '#f87171', bg: '#fef2f2', text: '#991b1b', advice: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.' },
  { min: 201, max: 300, label: 'Very Unhealthy',              color: '#c084fc', bg: '#faf5ff', text: '#6b21a8', advice: 'Health alert: The risk of health effects is increased for everyone.' },
  { min: 301, max: 500, label: 'Hazardous',                   color: '#f43f5e', bg: '#fff1f2', text: '#881337', advice: 'Health warning of emergency conditions: everyone is more likely to be affected.' },
];

export function getAqiLevel(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
  return AQI_LEVELS.find(l => aqi >= l.min && aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

export function getAqiDialDegrees(aqi) {
  const clamped = Math.min(Math.max(aqi, 0), 500);
  return (clamped / 500) * 180;
}

/**
 * Fetch live AQI data for a city from WAQI API
 * @param {string} cityId - City name or station ID
 * @param {string} token - WAQI API token
 */
export async function fetchAqi(cityId, token) {
  // Preserve @ for numeric station IDs (e.g. "@11346"), encode spaces in city names
  const encodedId = cityId.startsWith("@") ? cityId : encodeURIComponent(cityId);
  const url = `https://api.waqi.info/feed/${encodedId}/?token=${token}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) throw new Error(`WAQI API responded with ${res.status}`);
    
    const data = await res.json();
    
    if (data.status !== 'ok') {
      throw new Error(`WAQI API error: ${data.data || 'Unknown error'}`);
    }
    
    const d = data.data;
    const iaqi = d.iaqi || {};
    
    return {
      aqi: typeof d.aqi === 'number' ? d.aqi : null,
      city: d.city?.name || cityId,
      time: d.time?.s || new Date().toISOString(),
      dominentPollutant: d.dominentpol || null,
      pollutants: {
        pm25: iaqi.pm25?.v ?? null,
        pm10: iaqi.pm10?.v ?? null,
        o3:   iaqi.o3?.v   ?? null,
        no2:  iaqi.no2?.v  ?? null,
        so2:  iaqi.so2?.v  ?? null,
        co:   iaqi.co?.v   ?? null,
      },
      forecast: d.forecast?.daily || null,
      geo: d.city?.geo || null,
      attributions: d.attributions || [],
    };
  } catch (err) {
    console.error('[WAQI] Fetch error:', err.message);
    return null;
  }
}

/**
 * Fetch weather data from Open-Meteo (free, no API key needed)
 * @param {number} lat
 * @param {number} lon
 */
export async function fetchWeather(lat, lon) {
  if (!lat || !lon) return null;
  
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
    hourly: 'temperature_2m,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'mph',
    temperature_unit: 'celsius',
  });
  
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Open-Meteo responded with ${res.status}`);
    const data = await res.json();
    
    return {
      temperature: data.current?.temperature_2m ?? null,
      humidity: data.current?.relative_humidity_2m ?? null,
      windSpeed: data.current?.wind_speed_10m ?? null,
      windDirection: data.current?.wind_direction_10m ?? null,
      weatherCode: data.current?.weather_code ?? null,
      daily: {
        dates: data.daily?.time || [],
        tempMax: data.daily?.temperature_2m_max || [],
        tempMin: data.daily?.temperature_2m_min || [],
        precipitation: data.daily?.precipitation_sum || [],
        weatherCode: data.daily?.weather_code || [],
      },
      timezone: data.timezone || 'UTC',
      unit: '°C',
    };
  } catch (err) {
    console.error('[Weather] Fetch error:', err.message);
    return null;
  }
}

/**
 * Get WMO weather code description
 */
export function getWeatherDescription(code) {
  const codes = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains', 80: 'Slight showers', 81: 'Moderate showers',
    82: 'Violent showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  };
  return codes[code] ?? 'Unknown';
}

/**
 * Fetch AQI for many cities in batches to avoid WAQI rate limits.
 * @param {Array<{waqiId: string, slug: string}>} cities
 * @param {string} token
 * @param {number} batchSize - requests per batch (default 10)
 * @param {number} delayMs   - ms between batches (default 300)
 * @returns {Map<string, object|null>} slug → aqi data
 */
export async function fetchAqiBatch(cities, token, batchSize = 10, delayMs = 300) {
  const results = new Map();
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(city => fetchAqi(city.waqiId, token).catch(() => null))
    );
    batch.forEach((city, j) => results.set(city.slug, batchResults[j]));
    if (i + batchSize < cities.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

/**
 * Fetch both AQI and weather in parallel
 */
export async function fetchCityData(cityId, token) {
  const aqiData = await fetchAqi(cityId, token);
  
  let weatherData = null;
  if (aqiData?.geo?.length === 2) {
    const [lat, lon] = aqiData.geo;
    weatherData = await fetchWeather(lat, lon);
  }
  
  return { aqi: aqiData, weather: weatherData };
}
