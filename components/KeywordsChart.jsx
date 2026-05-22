"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { colors, getBarChartColor } from "../lib/colors";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <span style={{ color: colors.text.primary, fontWeight: 600 }}>{payload[0].payload.word}</span>
        <span style={{ color: colors.text.secondary, marginLeft: 8 }}>{payload[0].value} occurrences</span>
      </div>
    );
  }
  return null;
};

export default function KeywordsChart({ data }) {
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={top} layout="vertical" margin={{ left: 0, right: 20 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="word" tick={{ fill: colors.text.secondary, fontSize: 12, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: `rgba(75,101,135,0.05)` }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
          {top.map((entry, i) => (
            <Cell key={entry.word} fill={getBarChartColor(i, top.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
