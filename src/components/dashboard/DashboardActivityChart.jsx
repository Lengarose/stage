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
    <div
      className="border border-cyan-300/20 bg-[#0a101c]/95 p-3 text-xs shadow-[0_0_24px_-8px_rgba(0,229,255,0.6)] backdrop-blur-md"
      style={{ clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)" }}
    >
      <p className="font-bold text-white mb-1">{label}</p>
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
      <p className="text-sm text-white/45 py-8 text-center">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {hasTimeline ? (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-3">
            {ratingLabel}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis domain={[5, 10]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="rating"
                name="Rating"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22d3ee" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {hasWeekly ? (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-3">
            {matchesLabel}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="matches" name={matchesLabel} fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
