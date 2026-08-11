"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FinanceAnalyticsDailySummaryResponse } from "@/lib/types/report.types";

interface RevenueLineChartProps {
  data: FinanceAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function RevenueLineChart({ data, isLoading }: RevenueLineChartProps) {
  if (isLoading) {
    return <Skeleton height={280} className="rounded-[4px]" />;
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.metricDate),
    revenue: d.totalInvoicedAmount,
  }));

  return (
    <div className="rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-[13px] font-semibold text-neutral-900">
        Invoiced value by recorded date
      </h3>
      <ResponsiveContainer width="100%" height={244}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-neutral-200)"
          />
          <XAxis
            dataKey="date"
            axisLine={{ stroke: "var(--color-neutral-200)" }}
            tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={{ stroke: "var(--color-neutral-200)" }}
            tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), "Invoiced value"]}
            contentStyle={{
              backgroundColor: "var(--color-neutral-800)",
              border: "none",
              borderRadius: "4px",
              color: "var(--color-neutral-50)",
              fontSize: "13px",
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-primary-500)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
