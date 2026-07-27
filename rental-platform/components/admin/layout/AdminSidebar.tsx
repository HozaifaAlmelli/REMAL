"use client";

import { useUIStore } from "@/lib/stores/ui.store";
import { AdminNav } from "./AdminNav";
import { cn } from "@/lib/utils/cn";

export function AdminSidebar() {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);

  return (
    <aside
      className={cn(
        "flex flex-col border-e border-neutral-200 bg-white transition-[width] duration-200 ease-out",
        isSidebarOpen ? "w-16 md:w-60" : "w-16"
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2.5 border-b border-neutral-200 px-3",
          !isSidebarOpen && "justify-center"
        )}
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[5px] bg-primary-600 text-sm font-bold text-white"
        >
          K
        </span>
        {isSidebarOpen && (
          <span className="hidden text-[15px] font-semibold tracking-tight text-neutral-900 md:inline">
            Kaza Booking
          </span>
        )}
      </div>

      <AdminNav isCollapsed={!isSidebarOpen} />
    </aside>
  );
}
