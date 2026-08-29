# GlobalRemit — Methodology Paper Framework & Project Record

> **Purpose of this document.** This is a *scaffold and factual record* for your methodology
> paper — not the paper itself. Part A explains how to approach it and what each section
> needs. Part B is an accurate record of what was actually built and decided, so you have the
> technical facts straight when you write. The **analysis, justification, and reflection in
> your own words are yours to write** — that's what the paper is marked on. Look for the
> ➤ prompts: they mark where *you* need to add your reasoning.

> **Before you start:** get your exam board's marking criteria (EPQ / CS NEA / IB, etc.) and
> map the sections below onto its required structure. The mark scheme is the real spec.

---

## PART A — How to write the methodology paper

### What a methodology paper is
It documents **how** you carried out the project and **why you made each decision** — the
process, tools, design choices, data sourcing, testing, and honest evaluation. It is *not* a
user manual and *not* just a feature list. Markers reward: clear reasoning, evidence for
decisions, awareness of alternatives you rejected, and honest reflection on limitations.

### The single biggest strength of this project
The **research journey**. Most student projects assert "I used X." Yours can *show* a chain of
investigate → test → find evidence → decide. Foreground it. Concretely, you:
- proposed comparing real provider rates,
- tested whether that data was obtainable (Wise Comparison API, exchange-house sites),
- gathered **evidence** it was not available for your corridors (AED-out),
- and made a **reasoned, honest pivot** to a sourced-estimate model.

That is textbook methodology. Build the paper around it.

### Process tips (do these as you write)
- **Keep a decision log.** For each choice: the options, the evidence, the decision, the
  trade-off. Several are already recorded in Part B — expand them in your voice.
- **Use evidence.** Your API tests (e.g. Wise returning `providers: []` for AED→INR, but 18
  providers for GBP→EUR) are gold — quote the actual outputs.
- **Include diagrams.** At minimum: a system-architecture diagram (frontend ↔ backend ↔
  external APIs) and a data-flow diagram (user input → live FX → markup → result). Hand-drawn
  is fine if your board allows.
- **Include screenshots.** Light + dark mode, a language in RTL (Arabic/Urdu), a results
  screen, the "Estimated · Verified" label, the hidden-trend state for PKR.
