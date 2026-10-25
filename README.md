# Foolproof

An AI "where should I eat?" assistant that fake reviews can't fool.

Ask *"best biryani near Gachibowli under ₹400"*, then inject fake 5★ reviews, fake 1★ reviews or a prompt-injection review, and watch which ranking changes its answer.

All restaurants and reviews are fictional and generated. Flags are **suspicious signals**, not accusations.

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

Note: in a live test, Gemini itself ignored 20 fakes + an injection in the naive prompt. The naive column on the page is a **simulated** stars-only pipeline. Measuring how often real LLMs flip is an open question for the paper.

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
npm test                     # demo-script tests
npm run eval                 # writes results/sandbox-eval.json
```

## Deploy (Vercel)

1. Import this repo in Vercel (framework: Next.js).
2. Set env vars: `GEMINI_API_KEY`, `GEMINI_MODEL` (optional, default `gemini-flash-latest`), `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Without `TURNSTILE_SECRET_KEY`, the live AI endpoint refuses all requests in production (fail closed). The rest of the site still works.

## Security

- API key server-only; page is static and edge-cached.
- `/api/answer`: same-origin check, 4KB body cap, zod validation, per-IP + daily rate limit, Turnstile. The client sends only attack parameters; fake reviews are rebuilt on the server.
- Reviews are hostile input: rendered as plain text, capped, delimiter-stripped, wrapped in `<untrusted_review>` tags.
- CSP, HSTS, `frame-ancestors 'none'`, nosniff, strict referrer and permissions policies.
- Rate limiting is in-memory per instance. Swap in Upstash/Vercel KV before real traffic.

## Layout

```
src/lib/sandbox/   deterministic data: restaurants, review text, attacks
src/lib/scoring/   signals, trust rating, ranking, query parsing
src/lib/server/    Gemini client, guards, prompts
src/components/    Demo UI, flip chart, live panel
scripts/eval.ts    reproducible evaluation for the paper
```

## Roadmap

Supabase + pgvector storage, real embeddings for paraphrased fakes, YelpNYC validation, LLM-generated fakes, login, browser extension, more cities.
