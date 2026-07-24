import { SkeletonText } from "@/components/ui/SkeletonText";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

export function PipelineColumnSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-[330px] min-w-[330px] max-w-[330px] shrink-0 flex-col gap-3 rounded-lg bg-neutral-50 p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <SkeletonText className="h-5 w-1/2" />
        <div className="h-5 w-6 animate-pulse rounded-full bg-neutral-200" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
        <SkeletonCard showImage={false} lines={2} />
        <SkeletonCard showImage={false} lines={2} />
        <SkeletonCard showImage={false} lines={2} />
      </div>
    </div>
  );
}
