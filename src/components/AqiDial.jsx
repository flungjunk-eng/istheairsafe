import { getAqiLevel, getAqiDialDegrees } from '../utils/waqi.js';

const AQI_COLORS = ['#4ade80', '#facc15', '#fb923c', '#f87171', '#c084fc', '#f43f5e'];
const AQI_STOPS = [0, 50, 100, 150, 200, 300, 500];

export default function AqiDial({ aqi }) {
  const level = getAqiLevel(aqi);
  const degrees = getAqiDialDegrees(aqi ?? 0);
  
  // SVG dial parameters
  const cx = 110, cy = 110, r = 85;
  const startAngle = -180;
  const endAngle = 0;
  
  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  
  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const large = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
  }

  // Needle angle: maps 0–500 AQI to -180–0 degrees
  const needleAngle = -180 + ((Math.min(Math.max(aqi ?? 0, 0), 500) / 500) * 180);
  const needleTip = polarToCartesian(cx, cy, r - 12, needleAngle);

  // Color segments
  const segments = AQI_STOPS.slice(0, -1).map((start, i) => {
    const segStart = -180 + (start / 500) * 180;
    const segEnd = -180 + (AQI_STOPS[i + 1] / 500) * 180;
    return { path: describeArc(cx, cy, r, segStart, segEnd), color: AQI_COLORS[i] };
  });

  if (!level) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#9b9b97' }}>
        <span style={{ fontSize: '3rem' }}>—</span>
        <p>Data unavailable</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 220 130" style={{ width: '100%', maxWidth: '280px', overflow: 'visible' }}>
        {/* Background track */}
        <path
          d={describeArc(cx, cy, r, -180, 0)}
          fill="none"
          stroke="#f0f0ee"
          strokeWidth="18"
          strokeLinecap="round"
        />
        
        {/* Color segments */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#1a1a18"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="#1a1a18" />
        <circle cx={cx} cy={cy} r="3" fill="white" />

        {/* AQI Number */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.2rem', fill: level.color, fontWeight: 400 }}
        >
          {aqi ?? '—'}
        </text>

        {/* Labels */}
        <text x="28" y="118" textAnchor="middle" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', fill: '#9b9b97' }}>0</text>
        <text x="192" y="118" textAnchor="middle" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', fill: '#9b9b97' }}>500</text>
      </svg>

      {/* Level badge */}
      <div style={{
        display: 'inline-block',
        background: level.bg,
        color: level.text,
        border: `1px solid ${level.color}40`,
        borderRadius: '100px',
        padding: '0.35rem 1.1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        marginTop: '0.5rem',
      }}>
        {level.label}
      </div>
    </div>
  );
}
