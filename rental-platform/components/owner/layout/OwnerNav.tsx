"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Calendar,
  Wallet,
  Star,
  Bell,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";

const OWNER_NAV_ITEMS = [
  {
    label: "Dashboard",
    href: ROUTES.owner.dashboard,
    icon: LayoutDashboard,
  },
  { label: "My Units", href: ROUTES.owner.units, icon: Home },
  { label: "Bookings", href: ROUTES.owner.bookings, icon: Calendar },
  { label: "Finance", href: ROUTES.owner.finance, icon: Wallet },
  { label: "Reviews", href: ROUTES.owner.reviews, icon: Star },
  { label: "Notifications", href: ROUTES.owner.notifications, icon: Bell },
  { label: "Profile", href: ROUTES.owner.profile, icon: User },
] as const;

export function OwnerNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {OWNER_NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-neutral-100 font-semibold text-neutral-900"
                : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              collapsed && "justify-center"
            )}
            title={collapsed ? item.label : undefined}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary-500"
              />
            )}
            <Icon
              className={cn(
                "h-5 w-5 flex-shrink-0",
                active ? "text-primary-500" : "text-neutral-400"
              )}
            />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
