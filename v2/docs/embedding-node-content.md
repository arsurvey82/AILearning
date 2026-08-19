# Node 01, Embedding (field-tested content)

*Seed content for the first fully-built node of the LLM Learner. Captured from a live novice walkthrough (K, July 2026). Structured in the L0 to L4 depth layers from spec v4. The L2 "snags" are the exact questions a real beginner asked, in order, this is playtested, not guessed.*

Toy model used throughout: sorts 3 letters `A B C`; example input `C B A B B C`; embedding size shown as 48 (illustrated with 4).

---

## L0, one-liner (always visible)
**Turn each token into numbers, stamp it with its position, add the two. That combined vector is what enters the model.**
Analogy: a **name tag** (what you are) + a **seat number** (where you sit), carried together.

## L1. plain explanation + tiny real example
1. **Input**, the letters as ID numbers: `C B A B B C → 2 1 0 1 1 2`. Just addresses; meaningless alone.
2. **Token embed**. look up the *letter* → its meaning-vector (48 numbers).
3. **Position embed**. look up the *seat* → its position-vector (48 numbers).
4. **Input embed**. **add** the two → the vector that enters the model.

Real toy numbers (4 shown), the B in seat 3:
```
token "B"   [-0.31, 0.18, 0.24, 0.37]
seat  3     [ 0.05,-0.11, 0.30,-0.09]
add   →     [-0.26, 0.07, 0.54, 0.28]   ← input embedding for "B at seat 3"
```

## L2, common snags (playtested cards; each is a real question, with its plain answer)

**"What does '48 numbers' mean?"** → How many numbers describe one token. Like a color = 3 numbers (R,G,B); a token's meaning = 48 numbers. No single number *is* the meaning, the whole set is. They're learned, not human-labeled.

**"What's a seat?"** → One slot/position in the input row. The row of boxes at the top *is* the seats; each box = one seat = one position.

**"Why 11 columns/seats?"** → 11 = the model's max capacity (its *context window*). This toy needs room to hold the 6 input letters *and* write the 6-letter sorted answer into the same row → ~11 seats. Empty seats = where the output gets written.

**"Index vs token ID, same thing?"** → Same thing. "Token index" and "token ID" are two names for one number: the letter's slot in the vocabulary (A=0, B=1, C=2). "Index" just means "which one in a list, from 0."

**"Isn't position 3 an A?" (off-by-one)** → No, computers count from 0. In `C B A B B C`, A is the *3rd letter* but sits at *position 2*. Position 3 is the *4th letter* = B. Rule: position = (human count) − 1.

**"Why two separate tables (token + position)?"** → Because "what letter" and "which seat" are independent facts. Storing them separately = learn 3 letters + 11 seats = 14 vectors, then *add* to get any combo. Fusing them would need vocab×positions entries (astronomical at scale).

**"Input vs Input Embed. what's the difference?"** → *Input* = letters as bare IDs (one number each). *Input Embed* = same letters after embedding (48 numbers each). "Input, embedded." Input Embed is the input to the transformer *blocks*.

**"Is an LLM 'a machine'?"** → No, it's a **model**: a mathematical *function* with billions of tunable numbers, fit to data. (Corrects the v1 label.)

## L3, at scale (the "here vs real world" nuance)
- **embedding size:** 48 (toy) → GPT-2 **768** → Llama-3 **4096**
- **context window (seats):** 11 (toy) → **128,000+** → **1,000,000** (≈750k words ≈ 7-8 novels)
- **token ≈** a word *or a word-piece*: "cat" = 1 token; "unhappiness" ≈ 3
- **key rule:** these sizes are **chosen before training**; learning tunes the *values* in the slots, never the *number* of slots. A bigger model = a bigger form built up front.

## L4, under the hood (for the curious)
- token table `wte` shape `[vocab, C]`; position table `wpe` shape `[context, C]`
- `x = wte[token_ids] + wpe[positions]`  (minGPT/nanoGPT do exactly this)
- output = a `T × C` matrix (T tokens across × C dimensions tall)
- both tables are learned weights (blue in bbycroft); GPT-2 uses this learned position table, Llama swaps it for RoPE inside attention

## Leads to
→ **Attention** (each input-embed column becomes Q, K, V, and the tokens finally look at each other)
