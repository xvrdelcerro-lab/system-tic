import React from 'react';

// QuantityBar: shows a colored bar for quantity relative to max
export function QuantityBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ width: 80, height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          background: percent > 80 ? '#22c55e' : percent > 50 ? '#facc15' : '#ef4444',
          transition: 'width 0.3s',
        }}
      />
    </div>
  );
}

// VendorSharePie: SVG pie chart for vendor share
export function VendorSharePie({ shares }: { shares: { label: string; value: number; color: string }[] }) {
  const total = shares.reduce((sum, s) => sum + s.value, 0);
  let startAngle = 0;
  const radius = 10;
  const cx = 12;
  const cy = 12;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24">
      {shares.map((s, i) => {
        const angle = (s.value / total) * 360;
        const x1 = cx + radius * Math.cos((Math.PI * startAngle) / 180);
        const y1 = cy + radius * Math.sin((Math.PI * startAngle) / 180);
        const x2 = cx + radius * Math.cos((Math.PI * (startAngle + angle)) / 180);
        const y2 = cy + radius * Math.sin((Math.PI * (startAngle + angle)) / 180);
        const largeArc = angle > 180 ? 1 : 0;
        const path = `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
        startAngle += angle;
        return <path key={i} d={path} fill={s.color} stroke="#fff" strokeWidth={0.5} />;
      })}
    </svg>
  );
}

// StatusBadge: green/yellow/red for above/at/below average
export function StatusBadge({ value, avg }: { value: number; avg: number }) {
  let color = '#22c55e';
  let label = 'Above Avg';
  if (value < avg * 0.9) {
    color = '#ef4444';
    label = 'Below Avg';
  } else if (value < avg * 1.1) {
    color = '#facc15';
    label = 'Avg';
  }
  return (
    <span style={{ background: color, color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 10 }}>
      {label}
    </span>
  );
}
