# The neuro-symbolic gate

Every content sub-agent's draft passes through this before it can commit.

## Why it exists

The existing tests catch structural bugs: a missing entry, a broken `[[term]]`
link, a stray control character. They do not catch a plausible-looking wrong
citation, a slide into marketing voice, or a wall of text. Those are the failure
modes an agent producing prose is most likely to introduce.

The gate is deterministic and cheap. It runs on every write into
`src/content/`, `src/glossary/`, or `docs/`. If it fails, the write is rejected
and the agent receives structured feedback about what to fix.

## The neuro-symbolic loop

    neural draft -> symbolic gate -> pass? commit.
                                  -> fail? feedback to agent, retry (up to 3).
                                  -> still failing? escalate to a human.

Symbolic checks are honest about what they can and cannot see. They do NOT
answer "would a novice understand this." That still needs the playtest.

## Rules the gate enforces

Each rule reports a `{rule, where, why, fix}` object on failure.

### Sources and citations

- **source-not-whitelisted.** Every URL string in a content file must resolve
  to a host in the whitelist below. Any other host is rejected on sight, even
  if the citation is otherwise correct.

  Whitelist: `arxiv.org`, `aclanthology.org`, `aclweb.org`, any `.edu`, any
  `.gov`, `nature.com`, `science.org`, `ncbi.nlm.nih.gov`, `ieee.org`,
  `acm.org`, `jmlr.org`, `nips.cc`, `neurips.cc`, `proceedings.mlr.press`,
  `openreview.net`, `springer.com`, `wiley.com`, `jstor.org`, `distill.pub`,
  `anthropic.com`.

- **unparseable-url.** A URL that will not parse. Fix the URL or delete it.

### The dash ban

- **no-long-dashes.** No en dash (U+2013) or em dash (U+2014) in any file.
  Enforced separately by `tests/source.test.ts`; the gate catches it before
  the write lands so the agent gets the feedback in the loop rather than at CI
  time.

### Voice

- **first-person.** No `I`, `we`, `our`, `us`, `my`, `me` in prose. The site
  addresses the reader directly, in the second person. Comments in code are
  exempt (the code author may say "I chose this because...").

- **marketing-verb.** No `leverage`, `seamless`, `empower`, `unlock`,
  `utilize`, `synergy`, `robust`, `holistic`, `paradigm`, `revolutionary`,
  `game-changing`, `best-in-class`, `world-class`. Prose voice is plain and
  concrete.

### Calm surface

- **sentence-too-long.** Average sentence length in a prose string exceeds 22
  words. One idea per sentence; break the long ones.

- **paragraph-too-long.** A single prose string contains more than four
  sentences with no line break. Break into paragraphs, or cut.

## How the loop feeds the agent back

The gate exits 1 on any failure and prints structured JSON to stdout:

    {
      "pass": false,
      "checked": 3,
      "failures": [
        {
          "rule": "source-not-whitelisted",
          "where": "src/content/origins.ts:412",
          "why": "Host medium.com is not on the whitelist.",
          "fix": "Cite arxiv, ACL, a .edu, .gov, or a listed journal instead."
        }
      ]
    }

An orchestrating agent reads this and passes it back into the neural draft as
the revision instruction. Three attempts. If still failing, the workflow marks
the task escalated and moves on rather than looping forever.

## What the gate cannot see

- Whether the cited paper actually says what you claim it says. Cite honestly.
- Whether a novice would follow the explanation. Playtest.
- Whether the numbers on screen are real. That is the model's job, not the
  gate's; see `tools/make_fixtures.py` for the cross-check.

## Running it by hand

    node v2/tools/gate.mjs src/content/origins.ts
    node v2/tools/gate.mjs --staged     # check what git has staged
