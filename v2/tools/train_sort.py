"""
Train the toy model for real, so the numbers on screen mean something.

CLAUDE.md section 6 asked for this and it never happened. The app has been
running on seeded random weights labelled "illustrative", which is honest but
useless for teaching: a learner watching attention sees a flat 20/22/17/21/21
split, because random projections attend to everything equally. There is
nothing to notice and nothing to explain.

A trained model produces structure. Attention rows become lopsided in ways that
correspond to the task, and "this token is looking at that one" stops being a
claim in the prose and becomes something visible on screen.

Architecture is nanoGPT, not an invention:
  learned token and position embeddings, pre-LayerNorm blocks, causal
  self-attention with a fused qkv projection, 4x GELU MLP, final LayerNorm,
  and a language-model head tied to the token embedding.

Task is the standard sort demo. Feed six letters, then the model must emit the
same six in order. The sequence is twelve long, so block_size is eleven: the
model sees positions 0..10 and predicts 1..11. That is exactly the context
length CLAUDE.md specifies, which is a good sign the spec had this in mind.
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
V = len(VOCAB)
N = 6                 # letters in, letters out
BLOCK = 2 * N - 1     # 11, see the docstring
N_EMBD = 48
N_HEAD = 2
N_LAYER = 2
HEAD = N_EMBD // N_HEAD


# ----------------------------------------------------------------- data
def all_sequences():
    """Every input of length N, paired with its sorted continuation."""
    rows = []
    for combo in itertools.product(range(V), repeat=N):
        rows.append(list(combo) + sorted(combo))
    return torch.tensor(rows, dtype=torch.long)


SEQ = all_sequences()                      # [729, 12]
g = torch.Generator().manual_seed(7)
perm = torch.randperm(SEQ.size(0), generator=g)
SEQ = SEQ[perm]
n_val = 80
VAL, TRAIN = SEQ[:n_val], SEQ[n_val:]


def batch(data, bs):
    idx = torch.randint(0, data.size(0), (bs,))
    s = data[idx]
    return s[:, :-1], s[:, 1:]


def masked_loss(logits, y):
    """
    Only the output half is scored.

    Predicting the unsorted input from itself is not the task and is mostly
    unlearnable anyway, so including it just adds noise to the gradient.
    Positions 0..N-2 predict the rest of the input; from N-1 onward the model
    is predicting the sorted answer.
    """
    B, T, _ = logits.shape
    mask = torch.zeros(T, dtype=torch.bool)
    mask[N - 1:] = True
    lg = logits[:, mask, :].reshape(-1, V)
    tg = y[:, mask].reshape(-1)
    return F.cross_entropy(lg, tg)


# ---------------------------------------------------------------- model
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
        h = self.ln_1(x)
        q, k, v = self.c_attn(h).split(N_EMBD, dim=2)
        q = q.view(B, T, N_HEAD, HEAD).transpose(1, 2)
        k = k.view(B, T, N_HEAD, HEAD).transpose(1, 2)
        v = v.view(B, T, N_HEAD, HEAD).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) / math.sqrt(HEAD)
        att = att.masked_fill(mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).contiguous().view(B, T, C)
        x = x + self.c_proj(y)
        x = x + self.proj(F.gelu(self.fc(self.ln_2(x))))
        return x


class GPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.wte = nn.Embedding(V, N_EMBD)
        self.wpe = nn.Embedding(BLOCK, N_EMBD)
        self.blocks = nn.ModuleList([Block() for _ in range(N_LAYER)])
        self.ln_f = nn.LayerNorm(N_EMBD)
        self.head = nn.Linear(N_EMBD, V, bias=False)
        self.head.weight = self.wte.weight          # tied, as in GPT-2
        self.register_buffer(
            "mask", torch.tril(torch.ones(BLOCK, BLOCK)).view(1, 1, BLOCK, BLOCK)
        )

    def forward(self, idx):
        B, T = idx.shape
        pos = torch.arange(T, device=idx.device)
        x = self.wte(idx) + self.wpe(pos)
        for b in self.blocks:
            x = b(x, self.mask)
        return self.head(self.ln_f(x))


model = GPT()
n_params = sum(p.numel() for p in model.parameters())
print(f"parameters: {n_params:,}")

opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.01)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=4000)

for step in range(4000):
    x, y = batch(TRAIN, 128)
    loss = masked_loss(model(x), y)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    sched.step()
    if step % 500 == 0 or step == 3999:
        with torch.no_grad():
            vx, vy = VAL[:, :-1], VAL[:, 1:]
            vl = masked_loss(model(vx), vy).item()
        print(f"step {step:4d}  train {loss.item():.4f}  val {vl:.4f}")


# ------------------------------------------------------------- does it sort?
@torch.no_grad()
def sorts_correctly(data):
    """Greedy decode the answer half and compare against the true sort."""
    ok = 0
    for row in data:
        ctx = row[:N].tolist()
        for _ in range(N):
            inp = torch.tensor([ctx[-BLOCK:]], dtype=torch.long)
            nxt = model(inp)[0, -1].argmax().item()
            ctx.append(nxt)
        if ctx[N:] == sorted(row[:N].tolist()):
            ok += 1
    return ok / len(data)


acc_val = sorts_correctly(VAL)
acc_train = sorts_correctly(TRAIN[:200])
print(f"\nexact-match sort accuracy   held out: {acc_val:.1%}   seen: {acc_train:.1%}")

# The whole point of training was to get meaningful attention. If it cannot
# sort, the weights are no better than the random ones and shipping them would
# be worse, because they would look trustworthy.
if acc_val < 0.9:
    raise SystemExit(f"REFUSING TO EXPORT: only {acc_val:.1%} on held out data.")


# ------------------------------------------------------------------ export
def t2(x):
    """Transpose to [in][out] so the JS side can do sum_i v[i] * W[i][j]."""
    return [[round(float(v), 4) for v in row] for row in x.t()]


def m(x):
    return [[round(float(v), 4) for v in row] for row in x]


def vec(x):
    return [round(float(v), 4) for v in x]


out = {
    "note": "nanoGPT trained on the 6-letter sort task. Every number here is learned.",
    "vocab": VOCAB,
    "n_embd": N_EMBD, "n_head": N_HEAD, "n_layer": N_LAYER,
    "block_size": BLOCK, "head_dim": HEAD, "ffn": 4 * N_EMBD,
    "sort_accuracy_held_out": round(acc_val, 4),
    "wte": m(model.wte.weight),
    "wpe": m(model.wpe.weight),
    "ln_f": {"g": vec(model.ln_f.weight), "b": vec(model.ln_f.bias)},
    "blocks": [],
}
for b in model.blocks:
    out["blocks"].append({
        "ln1": {"g": vec(b.ln_1.weight), "b": vec(b.ln_1.bias)},
        "attn": {"w": t2(b.c_attn.weight), "b": vec(b.c_attn.bias)},
        "proj": {"w": t2(b.c_proj.weight), "b": vec(b.c_proj.bias)},
        "ln2": {"g": vec(b.ln_2.weight), "b": vec(b.ln_2.bias)},
        "fc": {"w": t2(b.fc.weight), "b": vec(b.fc.bias)},
        "down": {"w": t2(b.proj.weight), "b": vec(b.proj.bias)},
    })

dst = pathlib.Path(__file__).parent.parent / "src" / "model" / "weights.json"
dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"wrote {dst}  ({dst.stat().st_size/1024:.0f} KB)")
