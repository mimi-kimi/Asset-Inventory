"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TypeCount {
  name: string;
  count: number;
}

export function AssetsByTypeChart({ data }: { data: TypeCount[] }) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">No data yet</p>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#71717a" }}
            interval={0}
            angle={-14}
            height={44}
            textAnchor="end"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717a" }} />
          <Tooltip
            cursor={{ fill: "#fafafa" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" name="Assets" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
