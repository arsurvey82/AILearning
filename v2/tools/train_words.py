"""
Words instead of letters, on a task where attention becomes readable English.

Sorting letters was verifiable but nothing a person recognises: "C5 attends to
A2" is not a sentence. Moving to words only helps if the model has to do
something a reader can judge by eye, so this uses subject-verb agreement across
a distractor, which is the classic agreement-attraction probe:

    the cat  near the dogs sits .      verb agrees with "cat",  not "dogs"
    the cats near the dog  sit  .      verb agrees with "cats", not "dog"

The nearer noun always disagrees with the verb. A model that just copies from
the closest noun scores zero. To get it right the verb position must reach past
the distractor to the real subject, and that reach is visible in the attention
row. So the picture stops being "some numbers lit up" and becomes "the verb is
looking at the subject", which is a claim a reader can check.

Same nanoGPT architecture as the letter model.
"""

import itertools
import json
import math
import pathlib
import random
import torch
import torch.nn as nn
from torch.nn import functional as F

torch.manual_seed(1337)
random.seed(1337)

SG_N = ["cat", "dog", "bird", "child", "robot"]
PL_N = ["cats", "dogs", "birds", "children", "robots"]
SG_V = ["sits", "runs", "sleeps", "sings", "waits"]
PL_V = ["sit", "run", "sleep", "sing", "wait"]
FIXED = ["the", "near", "."]
VOCAB = FIXED + SG_N + PL_N + SG_V + PL_V
STOI = {w: i for i, w in enumerate(VOCAB)}
V = len(VOCAB)

# the N1 near the N2 V .   ->  7 tokens, so we feed 6 and predict 6.
LEN = 7
BLOCK = LEN - 1
N_EMBD, N_HEAD, N_LAYER = 64, 2, 2
HEAD = N_EMBD // N_HEAD
VERB_POS = 5           # index of the verb in the sentence


def sentences():
    """
    Every combination of subject number AND distractor number, independently.

    The first version of this only generated sentences where the distractor
    disagreed with the subject. That looked like a stronger test and was
    actually a hole: with the distractor perfectly anti-correlated with the
    answer, "invert the nearest noun" is a rule that scores 100% on training
    and 100% on held-out data while being completely wrong. The held-out split
    could not detect it because it shared the same bias.

    Crossing the two numbers independently makes the distractor carry no
    information at all, so the only rule that works is reading the subject.
    """
    out = []
    for subj_sg in (True, False):
        for dist_sg in (True, False):
            subs = SG_N if subj_sg else PL_N
            dist = SG_N if dist_sg else PL_N
            verbs = SG_V if subj_sg else PL_V
            for s, d, v in itertools.product(subs, dist, verbs):
                out.append(["the", s, "near", "the", d, v, "."])
    return out


ALL = sentences()
random.shuffle(ALL)
IDS = torch.tensor([[STOI[w] for w in s] for s in ALL], dtype=torch.long)
n_val = 160
VAL, TRAIN = IDS[:n_val], IDS[n_val:]
print(f"vocabulary: {V} words   sentences: {len(ALL)}   held out: {n_val}")


def batch(data, bs):
    s = data[torch.randint(0, data.size(0), (bs,))]
    return s[:, :-1], s[:, 1:]


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln_1 = nn.LayerNorm(N_EMBD)
        self.c_attn = nn.Linear(N_EMBD, 3 * N_EMBD)
        self.c_proj = nn.Linear(N_EMBD, N_EMBD)
        self.ln_2 = nn.LayerNorm(N_EMBD)
        self.fc = nn.Linear(N_EMBD, 4 * N_EMBD)
        self.proj = nn.Linear(4 * N_EMBD, N_EMBD)

    def forward(self, x, mask):
        B, T, C = x.shape
        q, k, v = self.c_attn(self.ln_1(x)).split(N_EMBD, dim=2)
        q, k, v = (t.view(B, T, N_HEAD, HEAD).transpose(1, 2) for t in (q, k, v))
        att = (q @ k.transpose(-2, -1)) / math.sqrt(HEAD)
        att = att.masked_fill(mask[:, :, :T, :T] == 0, float("-inf")).softmax(-1)
        x = x + self.c_proj((att @ v).transpose(1, 2).contiguous().view(B, T, C))
        return x + self.proj(F.gelu(self.fc(self.ln_2(x))))


class GPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.wte = nn.Embedding(V, N_EMBD)
        self.wpe = nn.Embedding(BLOCK, N_EMBD)
        self.blocks = nn.ModuleList([Block() for _ in range(N_LAYER)])
        self.ln_f = nn.LayerNorm(N_EMBD)
        self.head = nn.Linear(N_EMBD, V, bias=False)
        self.head.weight = self.wte.weight
        self.register_buffer("mask", torch.tril(torch.ones(BLOCK, BLOCK)).view(1, 1, BLOCK, BLOCK))

    def forward(self, idx):
        x = self.wte(idx) + self.wpe(torch.arange(idx.size(1)))
        for b in self.blocks:
            x = b(x, self.mask)
        return self.head(self.ln_f(x))


model = GPT()
print(f"parameters: {sum(p.numel() for p in model.parameters()):,}")

opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=0.01)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=3000)
curve = []
for step in range(3000):
    x, y = batch(TRAIN, 64)
    loss = F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1))
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    sched.step()
    if step % 20 == 0:
        curve.append(round(loss.item(), 4))
    if step % 600 == 0 or step == 2999:
        print(f"step {step:4d}  loss {loss.item():.4f}")


