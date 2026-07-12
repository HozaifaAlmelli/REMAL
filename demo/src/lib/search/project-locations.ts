import type { UnitListItem } from "@/lib/api/types";

export interface UnitMapPoint {
  unit: UnitListItem;
  latitude: number;
  longitude: number;
}

interface ProjectLocation {
  aliases: readonly string[];
  latitude: number;
  longitude: number;
}

// Public search intentionally uses approximate project centers instead of exact
// unit addresses. The current API has no unit coordinates, and this avoids
// exposing a private rental's precise location before booking.
const PROJECT_LOCATIONS: readonly ProjectLocation[] = [
  {
    aliases: ["abraj al alamein", "abraj el alamein", "أبراج العلمين"],
    latitude: 30.8444,
    longitude: 28.9521,
  },
  {
    aliases: ["mazarine", "mazarine new alamein", "مزارين"],
    latitude: 30.8616,
    longitude: 28.9187,
  },
  {
    aliases: ["the gate", "the gate towers", "ذا جيت"],
    latitude: 30.8426,
    longitude: 28.9259,
  },
  {
    aliases: ["palm hills", "palm hills new alamein", "بالم هيلز"],
    latitude: 30.8797,
    longitude: 28.8857,
  },
] as const;

function normalizeProjectName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getProjectLocation(
  projectName: string
): Pick<ProjectLocation, "latitude" | "longitude"> | null {
  const normalizedName = normalizeProjectName(projectName);
  const location = PROJECT_LOCATIONS.find((candidate) =>
    candidate.aliases.some(
      (alias) => normalizeProjectName(alias) === normalizedName
    )
  );

  return location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;
}

export function buildUnitMapPoints(units: UnitListItem[]): UnitMapPoint[] {
  const groups = new Map<
    string,
    { location: Pick<ProjectLocation, "latitude" | "longitude">; units: UnitListItem[] }
  >();

  for (const unit of units) {
    const location = getProjectLocation(unit.projectName);
    if (!location) continue;

    const group = groups.get(unit.projectId) ?? { location, units: [] };
    group.units.push(unit);
    groups.set(unit.projectId, group);
  }

  return Array.from(groups.values()).flatMap(({ location, units: projectUnits }) => {
    const sortedUnits = [...projectUnits].sort((a, b) => a.id.localeCompare(b.id));

    return sortedUnits.map((unit, index) => {
      if (sortedUnits.length === 1) {
        return { unit, ...location };
      }

      const angle = (index / sortedUnits.length) * Math.PI * 2;
      const radius = Math.min(0.003, 0.0012 + sortedUnits.length * 0.00012);
      return {
        unit,
        latitude: location.latitude + Math.sin(angle) * radius,
        longitude: location.longitude + Math.cos(angle) * radius,
      };
    });
  });
}
