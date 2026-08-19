# Playtest protocol, validation tier 3

Two of the three validation tiers are automated. This one cannot be, and
pretending otherwise is how the snag cards lose their value.

- **Tier 1. Derivable claims.** `tests/claims.test.ts` recomputes them. Done.
- **Tier 2. External figures.** Cited against primary sources in
  `src/content/sources.ts`. In progress, tracked by a ratchet.
- **Tier 3. snags.** Only a real beginner can validate these. This document.

## Why this tier exists

The Embedding node's eight snags came from watching K work through it in July
2026. They read differently from the other 195, and the difference is not
writing quality, it is provenance. "Isn't position 3 an A?" is a question
somebody actually asked. The anticipated cards are my prediction of where
people will trip, and predictions are wrong in ways that are invisible from
the inside.

The app already encodes the distinction. `snagsPlaytested: true` earns the
label *"questions real beginners asked here"*; everything else says
*"questions this usually raises"*. A test asserts that exactly one node claims
the stronger phrasing. **Do not set that flag without running this protocol.**

## Who to sit down

Someone who can program a little and has never studied how a model works.
Curious, not deferential. you need a person who will say "I don't get that"
rather than nodding.

Explicitly *not* useful: anyone who already knows the material, and anyone who
will try to be encouraging. Both produce clean sessions and no data.

## Setup

- One node per session, roughly 30-45 minutes.
- They drive. You do not touch the keyboard.
- Record the screen, or take timestamped notes. You will not remember it.
- Say once, at the start: **"Think out loud. Every time you're confused, say
  so, that's the entire point. You can't say it too often."**
- Then stop talking. The urge to rescue them is the biggest threat to the data.

## What to log

Log the *question they ask*, in their words. Not your reconstruction, not a
tidied heading. The wording is the artifact, a learner recognises their own
confusion in a phrasing, which is why the cards work at all.

| Log | Example |
|---|---|
| Their exact words | "wait, is position 3 an A?" |
| Where they were | Embedding, L1 open, hovering seat 3 |
| What triggered it | The seat row and the letter row disagreeing |
| Whether they resolved it alone | No, needed telling |
| Time to resolve | 90 seconds of being stuck |

Also log **silent** stumbles: a long pause, scrolling back up, re-reading,
clicking away. Those are confusions that never became questions, and they are
the ones the anticipated cards miss most often.

## Turning a stumble into a card

A logged stumble becomes a snag only if it clears all four:

1. **It is a real question**, phrased as they asked it, not rewritten into a
   heading. "Why 11 seats?" not "Context window sizing".
2. **The answer is ≤ 4 sentences** (§7.8). If it needs more, the *lesson* is
   wrong and L1 should change instead of adding a card.
3. **Two or more people hit it**, or one person got properly stuck. A single
   glance-and-recover is noise.
4. **It is not already answered** by an existing card or by L1.

Then add it to that node's `L2_snags`, set `snagsPlaytested: true`, and update
the count in `tests/content.test.ts`. the test that asserts only playtested
nodes make the stronger claim will fail until you do, which is intentional.

## When a stumble is not a snag

Sometimes the right fix is not a card:

- **They misread the interface** → fix the interface. A snag card papering over
  a UX problem is a bug with prose on top.
- **They were missing a prerequisite** → check Needs/Unlocks on that node.
- **Everyone hits it in the same place** → it belongs in L1, not L2. L2 is for
  the tangent; L1 is for the path.

## Order to run

Follow the spine, because a stumble at Tokenization contaminates everything
after it:

1. Tokenization
2. Token ID
3. Embedding *(already playtested. rerun as a control, and to check the
   protocol still reproduces K's eight)*
4. Attention

Then the nodes most likely to be wrong because they are furthest from my own
intuition about beginners: **Agent layer**, **AIBrix**, **KV cache**.

## Success criterion

Not "they understood it". The bar in `CLAUDE.md` §11 is:

> a curious beginner can open Embedding, understand it at L0, and dig to L4 and
> back **without ever feeling lost or buried**.

So the question after each session is: *at any point, did they not know where
they were or what to do next?* Every yes is a finding, whether or not it
produced a question.
