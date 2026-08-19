"""Is the trained attention actually interpretable, or just different noise?"""
import json, math, pathlib
import numpy as np

W = json.loads((pathlib.Path(__file__).parent.parent/'src/model/weights.json').read_text())
V, C, H, HD = W['vocab'], W['n_embd'], W['n_head'], W['head_dim']
wte, wpe = np.array(W['wte']), np.array(W['wpe'])

def ln(x, g, b):
    m, v = x.mean(-1, keepdims=True), x.var(-1, keepdims=True)
    return (x-m)/np.sqrt(v+1e-5)*np.array(g)+np.array(b)

seq = "C B A B B C".split()
ids = [V.index(s) for s in seq]
x = wte[ids] + wpe[:len(ids)]
T = len(ids)

for li, B in enumerate(W['blocks']):
    h = ln(x, B['ln1']['g'], B['ln1']['b'])
    qkv = h @ np.array(B['attn']['w']) + np.array(B['attn']['b'])
    q, k, v = qkv[:, :C], qkv[:, C:2*C], qkv[:, 2*C:]
    for hd in range(H):
        qs, ks = q[:, hd*HD:(hd+1)*HD], k[:, hd*HD:(hd+1)*HD]
        s = qs @ ks.T / math.sqrt(HD)
        s = np.where(np.tril(np.ones((T,T)))==0, -1e9, s)
        e = np.exp(s - s.max(-1, keepdims=True)); a = e/e.sum(-1, keepdims=True)
        print(f"\nlayer {li} head {hd}  (rows = who is looking)")
        print("        " + "  ".join(f"{c}{j}" for j,c in enumerate(seq)))
        for i in range(T):
            cells = "  ".join(f"{a[i,j]*100:2.0f}" if j<=i else " ." for j in range(T))
            top = int(np.argmax(a[i])); 
            print(f"  {seq[i]}{i} -> {cells}   strongest: {seq[top]}{top}")
    # rough forward continue
    o = np.zeros_like(h)
    for hd in range(H):
        qs, ks, vs = q[:, hd*HD:(hd+1)*HD], k[:, hd*HD:(hd+1)*HD], v[:, hd*HD:(hd+1)*HD]
        s = qs @ ks.T / math.sqrt(HD)
        s = np.where(np.tril(np.ones((T,T)))==0, -1e9, s)
        e = np.exp(s - s.max(-1, keepdims=True)); a = e/e.sum(-1, keepdims=True)
        o[:, hd*HD:(hd+1)*HD] = a @ vs
    x = x + o @ np.array(B['proj']['w']) + np.array(B['proj']['b'])
    h2 = ln(x, B['ln2']['g'], B['ln2']['b'])
    f = h2 @ np.array(B['fc']['w']) + np.array(B['fc']['b'])
    f = 0.5*f*(1+np.tanh(np.sqrt(2/np.pi)*(f+0.044715*f**3)))
    x = x + f @ np.array(B['down']['w']) + np.array(B['down']['b'])

lg = ln(x, W['ln_f']['g'], W['ln_f']['b']) @ wte.T
p = np.exp(lg[-1]-lg[-1].max()); p/=p.sum()
print("\nnext-token prediction after 'C B A B B C':")
for i,c in enumerate(V): print(f"  {c}  {p[i]*100:5.1f}%")
print("  (sorted answer starts with:", sorted(seq)[0], ")")
