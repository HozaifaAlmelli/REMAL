"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProjects, useUnits } from "@/lib/hooks/useCatalog";
import { resolveProjectId } from "@/lib/constants/project-slugs";
import { getImageUrls } from "@/lib/utils/image";
import { formatCurrency } from "@/lib/utils/format";
import {
  buildSearchParams,
  EMPTY_SEARCH_FILTERS,
  parseSearchFilters,
  type SearchFilters,
  toCatalogParams,
} from "@/lib/search/filters";
import type { UnitListItem } from "@/lib/api/types";

const SearchResultsMap = dynamic(
  () =>
    import("@/components/search/SearchResultsMap").then(
      (module) => module.SearchResultsMap
    ),
  { ssr: false }
);

type ViewMode = "list" | "map";

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: "شقة",
  villa: "فيلا",
  chalet: "شاليه",
  studio: "استوديو",
};

const SEARCH_LOAD_ERROR_MESSAGE =
  "تعذر الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const legacyProjectSlug = searchParams.get("project");
  const viewMode: ViewMode = searchParams.get("view") === "map" ? "map" : "list";
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const resultRefs = useRef(new Map<string, HTMLDivElement>());

  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjects();
  const parsedFilters = useMemo(
    () => parseSearchFilters(new URLSearchParams(queryString)),
    [queryString]
  );
  const resolvedLegacyProjectId = useMemo(
    () => resolveProjectId(legacyProjectSlug, projects ?? []),
    [legacyProjectSlug, projects]
  );
  const appliedFilters = useMemo(
    () => ({
      ...parsedFilters,
      projectId:
        parsedFilters.projectId || resolvedLegacyProjectId || "",
    }),
    [parsedFilters, resolvedLegacyProjectId]
  );
  const projectsReady = !legacyProjectSlug || !projectsLoading;
  const catalogParams = useMemo(
    () => toCatalogParams(appliedFilters),
    [appliedFilters]
  );
  const {
    data: units,
    isLoading,
    error,
    pagination,
    refresh: refreshUnits,
  } = useUnits(catalogParams);

  const retrySearch = useCallback(() => {
    refreshProjects();
    refreshUnits();
  }, [refreshProjects, refreshUnits]);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  const results = units ?? [];
  const showLoading = isLoading || !projectsReady;
  const totalResults = pagination?.totalCount ?? results.length;
  const hasActiveFilters = Boolean(
    appliedFilters.projectId || appliedFilters.minGuests
  );

  const updateDraft = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const navigateWithFilters = (filters: SearchFilters, replace = false) => {
    const params = buildSearchParams(filters);
    if (viewMode === "map") params.set("view", "map");
    const href = params.size ? `/search?${params.toString()}` : "/search";
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateWithFilters(draftFilters);
  };

  const resetFilters = () => {
    navigateWithFilters(EMPTY_SEARCH_FILTERS);
  };

  const setViewMode = (nextMode: ViewMode) => {
    const params = buildSearchParams(appliedFilters);
    if (nextMode === "map") params.set("view", "map");
    else params.delete("view");
    router.replace(params.size ? `/search?${params.toString()}` : "/search", {
      scroll: false,
    });
  };

  const selectMapUnit = useCallback((unitId: string) => {
    setActiveUnitId(unitId);
    resultRefs.current.get(unitId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 pb-24 pt-24 font-sans lg:pb-8">
      <div className="container mx-auto flex h-full flex-col px-4">
        <section className="sticky top-20 z-30 mb-6 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur-xl lg:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-black text-brand-950 lg:text-3xl">
                اكتشف الوجهات
              </h1>
              <p aria-live="polite" className="mt-1 text-sm font-bold text-gray-500 tabular-nums">
                {showLoading ? "جارٍ تحديث النتائج…" : `${totalResults} وحدة متاحة`}
              </p>
            </div>

            <div className="flex min-h-11 w-full items-center rounded-xl bg-gray-100 p-1 md:w-auto" aria-label="طريقة عرض النتائج">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors md:flex-none ${viewMode === "list" ? "bg-white text-brand-950 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                <ListIcon className="h-4 w-4" /> القائمة
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                aria-pressed={viewMode === "map"}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors md:flex-none ${viewMode === "map" ? "bg-white text-brand-950 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                <MapIcon className="h-4 w-4" /> الخريطة
              </button>
            </div>
          </div>

          <form onSubmit={applyFilters} className="mt-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <label className="flex min-h-[52px] items-center gap-3 rounded-xl border border-transparent bg-gray-50 px-4 focus-within:border-brand-300">
                <MapPin className="h-5 w-5 shrink-0 text-brand-500" />
                <span className="sr-only">المشروع</span>
                <select
                  value={draftFilters.projectId}
                  onChange={(event) => updateDraft("projectId", event.target.value)}
                  disabled={projectsLoading}
                  className="h-full w-full cursor-pointer bg-transparent font-bold text-brand-950 outline-none disabled:cursor-wait disabled:text-gray-400"
                >
                  <option value="">كل مشروعات الساحل</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-h-[52px] items-center gap-3 rounded-xl border border-transparent bg-gray-50 px-4 focus-within:border-brand-300">
                <Users className="h-5 w-5 shrink-0 text-brand-500" />
                <span className="sr-only">عدد الضيوف</span>
                <select
                  value={draftFilters.minGuests}
                  onChange={(event) => updateDraft("minGuests", event.target.value)}
                  className="h-full w-full cursor-pointer bg-transparent font-bold text-brand-950 outline-none"
                >
                  <option value="">أي عدد للضيوف</option>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? "ضيف" : "ضيوف أو أكثر"}
                    </option>
                  ))}
                </select>
              </label>

              <Button type="submit" className="min-h-[52px] rounded-xl bg-brand-950 px-7 font-bold text-white hover:bg-brand-800">
                <Search className="me-2 h-4 w-4" />
                بحث
              </Button>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFilters}
                  className="min-h-[52px] rounded-xl border-gray-200 px-5 font-bold text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw className="me-2 h-4 w-4" />
                  مسح الفلاتر
                </Button>
              )}
            </div>
          </form>
        </section>

        {(error || projectsError) && !showLoading ? (
          <section role="alert" className="grid min-h-72 place-items-center rounded-2xl border border-red-100 bg-white p-8 text-center">
            <div>
              <AlertCircle className="mx-auto h-9 w-9 text-red-600" />
              <h2 className="mt-3 text-lg font-black text-brand-950">تعذر تحميل نتائج البحث</h2>
              <p className="mt-2 text-sm font-medium text-gray-500">
                {SEARCH_LOAD_ERROR_MESSAGE}
              </p>
              <Button onClick={retrySearch} className="mt-5 rounded-xl bg-brand-950 text-white hover:bg-brand-800">
                إعادة المحاولة
              </Button>
            </div>
          </section>
        ) : (
          <div className={`flex-1 ${viewMode === "map" ? "grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]" : ""}`}>
            {viewMode === "map" && (
              <section className="order-1 min-h-[55vh] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm lg:order-2 lg:sticky lg:top-48 lg:h-[calc(100vh-13rem)]">
                <SearchResultsMap
                  units={results}
                  activeUnitId={activeUnitId}
                  onSelectUnit={selectMapUnit}
                />
              </section>
            )}

            <section className={`${viewMode === "map" ? "order-2 lg:order-1 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pe-1" : ""}`}>
              <AnimatePresence mode="wait">
                {showLoading ? (
                  <SearchSkeletons compact={viewMode === "map"} />
                ) : results.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid min-h-72 place-items-center rounded-2xl border border-gray-200 bg-white p-8 text-center"
                  >
                    <div>
                      <Search className="mx-auto h-9 w-9 text-brand-400" />
                      <h2 className="mt-3 text-lg font-black text-brand-950">لا توجد وحدات تطابق بحثك</h2>
                      <p className="mt-2 text-sm font-medium text-gray-500">
                        جرّب تغيير المشروع أو عدد الضيوف.
                      </p>
                      {hasActiveFilters && (
                        <Button onClick={resetFilters} variant="outline" className="mt-5 rounded-xl border-gray-200">
                          مسح الفلاتر
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`grid gap-5 ${viewMode === "list" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2"}`}
                  >
                    {results.map((unit) => (
                      <div
                        key={unit.id}
                        ref={(element) => {
                          if (element) resultRefs.current.set(unit.id, element);
                          else resultRefs.current.delete(unit.id);
                        }}
                        onMouseEnter={() => setActiveUnitId(unit.id)}
                        onFocus={() => setActiveUnitId(unit.id)}
                        className={activeUnitId === unit.id ? "rounded-2xl ring-2 ring-brand-400 ring-offset-2" : ""}
                      >
                        <ResultCard unit={unit} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function SearchSkeletons({ compact }: { compact: boolean }) {
  return (
    <motion.div
      key="skeletons"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`grid gap-5 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
      aria-label="جارٍ تحميل النتائج"
    >
      {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
        <div key={index} className="animate-pulse space-y-3">
          <div className="aspect-[4/3] rounded-2xl bg-gray-200" />
          <div className="h-4 w-2/3 rounded-full bg-gray-200" />
          <div className="h-5 w-full rounded-full bg-gray-200" />
          <div className="h-4 w-1/3 rounded-full bg-gray-100" />
        </div>
      ))}
    </motion.div>
  );
}

function ResultCard({ unit }: { unit: UnitListItem }) {
  const cover = getImageUrls(unit.images)[0];

  return (
    <Link href={`/units/${unit.id}`} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <Card padding="none" className="flex h-full flex-col overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          {cover ? (
            <img
              src={cover}
              alt={unit.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-50">
              <span className="text-lg font-black text-brand-300">Kaza Booking</span>
            </div>
          )}
        </div>

        <div className="flex flex-grow flex-col p-4 text-right">
          <p dir="auto" className="mb-1 text-xs font-black text-brand-600">
            {UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType} · {unit.projectName}
          </p>
          <h2 dir="auto" className="line-clamp-1 text-lg font-black leading-tight text-brand-950">
            {unit.name}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            حتى {unit.maxGuests} أفراد · {unit.bedrooms} غرف
          </p>
          <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
            <div>
              <span className="block text-lg font-black text-brand-950 tabular-nums">
                {formatCurrency(unit.basePricePerNight)}
              </span>
              <span className="text-[11px] font-bold text-gray-400">لليلة الواحدة</span>
            </div>
            <span className="inline-flex min-h-10 items-center rounded-lg bg-gray-100 px-3 text-sm font-bold text-brand-950 transition-colors group-hover:bg-brand-950 group-hover:text-white">
              عرض
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 pb-20 pt-24" />}>
      <SearchContent />
    </Suspense>
  );
}
