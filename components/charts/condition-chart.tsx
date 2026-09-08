"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CONDITION_ORDER, CONDITION_META } from "@/lib/format";
import type { Condition } from "@/lib/types";

export interface ConditionCount {
  condition: Condition;
  count: number;
}

export function ConditionChart({ data }: { data: ConditionCount[] }) {
  const filtered = data.filter((d) => d.count > 0);
  if (!filtered.length) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">No inspections yet</p>
    );
  }
  const chartData = filtered.map((d) => ({
    name: CONDITION_META[d.condition].label,
    value: d.count,
    color: CONDITION_META[d.condition].hex,
  }));

  return (
    <div className="flex h-64 items-center gap-4">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e4e4e7",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-40 space-y-1.5 text-sm">
        {CONDITION_ORDER.filter((c) =>
          filtered.some((d) => d.condition === c),
        ).map((c) => {
          const count = filtered.find((d) => d.condition === c)?.count ?? 0;
          return (
            <li key={c} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: CONDITION_META[c].hex }}
              />
              <span className="flex-1 text-zinc-600">{CONDITION_META[c].label}</span>
              <span className="font-semibold text-zinc-900">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
