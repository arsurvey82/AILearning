"""
The same task, with the MLP replaced by a mixture of experts.

This exists because "where is MoE" deserves a better answer than a diagram. The
routing is the whole idea and it is only convincing if you can watch a real
router send real tokens to different experts.

Follows Mixtral's shape, scaled down: the feed-forward block becomes N separate
experts plus a router that picks the top k for every token, at every layer,
independently. Mixtral uses 8 experts and picks 2 (arXiv 2401.04088). This uses
4 and picks 2, because 4 experts over a 3-letter vocabulary is already generous.

Also logs the loss curve, so the app can show what gradient descent actually
looked like instead of asserting that it happened.
"""

import itertools
import json
import math
import pathlib
import torch
import torch.nn as nn
from torch.nn import functional as F

torch.manual_seed(1337)

VOCAB = ["A", "B", "C"]
V, N = len(VOCAB), 6
BLOCK = 2 * N - 1
N_EMBD, N_HEAD, N_LAYER = 48, 2, 2
HEAD = N_EMBD // N_HEAD
N_EXPERT, TOP_K = 4, 2


def all_sequences():
    return torch.tensor(
        [list(c) + sorted(c) for c in itertools.product(range(V), repeat=N)],
        dtype=torch.long,
    )


SEQ = all_sequences()[torch.randperm(V**N, generator=torch.Generator().manual_seed(7))]
VAL, TRAIN = SEQ[:80], SEQ[80:]


def batch(data, bs):
    s = data[torch.randint(0, data.size(0), (bs,))]
    return s[:, :-1], s[:, 1:]


def masked_loss(logits, y):
    mask = torch.zeros(y.size(1), dtype=torch.bool)
    mask[N - 1:] = True
    return F.cross_entropy(logits[:, mask, :].reshape(-1, V), y[:, mask].reshape(-1))


class Expert(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Linear(N_EMBD, 4 * N_EMBD)
        self.proj = nn.Linear(4 * N_EMBD, N_EMBD)

    def forward(self, x):
        return self.proj(F.gelu(self.fc(x)))


class MoE(nn.Module):
    """Router picks top-k experts per token. Only those run."""

    def __init__(self):
        super().__init__()
        self.gate = nn.Linear(N_EMBD, N_EXPERT, bias=False)
        self.experts = nn.ModuleList([Expert() for _ in range(N_EXPERT)])

    def forward(self, x):
        B, T, C = x.shape
        flat = x.view(-1, C)
        logits = self.gate(flat)
        w, idx = torch.topk(logits, TOP_K, dim=-1)
        w = F.softmax(w, dim=-1)
        out = torch.zeros_like(flat)
        for e in range(N_EXPERT):
            hit = (idx == e)
            if not hit.any():
                continue
            rows = hit.any(dim=-1).nonzero(as_tuple=True)[0]
            gate_w = (w * hit.float()).sum(dim=-1)[rows].unsqueeze(-1)
            out[rows] += gate_w * self.experts[e](flat[rows])
        return out.view(B, T, C)


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln_1 = nn.LayerNorm(N_EMBD)
        self.c_attn = nn.Linear(N_EMBD, 3 * N_EMBD)
        self.c_proj = nn.Linear(N_EMBD, N_EMBD)
        self.ln_2 = nn.LayerNorm(N_EMBD)
        self.moe = MoE()

    def forward(self, x, mask):
        B, T, C = x.shape
        h = self.ln_1(x)
        q, k, v = self.c_attn(h).split(N_EMBD, dim=2)
        q, k, v = (t.view(B, T, N_HEAD, HEAD).transpose(1, 2) for t in (q, k, v))
        att = (q @ k.transpose(-2, -1)) / math.sqrt(HEAD)
        att = att.masked_fill(mask[:, :, :T, :T] == 0, float("-inf")).softmax(-1)
        x = x + self.c_proj((att @ v).transpose(1, 2).contiguous().view(B, T, C))
        return x + self.moe(self.ln_2(x))


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
total = sum(p.numel() for p in model.parameters())
per_expert = sum(p.numel() for p in model.blocks[0].moe.experts[0].parameters())
# Active parameters skip the experts that did not fire, which is the whole point.
inactive = N_LAYER * (N_EXPERT - TOP_K) * per_expert
print(f"total parameters:     {total:,}")
print(f"active per token:     {total - inactive:,}  ({TOP_K} of {N_EXPERT} experts per layer)")

opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.01)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=4000)
curve = []

