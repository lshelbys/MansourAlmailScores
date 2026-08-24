import { User } from "lucide-react";

const SIZES = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-24 w-24" } as const;
const ICONS = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-12 w-12" } as const;

/** Player photo with a person icon fallback (never a bare question mark). */
export function PlayerAvatar({ src, name, size = "sm", className = "" }: { src?: string | null; name?: string | null; size?: keyof typeof SIZES; className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${SIZES[size]} ${className}`}>
      {src ? <img src={src} alt={name ?? ""} className="h-full w-full object-cover" /> : <User className={`${ICONS[size]} text-muted-foreground`} />}
    </div>
  );
}
