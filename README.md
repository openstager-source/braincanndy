# Foolproof

A search engine for places to eat that fake reviews can't fool.

Search *"best cafe in Gachibowli"*. Raw stars would send you to Cloud Nine Café, a new place with 50 bought 5★ reviews. Foolproof ranks it last and puts Brew Theory first, and it lifts Velvet Bean, a good café buried by a 1★ smear.

All restaurants and reviews are fictional and generated. Flags are **suspicious signals**, not accusations.

## Search (home page)

- **Results ranked by trust.** Each place shows its trust rating next to its raw stars, how far it moved versus raw stars, and one line on why ("50 of 65 reviews set aside: posted in a sudden burst…"). The ranking menu in the search bar switches to **Raw stars** to show what a naive AI would pick.
- **AI Overview.** A summary written by code appears at once; with the live AI on, Gemini's explanation streams in over it. Gemini explains the ranking; it can't change it.
- **Evidence panel.** Pick a result to see its trust dial, which signals fired, and a weekly posting timeline where a burst of fakes stands out.
- **"Is this review real or fake?"** After a moment the assistant picks a review from that place and asks you. The card flips to show the verdict, the evidence, and how much that review counted; **Explain with AI** asks Gemini to explain it from the same evidence.
- **Ask about this place.** Suggested questions or your own, answered only from that place's data.
- **From the web.** Real Google results for the same search (via Serpstack), shown as Google lists them and never trust-scored: we can't see who wrote those reviews, and we never label a real business. Skipped for searches that name a sandbox place, since those names are fictional.
- Filters behind **+**, voice search (mic), shareable links (`/?q=…`), Back/Forward, a **Motion** switch, and a bottom sheet on phones.

## Play (the Lab, `/lab`)

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

Baseline detection (all 38 places, 106 planted fakes): 96% precision, 100% recall. Against the smart attacker (20 aged, slow-posting fakes with genuine-style text), recall drops to 84%. The sandbox fakes are template-written, so these numbers are optimistic; validate on YelpNYC.

Live AI results vary run to run. With 20 fakes and the injection review, live naive Gemini (`gemini-3.5-flash-lite`) sometimes picks the boosted place and sometimes doesn't; Foolproof's ranking can't move because code computes it. The naive column's "followed an instruction" badge is **simulated**. Measuring how often real LLMs flip is an open question for the paper.

## Architecture

- The site is a **static export** (`out/`): plain HTML/JS served from Netlify's CDN. All ranking and attack simulation runs in the browser. The search results code (sandbox, scoring, result views) loads only when a visitor heads for the search box, and only the places a search matches are generated and scored.
- Server code is four small Netlify Functions:

