// Tiny price-trend line (no chart library needed).
export function Sparkline({ points, width = 300, height = 56 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) {
    return <div className="text-sm text-muted">—</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 4;
  const xy = points.map((p, i) => [pad + (i * (width - pad * 2)) / (points.length - 1), pad + (1 - (p - min) / span) * (height - pad * 2)]);
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const color = last > prev ? "var(--color-bad)" : last < prev ? "var(--color-good)" : "var(--muted)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" preserveAspectRatio="none" role="img" aria-label="price trend">
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill={color} />
    </svg>
  );
}
