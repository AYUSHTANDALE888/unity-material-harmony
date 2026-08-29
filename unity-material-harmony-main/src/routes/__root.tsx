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
import { NummProvider } from "@/store/numm-store";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function NotFoundComponent() {
  const router = useRouter();
  const path = typeof window !== "undefined" ? window.location.pathname.toLowerCase() : "";
  const isGraphQuery = path.includes("graph") || path.includes("text");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isGraphQuery
            ? "Looking for the Material Knowledge Graph or Graph Text explorer?"
            : "This module does not exist in the NUMM prototype environment."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isGraphQuery && (
            <Link
              to="/graph"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open Knowledge Graph & Graph Text
            </Link>
          )}
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Return to overview
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This module didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The registry service could not be reached. Retry the request or return to the overview.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go to overview
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
      { title: "NUMM — National Unified Material Master" },
      {
        name: "description",
        content:
          "Material code standardisation, duplicate detection and governance platform for Indian CPSEs.",
      },
      { name: "author", content: "NUMM Programme Office" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
      {
        rel: "icon",
        href: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmdHcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBGMTcyQSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImFjY2VudEdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzhCREY4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzI1NjNFQiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ29sZEdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRjU5RTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0Q5NzcwNiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPCEtLSBCYXNlIHJvdW5kZWQgc2hpZWxkL3NxdWFyZSAtLT4KICA8cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0idXJsKCNiZ0dyYWQpIi8+CiAgPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjYyIiBoZWlnaHQ9IjYyIiByeD0iMTMiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzNDE1NSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1vcGFjaXR5PSIwLjYiLz4KICA8IS0tIER5bmFtaWMgZ2VvbWV0cmljIGNvbm5lY3Rpdml0eSBub2RlcyAtLT4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIzIiBmaWxsPSIjMzhCREY4IiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjE2IiByPSIzIiBmaWxsPSIjRjU5RTBCIiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ4IiByPSIzIiBmaWxsPSIjMTBCOTgxIiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjQ4IiByPSIzIiBmaWxsPSIjNjM2NkYxIiBvcGFjaXR5PSIwLjgiLz4KICA8bGluZSB4MT0iMTYiIHkxPSIxNiIgeDI9IjQ4IiB5Mj0iMTYiIHN0cm9rZT0iIzQ3NTU2OSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIyIDIiIG9wYWNpdHk9IjAuNSIvPgogIDxsaW5lIHgxPSI0OCIgeTE9IjE2IiB4Mj0iNDgiIHkyPSI0OCIgc3Ryb2tlPSIjNDc1NTY5IiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1kYXNoYXJyYXk9IjIgMiIgb3BhY2l0eT0iMC41Ii8+CiAgPGxpbmUgeDE9IjQ4IiB5MT0iNDgiIHgyPSIxNiIgeTI9IjQ4IiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWRhc2hhcnJheT0iMiAyIiBvcGFjaXR5PSIwLjUiLz4KICA8bGluZSB4MT0iMTYiIHkxPSI0OCIgeDI9IjE2IiB5Mj0iMTYiIHN0cm9rZT0iIzQ3NTU2OSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIyIDIiIG9wYWNpdHk9IjAuNSIvPgogIDwhLS0gQ2VudHJhbCBOTSBUeXBvZ3JhcGh5IC8gTW9ub2dyYW0gLS0+CiAgPHRleHQgeD0iMzIiIHk9IjM5IiBmb250LWZhbWlseT0iJ0lCTSBQbGV4IFNhbnMnLCAnSW50ZXInLCBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjIiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSItMC41Ij5OTTwvdGV4dD4KICA8IS0tIEJvdHRvbSBzdGF0dXMgLyBuYXRpb25hbCBhY2NlbnQgYmFyIC0tPgogIDxyZWN0IHg9IjIyIiB5PSI0NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIuNSIgcng9IjEuMjUiIGZpbGw9InVybCgjZ29sZEdyYWQpIi8+Cjwvc3ZnPgo=",
        type: "image/svg+xml",
      },
      { rel: "icon", href: "/favicon.svg?v=10", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico?v=10", sizes: "any" },
      { rel: "shortcut icon", href: "/favicon.ico?v=10" },
      {
        rel: "apple-touch-icon",
        href: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmdHcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBGMTcyQSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImFjY2VudEdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzhCREY4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzI1NjNFQiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ29sZEdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRjU5RTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0Q5NzcwNiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPCEtLSBCYXNlIHJvdW5kZWQgc2hpZWxkL3NxdWFyZSAtLT4KICA8cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0idXJsKCNiZ0dyYWQpIi8+CiAgPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjYyIiBoZWlnaHQ9IjYyIiByeD0iMTMiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzNDE1NSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1vcGFjaXR5PSIwLjYiLz4KICA8IS0tIER5bmFtaWMgZ2VvbWV0cmljIGNvbm5lY3Rpdml0eSBub2RlcyAtLT4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIzIiBmaWxsPSIjMzhCREY4IiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjE2IiByPSIzIiBmaWxsPSIjRjU5RTBCIiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ4IiByPSIzIiBmaWxsPSIjMTBCOTgxIiBvcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjQ4IiByPSIzIiBmaWxsPSIjNjM2NkYxIiBvcGFjaXR5PSIwLjgiLz4KICA8bGluZSB4MT0iMTYiIHkxPSIxNiIgeDI9IjQ4IiB5Mj0iMTYiIHN0cm9rZT0iIzQ3NTU2OSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIyIDIiIG9wYWNpdHk9IjAuNSIvPgogIDxsaW5lIHgxPSI0OCIgeTE9IjE2IiB4Mj0iNDgiIHkyPSI0OCIgc3Ryb2tlPSIjNDc1NTY5IiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1kYXNoYXJyYXk9IjIgMiIgb3BhY2l0eT0iMC41Ii8+CiAgPGxpbmUgeDE9IjQ4IiB5MT0iNDgiIHgyPSIxNiIgeTI9IjQ4IiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWRhc2hhcnJheT0iMiAyIiBvcGFjaXR5PSIwLjUiLz4KICA8bGluZSB4MT0iMTYiIHkxPSI0OCIgeDI9IjE2IiB5Mj0iMTYiIHN0cm9rZT0iIzQ3NTU2OSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIyIDIiIG9wYWNpdHk9IjAuNSIvPgogIDwhLS0gQ2VudHJhbCBOTSBUeXBvZ3JhcGh5IC8gTW9ub2dyYW0gLS0+CiAgPHRleHQgeD0iMzIiIHk9IjM5IiBmb250LWZhbWlseT0iJ0lCTSBQbGV4IFNhbnMnLCAnSW50ZXInLCBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjIiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSItMC41Ij5OTTwvdGV4dD4KICA8IS0tIEJvdHRvbSBzdGF0dXMgLyBuYXRpb25hbCBhY2NlbnQgYmFyIC0tPgogIDxyZWN0IHg9IjIyIiB5PSI0NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIuNSIgcng9IjEuMjUiIGZpbGw9InVybCgjZ29sZEdyYWQpIi8+Cjwvc3ZnPgo=",
      },
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
      <NummProvider>
        <TooltipProvider delayDuration={300}>
          <AppShell>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </AppShell>
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </NummProvider>
    </QueryClientProvider>
  );
}
