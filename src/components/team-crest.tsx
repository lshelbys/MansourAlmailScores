/** Club crest with an automatic two-letter monogram when no logo is uploaded. */
export function TeamCrest({ name, logo, className = "h-9 w-9", rounded = "rounded-lg" }: { name?: string | null; logo?: string | null; className?: string; rounded?: string }) {
  if (logo) return <img src={logo} alt="" className={`${className} object-contain`} />;
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const mono = (words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  return (
    <span className={`${className} ${rounded} inline-flex items-center justify-center border border-border bg-muted text-[0.6rem] font-black leading-none tracking-tight text-muted-foreground`}>
      {mono}
    </span>
  );
}
