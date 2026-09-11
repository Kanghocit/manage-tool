type Props = {
  activity: Record<string, number>;
  days?: number;
};

function buildDays(count: number) {
  const out: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const COLORS = ["#e2e8f0", "#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8"];

export function ActivityHeatmap({ activity, days = 84 }: Props) {
  const dates = buildDays(days);
  const max = Math.max(1, ...dates.map((d) => activity[d] ?? 0));

  return (
    <div>
      <div className="study-heatmap">
        {dates.map((date) => {
          const count = activity[date] ?? 0;
          const lv = level(count);
          return (
            <div
              key={date}
              className="study-heatmap-cell"
              style={{ background: COLORS[lv] }}
              title={`${date}: ${count} lần ôn (max ${max})`}
            />
          );
        })}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--study-muted)" }}>
        84 ngày gần nhất — màu đậm = ôn nhiều hơn
      </p>
    </div>
  );
}
