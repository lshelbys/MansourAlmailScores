import { useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { inputCls, btnGhost } from "./ui";
import { uploadMedia } from "./upload";
import { mediaThumb, youtubeId } from "@/components/media-gallery";

/** Shared media gallery editor: photo uploads plus video/social links. */
export function MediaUrls({ urls, onChange, bucket = "player-photos" }: { urls: string[]; onChange: (v: string[]) => void; bucket?: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const add = (url: string) => { if (url.trim() && !urls.includes(url.trim())) onChange([...urls, url.trim()]); };
  return (
    <div className="grid gap-2">
      {urls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {urls.map((u) => {
            const yt = youtubeId(u);
            const thumb = mediaThumb(u);
            return (
              <div key={u} className="relative overflow-hidden rounded-lg border border-border bg-background">
                {thumb
                  ? <img src={thumb} alt="" className="h-20 w-full object-cover" />
                  : <div className="flex h-20 flex-col items-center justify-center px-2 text-center text-[0.6rem] font-semibold text-muted-foreground">Link<span className="w-full truncate">{u}</span></div>}
                {yt && <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1 text-[0.55rem] font-bold">Video</span>}
                <button type="button" aria-label="Remove media" onClick={() => onChange(urls.filter((x) => x !== u))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input className={inputCls} placeholder="YouTube, Instagram, TikTok, Facebook or image link" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className={btnGhost} onClick={() => { add(value); setValue(""); }}><Plus className="h-3.5 w-3.5" /> Add link</button>
        <label className={`${btnGhost} cursor-pointer`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Upload photos
          <input className="sr-only" type="file" accept="image/*" multiple onChange={async (e) => {
            const files = Array.from(e.target.files ?? []); e.target.value = "";
            if (!files.length) return;
            setBusy(true);
            const uploaded: string[] = [];
            for (const file of files) { const url = await uploadMedia(bucket, file); if (url) uploaded.push(url); }
            onChange([...urls, ...uploaded]);
            setBusy(false);
          }} />
        </label>
      </div>
    </div>
  );
}
