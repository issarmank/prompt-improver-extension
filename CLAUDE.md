This is a repo for a Chrome extension called "Prompt Polish" —
Manifest V3, TypeScript, Vite + @crxjs/vite-plugin, Vitest for tests,
ESLint + Prettier.

## Standing conventions

- Commit after every logical unit of work is complete and verified —
  never commit a build that fails or tests that don't pass
- Commit format: `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`,
  one feature per commit
- Before committing: `npm run build` must succeed and `npm test` must pass
- Never touch a site's own send button or existing event listeners —
  only read/write the input field's text
- Log adapter research (selectors, DOM quirks per site) to NOTES.md

Full spec:
Build a Chrome extension (Manifest V3) called "Prompt Polish" that improves a user's
prompt before they send it to a web-based LLM chat interface.

## Core behavior
- Content script injects a small "✨ Improve" button next to the prompt input on
  supported sites (start with: chatgpt.com, claude.ai, gemini.google.com)
- User writes a prompt, clicks the button (no auto-trigger on Enter)
- Extension sends the current prompt text to a background service worker
- Service worker calls an LLM API with a rewrite instruction and returns an
  improved prompt
- The improved prompt REPLACES the text in the input box, dispatching proper
  input/change events so each site's framework (React on ChatGPT/Claude, etc.)
  recognizes the change and enables the send button
- User can still edit before sending — never auto-send

## Components
1. manifest.json — MV3, content_scripts matched per site, background service
   worker, storage permission, host permissions for the LLM API endpoint
2. Site adapters — one small module per site exporting: findInputElement(),
   getText(), setText(text). Keep these isolated so adding a new site doesn't
   touch shared logic.
3. background.js — receives {text, siteId} via chrome.runtime.onMessage, calls
   the rewrite API, returns the result. Handle errors (timeout, bad API key,
   rate limit) and return a typed error the content script can show to the user.
4. options.html/js — user enters their own API key (stored via chrome.storage.sync,
   never synced in plaintext to a remote server), can toggle which sites are active
5. Content script UI — button with loading state, error toast on failure, never
   silently fails

## Non-functional requirements
- No use of eval or remote code execution (MV3 policy compliance)
- No modification of the page's existing send button/logic — only the text field
- Rewrite call should timeout gracefully at 8s
- Write unit tests for the site-adapter text-replacement logic (this is the
  fragile part — React sites won't pick up a plain .value assignment)

## Definition of done
- Extension loads unpacked in Chrome with no manifest errors
- On chatgpt.com and claude.ai: typing a prompt, clicking Improve, replaces the
  text in a way the page's own send button becomes enabled
- Options page saves and retrieves an API key correctly
- `npm test` passes for the adapter logic
- README documents how to load the extension and add a new site adapter

Before writing any feature code, do two things:

1. Create CLAUDE.md at the repo root with these standing conventions:
   - Commit after every logical unit of work is complete and verified —
     never commit a build that fails or tests that don't pass
   - Commit format: `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`,
     one feature per commit
   - Before committing: npm run build must succeed and npm test must pass
   - Never touch a site's own send button or existing event listeners —
     only read/write the input field's text
   - Log adapter research (selectors, DOM quirks per site) to NOTES.md

2. Set up the project scaffold matching this structure:
    prompt-polish/
├── CLAUDE.md
├── README.md
├── NOTES.md
├── package.json                 # workspace root
├── extension/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── manifest.config.ts
│   │   ├── background/
│   │   │   └── service-worker.ts   # now just calls YOUR backend, not the LLM directly
│   │   ├── content/
│   │   │   ├── index.ts
│   │   │   ├── sites/
│   │   │   │   ├── types.ts
│   │   │   │   ├── chatgpt.ts
│   │   │   │   ├── claude.ts
│   │   │   │   └── gemini.ts
│   │   │   └── ui/
│   │   ├── options/
│   │   └── lib/
│   │       ├── backend-client.ts    # replaces the old direct api.ts
│   │       ├── messaging.ts
│   │       └── storage.ts
│   └── tests/
│       └── adapters.test.ts
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── docker-compose.yml            # spins up local Redis for dev
    ├── src/
    │   ├── index.ts                  # Express app entry
    │   ├── routes/
    │   │   └── rewrite.ts            # POST /rewrite endpoint
    │   ├── lib/
    │   │   ├── redis.ts              # ioredis client
    │   │   ├── rate-limiter.ts       # rate-limiter-flexible config
    │   │   └── llm.ts                # actual LLM API call
    │   └── middleware/
    │       └── auth.ts               # validates the user/extension identifier
    └── tests/
        └── rate-limiter.test.ts

Then commit the scaffold. Don't build any feature logic yet — just get
the empty scaffold building and loadable as an unpacked extension.