@torch.no_grad()
def agreement(data):
    """
    Does it choose a verb of the right number?

    Scored on number, not on the exact verb: any of the five plural verbs is a
    correct answer after a plural subject. Getting the specific verb right is
    not learnable here and would only make the score look worse for no reason.
    """
    ok = 0
    for row in data:
        pred = model(row[:-1].unsqueeze(0))[0, VERB_POS - 1].argmax().item()
        want_pl = VOCAB[row[1].item()] in PL_N
        ok += (VOCAB[pred] in PL_V) == want_pl and VOCAB[pred] in (PL_V + SG_V)
    return ok / len(data)


@torch.no_grad()
def distractor_invariance(data):
    """
    Does flipping the distractor's number leave the verb's number alone?

    Accuracy cannot answer this, which is the point. A model reading the nearer
    noun can score perfectly on a biased test set and still fail here, so this
    is the gate that actually proves the subject is what controls the verb.
    """
    ok = 0
    for row in data:
        r = row.clone()
        d = VOCAB[r[4].item()]
        r[4] = STOI[PL_N[SG_N.index(d)] if d in SG_N else SG_N[PL_N.index(d)]]
        a = VOCAB[model(row[:-1].unsqueeze(0))[0, VERB_POS - 1].argmax().item()]
        b = VOCAB[model(r[:-1].unsqueeze(0))[0, VERB_POS - 1].argmax().item()]
        ok += (a in PL_V) == (b in PL_V)
    return ok / len(data)


acc = agreement(VAL)
inv = distractor_invariance(VAL)
print(f"\nagreement on held-out sentences:       {acc:.1%}")
print(f"verb unchanged when distractor flips: {inv:.1%}")

if acc < 0.95:
    raise SystemExit(f"REFUSING TO EXPORT: agreement {acc:.1%}")
# Accuracy alone cannot catch a model that reads the nearer noun, so this is
# the gate that actually proves the subject controls the verb.
if inv < 0.95:
    raise SystemExit(f"REFUSING TO EXPORT: the distractor still moves the verb ({inv:.1%})")


# --------------------------------------------------- is the reach visible?
@torch.no_grad()
def show(sentence):
    ids = torch.tensor([[STOI[w] for w in sentence[:-1]]])
    x = model.wte(ids) + model.wpe(torch.arange(ids.size(1)))
    rows = []
    for li, b in enumerate(model.blocks):
        q, k, v = b.c_attn(b.ln_1(x)).split(N_EMBD, dim=2)
        q, k, v = (t.view(1, ids.size(1), N_HEAD, HEAD).transpose(1, 2) for t in (q, k, v))
        att = (q @ k.transpose(-2, -1)) / math.sqrt(HEAD)
        att = att.masked_fill(model.mask[:, :, :ids.size(1), :ids.size(1)] == 0, float("-inf")).softmax(-1)
        rows.append(att[0, :, VERB_POS - 1].tolist())
        x = x + b.c_proj((att @ v).transpose(1, 2).contiguous().view(1, ids.size(1), N_EMBD))
        x = x + b.proj(F.gelu(b.fc(b.ln_2(x))))
    return rows


demo = ["the", "cat", "near", "the", "dogs", "sits", "."]
print(f"\n\"{' '.join(demo)}\"")
print("what the verb position is looking at:")
words = demo[:-1]
for li, heads in enumerate(show(demo)):
    for hi, row in enumerate(heads):
        top = max(range(len(row)), key=lambda j: row[j])
        cells = "  ".join(f"{w}:{p*100:2.0f}" for w, p in zip(words, row))
        print(f"  layer {li} head {hi}   {cells}   -> strongest: {words[top]}")


def t2(x): return [[round(float(v), 4) for v in r] for r in x.t()]
def m(x): return [[round(float(v), 4) for v in r] for r in x]
def vec(x): return [round(float(v), 4) for v in x]


out = {
    "note": "nanoGPT trained on subject-verb agreement across a distractor.",
    "task": "the N1 near the N2 VERB . -- the verb agrees with N1, never the nearer N2",
    "vocab": VOCAB, "n_embd": N_EMBD, "n_head": N_HEAD, "n_layer": N_LAYER,
    "block_size": BLOCK, "head_dim": HEAD, "ffn": 4 * N_EMBD,
    "verb_pos": VERB_POS,
    "groups": {"sg_noun": SG_N, "pl_noun": PL_N, "sg_verb": SG_V, "pl_verb": PL_V, "fixed": FIXED},
    "agreement_held_out": round(acc, 4),
    "distractor_invariance": round(inv, 4),
    "loss_curve": curve,
    "wte": m(model.wte.weight), "wpe": m(model.wpe.weight),
    "ln_f": {"g": vec(model.ln_f.weight), "b": vec(model.ln_f.bias)},
    "blocks": [{
        "ln1": {"g": vec(b.ln_1.weight), "b": vec(b.ln_1.bias)},
        "attn": {"w": t2(b.c_attn.weight), "b": vec(b.c_attn.bias)},
        "proj": {"w": t2(b.c_proj.weight), "b": vec(b.c_proj.bias)},
        "ln2": {"g": vec(b.ln_2.weight), "b": vec(b.ln_2.bias)},
        "fc": {"w": t2(b.fc.weight), "b": vec(b.fc.bias)},
        "down": {"w": t2(b.proj.weight), "b": vec(b.proj.bias)},
    } for b in model.blocks],
}
dst = pathlib.Path(__file__).parent.parent / "src" / "model" / "weights-words.json"
dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"\nwrote {dst}  ({dst.stat().st_size/1024:.0f} KB)")
