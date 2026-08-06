# Prompt Polish

A Chrome extension (Manifest V3) that improves your prompt before you send it to a
web-based LLM chat interface (ChatGPT, Claude, Gemini, Groq, Deepseek).

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

## Loading the extension unpacked

1. Run `npm run build` (output lands in `extension/dist/`)
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/dist/` directory

## Adding a new site adapter

Site adapters live in `extension/src/content/sites/`. Each adapter is a small module
implementing the `SiteAdapter` interface from `types.ts` (`findInputElement()`,
`getText()`, `setText()`), so adding a site never touches shared logic. Log any
selector/DOM research in `NOTES.md`.
