export function DonutChart({
  slices,
  label,
  value,
}: {
  slices: { color: string; percent: number }[];
  label: string;
  value: string;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<
    Array<{
      color: string;
      index: number;
      length: number;
      offset: number;
    }>
  >((result, slice, index) => {
    const length = (Math.max(slice.percent, 0) / 100) * circumference;
    const previous = result.at(-1);
    const offset = previous ? previous.offset + previous.length : 0;
    return [...result, { color: slice.color, index, length, offset }];
  }, []);

  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
        />
        {segments.map(({ color, index, length, offset }) => (
          <circle
            key={`${color}-${index}`}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