- **Cite sources** (Wise API docs, remit.ae, open.er-api, Frankfurter). List in References.
- **Write in the past tense**, third person / passive where your board prefers ("A live FX
  source was chosen because…").
- **Be honest about limitations** — it *gains* marks here, it doesn't lose them.

### Suggested section structure
1. Introduction — aim, rationale, personal motivation
2. Background & Context — remittances, the market, existing tools, the data problem
3. Aims & Objectives / Research Question
4. Methodology — development approach, tech choices, architecture, **data-sourcing method**,
   design decisions
5. Implementation — how the key parts were built
6. Testing & Verification — how it was validated
7. Ethical & Honesty Considerations — data accuracy, labelling, scraping/ToS
8. Evaluation & Limitations — what works, what's estimated, future work
9. Conclusion & Reflection
10. References

---

## PART B — Project record (raw material, mapped to the sections above)

### 1. Introduction — aim & rationale
- **Project:** *GlobalRemit* — a web app that helps people in the UAE (sending in AED) compare
  money-transfer providers to send more money home.
- **Target users:** migrant workers in Dubai remitting to India, Pakistan, the Philippines,
  and Europe (currencies: INR, PKR, PHP, EUR).
- **Personal motivation:** developed by an A-Level student at NAS Dubai to help labourers find
  lower-cost transfers. (This personal framing is a genuine strength — state it plainly.)

➤ *In your paper:* explain why this problem matters (remittance fees are a real cost to
low-income workers) and why you were motivated to build it.

### 2. Background & Context
- Remittances from the UAE are a large, high-volume market; small rate/fee differences add up.
- Providers fall into two types: **digital apps** (Wise, Remitly, WorldRemit, Instarem) and
  **UAE exchange houses** (Al Ansari, LuLu). Exchange houses typically charge **no explicit
  transfer fee** and instead build their margin into the exchange rate.
- **Existing comparison tools** exist (e.g. remit.ae, gulfcalc) — useful context/competitors.
- **The core data problem** (this is central to your methodology): there is **no free,
  clean, public source of live per-provider rates for money leaving the UAE.**

➤ *In your paper:* review the market and existing tools, and set up the data problem that
drives your methodology.

### 3. Aims & Objectives
Example objectives to adapt:
- Compare multiple remittance providers for AED→{INR,PKR,PHP,EUR} in one interface.
- Use **real, live** exchange-rate data wherever obtainable.
- Be **honest** about which numbers are live vs estimated (no misrepresentation).
- Be **accessible** to the target audience (multiple languages, incl. RTL; light/dark; mobile).

### 4. Methodology (the core)

#### 4.1 Development approach
- **Iterative / prototype-driven.** An initial working prototype was built, then repeatedly
  refined as research revealed what data was actually available. Decisions were evidence-led
  rather than fixed up front.

➤ *In your paper:* name the methodology (iterative/agile-style prototyping) and justify it —
it suited a project where requirements changed as data-availability was discovered.

#### 4.2 Technology choices (with justification to add)
| Layer | Technology | Why (➤ expand in your words) |
|---|---|---|
| Frontend | React + Vite | Component-based UI, fast dev server |
| UI library | Material UI (MUI) | Ready-made accessible components, theming for dark mode |
| Charts | Recharts | Simple declarative charts for the rate trend |
| Backend | Python + FastAPI | Fast to build a typed JSON API; automatic validation |
| Validation | Pydantic | Enforces valid input (amount > 0, currency codes) |
| Version control | Git + GitHub | History, backup, multi-machine access |

#### 4.3 System architecture
- **Two-tier:** a React frontend calls a FastAPI backend at `POST /api/quote`.
- The **backend** is the only part that talks to external rate APIs — this keeps logic
  (and any future secrets/keys) server-side, not exposed in the browser.
- Data flow: *user enters amount + destination → frontend calls backend → backend fetches
  live mid-market rate → applies each provider's markup → returns quotes → frontend renders.*

➤ *In your paper:* include an architecture diagram and a data-flow diagram here.

#### 4.4 Data-sourcing methodology — **the heart of the paper**
This is the strongest section. Present it as an investigation with evidence:

1. **First attempt — real per-provider rates.** Investigated whether live provider rates could
   be obtained programmatically.
2. **Wise Comparison API — tested, evidence gathered.** It returned **0 providers for every
   AED-out corridor** (AED→INR/PKR/PHP/EUR/GBP/USD), but **18 providers for GBP→EUR** and 9 for
   USD→INR. Conclusion: **Wise covers money *into* the UAE, not *out*** — useless for this app's
   direction. (Quote the real `providers: []` vs populated outputs as evidence.)
3. **Exchange houses.** Al Ansari, LuLu, etc. have **no public API**; their sites are
   JavaScript-rendered and bot-protected, and scraping would be fragile and against their
   Terms of Service.
4. **Comparison aggregators (remit.ae).** Have the data but render it via JavaScript with no
   public developer API; not cleanly obtainable, and a paid/off-the-shelf API for it does not
   exist for individual developers.
5. **Decision (the pivot):** since live per-provider data was unavailable, adopt a
   **transparent estimate model** ("Method B"):
   - Fetch the **live mid-market rate** from a free API (`open.er-api.com`, no key, covers AED
     & PKR).
   - Multiply by each provider's **markup** (its typical % relative to mid-market), sourced
     from real data.
   - Because the mid-market rate updates daily, **all displayed provider rates update daily
     automatically**; only the markups need occasional re-checking.
   - Note: this is essentially how Wise's own comparison feed works internally (collect a
     markup, apply it to the current mid-market rate).
6. **Sourcing the markups (real data):**
   - **Wise, Remitly, WorldRemit, Instarem** — from the **Wise Comparison API** (real
     advertised rates on USD→INR; markup-% is roughly corridor-stable).
   - **Al Ansari, LuLu** — from **remit.ae** per-provider pages.
7. **Fees:** deliberately **not modelled**. Exchange houses bundle margin into the rate and
   don't publish a simple fee; digital apps' fees vary by amount and corridor. The app compares
   on **exchange rate** and tells users to *"check the fee with the provider."*

➤ *In your paper:* this whole subsection should read as a reasoned investigation. Emphasise
that a negative result (no data available) still produced a valid, evidence-based decision.

#### 4.5 Design decisions (for the target audience)
- **Multi-language (i18n):** English, Hindi, Urdu, Arabic, Tagalog — chosen to match the
  nationalities of the target users (Indian, Pakistani, UAE/Arabic-speaking, Filipino).
  **Right-to-left (RTL)** layout support for Arabic and Urdu.
- **Dark mode:** user-toggleable, defaults to the device's OS preference on first visit, choice
  remembered between visits.
- **Accessibility/UX:** responsive layout; clear error and loading states; the whole UI themed
  through a single set of colour tokens so light/dark stay consistent.

➤ *In your paper:* justify these against the *audience* — e.g. many target users are more
comfortable reading in their first language; RTL is essential for Arabic/Urdu.

#### 4.6 Feature decisions & removals (evidence of critical thinking)
- **Removed the "fake comparison."** The original prototype gave one provider a rate *above*
  mid-market (impossible in reality), so it always "won." This was corrected to realistic,
  sub-mid-market markups. *(Good example of self-critique.)*
- **Fixed the PKR flat-line.** The original trend source (Frankfurter / ECB) doesn't publish
  AED or PKR, so PKR used a frozen constant → a meaningless flat chart. A `trendAvailable`
  flag now hides the chart when there's no real history instead of showing a misleading line.
