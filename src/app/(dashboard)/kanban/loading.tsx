export default function Loading() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="min-w-[280px]">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="bg-muted/30 rounded-lg p-2 min-h-[400px] space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="bg-card border border-border rounded-lg p-3 space-y-2 animate-pulse">
                <div className="h-3 w-12 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
