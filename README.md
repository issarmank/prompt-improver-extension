# Prompt Polish

https://github.com/user-attachments/assets/312e3bb9-f5ad-4581-895a-e4e453180d93

A Chrome extension (Manifest V3) that improves your prompt before you send it to a
web-based LLM chat interface (ChatGPT, Claude, Gemini, Grok, DeepSeek).

## Repository layout

- `extension/` — the Chrome extension (TypeScript, Vite + @crxjs/vite-plugin, Vitest)
- `server/` — the backend that proxies rewrite requests to the LLM API (TypeScript, Express)

## Development

```bash
npm install        # installs all workspaces
npm run build      # builds every workspace
npm test           # runs every workspace's tests
npm run lint       # ESLint across the repo
```

## Pointing the extension at a backend

The extension talks to the `server/` backend, never to the LLM directly. Which
backend a build targets is decided at build time by `VITE_BACKEND_URL`:

```bash
# extension/.env.production
VITE_BACKEND_URL=https://your-backend-host
```

Unset, builds fall back to `http://localhost:8787` — the dev server from
`server/docker-compose.yml` — so local work needs no configuration.

One variable drives two things that must agree: the URL the service worker
fetches, and the `host_permissions` entry in the generated manifest. MV3 only
waives CORS for hosts declared in `host_permissions`, so a build whose backend
is missing from that list fails at runtime with no useful error. `vite.config.ts`
resolves the value once and feeds both, and `extension/tests/manifest.test.ts`
pins the derivation.

The server has a matching setting: `EXTENSION_ORIGIN`, a comma-separated CORS
allowlist of `chrome-extension://<id>` origins (see `server/.env.example`). An
unpacked extension's id comes from its install path and changes if the folder
moves; publishing to the Web Store assigns a different, permanent one. Requests
with no `Origin` header pass through, so `curl` works regardless.

## Loading the extension unpacked

1. Run `npm run build` (output lands in `extension/dist/`)
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/dist/` directory

## Adding a new site adapter

Site adapters live in `extension/src/content/sites/`. Each adapter is a small module
implementing the `SiteAdapter` interface from `types.ts` (`findInputElement()`,
`findButtonSlot()`, `getText()`, `setText()`), so adding a site never touches
shared logic. Log any selector/DOM research in `NOTES.md`.

`findButtonSlot()` says where in the site's *own* composer action row — the row
with the model picker, mic and send controls — the Improve button belongs. Most
sites need one line:

```ts
findButtonSlot(input) {
  return slotLeftOf(input, ['button[aria-label*="Model select" i]']);
}
```

`slotLeftOf()` (in `sites/slot.ts`) takes landmark selectors in priority order,
finds the first one inside the composer, climbs to the row that holds it, and
docks the button immediately to its left. Pick a landmark that is always present
and never a hashed class name — note that claude and gemini have no send button
at all. Returning `null` means the button does not render on that site, which is
the intended failure mode: it shows in the action row or nowhere.
