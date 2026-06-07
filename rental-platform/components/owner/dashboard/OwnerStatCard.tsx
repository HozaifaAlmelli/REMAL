interface OwnerStatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
}

export function OwnerStatCard({ label, value, subValue }: OwnerStatCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-neutral-900">
        {value}
      </p>
      {subValue && (
        <p className="mt-1 text-xs text-neutral-400">{subValue}</p>
      )}
    </div>
  );
}
