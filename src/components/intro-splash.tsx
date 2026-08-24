import { useEffect, useState } from "react";
import logoLight from "@/assets/logo-mark-v2.png.asset.json";
import logoDark from "@/assets/logo-mark-dark.png";
import { useTheme } from "./theme-provider";

const SESSION_KEY = "mas-intro-shown";

export function IntroSplash() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 1600);
    const hideTimer = setTimeout(() => setVisible(false), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;
  const isLight = theme === "light";
  const src = isLight ? logoLight.url : logoDark;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"} ${isLight ? "bg-white" : "bg-[#050b1a]"}`}
      aria-hidden="true"
    >
      <div
        className={`pointer-events-none absolute inset-0 opacity-40 ${
          isLight
            ? "[background:radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.18),transparent_60%)]"
            : "[background:radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.35),transparent_60%)]"
        }`}
      />
      <div className="relative flex flex-col items-center gap-6 px-6">
        <div className="animate-mas-logo-in flex flex-col items-center gap-4">
          <img
            src={src}
            alt="MansourAlmailScores"
            className={`h-auto w-[min(220px,50vw)] ${isLight ? "" : "drop-shadow-[0_0_40px_rgba(37,99,235,0.45)]"}`}
          />
          <div className={`text-2xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>MansourAlmailScores</div>
        </div>
      </div>
    </div>
  );
}