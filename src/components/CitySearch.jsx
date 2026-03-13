import { useState, useRef, useEffect } from 'react';

export default function CitySearch({ cities }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const filtered = cities
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.state?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q)
      )
      .slice(0, 8);
    setResults(filtered);
  }, [query]);

  function handleSelect(city) {
    window.location.href = city.url;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0]);
    }
  }

  return (
    <div style={{ position: 'relative', maxWidth: '520px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'white',
        border: `1.5px solid ${focused ? '#2d6a4f' : '#e5e5e2'}`,
        borderRadius: '100px',
        padding: '0.65rem 1.25rem',
        boxShadow: focused ? '0 0 0 4px rgba(45,106,79,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search any city — New York, Tokyo, Delhi…"
          style={{
            border: 'none',
            outline: 'none',
            flex: 1,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '1rem',
            color: '#1a1a18',
            background: 'transparent',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#9b9b97', fontSize: '1rem', padding: '0 0.25rem',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {focused && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0, right: 0,
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e5e2',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          zIndex: 50,
        }}>
          {results.map((city, i) => (
            <button
              key={city.slug}
              onClick={() => handleSelect(city)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid #f0f0ee' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f7f7f5'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span>
                <span style={{ fontWeight: 600, color: '#1a1a18', fontSize: '0.95rem' }}>{city.name}</span>
                <span style={{ color: '#9b9b97', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  {city.state ? `${city.state}, ` : ''}{city.country}
                </span>
              </span>
              <span style={{ fontSize: '0.75rem', color: '#52b788', fontFamily: 'DM Mono, monospace' }}>
                Check →
              </span>
            </button>
          ))}
        </div>
      )}

      {focused && query && results.length === 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0, right: 0,
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e5e2',
          padding: '1rem 1.25rem',
          textAlign: 'center',
          color: '#9b9b97',
          fontSize: '0.875rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          zIndex: 50,
        }}>
          No cities found for "{query}"
        </div>
      )}
    </div>
  );
}
