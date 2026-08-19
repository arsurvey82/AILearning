# LLM Learner

An explorable explanation of how a language model works, built for a smart
non-expert. It runs entirely in the browser with no backend, and every number
on screen is computed from real trained weights rather than illustrated.

## Two scales

**Start here.** Seven words, four numbers each, the whole token table printed
as numbers you can read. Trained with skip-gram on a sixteen-line corpus, so
`cat` and `dog` land at 0.94 cosine because they keep the same company, not
because anybody typed those numbers in.

**A trained model.** A nanoGPT with 101,952 parameters that does subject-verb
agreement across a distractor, and a second that sorts letters. The verb
attends to the subject and ignores the nearer noun, which is a claim you can
check against your own grammar.

## What makes it different from a diagram

Every figure is derived. The forward pass in `src/model/gpt.ts` is verified
against an independent numpy implementation in `tools/make_fixtures.py`,
compared on every intermediate to five decimal places. Two implementations
agreeing is a much stronger claim than one agreeing with itself.

Every concept carries its **origin**: either forced, meaning nobody chose it
and there is no alternative history, or a dated fix with the failure it
repaired and the paper it came from. Explaining what a knob does never stops it
feeling arbitrary. Naming the failure that made it necessary does.

Every term inside every explanation can be opened, and a test fails the build
if any of them cannot.

## Models

| Model | Shape | Task | Result |
|---|---|---|---|
| tiny | 7 words x 4 dim | skip-gram on 16 lines | cat/dog 0.94, cat/wood -0.09 |
| words | 101,952 params, 2 layers | agreement across a distractor | 100% agreement, 100% distractor-invariant |
| letters | 57,312 params, 2 layers | sort six letters | 98.8% held out |
| letters, MoE | 169,728 total, 95,040 active | same, 4 experts top 2 | 100% held out |

Each training script refuses to export if the model fails its own task, so
weights that cannot do the thing can never reach the app and look trustworthy.

## Running it

```
npm install
npm run dev          # local
npm run build        # one self-contained HTML file in dist/
npx vitest run       # 195 unit tests
npx playwright test  # 74 browser tests
```

Retraining, which needs Python and PyTorch:

```
python tools/train_tiny.py       # the printable 4-dim table
python tools/train_words.py      # subject-verb agreement
python tools/train_sort.py       # letter sorting
python tools/train_moe.py        # mixture of experts
python tools/make_fixtures.py    # regenerate the reference values
```

## Rules the build enforces

- No number is faked. If it cannot be derived, it does not ship.
- Nothing rounds inside the model. Display formats; the model keeps what it computed.
- Every dated claim carries its source.
- Every term used in an explanation must itself be openable.
- Every control names the exact change it causes, and a sweep fails any control
  that leaves the rendered numbers untouched.
