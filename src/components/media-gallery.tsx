import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";

/** YouTube video id from any common share/watch/shorts link. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) || /\/storage\/v1\/object\//.test(url);
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Best available preview image for a media link (photo itself or video thumbnail). */
export function mediaThumb(url: string): string | null {
  if (isImageUrl(url)) return url;
  const yt = youtubeId(url);
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;
}

/** Renders a mixed list of links: photos inline, YouTube embedded, everything else as a link card. */
export function MediaGallery({ urls, className = "" }: { urls: string[]; className?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {urls.map((url) => {
        const yt = youtubeId(url);
        if (yt) {
          if (playing !== url) {
            return (
              <button key={url} type="button" onClick={() => setPlaying(url)}
                className="group relative overflow-hidden rounded-2xl border border-border bg-black">
                <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover transition group-hover:opacity-80" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground"><Play className="h-5 w-5" /></span>
                </span>
              </button>
            );
          }
          return (
            <div key={url} className="overflow-hidden rounded-2xl border border-border bg-black">
              <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${yt}?autoplay=1`} title="Video" loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          );
        }
        if (isImageUrl(url)) {
          return <img key={url} src={url} alt="" loading="lazy" className="h-48 w-full rounded-2xl border border-border object-cover" />;
        }
        return (
          <a key={url} href={url} target="_blank" rel="noreferrer"
            className="flex h-48 flex-col justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-primary">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{host(url)}</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">Open media <ExternalLink className="h-4 w-4" /></span>
          </a>
        );
      })}
    </div>
  );
}
