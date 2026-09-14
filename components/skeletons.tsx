/** Lightweight skeleton blocks used by the route-level loading states. */

export function PanelSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-zinc-100 ${className}`} />
  );
}

export function MapSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full animate-pulse">
      <aside className="hidden w-[260px] flex-col gap-3 border-r border-zinc-200 bg-white p-4 xl:flex">
        <PanelSkeleton className="h-24" />
        <PanelSkeleton className="h-64" />
      </aside>
      <div className="flex-1 p-3">
        <PanelSkeleton className="h-full bg-zinc-200/70" />
      </div>
      <aside className="hidden w-[280px] flex-col gap-3 border-l border-zinc-200 bg-white p-4 xl:flex">
        <PanelSkeleton className="h-24" />
        <PanelSkeleton className="h-44" />
      </aside>
    </div>
  );
}

export function TableSkeleton({
  title = "Loading…",
  rows = 6,
}: {
  title?: string;
  rows?: number;
}) {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-300">{title}</h1>
        <PanelSkeleton className="h-4 w-56" />
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="h-11 border-b border-zinc-200 bg-zinc-50" />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-b-0"
          >
            <PanelSkeleton className="h-4 flex-1" />
            <PanelSkeleton className="h-4 w-24" />
            <PanelSkeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileScreenSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <PanelSkeleton className="h-24" />
      <PanelSkeleton className="h-16" />
      <PanelSkeleton className="h-16" />
      <PanelSkeleton className="h-16" />
    </div>
  );
}
