import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../components/theme-provider";
import { IntroSplash } from "../components/intro-splash";
import { I18nProvider } from "../lib/i18n";
import { CurrencyProvider } from "../lib/currency";
import { AutoTranslateProvider, useTranslationReady } from "../lib/auto-translate";
import { BrandLogo } from "../components/brand-logo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MansourAlmailScores — Live Football Scores" },
      {
        name: "description",
        content:
          "Live scores, match centers, lineups, and coverage of the best leagues of the world.",
      },
      { name: "author", content: "MansourAlmailScores" },
      { name: "theme-color", content: "#0a1628" },
      { property: "og:title", content: "MansourAlmailScores — Live Football Scores" },
      {
        property: "og:description",
        content:
          "Live scores, match centers, lineups, and coverage of the best leagues of the world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MansourAlmailScores — Live Football Scores" },
      { name: "twitter:description", content: "Live scores, match centers, lineups, and coverage of the best leagues of the world." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab9f645-fd29-4918-b6f6-f8760815f669/id-preview-291137d6--552dae1c-a8e4-4697-9e43-5a409c40ae78.lovable.app-1784632724087.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab9f645-fd29-4918-b6f6-f8760815f669/id-preview-291137d6--552dae1c-a8e4-4697-9e43-5a409c40ae78.lovable.app-1784632724087.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <CurrencyProvider>
            <AutoTranslateProvider>
              <IntroSplash />
              <LanguageReadyGate><Outlet /></LanguageReadyGate>
            </AutoTranslateProvider>
          </CurrencyProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function LanguageReadyGate({ children }: { children: ReactNode }) {
  const ready = useTranslationReady();
  return (
    <>
      <div className={ready ? "contents" : "pointer-events-none select-none opacity-0"}>{children}</div>
      {!ready && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <BrandLogo className="h-14" />
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm font-semibold">جارٍ تجهيز النسخة العربية…</p>
          </div>
        </div>
      )}
    </>
  );
}
