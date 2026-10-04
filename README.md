# USD Study Guide — NCP-OUSD Prep

A self-contained study tool for the **NVIDIA-Certified Professional: OpenUSD
Development (NCP-OUSD)** exam: spaced-repetition flashcards, a practice quiz, a
composition-arc MCQ bank, a study plan, and the exam blueprint.

Live: **https://jiapodou.github.io/USD-study-guide/**

## Layout

The app is static (no build step, no server) and decoupled into:

```
index.html        markup only — links the stylesheet and the four scripts below
styles.css        all styling (dark theme, flip animation, responsive)
data/deck.js      window.DECK  — 106 flashcards + 20 quiz questions + exam meta
data/refs.js      window.REFS / DOMAIN_REFS / CARD_REFS — source-doc links
data/mcq.js       window.COMPOSITION_MCQS — 22 composition-arc scenario MCQs
app/app.js        the vanilla-JS mini-app (SRS, quiz, MCQ, filters, rendering)
tools/verify_composition.py   USD-Python proof of the MCQ answers (see below)
.nojekyll         tell GitHub Pages to serve files as-is (no Jekyll)
```

Scripts load in order (`deck → refs → mcq → app`) and communicate through
`window.*` globals — no ES modules — so the page works both on GitHub Pages and
when opened directly as a `file://`. All asset paths are **relative**, so the
site resolves correctly under the `/USD-study-guide/` project path.

## Run locally

Just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# then visit http://127.0.0.1:8000/
```

## Deploy

GitHub Pages serves the `main` branch root. Commit and push; the live URL
updates automatically.

## Editing content

- **Flashcards / quiz:** edit `data/deck.js` (`cards` / `quiz` arrays), reload.
- **Source links:** edit `data/refs.js`.
- **Composition MCQs:** edit `data/mcq.js`.

## Verifying the composition MCQ answers

The composition-arc questions are the hardest part to get right, so every
stage-computable answer is **proven by composing real USDA layers in USD
Python** rather than asserted. With `pxr` installed:

```bash
python3 tools/verify_composition.py
```

Each scenario authors throwaway `.usda` layers, opens the composed stage, reads
the resolved opinion, and prints `PASS/FAIL` against the answer baked into
`data/mcq.js`. Last run: **20/20** stage-computable scenarios verified (the two
remaining MCQs are definitional — the LIVRPS strength-order recall and a
"is scalar value-resolution the whole story" conceptual question).
