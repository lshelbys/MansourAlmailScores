import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FileArchive, Download, Terminal } from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download project — MansourAlmailScores" },
      { name: "description", content: "Download the complete MansourAlmailScores source code archive and deploy it to Vercel." },
      { property: "og:title", content: "Download project — MansourAlmailScores" },
      { property: "og:description", content: "Grab the full source archive of MansourAlmailScores and deploy it anywhere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DownloadPage,
});

const FILE = "/mansouralmailscores-project.tar.gz";

const steps: Array<{ label: string; code: string }> = [
  { label: "Extract the archive", code: "tar -xzf mansouralmailscores-project.tar.gz" },
  { label: "Install dependencies", code: "npm install" },
  { label: "Push to GitHub", code: "git init\ngit add .\ngit commit -m \"MansourAlmailScores\"\ngit remote add origin https://github.com/YOUR_USERNAME/mansouralmailscores.git\ngit push -u origin main" },
  { label: "Deploy on Vercel", code: "Import the repo on vercel.com, framework preset: Vite,\nbuild command: npm run build, output: dist" },
];

const envVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_API_KEY"];

function DownloadPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <FileArchive className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Download MansourAlmailScores</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The complete source code — routes, admin panel, Almail AI, translations and database migrations — ready to deploy.
        </p>
        <a
          href={FILE}
          download="mansouralmailscores-project.tar.gz"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Download archive (.tar.gz)
        </a>
        <p className="mt-3 text-xs text-muted-foreground">
          If the download does not start inside the preview, open <span className="font-mono">{FILE}</span> in a new browser tab.
        </p>
      </div>

      <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-primary" /> Deploy to Vercel</div>
        <ol className="mt-4 grid gap-4">
          {steps.map((s, i) => (
            <li key={s.label} className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                {s.label}
              </div>
              <pre className="overflow-x-auto rounded-2xl border border-border bg-background p-3 text-left text-xs leading-relaxed"><code>{s.code}</code></pre>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-4 max-w-2xl rounded-3xl border border-border bg-card p-6">
        <div className="text-sm font-bold">Environment variables to set on Vercel</div>
        <p className="mt-1 text-xs text-muted-foreground">Copy these from your backend settings — the archive ships without secrets.</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {envVars.map((v) => (
            <li key={v} className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs">{v}</li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}