- **Removed Standard/Express speed toggle and delivery-time estimates** — judged not to add
  real value once fees were deferred to the provider.
- **Provider roster corrected to reality:** removed **Wall Street** (company has closed) and
  **Federal Exchange** (no citable rate source); added **WorldRemit** and **Instarem** (both
  have real sourced markups and operate in the UAE market).

### 5. Implementation (key parts)
- **`/api/quote` endpoint:** validates input, fetches the live mid-market rate (with graceful
  fallback to a historical source, then an offline table if both are unreachable), computes
  each provider quote, and returns them plus a `rateLive` flag and per-provider
  `lastVerified` date and `estimated` flag.
- **Provider model:** a single data-driven table of `{provider, markup, url, lastVerified}` —
  replaced six copy-pasted code blocks from the original, making it easy to add/verify
  providers.
- **Frontend:** a single-page calculator (amount → destination currency → Compare) that renders
  provider cards, a "best value" banner, an "Estimated · Verified {date}" label per card, and a
  trend chart shown only when real history exists.

➤ *In your paper:* pick 1–2 components and describe them in a little more depth (code snippet +
explanation), rather than listing everything.

### 6. Testing & Verification
Document the methods actually used:
- **Static checks:** ESLint on the frontend; production build (`vite build`) to catch errors.
- **Backend checks:** syntax validation; running the server and calling endpoints with `curl`.
- **API/corridor testing:** querying the Wise Comparison API and the live FX API across
  multiple corridors (AED→INR/PKR/PHP/EUR and control corridors) to verify coverage and rates.
- **Input validation testing:** confirming invalid input (e.g. negative amount) returns a
  proper error (HTTP 422) rather than a wrong result.
- **Graceful-degradation testing:** confirming the app still responds sensibly when a live rate
  source is unavailable (falls back, sets `rateLive = false`).

➤ *In your paper:* present these as a short test table (test → method → expected → result).

### 7. Ethical & Honesty Considerations (a strong section for this project)
- **No misrepresentation of data.** Rather than presenting invented numbers as live quotes, the
  app clearly labels rates as **"Estimated"** with a **"Verified" date**, and states rates are
  compared **before fees**.
- **Live vs estimated is explicit.** A `rateLive` flag distinguishes a genuinely live
  mid-market rate from a fallback.
- **Scraping / Terms of Service.** Scraping provider or aggregator sites was considered and
  **rejected** — it is fragile, often bot-blocked, and typically against their ToS. Only
  sanctioned/public data sources were used.
- **Data privacy:** the app takes no personal data and stores only UI preferences (language,
  theme) locally in the browser.

### 8. Evaluation & Limitations
- **Works well:** live, auto-updating mid-market rates (incl. AED & PKR); six real providers
  with sourced markups; accessible multi-language, light/dark, mobile-friendly UI; honest
  labelling.
- **Limitations:** provider **markups are periodic snapshots**, not live per-provider quotes;
  **fees are not shown** (deferred to the provider); the **7-day trend** needs paid historical
  data for currencies the free source doesn't cover (e.g. PKR), so it is hidden there.
- **Future work:** a paid FX API for historical PKR/AED trends; a B2B data agreement or partner
  API for true per-provider rates; the previously-scoped AI help chatbot; automated markup
  re-verification.

➤ *In your paper:* be candid here. Explicitly linking each limitation to the *evidence* that
caused it (no AED-out API, etc.) shows strong understanding.

### 9. Conclusion & Reflection
➤ *In your words:* what you set out to do, what you achieved, what you learned (technically and
about real-world data availability), and what you'd do differently. Reflection carries marks —
write it genuinely.

### 10. References (starter list — format to your board's style)
- Wise Platform — Comparison API documentation: https://docs.wise.com/api-reference/comparison
- ExchangeRate-API open endpoint (live FX): https://open.er-api.com/
- Frankfurter API (ECB historical FX): https://api.frankfurter.dev/
- remit.ae — UAE remittance comparison (provider rate reference): https://remit.ae/
- (Add: React, FastAPI, MUI documentation as used.)

---

## Appendix — Technology & data-source summary (quick reference)
- **Frontend:** React, Vite, Material UI, Recharts, Emotion.
- **Backend:** Python, FastAPI, Uvicorn, Pydantic, Requests.
- **Live FX (current rate):** open.er-api.com — free, no key, covers AED & PKR.
- **Historical trend:** Frankfurter (ECB) — free; lacks AED/PKR (trend hidden where unavailable).
- **Markup research:** Wise Comparison API (Wise, Remitly, WorldRemit, Instarem); remit.ae
  (Al Ansari, LuLu).
- **Tooling:** Git/GitHub, ESLint.
- **Providers compared (6):** Wise, Remitly, WorldRemit, Instarem, Al Ansari, LuLu Exchange.
