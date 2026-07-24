"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { redirect, usePathname, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { Button } from "@/components/ui/Button";
import { CreateLeadModal } from "@/components/admin/crm/CreateLeadModal";
import PipelineBoard from "@/components/admin/crm/PipelineBoard";
import { CrmViewControls } from "@/components/admin/crm/CrmViewControls";
import { CrmLeadListView } from "@/components/admin/crm/CrmLeadListView";
import { useAssignableAdmins, useLeadsPipeline } from "@/lib/hooks/useCrm";
import {
  CRM_VIEWS,
  filterCrmLeads,
  normalizeCrmStatus,
  normalizeCrmView,
  type CrmLeadFilterState,
  type CrmView,
} from "@/lib/crm/lead-filters";

export default function CrmPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { canViewCRM, canManageCRM } = usePermissions();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const leadsQuery = useLeadsPipeline();
  const assigneesQuery = useAssignableAdmins();

  if (!canViewCRM) {
    redirect(ROUTES.admin.dashboard);
  }

  const readNavigationState = useCallback((params: URLSearchParams) => {
    const requestedPage = Number.parseInt(params.get("page") ?? "1", 10);

    return {
      view: normalizeCrmView(params.get("view")),
      filters: {
        search: params.get("q") ?? "",
        status: normalizeCrmStatus(params.get("stage")),
        source: params.get("source") ?? "",
        ownerId: params.get("owner") ?? "",
      } satisfies CrmLeadFilterState,
      page:
        Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    };
  }, []);
  const initialNavigationState = readNavigationState(
    new URLSearchParams(searchParams.toString())
  );
  const [view, setView] = useState(initialNavigationState.view);
  const [filters, setFilters] = useState(initialNavigationState.filters);
  const [page, setPage] = useState(initialNavigationState.page);

  useEffect(() => {
    const restoreFromHistory = () => {
      const restored = readNavigationState(
        new URLSearchParams(window.location.search)
      );
      setView(restored.view);
      setFilters(restored.filters);
      setPage(restored.page);
    };

    window.addEventListener("popstate", restoreFromHistory);
    return () => window.removeEventListener("popstate", restoreFromHistory);
  }, [readNavigationState]);
  const filteredLeads = useMemo(
    () =>
      filterCrmLeads(leadsQuery.leads, {
        search: filters.search,
        status: filters.status,
        source: filters.source,
        ownerId: filters.ownerId,
      }),
    [
      leadsQuery.leads,
      filters.ownerId,
      filters.search,
      filters.source,
      filters.status,
    ]
  );
  const sources = useMemo(
    () =>
      Array.from(new Set(leadsQuery.leads.map((lead) => lead.source))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [leadsQuery.leads]
  );

  const updateQuery = useCallback(
    (
      updates: Record<string, string>,
      navigation: "push" | "replace" = "replace"
    ) => {
      const currentSearch =
        typeof window === "undefined"
          ? searchParams.toString()
          : window.location.search;
      const next = new URLSearchParams(currentSearch);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });

      const query = next.toString();
      const target = query ? `${pathname}?${query}` : pathname;

      const historyMethod =
        navigation === "replace" ? "replaceState" : "pushState";
      window.history[historyMethod](window.history.state, "", target);
    },
    [pathname, searchParams]
  );

  const handleViewChange = (nextView: CrmView) => {
    setView(nextView);
    updateQuery(
      { view: nextView === CRM_VIEWS.Pipeline ? "" : nextView },
      "push"
    );
  };

  const handleFilterChange = <K extends keyof CrmLeadFilterState>(
    key: K,
    value: CrmLeadFilterState[K]
  ) => {
    const nextFilters = {
      ...filters,
      [key]: value,
    };
    setFilters(nextFilters);
    setPage(1);
    updateQuery({
      q: nextFilters.search,
      stage: nextFilters.status,
      source: nextFilters.source,
      owner: nextFilters.ownerId,
      page: "",
    });
  };

  const resetFilters = () => {
    setFilters({ search: "", status: "", source: "", ownerId: "" });
    setPage(1);
    updateQuery({ q: "", stage: "", source: "", owner: "", page: "" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Leads pipeline
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Move client enquiries through sales stages and capture the next
            action for each lead.
          </p>
        </div>
        {canManageCRM && (
          <Button onClick={() => setIsModalOpen(true)}>Create lead</Button>
        )}
      </div>

      <CrmViewControls
        view={view}
        filters={filters}
        sources={sources}
        assignees={assigneesQuery.data ?? []}
        filteredCount={filteredLeads.length}
        totalCount={leadsQuery.totalCount}
        onViewChange={handleViewChange}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
      />

      {leadsQuery.hasNextPage && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 pb-3">
          <p className="text-xs tabular-nums text-neutral-500">
            {leadsQuery.loadedCount} of {leadsQuery.totalCount} leads loaded
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={leadsQuery.isFetchingNextPage}
            onClick={() => leadsQuery.fetchNextPage()}
          >
            Load more leads
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {view === CRM_VIEWS.List ? (
          <CrmLeadListView
            leads={filteredLeads}
            assignees={assigneesQuery.data ?? []}
            page={page}
            isLoading={leadsQuery.isLoading}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              updateQuery({ page: String(nextPage) }, "push");
            }}
          />
        ) : (
          <PipelineBoard
            leads={filteredLeads}
            totalCount={leadsQuery.totalCount}
            isLoading={leadsQuery.isLoading}
            isError={leadsQuery.isError}
            onRefetch={() => leadsQuery.refetch()}
          />
        )}
      </div>

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
