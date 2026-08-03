import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  HISTORICAL_WIZARD_STEPS,
  type HistoricalWizardStep,
} from "@/lib/historical-bookings/wizard";

interface HistoricalWizardStepperProps {
  currentStep: HistoricalWizardStep;
  furthestStep: HistoricalWizardStep;
  disabled: boolean;
  invalidStep?: HistoricalWizardStep;
  onStepSelect: (step: HistoricalWizardStep) => void;
}

export function HistoricalWizardStepper({
  currentStep,
  furthestStep,
  disabled,
  invalidStep,
  onStepSelect,
}: HistoricalWizardStepperProps) {
  return (
    <nav
      aria-label="Historical booking steps"
      className="border-b border-neutral-200 bg-white"
    >
      <ol className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6">
        {HISTORICAL_WIZARD_STEPS.map((step, index) => {
          const number = (index + 1) as HistoricalWizardStep;
          const isCurrent = number === currentStep;
          const isComplete = number < currentStep || number < furthestStep;
          const isReachable = number <= furthestStep;
          const isInvalid = number === invalidStep;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={disabled || !isReachable}
                onClick={() => onStepSelect(number)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={
                  isInvalid ? `${step.label}, contains errors` : step.label
                }
                className={cn(
                  "flex min-h-[68px] w-full items-center gap-2 border-b-2 px-3 text-start transition-colors",
                  isCurrent
                    ? "border-primary-600 bg-primary-50 text-neutral-900"
                    : "border-transparent text-neutral-500",
                  isReachable &&
                    !isCurrent &&
                    "hover:bg-neutral-50 hover:text-neutral-800",
                  isInvalid && "border-error bg-error-bg",
                  !isReachable && "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    isCurrent && "border-primary-600 bg-primary-600 text-white",
                    isComplete &&
                      !isCurrent &&
                      "border-success bg-success text-white",
                    !isCurrent &&
                      !isComplete &&
                      "border-neutral-300 bg-white text-neutral-500"
                  )}
                >
                  {isComplete && !isCurrent ? (
                    <Check aria-hidden size={14} />
                  ) : (
                    number
                  )}
                </span>
                <span className="min-w-0 text-xs font-medium leading-4 sm:text-sm">
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