| Route | File | What it does |
|---|---|---|
| `POST /api/answer` | `answer.mts` | AI Overview (and the Lab's naive vs Foolproof answers), via Gemini |
| `POST /api/ask` | `ask.mts` | "Explain with AI" for one review, and questions about one place |
| `GET /api/web?q=` | `web.mts` | "From the web" results from Serpstack, cached on the CDN per query |
| `GET /api/health` | `health.mts` | Setup check; `?check=1` pings Gemini |

## Deploy on Netlify

1. Netlify → **Add new project → Import an existing project → GitHub** → pick this repo. Don't drag-and-drop the folder: it needs a build.
2. Leave the build settings as detected; `netlify.toml` sets them (`npm run build`, publish `.next`, Node 22).
3. **Site configuration → Environment variables**:
   - `GEMINI_API_KEY` (required for the live AI).
   - `GEMINI_MODEL`: leave unset. If it's set to `gemini-flash-latest`, delete it: that model took 40–70s per answer and Netlify stops functions at 60s.
   - `WEB_SEARCH_API_KEY` (optional): a [Serpstack](https://serpstack.com) access key for the "From the web" results. Without it the section is simply left out. The free plan allows 100 searches a month; each distinct search is cached on Netlify's CDN for a week, so repeats cost nothing.
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
| "From the web" is missing | `WEB_SEARCH_API_KEY` isn't set (`/api/health` shows `"webSearch":"missing"`). Add it and redeploy. |
| "Serpstack rejected the API key" | Copy the access key again from the Serpstack dashboard into `WEB_SEARCH_API_KEY`, then redeploy. |
| "this month's Serpstack searches are used up" | The plan's monthly limit is reached. It resets with the billing month, or upgrade the plan. Cached searches keep working. |

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev                  # UI only, http://localhost:3000 (no live AI)
npx netlify dev              # UI + live AI function, http://localhost:8888
npm test                     # demo-script, search and endpoint tests
npm run eval                 # writes results/sandbox-eval.json
```

## Security

- Gemini key is server-only (Netlify env var, read by the function). The page is static.
- `/api/answer`: Netlify platform rate limit (10/min per IP), same-origin check, 4KB body cap, zod validation, in-memory backup limit, optional Turnstile with a signed 10-minute pass cookie. The client sends only attack parameters; fake reviews are rebuilt on the server.
- `/api/ask`: the same guards (2KB cap, 12/min). The client sends only a place id and a review id or a question; the server rebuilds the place's data. Questions are length-capped and stripped of control characters and our prompt delimiters, then wrapped in `<user_question>` tags the model is told never to obey.
- `/api/web`: GET only, refuses other sites' pages (`Sec-Fetch-Site`), rate-limited (8/min per IP plus the in-memory limit), and with Turnstile on, only visitors holding a pass can spend searches. The Serpstack key stays on the server and goes out only over HTTPS. Responses carry only titles, http(s) links, snippets and listing facts, trimmed and cleaned; links render as plain `<a rel="noopener noreferrer nofollow ugc">`. Upstream error messages are never passed through.
- Voice search uses the browser's speech recognition; `Permissions-Policy` allows the microphone for this site only.
- Gemini calls: fast-model fallback chain, 15s first-byte limit per model, 45s hard stop (Netlify's limit is 60s). Upstream errors are logged, never shown to visitors.
- Reviews are hostile input: rendered as plain text, capped, delimiter-stripped, wrapped in `<untrusted_review>` tags.
- Headers (in `netlify.toml`): CSP, HSTS, `frame-ancestors 'none'`, nosniff, strict referrer and permissions policies. Each page also gets a hash-based script CSP at build time (`scripts/csp-meta.mjs`), so no inline script runs unless it's one Next.js generated.

## Performance

Lighthouse 12, mobile profile (simulated slow 4G, 4× slower CPU), with the build served brotli-compressed like Netlify's CDN:

| Page | Performance | Accessibility | Best practices | CLS |
|---|---|---|---|---|
| Home (mobile / desktop) | 97 / 100 | 100 | 100 | 0 |
| Results, `?q=best cafe in gachibowli` (mobile / desktop) | 87 / 100 | 100 | 96* | 0.001 / 0 |
| Lab (mobile) | 95 | 100 | 100 | 0 |

\*The 4 points were one console error: the test machine couldn't reach Serpstack, so `/api/web` answered 503. Where Serpstack answers, or no key is set (the endpoint then returns 204), that error doesn't occur.

In a real browser on a 4× slower CPU the home page's largest paint lands at about 0.2 s. How:

- Static export, CSS inlined, fonts self-hosted with size-matched fallbacks. The home page ships about 6 KB (gzip) of its own code; the results code loads on intent.
- Animations stay on the GPU: the squiggles drift as whole elements and the live dots pulse with transform and opacity, so nothing repaints the page every frame. Glows pause on the results page.
- No layout shift: the AI Overview has a fixed-height text box with **Show more**, so streaming text never pushes results down, and a shared link keeps the footer below the fold until results arrive.
- In the Lab, sandbox-wide stats and the chart are computed in idle-time slices of 8 ms or less, and celebrations run at low priority.

## Layout

```
src/lib/sandbox/        deterministic data: restaurants, review text, attacks (generated per place, on first use)
src/lib/scoring/        signals, trust rating, ranking, query parsing
src/lib/search/         summaries, timelines, "why" lines and quiz picks for the search page
src/lib/server/         AI, ask and web handlers, Gemini client, guards, prompts
src/lib/game/           missions, credits, levels, quiz, saved progress
src/components/search/  the search engine: search bar, results, evidence panel, review check, web results
src/components/         the Lab: attack lab, verdict boards, quiz, effects, live panel
netlify/functions/      answer, ask, web and health endpoints
scripts/eval.ts         reproducible evaluation for the paper
scripts/csp-meta.mjs    post-build strict CSP
```

## Roadmap

Supabase + pgvector storage, real embeddings for paraphrased fakes, YelpNYC validation, LLM-generated fakes, login, browser extension, more cities.
