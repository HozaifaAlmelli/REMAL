"use client";

import { useEffect, useState } from "react";
import {
  availabilityService,
  projectsService,
  unitsService,
} from "@/lib/api/services";
import type {
  OperationalAvailability,
  Project,
  UnitCatalogParams,
  UnitDetails,
  UnitImage,
  UnitListItem,
} from "@/lib/api/types";

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

const ERR = "تعذر تحميل البيانات. حاول مرة أخرى.";

export function useUnits(params: UnitCatalogParams) {
  const [state, setState] = useState<AsyncState<UnitListItem[]>>({
    data: null,
    isLoading: true,
    error: null,
  });
  const key = JSON.stringify(params);

  useEffect(() => {
    let active = true;
    setState({ data: null, isLoading: true, error: null });
    unitsService
      .list(params)
      .then((res) => {
        if (active) setState({ data: res.items, isLoading: false, error: null });
      })
      .catch((e: unknown) => {
        if (active)
          setState({
            data: null,
            isLoading: false,
            error: e instanceof Error ? e.message : ERR,
          });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function useProjects() {
  const [state, setState] = useState<AsyncState<Project[]>>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    projectsService
      .list()
      .then((data) => {
        if (active) setState({ data, isLoading: false, error: null });
      })
      .catch((e: unknown) => {
        if (active)
          setState({
            data: null,
            isLoading: false,
            error: e instanceof Error ? e.message : ERR,
          });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function useUnit(id: string | null) {
  const [state, setState] = useState<AsyncState<UnitDetails>>({
    data: null,
    isLoading: Boolean(id),
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }
    let active = true;
    setState({ data: null, isLoading: true, error: null });
    unitsService
      .getById(id)
      .then((data) => {
        if (active) setState({ data, isLoading: false, error: null });
      })
      .catch((e: unknown) => {
        if (active)
          setState({
            data: null,
            isLoading: false,
            error: e instanceof Error ? e.message : ERR,
          });
      });
    return () => {
      active = false;
    };
  }, [id]);

  return state;
}

export function useUnitImages(id: string | null) {
  const [images, setImages] = useState<UnitImage[]>([]);

  useEffect(() => {
    if (!id) {
      setImages([]);
      return;
    }
    let active = true;
    unitsService
      .getImages(id)
      .then((data) => {
        if (active) setImages(data);
      })
      .catch(() => {
        if (active) setImages([]);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return images;
}

/** Operational availability for a date range; null range = idle. */
export function useAvailability(
  unitId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const [state, setState] = useState<AsyncState<OperationalAvailability>>({
    data: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!unitId || !startDate || !endDate) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    let active = true;
    let hasLoaded = false;

    const loadAvailability = () => {
      if (!hasLoaded) {
        setState({ data: null, isLoading: true, error: null });
      }

      availabilityService
        .check(unitId, startDate, endDate)
        .then((data) => {
          if (!active) return;
          hasLoaded = true;
          setState({ data, isLoading: false, error: null });
        })
        .catch((e: unknown) => {
          if (!active) return;
          hasLoaded = true;
          setState({
            data: null,
            isLoading: false,
            error: e instanceof Error ? e.message : ERR,
          });
        });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadAvailability();
      }
    };

    loadAvailability();
    const intervalId = window.setInterval(loadAvailability, 60_000);
    window.addEventListener("focus", loadAvailability);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadAvailability);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [unitId, startDate, endDate]);

  return state;
}
