export function normalizeGuestCapacity(maxGuests: number): number {
  if (!Number.isFinite(maxGuests)) return 1;
  return Math.max(1, Math.trunc(maxGuests));
}

export function clampGuestCount(guests: number, maxGuests: number): number {
  const capacity = normalizeGuestCapacity(maxGuests);
  if (!Number.isFinite(guests)) return 1;
  return Math.min(capacity, Math.max(1, Math.trunc(guests)));
}

export function stepGuestCount(
  guests: number,
  change: -1 | 1,
  maxGuests: number
): number {
  return clampGuestCount(guests + change, maxGuests);
}

export function formatGuestCount(guests: number): string {
  if (guests === 1) return "ضيف واحد";
  if (guests === 2) return "ضيفان";
  return `${guests} ضيوف`;
}
