"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { colors } from "../lib/colors";

const COLORS = colors.sentiment;

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <span style={{ color: colors.text.primary, fontWeight: 600, textTransform: "capitalize" }}>{payload[0].name}</span>
        <span style={{ color: colors.text.secondary, marginLeft: 8 }}>{payload[0].value} texts</span>
      </div>
    );
  }
  return null;
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function SentimentChart({ data }) {
  const chartData = Object.entries(data).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" labelLine={false} label={CustomLabel}>
          {chartData.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(value) => <span style={{ color: colors.text.secondary, fontSize: 12, textTransform: "capitalize" }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
