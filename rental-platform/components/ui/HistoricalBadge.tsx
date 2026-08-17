import { FileClock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function HistoricalBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200",
        className
      )}
      aria-label="Historical Booking"
    >
      <FileClock className="h-3.5 w-3.5" aria-hidden="true" />
      Historical
    </span>
  );
}
