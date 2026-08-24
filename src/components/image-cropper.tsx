import { useEffect, useRef, useState } from "react";

/**
 * Lightweight crop dialog: drag to pan, slider to zoom, exports a PNG File.
 * Used everywhere an image is uploaded or replaced in the admin panel.
 */
export function ImageCropper({
  file,
  src,
  aspect = 1,
  onCancel,
  onDone,
}: {
  file?: File | null;
  src?: string | null;
  aspect?: number;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setUrl(src ?? null);
    return undefined;
  }, [file, src]);

  useEffect(() => {
    if (!url) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => { setImg(image); setZoom(1); setOffset({ x: 0, y: 0 }); };
    image.onerror = () => setFailed(true);
    image.src = url;
  }, [url]);

  const commit = async () => {
    const box = boxRef.current;
    if (!img || !box) return;
    setBusy(true);
    try {
      const boxW = box.clientWidth;
      const boxH = box.clientHeight;
      const base = Math.max(boxW / img.width, boxH / img.height);
      const scale = base * zoom;
      const out = document.createElement("canvas");
      const outW = 1024;
      out.width = outW;
      out.height = Math.round(outW / aspect);
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const ratio = out.width / boxW;
      ctx.imageSmoothingQuality = "high";
      const drawW = img.width * scale * ratio;
      const drawH = img.height * scale * ratio;
      const cx = out.width / 2 + offset.x * ratio;
      const cy = out.height / 2 + offset.y * ratio;
      ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("no blob");
      const name = `${file?.name.replace(/\.[^.]+$/, "") ?? "image"}-crop.png`;
      const cropped = typeof File === "function"
        ? new File([blob], name, { type: "image/png", lastModified: Date.now() })
        : Object.assign(blob, { name, lastModified: Date.now() }) as File;
      await onDone(cropped);
    } catch {
      setError("The crop could not be saved. Please try another image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overscroll-contain bg-black/70 p-3 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Crop image</h3>
          <button onClick={onCancel} className="rounded-full px-2 text-sm text-muted-foreground hover:bg-accent">✕</button>
        </div>
        {failed ? (
          <p className="text-xs text-muted-foreground">This image can’t be cropped in the browser. Upload a new file to crop it.</p>
        ) : (
          <>
            <div
              ref={boxRef}
              className="relative w-full touch-none overflow-hidden rounded-2xl border border-border bg-muted"
              style={{ aspectRatio: String(aspect) }}
               onPointerDown={(e) => { e.preventDefault(); drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
               onPointerUp={(e) => { drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
               onPointerCancel={() => { drag.current = null; }}
            >
              {url && (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                   style={{
                     transform: `translate(-50%,-50%) translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
                     width: img && img.width / img.height >= aspect ? "auto" : "100%",
                     height: img && img.width / img.height >= aspect ? "100%" : "auto",
                   }}
                />
              )}
            </div>
            <label className="mt-3 block text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Zoom
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          </>
        )}
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-medium" onClick={onCancel}>Cancel</button>
          {!failed && <button disabled={busy || !img} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60" onClick={commit}>{busy ? "Saving…" : "Use crop"}</button>}
        </div>
      </div>
    </div>
  );
}
