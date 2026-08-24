import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

/**
 * Destructive confirmation dialog that requires the user to type an exact word
 * before the action button becomes available.
 */
export function ConfirmDelete({
  open,
  title,
  description,
  confirmWord,
  actionLabel = "Delete",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmWord: string;
  actionLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setValue(""); setBusy(false); } }, [open]);
  if (!open) return null;

  const ready = value.trim().toLowerCase() === confirmWord.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground/60 p-3 backdrop-blur-sm sm:p-6" onClick={onCancel}>
      <div className="my-8 w-full max-w-md rounded-3xl border border-destructive/40 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertTriangle className="h-4 w-4" /> {title}</div>
        {description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        <p className="mt-4 text-xs font-semibold">Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-destructive">{confirmWord}</span> to confirm</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={confirmWord}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-destructive sm:py-2 sm:text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium hover:bg-accent">Cancel</button>
          <button
            disabled={!ready || busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-destructive px-4 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
