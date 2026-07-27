import { Check, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  CrmBookingWizardCopy,
  CrmBookingWizardStep,
  CrmBookingWizardStepId,
} from "./crm-booking-wizard";

interface CrmBookingWizardStepperProps {
  steps: CrmBookingWizardStep[];
  currentStep: CrmBookingWizardStepId;
  copy: CrmBookingWizardCopy;
  onStepChange: (step: CrmBookingWizardStepId) => void;
}

export function CrmBookingWizardStepper({
  steps,
  currentStep,
  copy,
  onStepChange,
}: CrmBookingWizardStepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep)
  );
  const current = steps[currentIndex];

  return (
    <nav aria-label={copy.title}>
      <div className="sm:hidden">
        <p className="text-xs font-medium tabular-nums text-neutral-500">
          {copy.stepCount(currentIndex + 1, steps.length)}
        </p>
        <p className="mt-1 text-sm font-semibold text-neutral-900">
          {current?.label}
        </p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-200 motion-reduce:transition-none"
            style={{
              width: `${((currentIndex + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <ol className="hidden grid-cols-[repeat(var(--wizard-steps),minmax(0,1fr))] gap-2 sm:grid">
        {steps.map((step, index) => {
          const canNavigate =
            step.status === "completed" || step.status === "current";
          const statusLabel =
            step.status === "current"
              ? copy.currentStep
              : step.status === "completed"
                ? copy.completedStep
                : step.status === "blocked"
                  ? copy.blockedStep
                  : copy.upcomingStep;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => canNavigate && onStepChange(step.id)}
                disabled={!canNavigate || step.id === currentStep}
                aria-current={step.id === currentStep ? "step" : undefined}
                aria-label={`${step.label}. ${statusLabel}`}
                className={cn(
                  "group flex min-h-11 w-full items-center gap-2 rounded-[var(--portal-radius-control)] px-2 py-2 text-start transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                  step.status === "current" && "bg-primary-50 text-primary-800",
                  step.status === "completed" &&
                    "text-neutral-700 hover:bg-neutral-100",
                  (step.status === "upcoming" ||
                    step.status === "blocked") &&
                    "cursor-not-allowed text-neutral-400"
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                    step.status === "current" &&
                      "border-primary-600 bg-primary-600 text-white",
                    step.status === "completed" &&
                      "border-success bg-success-bg text-success",
                    (step.status === "upcoming" ||
                      step.status === "blocked") &&
                      "border-neutral-300 bg-white text-neutral-500"
                  )}
                  aria-hidden="true"
                >
                  {step.status === "completed" ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : step.status === "blocked" ? (
                    <LockKeyhole size={13} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
                    {statusLabel}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
