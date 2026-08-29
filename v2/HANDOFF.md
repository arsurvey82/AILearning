# Handoff

Written for whoever picks this up next. No prior context assumed.

## What this is

A website that teaches how a language model works. One HTML file. It runs in a
browser with no server behind it.

The thing that makes it different from a blog post: it does not draw pictures of
numbers. It runs four small language models in the browser and shows you their
actual output. When the page says a word attends to another word, that is a real
model doing it, not an illustration.

## How to run it

You need Node.

    cd v2
    npm install
    npm run dev

That opens it locally. To make the single file you can email or host:

    npm run build

The result is `dist/index.html`. Open it by double-clicking. It works offline.

## What a visitor sees

There are three screens. A visitor picks one from the top of the page.

**1. Start here.** Seven words. Four numbers each. The whole table is printed so
you can read it. `cat` and `dog` end up with similar numbers, and the page shows
you the sixteen lines of text that made them similar. This is the front door
because it is small enough to understand completely.

**2. A trained model.** A sentence with a missing word: *the cat near the dogs
____ .* Press a button and the model fills it in with "runs". Then it shows what
it was looking at while deciding: 100% on "cat", 0% on "dogs". Change "cat" to
"cats" and the answer becomes "run". Change "dogs" to "dog" and the answer does
not change, which is the point.

**3. Concept map.** 67 lessons about parts of a language model. Click through
them, or walk the twelve steps a word takes through the model from left to right.

Any underlined word anywhere can be clicked to look it up. That opens a panel
which keeps a trail, so you can go three words deep and still find your way back.

## The four models

They are small on purpose. Every one was trained by a script in `tools/`.

| File | What it does | How well |
|---|---|---|
| `tiny.json` | places 7 words near each other by meaning | cat and dog score 0.94 out of 1 |
| `weights-words.json` | picks the right verb for the subject | right 100% of the time on sentences it never saw |
| `weights.json` | sorts six letters | right 98.8% of the time |
| `weights-moe.json` | same, split across 4 sub-networks | right 100% of the time |

Each training script checks its own model before saving. If the model cannot do
its job, the script refuses to save it. This exists because weights that do not
work look exactly the same as weights that do.

To retrain any of them you need Python with PyTorch:

    python tools/train_tiny.py
    python tools/train_words.py
    python tools/train_sort.py
    python tools/train_moe.py
    python tools/make_fixtures.py     # run this last, always

## Rules this project follows

These are enforced by tests, not by good intentions. If you break one, the build
fails.

1. **No made-up numbers.** If a number cannot be calculated, it does not go on
   the page.
2. **Do not round inside the model.** Round when you display it. Rounding early
   once turned a real probability into zero and made a bar disappear.
3. **Every date needs a source.** A claim like "attention was 2014" carries a
   link to the paper.
4. **Every word in an explanation must be clickable.** If a sentence uses a term
   the reader might not know, that term needs its own entry. A test fails the
   build otherwise. This is what stops the writing feeling vague.
5. **Every button must change something.** A test clicks every control and fails
   if any of them does nothing.

## Where things live

    src/model/      the four models and the maths that runs them
    src/learn/      the "Start here" and "trained model" screens
    src/glossary/   the clickable word lookups
    src/content/    the 67 lessons, and why each concept exists
    src/ui/         the history timeline and shared bits
    tools/          the Python training scripts
    tests/          195 tests that run in Node, 74 that run in a browser

Run them with `npx vitest run` and `npx playwright test`.

## What is finished

- All four models, trained and checked.
- Three screens, all working.
- The word lookup, with sources.
- History for 44 of the concepts: what problem each one solved, and when.
- Three lessons on AI agents: workflows versus agents, context engineering, and
  designing tools. Every claim quoted from a published source, including the
  one that says there is no correct pattern.
- 269 tests passing.

## What is not finished

**The most important one first.**

1. **Nobody has watched a real beginner use this.** There are 206 cards
   answering "questions people usually ask", and 205 of them are guesses. One
   was written after watching an actual person. The instructions for running a
   session are in `docs/playtest-protocol.md`. Until someone does this, we do
   not know whether any of it teaches.

2. **The file is 1.8 MB.** Most of that is the models themselves. It loads fine
   but it is not small. Shrinking it means saving the model numbers with fewer
   decimal places, which also means regenerating the test fixtures.

3. **Nothing has been pushed.** Three commits sit on `master` locally. They
   have never been sent to GitHub.

## If you only do one thing

Sit a person who does not know how language models work in front of it. Say
nothing. Watch where they stop. Write down the exact words they use when they get
confused, and put those words into the "common snags" cards.

That is worth more than any feature on the list above.