for step in range(4000):
    x, y = batch(TRAIN, 128)
    loss = masked_loss(model(x), y)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    sched.step()
    if step % 20 == 0:
        curve.append(round(loss.item(), 4))
    if step % 800 == 0 or step == 3999:
        print(f"step {step:4d}  loss {loss.item():.4f}")


@torch.no_grad()
def accuracy(data):
    ok = 0
    for row in data:
        ctx = row[:N].tolist()
        for _ in range(N):
            ctx.append(model(torch.tensor([ctx[-BLOCK:]]))[0, -1].argmax().item())
        ok += ctx[N:] == sorted(row[:N].tolist())
    return ok / len(data)


acc = accuracy(VAL)
print(f"\nexact-match sort accuracy, held out: {acc:.1%}")
if acc < 0.85:
    raise SystemExit(f"REFUSING TO EXPORT: {acc:.1%}")


def t2(x): return [[round(float(v), 4) for v in r] for r in x.t()]
def m(x): return [[round(float(v), 4) for v in r] for r in x]
def vec(x): return [round(float(v), 4) for v in x]


out = {
    "note": "Mixtral-shaped mixture of experts on the 6-letter sort task. Real routing.",
    "vocab": VOCAB, "n_embd": N_EMBD, "n_head": N_HEAD, "n_layer": N_LAYER,
    "block_size": BLOCK, "head_dim": HEAD, "ffn": 4 * N_EMBD,
    "n_expert": N_EXPERT, "top_k": TOP_K,
    "params_total": total, "params_active": total - inactive,
    "sort_accuracy_held_out": round(acc, 4),
    "loss_curve": curve,
    "wte": m(model.wte.weight), "wpe": m(model.wpe.weight),
    "ln_f": {"g": vec(model.ln_f.weight), "b": vec(model.ln_f.bias)},
    "blocks": [],
}
for b in model.blocks:
    out["blocks"].append({
        "ln1": {"g": vec(b.ln_1.weight), "b": vec(b.ln_1.bias)},
        "attn": {"w": t2(b.c_attn.weight), "b": vec(b.c_attn.bias)},
        "proj": {"w": t2(b.c_proj.weight), "b": vec(b.c_proj.bias)},
        "ln2": {"g": vec(b.ln_2.weight), "b": vec(b.ln_2.bias)},
        "gate": {"w": t2(b.moe.gate.weight)},
        "experts": [{"fc": {"w": t2(e.fc.weight), "b": vec(e.fc.bias)},
                     "down": {"w": t2(e.proj.weight), "b": vec(e.proj.bias)}}
                    for e in b.moe.experts],
    })

dst = pathlib.Path(__file__).parent.parent / "src" / "model" / "weights-moe.json"
dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"wrote {dst}  ({dst.stat().st_size/1024:.0f} KB)")

# Which expert does each token actually pick? This is the demo.
with torch.no_grad():
    seq = "C B A B B C".split()
    ids = torch.tensor([[VOCAB.index(s) for s in seq]])
    x = model.wte(ids) + model.wpe(torch.arange(len(seq)))
    for li, b in enumerate(model.blocks):
        h = b.ln_1(x)
        q, k, v = b.c_attn(h).split(N_EMBD, dim=2)
        q, k, v = (t.view(1, len(seq), N_HEAD, HEAD).transpose(1, 2) for t in (q, k, v))
        att = (q @ k.transpose(-2, -1)) / math.sqrt(HEAD)
        att = att.masked_fill(b.mask if False else torch.tril(torch.ones(len(seq), len(seq))) == 0, float("-inf")).softmax(-1)
        x = x + b.c_proj((att @ v).transpose(1, 2).contiguous().view(1, len(seq), N_EMBD))
        g = b.moe.gate(b.ln_2(x).view(-1, N_EMBD))
        w, idx = torch.topk(g, TOP_K, -1)
        w = w.softmax(-1)
        print(f"\nlayer {li} routing:")
        for t, s in enumerate(seq):
            picks = ", ".join(f"expert {idx[t][j].item()} at {w[t][j]*100:.0f}%" for j in range(TOP_K))
            print(f"  {s}{t} -> {picks}")
        x = x + b.moe(b.ln_2(x))
