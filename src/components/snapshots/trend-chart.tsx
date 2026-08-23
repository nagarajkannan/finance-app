import { trendPoints } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import type { Snapshot } from "@/lib/snapshots";
import { ChartLegend, LineChart, type ChartSeries } from "@/components/charts/line-chart";

/** Net worth over time, optionally with the assets and liabilities behind it. */
export function NetWorthTrend({
  snapshots,
  showBreakdown = true,
}: {
  snapshots: Snapshot[];
  showBreakdown?: boolean;
}) {
  const points = trendPoints(snapshots);

  if (points.length === 0) return null;

  const at = (point: (typeof points)[number]) => new Date(point.capturedAt).getTime();

  const series: ChartSeries[] = [
    {
      id: "net-worth",
      label: "Net worth",
      color: "#0f172a",
      points: points.map((point) => ({ x: at(point), y: point.netWorth })),
    },
  ];

  if (showBreakdown) {
    series.push(
      {
        id: "assets",
        label: "Assets",
        color: "#059669",
        points: points.map((point) => ({ x: at(point), y: point.assets })),
      },
      {
        id: "liabilities",
        label: "Liabilities",
        color: "#e11d48",
        points: points.map((point) => ({ x: at(point), y: point.liabilities })),
      },
    );
  }

  const ticks = [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]];
  const xLabels = [...new Set(ticks.map((point) => at(point)))].map((position) => ({
    position,
    label: formatDate(new Date(position).toISOString()),
  }));

  return (
    <div>
      <LineChart series={series} xLabels={xLabels} />
      <ChartLegend series={series} />
    </div>
  );
}
