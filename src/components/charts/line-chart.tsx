import { formatCompact } from "@/lib/format";

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 64 };

function niceBounds(values: number[]): { min: number; max: number } {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

/**
 * A plain SVG line chart. Each series is drawn against the same scale so
 * assets, liabilities and net worth can be read together.
 */
export function LineChart({
  series,
  xLabels,
}: {
  series: ChartSeries[];
  xLabels: { position: number; label: string }[];
}) {
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));

  if (allX.length === 0) return null;

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const { min, max } = niceBounds(allY);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const toX = (value: number) =>
    PADDING.left + (maxX === minX ? plotWidth / 2 : ((value - minX) / (maxX - minX)) * plotWidth);
  const toY = (value: number) =>
    PADDING.top + plotHeight - ((value - min) / (max - min)) * plotHeight;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((step) => min + (max - min) * step);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-56 w-full"
      role="img"
      aria-label={`Trend of ${series.map((s) => s.label).join(", ")}`}
    >
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={toY(value)}
            y2={toY(value)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text
            x={PADDING.left - 8}
            y={toY(value) + 4}
            textAnchor="end"
            className="fill-slate-400 text-[10px]"
          >
            {formatCompact(value)}
          </text>
        </g>
      ))}

      {series.map((line) => (
        <g key={line.id}>
          <polyline
            fill="none"
            stroke={line.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={line.points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(" ")}
          />
          {line.points.map((point, index) => (
            <circle
              key={`${line.id}-${index}`}
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={2.5}
              fill={line.color}
            />
          ))}
        </g>
      ))}

      {xLabels.map((tick) => (
        <text
          key={`${tick.position}-${tick.label}`}
          x={toX(tick.position)}
          y={HEIGHT - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[10px]"
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4">
      {series.map((line) => (
        <span key={line.id} className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: line.color }}
          />
          {line.label}
        </span>
      ))}
    </div>
  );
}
