"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { colors } from "../lib/colors";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <span style={{ color: colors.text.primary, fontWeight: 600 }}>{payload[0].payload.name}</span>
        <span style={{ color: colors.text.secondary, marginLeft: 8 }}>{payload[0].value}ms</span>
      </div>
    );
  }
  return null;
};

export default function SpeedupChart({ benchmark }) {
  const { sequentialMs, parallelMs, speedup, numWorkers } = benchmark;
  const data = [
    { name: "Sequential", time: sequentialMs },
    { name: `Parallel (${numWorkers} threads)`, time: parallelMs },
  ];
  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ left: 0, right: 20, top: 10 }}>
          <XAxis dataKey="name" tick={{ fill: colors.text.secondary, fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: colors.text.label, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} width={55} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: `rgba(75,101,135,0.05)` }} />
          <Bar dataKey="time" radius={[4, 4, 0, 0]} barSize={48}>
            <Cell fill={colors.text.label} />
            <Cell fill={colors.accent.primary} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Sequential", value: `${sequentialMs}ms`, color: colors.text.secondary },
          { label: "Parallel",   value: `${parallelMs}ms`,   color: colors.accent.primary },
          { label: "Speedup",    value: `${speedup}x`,       color: colors.text.primary },
        ].map((s) => (
          <div key={s.label} className="rounded-lg py-3" style={{ border: `1px solid ${colors.border.default}`, background: colors.background.secondary }}>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
