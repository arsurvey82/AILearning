"""
Seven words, four dimensions, small enough to print.

The reference journal hand-picks its table so that cat and dog come out close.
That is a fair way to illustrate the idea, but it asserts the very thing the
reader is being asked to believe. Training the table instead means the closeness
is earned: cat and dog end up near each other because they genuinely appear in
the same company, and the reader can check that against the corpus.

Four dimensions is the whole point. At 64 you can only ever show a heatmap of a
row; at 4 you can print the row and read it. The rule the journal gets right is
that one thing changes at a time, and that is only possible when the numbers
stay small enough to hold in your head.

This is word2vec's skip-gram idea, at a size where every number is visible.
"""

import itertools
import json
import math
import pathlib
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(7)

VOCAB = ["the", "cat", "dog", "sat", "wood", "food", "eat"]
STOI = {w: i for i, w in enumerate(VOCAB)}
DIM = 4

# A tiny corpus. Cats and dogs do the same things and go to the same places,
# which is the only reason they will end up near each other.
CORPUS = [
    # Cats and dogs mostly do the same things, which is what pulls them together.
    "the cat sat", "the dog sat",
    "the cat eat food", "the dog eat food",
    "cat eat", "dog eat",
    "the cat", "the dog",
    # ...but not identically. Without these two lines they come out with exactly
    # the same numbers, cosine 1.000, because nothing in the corpus can tell
    # them apart. Close is the lesson; identical is an artefact of too tidy a
    # world, and it invites the reader to ask whether they are the same word.
    "the cat sat wood", "the cat sat wood",
    "the dog eat food", "the dog eat",
    "eat food", "eat food",
    "sat wood", "sat wood",
    "the food", "the wood",
]

WINDOW = 2


def pairs():
    """Every (word, nearby word) pair. Company kept, in one list."""
    out = []
    for line in CORPUS:
        ws = [STOI[w] for w in line.split()]
        for i, c in enumerate(ws):
            for j in range(max(0, i - WINDOW), min(len(ws), i + WINDOW + 1)):
                if i != j:
                    out.append((c, ws[j]))
    return torch.tensor(out, dtype=torch.long)


P = pairs()
print(f"vocabulary: {len(VOCAB)} words   pairs: {len(P)}   dimension: {DIM}")


class SkipGram(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(len(VOCAB), DIM)
        self.out = nn.Linear(DIM, len(VOCAB), bias=False)

    def forward(self, centre):
        return self.out(self.emb(centre))


model = SkipGram()
opt = torch.optim.Adam(model.parameters(), lr=0.05)

for step in range(3000):
    logits = model(P[:, 0])
    loss = F.cross_entropy(logits, P[:, 1])
    opt.zero_grad(set_to_none=True)
    loss.backward()
    opt.step()
    if step % 750 == 0 or step == 2999:
        print(f"step {step:4d}  loss {loss.item():.4f}")

# Scaled to a readable range and rounded to two places, because the point of
# four dimensions is that a person can read the row out loud.
raw = model.emb.weight.detach()
scaled = raw / raw.abs().max() * 0.9
TABLE = [[round(float(v), 2) for v in row] for row in scaled]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


print("\nthe table, as it will be printed:")
print("  token   c1     c2     c3     c4")
for w, row in zip(VOCAB, TABLE):
    print(f"  {w:6s} " + "  ".join(f"{v:5.2f}" for v in row))

print("\nnearest neighbour for each word, by cosine:")
worst_pair = None
for i, w in enumerate(VOCAB):
    sims = [(cosine(TABLE[i], TABLE[j]), VOCAB[j]) for j in range(len(VOCAB)) if j != i]
    sims.sort(reverse=True)
    print(f"  {w:6s} -> {sims[0][1]:6s} ({sims[0][0]:.3f})")

cat_dog = cosine(TABLE[STOI["cat"]], TABLE[STOI["dog"]])
cat_wood = cosine(TABLE[STOI["cat"]], TABLE[STOI["wood"]])
print(f"\ncat vs dog:  {cat_dog:.3f}")
print(f"cat vs wood: {cat_wood:.3f}")

# The entire thesis of the lesson is that similar words land near each other. If
# that did not happen, the table is not worth printing and nothing downstream
# is worth saying.
if cat_dog < 0.85:
    raise SystemExit(f"REFUSING TO EXPORT: cat and dog are not close ({cat_dog:.3f})")
if cat_dog > 0.999:
    raise SystemExit(f"REFUSING TO EXPORT: cat and dog are identical ({cat_dog:.3f}), which reads as a bug")
if cat_dog <= cat_wood:
    raise SystemExit("REFUSING TO EXPORT: cat is no closer to dog than to wood")

# Position rows: small on purpose, so they nudge rather than take over. A word
# at the front and the same word at the back must still look mostly like itself.
SEATS = 6
POS = [[round(0.01 * (s * DIM + d + 1), 2) for d in range(DIM)] for s in range(SEATS)]

out = {
    "note": "Skip-gram trained on a 16-line corpus. Four dimensions so the table can be printed.",
    "vocab": VOCAB,
    "dim": DIM,
    "seats": SEATS,
    "corpus": CORPUS,
    "window": WINDOW,
    "tokens": TABLE,
    "positions": POS,
    "cat_dog_cosine": round(cat_dog, 3),
    "cat_wood_cosine": round(cat_wood, 3),
}
dst = pathlib.Path(__file__).parent.parent / "src" / "model" / "tiny.json"
dst.write_text(json.dumps(out, indent=1), encoding="utf-8")
print(f"\nwrote {dst}  ({dst.stat().st_size / 1024:.1f} KB)")
