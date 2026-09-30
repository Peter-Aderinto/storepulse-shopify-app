import type { LinksFunction } from "react-router";
import dashboardStyles from "./styles/dashboard.css?url";
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: dashboardStyles },
  { rel: "icon", type: "image/svg+xml", href: "/brand/storepulse-mark.svg" },
];
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
