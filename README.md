# Foolproof

An AI "where should I eat?" assistant that fake reviews can't fool.

Ask *"best biryani near Gachibowli under ₹400"*, then inject fake 5★ reviews, fake 1★ reviews or a prompt-injection review, and watch which ranking changes its answer.

All restaurants and reviews are fictional and generated. Flags are **suspicious signals**, not accusations.

## Play

- **Attack lab.** You're the attacker with a 40-credit budget. Fake reviews cost 1 credit each, a hidden instruction costs 5, and smart (aged, slow-posting) accounts triple the price of every fake. Seven missions run from "Buy the top spot" to **Boss: fool Foolproof**, which is winnable: 3 smart-account 1★ reviews tip the close race at the top. That's the open research problem, and the game says so.
- **Spot the fake.** Six reviews, three written to deceive in a human-sounding voice from cheap accounts. Players judge the words; Foolproof judges behaviour and gets all six. It's the paper's point, played live.
- XP, levels (Rookie → Chief inspector), badges, animated rank changes, verdict stamps, confetti. Progress is saved in the visitor's browser only.

## How it works

- **Behaviour over text.** Each review is scored on posting bursts, rating far from the place's typical rating, single-review / brand-new accounts, near-duplicate text, and instructions aimed at AI.
- **Trust-adjusted rating** = Bayesian average where each review counts by `(1 − suspicion)²`.
- **Code ranks, the LLM only explains.** That's why prompt injection can't move the Foolproof ranking.
- Every flag shows its reason, e.g. "21 reviews within 48h", "account's only review".

## Sandbox results (`npm run eval`)

| Attack | Naive (stars at face value) flips at | Foolproof flips at |
|---|---|---|
| Fake 5★ boost | 18 fakes | never (≤30) |
| Fake 1★ smear | 2 fakes | never (≤30) |
| Prompt injection | 1 review (simulated obey) | never |
| Smart attacker boost (aged accounts, spread out, genuine-style text) | 29 | 23 |

Baseline detection: 95% precision, 100% recall. Against the smart attacker, recall drops to ~67%. The sandbox fakes are template-written, so these numbers are optimistic; validate on YelpNYC.

Live AI results vary run to run. With 20 fakes and the injection review, live naive Gemini (`gemini-3.5-flash-lite`) sometimes picks the boosted place and sometimes doesn't; Foolproof's ranking can't move because code computes it. The naive column's "followed an instruction" badge is **simulated**. Measuring how often real LLMs flip is an open question for the paper.

## Architecture

- The site is a **static export** (`out/`): plain HTML/JS served from Netlify's CDN. All ranking and attack simulation runs in the browser.
- The only server code is the live AI: **`netlify/functions/answer.mts`** at `POST /api/answer`, which calls Gemini.

## Deploy on Netlify

1. Netlify → **Add new project → Import an existing project → GitHub** → pick this repo. Don't drag-and-drop the folder: it needs a build.
2. Leave the build settings as detected; `netlify.toml` sets them (`npm run build`, publish `.next`, Node 22).
3. **Site configuration → Environment variables**:
   - `GEMINI_API_KEY` (required for the live AI).
   - `GEMINI_MODEL`: leave unset. If it's set to `gemini-flash-latest`, delete it: that model took 40–70s per answer and Netlify stops functions at 60s.
   - Optional bot check: `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (set both or neither).
4. **Deploys → Trigger deploy → Clear cache and deploy site.** Env var changes only apply after a new deploy.

### If something's wrong

**Live AI not working?** Open `https://YOUR-SITE.netlify.app/api/health?check=1`, or press **Check setup** under the live AI answers. It reports whether the function is deployed, whether the key is set, and what Gemini says about the key. Only status words are returned, never the key.

| What you see | Fix |
|---|---|
| "Page not found" on the whole site | The site was uploaded without a build. Re-create it with "Import an existing project" (step 1). |
| Deploy log says the build failed | Copy the last 30 lines of the deploy log; the cause is usually there. |
| `/api/health` is "Page not found" | Functions weren't built: same fix as the first row. |
| `"geminiKey":"missing"` / "Live AI isn't set up" | Add a variable named exactly `GEMINI_API_KEY`, then **Trigger deploy**. Env var changes only apply after a new deploy. |
| `"kind":"key_rejected"` | Google refused the key; `detail` says why (e.g. `API_KEY_INVALID`). Copy the key again from Google AI Studio. Stray quotes and spaces are stripped automatically. |
| `"kind":"quota"` | The key's free quota is used up. Per-minute limits reset in a minute, daily ones at midnight Pacific. Billing in Google AI Studio lifts them. |
| `"kind":"unavailable"` | Gemini didn't answer; try again. Details: Netlify → Logs → Functions → `answer`. |

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev                  # UI only, http://localhost:3000 (no live AI)
npx netlify dev              # UI + live AI function, http://localhost:8888
npm test                     # demo-script + endpoint tests
npm run eval                 # writes results/sandbox-eval.json
```

## Security

- Gemini key is server-only (Netlify env var, read by the function). The page is static.
- `/api/answer`: Netlify platform rate limit (10/min per IP), same-origin check, 4KB body cap, zod validation, in-memory backup limit, optional Turnstile with a signed 10-minute pass cookie. The client sends only attack parameters; fake reviews are rebuilt on the server.
- Gemini calls: fast-model fallback chain, 15s first-byte limit per model, 45s hard stop (Netlify's limit is 60s). Upstream errors are logged, never shown to visitors.
- Reviews are hostile input: rendered as plain text, capped, delimiter-stripped, wrapped in `<untrusted_review>` tags.
- Headers (in `netlify.toml`): CSP, HSTS, `frame-ancestors 'none'`, nosniff, strict referrer and permissions policies. Each page also gets a hash-based script CSP at build time (`scripts/csp-meta.mjs`), so no inline script runs unless it's one Next.js generated.

## Performance

Measured with Lighthouse on its mobile profile with real throttling (slow 4G, 4× slower CPU): **performance 89–92, accessibility 100, best practices 100, LCP 1.0–1.1 s, CLS 0.002**. Every tap, measured with real input events on the same 4× slower CPU, finishes in under 200 ms (INP).

How: the page is a static export with the CSS inlined, and fonts are self-hosted with size-matched fallbacks. On load, only the restaurants that match the question get scored. Sandbox-wide stats and the chart are computed in idle-time slices of 8 ms or less, and celebrations run at low priority.

## Layout

```
src/lib/sandbox/        deterministic data: restaurants, review text, attacks
src/lib/scoring/        signals, trust rating, ranking, query parsing
src/lib/server/         live AI handler, Gemini client, guards, prompts
src/lib/game/           missions, credits, levels, quiz, saved progress
src/components/         Attack lab, verdict boards, case board, quiz, effects, live panel
netlify/functions/      the live AI endpoint
scripts/eval.ts         reproducible evaluation for the paper
scripts/csp-meta.mjs    post-build strict CSP
```

## Roadmap

Supabase + pgvector storage, real embeddings for paraphrased fakes, YelpNYC validation, LLM-generated fakes, login, browser extension, more cities.
