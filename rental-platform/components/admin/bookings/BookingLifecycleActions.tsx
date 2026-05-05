import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  BOOKING_VALID_TRANSITIONS,
  BookingStatus,
} from "@/lib/constants/booking-statuses";
import { LifecycleActionDialog } from "./LifecycleActionDialog";
import {
  useConfirmBooking,
  useCancelBooking,
  useCompleteBooking,
} from "@/lib/hooks/useBookings";
import { CheckCircle, XCircle, CheckSquare } from "lucide-react";

interface BookingLifecycleActionsProps {
  bookingId: string;
  currentStatus: BookingStatus;
}

type ActionType = "confirm" | "cancel" | "complete" | null;

export function BookingLifecycleActions({
  bookingId,
  currentStatus,
}: BookingLifecycleActionsProps) {
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  const confirmMutation = useConfirmBooking(bookingId);
  const cancelMutation = useCancelBooking(bookingId);
  const completeMutation = useCompleteBooking(bookingId);

  const getValidTransitions = () => {
    // Normalize status to handle case differences (DB returns lowercase, types expect capitalized)
    const normalizedStatus = (currentStatus.charAt(0).toUpperCase() +
      currentStatus.slice(1).toLowerCase()) as BookingStatus;
    return BOOKING_VALID_TRANSITIONS[normalizedStatus] || [];
  };

  const validTransitions = getValidTransitions();

  const handleActionComplete = (notes?: string) => {
    const data = notes ? { notes } : undefined;

    switch (activeAction) {
      case "confirm":
        confirmMutation.mutate(data, {
          onSuccess: () => setActiveAction(null),
        });
        break;
      case "cancel":
        cancelMutation.mutate(data, { onSuccess: () => setActiveAction(null) });
        break;
      case "complete":
        completeMutation.mutate(data, {
          onSuccess: () => setActiveAction(null),
        });
        break;
    }
  };

  const getDialogConfig = () => {
    switch (activeAction) {
      case "confirm":
        return {
          title: "Confirm Booking",
          description:
            "Are you sure you want to confirm this booking? This will generate the invoice and send a confirmation to the client.",
          actionLabel: "Confirm Booking",
          isPending: confirmMutation.isPending,
        };
      case "cancel":
        return {
          title: "Cancel Booking",
          description:
            "Are you sure you want to cancel this booking? This action is permanent. The unit will be freed up for these dates.",
          actionLabel: "Cancel Booking",
          isPending: cancelMutation.isPending,
          requireNotes: true,
        };
      case "complete":
        return {
          title: "Complete Booking",
          description:
            "Mark the booking as completed. Use this when the client has checked out normally at the end of their stay.",
          actionLabel: "Complete Booking",
          isPending: completeMutation.isPending,
        };
      default:
        return {
          title: "",
          description: "",
          actionLabel: "",
          isPending: false,
        };
    }
  };

  const dialogConfig = getDialogConfig();

  return (
    <div className="space-y-4">
      {/* Debug info */}
      <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
        <div className="font-semibold">Debug Info:</div>
        <div>
          Current Status (raw):{" "}
          <span className="font-bold">{currentStatus}</span>
        </div>
        <div>
          Current Status (normalized):{" "}
          <span className="font-bold">
            {currentStatus.charAt(0).toUpperCase() +
              currentStatus.slice(1).toLowerCase()}
          </span>
        </div>
        <div>
          Available Transitions:{" "}
          <span className="font-bold">
            {validTransitions.join(", ") || "None"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {validTransitions.includes("Confirmed") && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => setActiveAction("confirm")}
            className="shadow-md hover:shadow-lg"
          >
            <CheckCircle className="mr-2 h-5 w-5" />✓ Confirm Booking
          </Button>
        )}
        {validTransitions.includes("Completed") && (
          <Button
            variant="success"
            size="lg"
            onClick={() => setActiveAction("complete")}
            className="shadow-md hover:shadow-lg"
          >
            <CheckSquare className="mr-2 h-5 w-5" />☑ Complete Booking
          </Button>
        )}
        {validTransitions.includes("Cancelled") && (
          <Button
            variant="danger"
            size="lg"
            onClick={() => setActiveAction("cancel")}
            className="shadow-md hover:shadow-lg"
          >
            <XCircle className="mr-2 h-5 w-5" />✗ Cancel Booking
          </Button>
        )}

        {activeAction && (
          <LifecycleActionDialog
            open={!!activeAction}
            onOpenChange={(open) => !open && setActiveAction(null)}
            onConfirm={handleActionComplete}
            {...dialogConfig}
          />
        )}
      </div>

      {validTransitions.length === 0 && (
        <div className="rounded-md bg-neutral-100 p-4 text-center text-sm text-neutral-600">
          <p className="font-semibold">No actions available</p>
          <p className="mt-1 text-xs">
            This booking is in a terminal state ({currentStatus})
          </p>
        </div>
      )}
    </div>
  );
}
