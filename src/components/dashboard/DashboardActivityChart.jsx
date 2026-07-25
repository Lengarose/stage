import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function DashboardActivityChart({ timeline, weekly, ratingLabel, matchesLabel, emptyLabel }) {
  const hasTimeline = timeline?.length > 0;
  const hasWeekly = weekly?.some((w) => w.matches > 0);

  if (!hasTimeline && !hasWeekly) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {hasTimeline ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
            {ratingLabel}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis domain={[5, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="rating"
                name="Rating"
                stroke="hsl(189,100%,52%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(189,100%,52%)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {hasWeekly ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
            {matchesLabel}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="matches" name={matchesLabel} fill="hsl(145,70%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
