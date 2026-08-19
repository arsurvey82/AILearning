"""
Expected values for the TypeScript forward pass to match.

Written in numpy, from the exported JSON rather than from the torch model. That
makes it an independent reimplementation: if the JSON export dropped or
transposed something, this catches it, because it never sees the torch objects.

The fixture records every intermediate, not just the output. A pass that gets
the right answer through two cancelling mistakes is a real risk when porting,
and only the intermediates expose it.
"""

import json
import math
import pathlib
import numpy as np

ROOT = pathlib.Path(__file__).parent.parent
SRC = ROOT / "src" / "model"


def layernorm(x, g, b):
    m = x.mean(-1, keepdims=True)
    v = x.var(-1, keepdims=True)
    return (x - m) / np.sqrt(v + 1e-5) * np.array(g) + np.array(b)


def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))


def softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)


def run(W, tokens):
    V, C, NH, HD = W["vocab"], W["n_embd"], W["n_head"], W["head_dim"]
    ids = [V.index(t) for t in tokens]
    T = len(ids)
    wte, wpe = np.array(W["wte"]), np.array(W["wpe"])
    x = wte[ids] + wpe[:T]

    trace = {"ids": ids, "embed": x.tolist(), "layers": []}

    for B in W["blocks"]:
        L = {}
        h = layernorm(x, B["ln1"]["g"], B["ln1"]["b"])
        L["norm1"] = h.tolist()
        qkv = h @ np.array(B["attn"]["w"]) + np.array(B["attn"]["b"])
        q, k, v = qkv[:, :C], qkv[:, C : 2 * C], qkv[:, 2 * C :]
        L["Q"], L["K"], L["V"] = q.tolist(), k.tolist(), v.tolist()

        merged = np.zeros((T, C))
        L["heads"] = []
        for hd in range(NH):
            qs, ks, vs = (m[:, hd * HD : (hd + 1) * HD] for m in (q, k, v))
            s = qs @ ks.T / math.sqrt(HD)
            s = np.where(np.tril(np.ones((T, T))) == 0, -np.inf, s)
            a = softmax(np.where(np.isneginf(s), -1e9, s))
            a = np.where(np.isneginf(s), 0.0, a)
            o = a @ vs
            merged[:, hd * HD : (hd + 1) * HD] = o
            L["heads"].append({
                "scores": np.where(np.isneginf(s), None, s).tolist(),
                "weights": a.tolist(),
                "out": o.tolist(),
            })

        attn_out = merged @ np.array(B["proj"]["w"]) + np.array(B["proj"]["b"])
        x = x + attn_out
        L["attnOut"], L["afterAttn"] = attn_out.tolist(), x.tolist()

        h2 = layernorm(x, B["ln2"]["g"], B["ln2"]["b"])
        L["norm2"] = h2.tolist()

        if "experts" in B:
            gate = h2 @ np.array(B["gate"]["w"])
            order = np.argsort(-gate, axis=-1)[:, : W["top_k"]]
            picked = np.take_along_axis(gate, order, axis=-1)
            gw = softmax(picked)
            down = np.zeros((T, C))
            for t in range(T):
                for j in range(W["top_k"]):
                    E = B["experts"][order[t][j]]
                    hh = gelu(h2[t] @ np.array(E["fc"]["w"]) + np.array(E["fc"]["b"]))
                    down[t] += gw[t][j] * (hh @ np.array(E["down"]["w"]) + np.array(E["down"]["b"]))
            L["route"] = [[{"e": int(order[t][j]), "w": float(gw[t][j])}
                           for j in range(W["top_k"])] for t in range(T)]
        else:
            hid = gelu(h2 @ np.array(B["fc"]["w"]) + np.array(B["fc"]["b"]))
            L["hidden"] = hid.tolist()
            down = hid @ np.array(B["down"]["w"]) + np.array(B["down"]["b"])

        L["down"] = down.tolist()
        x = x + down
        L["afterMlp"] = x.tolist()
        trace["layers"].append(L)

    fin = layernorm(x, W["ln_f"]["g"], W["ln_f"]["b"])
    trace["finalNorm"] = fin.tolist()
    logits = fin[-1] @ wte.T
    trace["logits"] = logits.tolist()
    trace["probs"] = softmax(logits).tolist()
    trace["predicted"] = V[int(np.argmax(logits))]
    return trace


CASES = [
    ("words", "weights-words.json", ["the", "cat", "near", "the", "dogs", "sits"]),
    ("words_plural", "weights-words.json", ["the", "cats", "near", "the", "dog", "sit"]),
    ("letters", "weights.json", ["C", "B", "A", "B", "B", "C"]),
    ("letters_moe", "weights-moe.json", ["C", "B", "A", "B", "B", "C"]),
]

out = {}
for name, f, toks in CASES:
    W = json.loads((SRC / f).read_text(encoding="utf-8"))
    tr = run(W, toks)
    out[name] = {"weights": f, "tokens": toks, "trace": tr}
    print(f"{name:14s} {' '.join(toks):34s} -> {tr['predicted']}")

dst = ROOT / "tests" / "fixtures" / "forward.json"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"\nwrote {dst}  ({dst.stat().st_size/1024:.0f} KB)")
