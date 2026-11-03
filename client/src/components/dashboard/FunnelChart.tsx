import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function FunnelChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart
        data={data}
        margin={{ top: 15, right: 15, left: -25, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 5"
          vertical={false}
          stroke="var(--border)"
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        />
        <Area
          isAnimationActive={false}
          type="linear"
          dataKey="count"
          name="Applications"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
