import { findCountry } from "@/lib/countries";

const SIZES = { xs: "h-3 w-[1.125rem]", sm: "h-3.5 w-[1.3rem]", md: "h-4 w-6", lg: "h-5 w-7" } as const;

/** Real flag image (not the OS emoji font) rendered from an ISO country code. */
export function FlagIcon({
  value,
  size = "sm",
  className = "",
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const c = findCountry(value);
  if (!c) return null;
  const code = c.code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={`${c.name} flag`}
      title={c.name}
      loading="lazy"
      className={`${SIZES[size]} shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 ${className}`}
    />
  );
}

/** Flag image + country name. */
export function FlagLabel({
  value,
  size = "sm",
  className = "",
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const c = findCountry(value);
  if (!c) return value ? <span className={className}>{value}</span> : null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FlagIcon value={c.code} size={size} />
      <span className="truncate">{c.name}</span>
    </span>
  );
}
