"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BookingAnalyticsDailySummaryResponse } from "@/lib/types/report.types";

interface BookingsBarChartProps {
  data: BookingAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function BookingsBarChart({ data, isLoading }: BookingsBarChartProps) {
  if (isLoading) {
    return <Skeleton height={280} className="rounded-[4px]" />;
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.metricDate),
    confirmed: d.confirmedBookingsCount,
    completed: Math.max(0, d.completedBookingsCount - d.historicalBookingsCount),
    historical: d.historicalBookingsCount,
    cancelled: d.cancelledBookingsCount,
  }));

  return (
    <div className="rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-[13px] font-semibold text-neutral-900">
        Bookings entered by recorded date
      </h3>
      <ResponsiveContainer width="100%" height={244}>
        <BarChart data={chartData}>
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-neutral-800)",
              border: "none",
              borderRadius: "4px",
              color: "var(--color-neutral-50)",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          <Bar
            dataKey="confirmed"
            stackId="a"
            fill="var(--color-primary-500)"
            name="Confirmed"
          />
          <Bar
            dataKey="completed"
            stackId="a"
            fill="var(--color-accent-green)"
            name="Completed"
          />
          <Bar
            dataKey="historical"
            stackId="a"
            fill="var(--color-accent-amber)"
            name="Historical"
          />
          <Bar dataKey="cancelled" fill="var(--color-error)" name="Cancelled" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
