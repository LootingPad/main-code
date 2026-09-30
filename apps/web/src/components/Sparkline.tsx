export function Sparkline({
  seed,
  width = 88,
  height = 32,
  fill = false,
  fluid = false,
  up: upProp,
  values,
}: {
  seed: string;
  width?: number;
  height?: number;
  fill?: boolean;
  fluid?: boolean;
  up?: boolean;
  /** Real price series only. Empty / short series render blank — never invent a chart. */
  values?: number[] | null;
}) {
  const series = (values ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (series.length < 2) {
    return (
      <span
        className={fluid || fill ? "spark-fluid" : "inline-block"}
        style={fluid || fill ? undefined : { width, height }}
        aria-hidden
      />
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const up = upProp ?? series[series.length - 1] >= series[0];
  const color = up ? "#ccff00" : "#ff4d4d";
  const gradId = `spark-${seed.replace(/[^a-z0-9]/gi, "")}-${up ? "up" : "down"}`;
  const coords = series.map((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - ((point - min) / (max - min || 1)) * (height - 8) - 4;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <span className={fluid || fill ? "spark-fluid" : "inline-block"} style={fluid || fill ? undefined : { width }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
        {fill ? (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={color} stopOpacity="0.42" />
              <stop offset="48%" stopColor={color} stopOpacity="0.14" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
        ) : null}
        {fill ? <polygon points={area} fill={`url(#${gradId})`} /> : null}
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={fill ? 1.15 : 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
