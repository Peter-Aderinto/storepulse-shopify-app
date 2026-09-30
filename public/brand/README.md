# StorePulse identity

An original storefront outline crossed by a pulse trace: catalog health and monitoring. The single brand accent is forest green, `#217451`; semantic success/warning/critical colors remain separate from the identity.

- `storepulse-mark.svg`: vector source and in-app mark. Also configured as the document favicon in `app/root.tsx`.
- `storepulse-app-icon-1200.png`: square 1200 × 1200 PNG with opaque background and no rounded corners, ready for Shopify's app icon setting.
- `../favicon.ico`: matching 32px browser fallback.

The Shopify Admin/app-list icon is configured in **Dev Dashboard → Mastersales → StorePulse → Settings → App icon**. Upload `storepulse-app-icon-1200.png` there. This setting is not supported in `shopify.app.toml`; no fictional TOML field is added. The account-level upload has not been performed as part of this local visual review.

Specifications: [Shopify visual design — App icon](https://shopify.dev/docs/apps/design/visual-design#app-icon). Configuration location: [Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard).

The SVG is the editable source. The PNG and ICO were rendered from it using Chromium without adding project dependencies. Keep the white mark and adequate inset when exporting. Round the SVG container in the interface only; keep the Shopify upload square.
