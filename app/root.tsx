import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { version } from "../package.json";
import "./app.css";

const runtimeVersion = encodeURIComponent(version);

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "manifest", href: "/site.webmanifest" },
  { rel: "preload", href: `/cores/nesbox_fceux.js?v=${runtimeVersion}`, as: "script" },
  { rel: "preload", href: `/cores/vendor/fceux.wasm?v=${runtimeVersion}`, as: "fetch", type: "application/wasm", crossOrigin: "anonymous" },
  { rel: "preload", href: `/cores/nesbox_snes.js?v=${runtimeVersion}`, as: "script" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Unexpected error";
  const details = isRouteErrorResponse(error) ? error.data : error instanceof Error ? error.message : "";

  return (
    <main className="error-page">
      <section>
        <h1>{message}</h1>
        <p>{String(details)}</p>
      </section>
    </main>
  );
}
