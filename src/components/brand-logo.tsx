import logoDark from "@/assets/logo-mark-dark.png";
import { useI18n } from "@/lib/i18n";

interface BrandLogoProps {
  variant?: "horizontal" | "icon";
  className?: string;
  showWordmark?: boolean;
}

/** Two artwork variants keep the blue mark blue: navy on light, white on dark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <img src={logoDark} alt="MansourAlmailScores" className={`${className ?? ""} brightness-0 dark:brightness-100`} />
    </>
  );
}

export function BrandLogo({ className, showWordmark = true, variant }: BrandLogoProps) {
  if (variant === "icon" || !showWordmark) {
    return <LogoMark className={className} />;
  }
  return <Wordmark className={className} />;
}

/** Arabic gets its own typeset wordmark so the brand never falls back to Latin text. */
function Wordmark({ className }: { className?: string }) {
  const { lang } = useI18n();
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-full w-auto object-contain" />
      {lang === "ar" ? (
        <span className="flex flex-col leading-none">
          <span className="text-[0.95rem] font-black tracking-tight">منصور الميل</span>
          <span className="text-[0.7rem] font-bold tracking-[0.2em] text-primary">سكورز</span>
        </span>
      ) : (
        <span className="text-base font-black tracking-tight">MansourAlmailScores</span>
      )}
    </span>
  );
}
