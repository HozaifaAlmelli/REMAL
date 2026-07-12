"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { UnitListItem } from "@/lib/api/types";
import { formatCurrency } from "@/lib/utils/format";
import { buildUnitMapPoints } from "@/lib/search/project-locations";
import "leaflet/dist/leaflet.css";

interface SearchResultsMapProps {
  units: UnitListItem[];
  activeUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [30.85, 28.93];

export function SearchResultsMap({
  units,
  activeUnitId,
  onSelectUnit,
}: SearchResultsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const points = useMemo(() => buildUnitMapPoints(units), [units]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let disposed = false;
    const markers = markersRef.current;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
        .on("tileerror", () => setTileError(true))
        .addTo(map);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      mapRef.current = map;
      setIsReady(true);
    });

    return () => {
      disposed = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !mapRef.current) return;

    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !mapRef.current) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();

      for (const point of points) {
        const marker = L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({
            className: "kaza-map-marker-shell",
            html: `<span class="kaza-map-marker">${formatCurrency(point.unit.basePricePerNight)}</span>`,
            iconAnchor: [38, 16],
          }),
          keyboard: true,
          title: point.unit.name,
          riseOnHover: true,
        });

        const popup = document.createElement("div");
        popup.dir = "rtl";
        popup.className = "min-w-44 space-y-1 text-right font-sans";
        const title = document.createElement("strong");
        title.className = "block text-sm text-brand-950";
        title.textContent = point.unit.name;
        const location = document.createElement("span");
        location.className = "block text-xs text-gray-500";
        location.textContent = `${point.unit.projectName} · موقع تقريبي`;
        const link = document.createElement("a");
        link.className = "mt-2 inline-block text-xs font-bold text-brand-700";
        link.href = `/units/${point.unit.id}`;
        link.textContent = "عرض الوحدة";
        popup.append(title, location, link);

        marker.bindPopup(popup, { closeButton: true, maxWidth: 240 });
        marker.on("click", () => onSelectUnit(point.unit.id));
        marker.addTo(mapRef.current);
        markersRef.current.set(point.unit.id, marker);
      }

      if (points.length === 1) {
        mapRef.current.setView([points[0].latitude, points[0].longitude], 14);
      } else if (points.length > 1) {
        mapRef.current.fitBounds(
          L.latLngBounds(points.map((point) => [point.latitude, point.longitude])),
          { padding: [48, 48], maxZoom: 14 }
        );
      } else {
        mapRef.current.setView(DEFAULT_CENTER, 11);
      }
    });

    return () => {
      disposed = true;
    };
  }, [isReady, onSelectUnit, points]);

  useEffect(() => {
    if (!activeUnitId || !mapRef.current) return;
    const marker = markersRef.current.get(activeUnitId);
    if (!marker) return;
    mapRef.current.panTo(marker.getLatLng(), { animate: true });
    marker.openPopup();
  }, [activeUnitId]);

  return (
    <div className="relative h-full min-h-[420px] w-full" aria-label="خريطة نتائج البحث">
      <div ref={containerRef} className="absolute inset-0" />
      {!isReady && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-gray-100 text-sm font-bold text-gray-500">
          جارٍ تحميل الخريطة…
        </div>
      )}
      {isReady && points.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-xl border border-gray-200 bg-white/95 p-3 text-center text-sm font-bold text-gray-600 shadow-sm">
          لا تتوفر مواقع تقريبية للنتائج الحالية.
        </div>
      )}
      {tileError && (
        <div role="alert" className="absolute inset-x-4 bottom-8 z-[500] rounded-xl bg-white/95 p-3 text-center text-xs font-bold text-red-700 shadow-sm">
          تعذر تحميل تفاصيل الخريطة. تحقق من الاتصال ثم أعد المحاولة.
        </div>
      )}
      <Link
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        className="sr-only"
      >
        حقوق خريطة OpenStreetMap
      </Link>
    </div>
  );
}
