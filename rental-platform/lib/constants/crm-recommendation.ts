import { ApiError } from "@/lib/api/api-error";

export const NEEDS_RECOMMENDATION_BADGE = "Needs Recommendation";
export const WAITING_FOR_RECOMMENDATION = "Waiting for unit recommendation";
export const WAITING_FOR_RECOMMENDATION_HINT =
  "This request came in without a unit. Pick an available unit when you convert it to a booking.";
export const UNIT_NO_LONGER_AVAILABLE =
  "The selected unit is no longer available for these dates. Choose another available unit to continue.";

export function isUnitAvailabilityConflict(
  error: ApiError,
  unitId: string
): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    !message.startsWith("crm lead ") && message.includes(unitId.toLowerCase())
  );
}
