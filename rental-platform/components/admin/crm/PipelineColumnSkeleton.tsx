import { SkeletonText } from "@/components/ui/SkeletonText";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

export function PipelineColumnSkeleton() {
  return (
    <div className="bg-neutral-100/60 flex h-full min-h-0 w-[330px] min-w-[330px] max-w-[330px] shrink-0 flex-col overflow-hidden rounded-[var(--portal-radius-card)] border border-neutral-200">
      <div className="flex min-h-10 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 py-2">
        <SkeletonText className="h-5 w-1/2" />
        <div className="h-5 w-6 animate-pulse rounded-full bg-neutral-200" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2">
        <SkeletonCard showImage={false} lines={2} />
        <SkeletonCard showImage={false} lines={2} />
        <SkeletonCard showImage={false} lines={2} />
      </div>
    </div>
  );
}
