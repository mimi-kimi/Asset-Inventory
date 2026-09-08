export function PhotoGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {urls.map((url, idx) => (
        <a
          key={`${url}-${idx}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Inspection photo ${idx + 1}`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
