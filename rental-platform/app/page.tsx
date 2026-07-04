import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";

const portalEntrypoints = [
  {
    title: "Client account",
    description: "View bookings, payments, notifications, and reviews.",
    href: ROUTES.auth.clientLogin,
    icon: UserRound,
  },
  {
    title: "Owner portal",
    description: "Track units, bookings, earnings, payouts, and reviews.",
    href: ROUTES.auth.ownerLogin,
    icon: Building2,
  },
  {
    title: "Admin portal",
    description: "Manage CRM, bookings, finance, owners, units, and settings.",
    href: ROUTES.auth.adminLogin,
    icon: ShieldCheck,
  },
] as const;

export default function PortalGatewayPage() {
  return (
    <main className="portal-auth min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(20,23,26,0.06),0_12px_28px_rgba(20,23,26,0.07)] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="flex flex-col justify-between bg-neutral-900 p-8 text-neutral-50">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-600 text-lg font-bold tracking-tight text-white">
                  K
                </div>
                <span className="text-xl font-semibold tracking-tight">
                  Kaza Booking
                </span>
              </div>
              <h1 className="mt-10 max-w-sm text-3xl font-semibold tracking-tight">
                Sign in to the right workspace.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-neutral-300">
                Access the operational tools for clients, owners, and platform
                teams from one secure entry point.
              </p>
            </div>

            <p className="mt-12 text-xs text-neutral-400">
              Property management platform
            </p>
          </aside>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-medium text-primary-700">
                Portal access
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                Choose your account type
              </h2>
            </div>

            <div className="grid gap-3">
              {portalEntrypoints.map((entry) => {
                const Icon = entry.icon;

                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-lg bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-primary-100 group-hover:text-primary-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {entry.title}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-neutral-500">
                        {entry.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 flex-none text-neutral-400 transition-colors group-hover:text-primary-700"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
