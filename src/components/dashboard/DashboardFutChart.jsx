import {
  Bar,
  BarChart,
  CartesianGrid,
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

export default function DashboardFutChart({ weekly, winsLabel, lossesLabel, emptyLabel }) {
  const hasData = weekly?.some((w) => w.matches > 0);

  if (!hasData) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={weekly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={28} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="wins" name={winsLabel} stackId="fut" fill="hsl(145,70%,50%)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="losses" name={lossesLabel} stackId="fut" fill="hsl(0,72%,55%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
