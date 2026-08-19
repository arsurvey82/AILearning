# Claim inventory

Nodes: 64
Checkable claims: 582
- derivable (become tests): 17
- external (need a source): 287
- judgement (framing, not cited): 278


## derivable (17)


### foundations
- `L4`. A useful check on where the cost goes: a forward pass costs roughly `2 × parameters` floating-point operations per token.

### logits
- `L2[0]`. Forcing every output to be positive and to sum to 1 inside the network would constrain training badly.

### softmax
- `L0`. Squashes scores into probabilities that sum to 1.

### query
- `L1.prose[0]`. **One matrix multiply, nothing more.** The token's 48-number input vector times a learned 48×24 matrix gives a 24-number query.

### key
- `L1.prose[0]`. **Same operation as the query, different matrix.** Input vector times a learned 48×24 `Wk`.

### value
- `L1.prose[0]`. **The third projection, from the same input vector.** A learned 48×24 `Wv`.
- `L4`, Because `A`'s rows sum to 1, every output row is a convex combination of value rows. it can never be larger than the largest value or smaller than the smallest.

### attention-weights
- `L0`. Turn each row of scores into percentages that sum to 1. how much attention this token pays to each token it can see.
- `L1.prose[2]`. **Dividing by the total forces a budget.** Rows sum to exactly 1, so attention is always shared out, never created.

### weighted-sum
- `L1.prose[1]`. **The result is a convex combination.** Because the weights sum to 1, the output can never exceed the range of the values that went in.

### up-projection
- `L0`. A matrix multiply that expands the vector to roughly 4× width, room to compute in.
- `L1.prose[0]`. **One multiply, one shape change.** 48 numbers in, roughly 192 out, via a learned matrix.

### embedding
- `L2[3]`. "Token index" and "token ID" are two names for one number: the letter's slot in the vocabulary (A=0, B=1, C=2).

### attention
- `L0`. The result is a percentage split that always adds up to 1.
- `L1.prose[4]`. **Softmax, then blend.** Turn each row of scores into percentages that sum to 1, then add up the Values in those proportions.

### gpu
- `L2[1]`. Multiply parameters by bytes per parameter: 2 for fp16, 1 for int8, about 0.5 for 4-bit.

### kv-cache
- `L1.prose[2]`. **So you cache instead of recomputing.** Without the cache, generating token N re-does the work for all N−1 previous tokens, and generation cost grows with the square of the length.

## external (287)


### llm
- `L3.Parameters.gpt2`, 124 million
- `L3.Parameters.llama`, 8 billion
- `L3.Trained on.gpt2`, ~10B tokens
- `L3.Trained on.llama`, ~15T tokens

### model
- `L2[1]`. GPT-2 and modern models differ in size, normalisation choice, position encoding and activation, but a diagram of one is a diagram of the other.
- `L3.Distinct architectures.llama`, 1

### foundations
- `L3.Operations per token.llama`, billions of multiply-adds

### linalg
- `L3.Multiplies per token.llama`, ~16 billion

### vector
- `L3.Width.gpt2`, 768
- `L3.Width.llama`, 4,096
- `L3.Bytes per vector at fp16.gpt2`, 1,536
- `L3.Bytes per vector at fp16.llama`, 8,192

### matrix
- `L3.Largest matrix.gpt2`, 768 × 50,257
- `L3.Largest matrix.llama`, 4,096 × 128,256
- `L3.Matrices per block.llama`, ~7

### matmul
- `L3.Multiplies per token.llama`, ~16 billion
- `L3.What limits it.llama`, memory bandwidth during generation

### dot-product
- `L3.Terms per dot product.gpt2`, 64
- `L3.Terms per dot product.llama`, 128
- `L3.Dot products per layer.llama`, billions at long context

### calculus
- `L3.Gradients per step.llama`, 8 billion
- `L3.Steps in a run.llama`, hundreds of thousands

### derivative
- `L3.Derivatives per step.llama`, 8 billion

### backprop
- `L3.Cost vs forward pass.llama`, ~2×
- `L3.Activation memory.llama`, often larger than the weights

### gradient-descent
- `L0`. The optimiser. SGD, then Adam, then AdamW, decides how big each step is.
- `L1.prose[0]`. **Subtract the gradient, scaled by a learning rate.** That is plain SGD, and it works.
- `L1.prose[2]`. **Adam adapts per weight.** Weights with consistently small gradients take larger steps, and vice versa, so one global learning rate suits every weight.
- `L1.prose[3]`. **AdamW fixes weight decay.** It applies decay separately from the adaptive step, which turned out to matter and is now the default.
- `L3.Optimiser memory.llama`, 2 extra numbers per weight
- `L3.Learning rate.llama`, warmup then decay, ~1e-4 peak
- `L4`. The last line being separate from the adaptive step is the whole of AdamW.
- `L4`. Folding decay into the gradient, as the original Adam did, makes it interact with the per-weight scaling in a way nobody intended.

### probability
- `L3.Numbers per prediction.gpt2`, 50,257
- `L3.Numbers per prediction.llama`, 128,256

### logits
- `L1.prose[0]`. **One number per vocabulary slot.** For Llama-3 that is 128,256 numbers for every single token generated.
- `L3.Logits per token.gpt2`, 50,257
- `L3.Logits per token.llama`, 128,256

### softmax
- `L3.Applied per token.llama`. once per head per layer, plus once at the end

### sampling
- `L3.Typical temperature.llama`. 0 for factual, 0.7-1.0 for creative
- `L3.Typical top-p.llama`, 0.9-0.95

### objects
- `L3.Weights.llama`, 8 billion, fixed
- `L3.Activations.llama`, depends on prompt length
- `L4`, In PyTorch the distinction is literal: parameters are registered on the module and appear in `model.parameters()`; activations are ordinary tensors produced during `forward` and freed by the garbage collector.

### parameter
- `L3.Count.gpt2`, 124 million
- `L3.Count.llama`, 8 billion
- `L3.Bytes each at fp16.llama`, 2

### tensor
- `L3.Common shape.llama`, [batch, tokens, 4096]
- `L3.Attention grid.llama`, [32, T, T] per layer

### neuron
- `L3.Feed-forward dimensions.llama`, 14,336 per layer

### architecture
- `L2[1]`. The refinements to the architecture itself. RMSNorm, RoPE, SwiGLU, GQA. Are real but incremental against a design that is recognisably the 2017 transformer with the encoder removed.
- `L3.Architecture code.llama`, a few hundred lines
- `L3.Weights.llama`, ~16 GB

### transformer
- `L3.Blocks stacked.gpt2`, 12
- `L3.Blocks stacked.llama`, 32
- `L3.Vector width.gpt2`, 768
- `L3.Vector width.llama`, 4,096
- `L3.Passes for one answer.llama`, one per token generated
- `L3.Passes for one answer.note`. A 500-word answer is roughly 650 complete passes through every block.

### layer
- `L1.flow.mix.n1`, RMSNorm: rescale
- `L1.flow.think.n2`, RMSNorm: rescale again
- `L3.Blocks.gpt2`, 12
- `L3.Blocks.llama`, 32
- `L3.Parameter split per block.llama`, ~1/3 attention, ~2/3 feed-forward

### query
- `L3.Query width.gpt2`, 64
- `L3.Query width.llama`, 128
- `L3.Wq size per head.gpt2`, 768 × 64
- `L3.Wq size per head.llama`, 4,096 × 128

### key
- `L3.Key heads.gpt2`, 12 (one per query head)
- `L3.Key heads.llama`, 8 (shared by 32)
- `L3.Cached per token.llama`, ~128 KB across all layers

### value
- `L3.Value width.gpt2`, 64
- `L3.Value width.llama`, 128
- `L3.Shared with keys?.llama`, yes, under GQA

### attention-scores
- `L2[2]`. Every "efficient attention" method is an attack on that square. FlashAttention avoids materialising it, sparse patterns skip parts of it.
- `L3.Grid size.gpt2`, up to 1,024²
- `L3.Grid size.llama`, up to 128,000²
- `L3.Scale divisor.gpt2`, √64 = 8
- `L3.Scale divisor.llama`, √128 ≈ 11.3
- `L4`. FlashAttention's contribution is never storing `S` at all: it fuses the score, mask, softmax and value-blend into one kernel that works in tiles, keeping only the running softmax statistics.

### attention-weights
- `L3.Rows per layer per head.llama`, one per token, up to 128,000
- `L3.Numerical guard.llama`, same
- `L3.Numerical guard.note`, e^1000 overflows; e^(1000−1000) does not.

### weighted-sum
- `L3.Per-head output width.gpt2`, 64
- `L3.Per-head output width.llama`, 128
- `L3.After concatenation.gpt2`, 768
- `L3.After concatenation.llama`, 4,096

### mlp
- `L1.flow.act`, Nonlinearity: the bend, SwiGLU or GELU
- `L3.Expansion factor.gpt2`, 4×
- `L3.Expansion factor.llama`, ~3.5× with SwiGLU
- `L3.Middle width.gpt2`, 3,072
- `L3.Middle width.llama`, 14,336
- `L3.Share of block parameters.llama`, ~2/3
- `L4`. SwiGLU splits the up-projection in two and uses one half to gate the other:

### up-projection
- `L3.Output width.gpt2`, 3,072
- `L3.Output width.llama`, 14,336
- `L3.Parameters.gpt2`, ~2.4M per layer
- `L3.Parameters.llama`, ~59M per layer

### activation
- `L1.prose[3]`. **SwiGLU adds a gate.** Half the expanded vector controls how much of the other half passes.
- `L2[1]`. Smooth curves like GELU and SiLU avoid that and train slightly better, which at this scale is worth the extra arithmetic.
- `L3.Common choice.here`, SwiGLU
- `L3.Common choice.gpt2`, GELU
- `L3.Common choice.llama`, SwiGLU
- `L3.Matrices needed.gpt2`, 2
- `L3.Matrices needed.llama`, 3

### down-projection
- `L3.Shape.gpt2`, 3,072 × 768
- `L3.Shape.llama`, 14,336 × 4,096

### residual
- `L3.Stream width.gpt2`, 768
- `L3.Stream width.llama`, 4,096
- `L3.Writes into it.gpt2`, 24
- `L3.Writes into it.llama`, 64

### normalization
- `L1.prose[3]`. **RMSNorm drops the mean-centring.** LayerNorm subtracts the mean first; RMSNorm skips it, works essentially as well, and is cheaper.
- `L3.Common choice.here`, RMSNorm
- `L3.Common choice.gpt2`, LayerNorm
- `L3.Common choice.llama`, RMSNorm
- `L3.Learned parameters.gpt2`, 768 × 2
- `L3.Learned parameters.llama`, 4,096

### rope
- `L1.prose[1]`. **The learned position table you met at Embedding is one fix.** GPT-2 adds a per-seat vector at the start and lets it flow through.
- `L1.prose[2]`. **RoPE is the other, and it acts later.** Instead of adding at the input, it *rotates* the Q and K vectors by an angle proportional to position, inside attention.
- `L1.flow.learned`, Learned table: GPT-2 · added once at the input
- `L1.flow.rope`, RoPE: rotates Q and K inside every layer
- `L2[2]`. That is why context extension is possible at all with RoPE and awkward with a learned table.
- `L3.Method.gpt2`, learned table
- `L3.Method.llama`, RoPE
- `L3.Positions supported.gpt2`, 1,024, hard limit
- `L3.Positions supported.llama`, extendable by retuning frequencies

### unembedding
- `L2[1]`. It saves a large matrix, for Llama-3, hundreds of millions of parameters, and encodes a reasonable prior: a token's input direction and its output direction should be related.
- `L3.Logits produced.gpt2`, 50,257
- `L3.Logits produced.llama`, 128,256
- `L3.Matrix size.gpt2`, 768 × 50,257
- `L3.Matrix size.llama`, 4,096 × 128,256

### the-loop
- `L3.Passes per answer.llama`, one per token
- `L3.Cost shape.llama`, linear in output length

### tokenization
- `L3.Vocabulary size.gpt2`, 50,257
- `L3.Vocabulary size.llama`, 128,256
- `L3.What one piece is.gpt2`, word or word-piece
- `L3.What one piece is.llama`, word or word-piece
- `L3.What one piece is.note`. English averages roughly 0.75 words per token, so 1,000 tokens is about 750 words.
- `L3.How the vocabulary is chosen.gpt2`, learned from the corpus (BPE)
- `L3.How the vocabulary is chosen.llama`, learned from the corpus (BPE)

### token-id
- `L3.Highest possible ID.gpt2`, 50,256
- `L3.Highest possible ID.llama`, 128,255
- `L3.What holds the rows.gpt2`, 50,257 × 768
- `L3.What holds the rows.llama`, 128,256 × 4,096
- `L3.What holds the rows.note`, Here that is 144 numbers.
- `L3.What holds the rows.note`, In Llama-3 it is roughly 525 million.
- `L3.Special IDs.gpt2`, end-of-text
- `L3.Special IDs.llama`. begin/end-of-text, padding, chat-role markers

### embedding
- `L3.Embedding size.gpt2`, 768
- `L3.Embedding size.llama`, 4,096
- `L3.Embedding size.note`. Llama-3-8B's token table alone is 128,256 × 4,096 ≈ 525 million numbers.
- `L3.Context window (seats).gpt2`, 1,024
- `L3.Context window (seats).llama`, 128,000
- `L3.Context window (seats).note`. Frontier long-context models now reach ~1,000,000 tokens ≈ 750,000 words ≈ 7-8 novels.
- `L3.What one token is.gpt2`, a word or word-piece
- `L3.What one token is.llama`, a word or word-piece
- `L3.What one token is.note`, "cat" is 1 token; "unhappiness" is roughly 3.
- `L4`, which is exactly what minGPT and nanoGPT do.
- `L4`. GPT-2 uses this learned position table.
- `L4`. Llama drops `wpe` entirely and swaps in **RoPE**, which injects position by *rotating* the Q and K vectors inside attention instead of adding a vector here.

### attention
- `L3.Heads.gpt2`, 12
- `L3.Heads.llama`, 32
- `L3.Heads.note`, GPT-3 used 96.
- `L3.Width per head.gpt2`, 64
- `L3.Width per head.llama`, 128
- `L3.Size of the score grid.gpt2`, up to 1,024 × 1,024
- `L3.Size of the score grid.llama`, up to 128,000 × 128,000
- `L3.Size of the score grid.note`. This is the single reason long context is expensive, and why FlashAttention and paged KV caches exist.
- `L3.Variant used.gpt2`, multi-head (MHA)
- `L3.Variant used.llama`, grouped-query (GQA)
- `L3.Variant used.note`. GQA and MLA share Keys and Values across heads.

### build
- `L3.Share of total compute.llama`, pretraining ≫ 98%
- `L3.Training tokens.gpt2`, ~10 billion
- `L3.Training tokens.llama`, ~15 trillion

### gather-data
- `L3.Corpus size.gpt2`, ~40 GB text
- `L3.Corpus size.llama`, ~15 trillion tokens
- `L3.Kept after filtering.llama`, a small fraction of crawl

### train-tokenizer
- `L3.Vocabulary size.gpt2`, 50,257
- `L3.Vocabulary size.llama`, 128,256
- `L3.Cost to train.llama`, hours on CPU

### pretraining
- `L1.prose[3]`. **AdamW takes the step.** Not a raw step. it keeps running averages of each weight's gradient history so noisy directions move less than consistent ones.
- `L1.flow.back.opt`, AdamW state: per-weight momentum
- `L2[2]`. Training holds weights, plus a gradient for each, plus AdamW's two running averages for each, plus the activations of the whole forward pass so backprop can use them.
- `L3.Tokens seen.gpt2`, ~10 billion
- `L3.Tokens seen.llama`, ~15 trillion
- `L3.Wall clock.gpt2`, days
- `L3.Wall clock.llama`, weeks on thousands of GPUs
- `L3.Memory vs serving.llama`, ~4× the weights

### sft
- `L3.Examples.llama`, thousands to ~100k
- `L3.Wall clock.llama`, hours
- `L3.Cost vs pretraining.llama`, a rounding error

### alignment
- `L1.prose[2]`. **RLHF was the original recipe.** Train a reward model to predict human preference, then use reinforcement learning to maximise it.
- `L1.prose[3]`. **DPO removes the reward model.** It turns out you can optimise directly against the preference pairs.
- `L1.flow.opt.rlhf`, RLHF: reward model + RL
- `L1.flow.opt.dpo`, DPO / GRPO: direct, no reward model
- `L2[3]`, Not because RLHF fails, but because it is a lot of moving parts. a separate reward model to train, serve and keep from going stale, plus RL's own instability.
- `L2[3]`. DPO gets much of the benefit from the same data with a single training run.
- `L3.Preference pairs.llama`, tens to hundreds of thousands
- `L3.Who compares.llama`. humans, increasingly assisted by models
- `L4`. DPO's insight is that the reward model was an unnecessary intermediate.

### lora-dora
- `L1.prose[1]`, **The observation behind LoRA: the update is low-rank.** The change fine-tuning makes to a big weight matrix turns out to be expressible as the product of two much thinner matrices.
- `L1.prose[4]`. **DoRA refines it.** It separates the update into magnitude and direction, which tracks full fine-tuning more closely at similar cost.
- `L3.Trainable share.llama`, well under 1%
- `L3.Adapter file size.llama`, megabytes vs ~16 GB
- `L3.Typical rank.llama`, 8-64

### evaluation
- `L3.Suites run per candidate.llama`, dozens
- `L3.Human-reviewed set.llama`, small but essential

### deploy-prep
- `L3.Weights at each precision.llama`, 16 GB → 8 GB → ~4 GB
- `L3.Weights at each precision.note`. An 8B model at fp16, int8 and 4-bit.
- `L3.Typical quality cost.llama`, small at 8-bit, visible at 4-bit

### continual
- `L3.Base model cadence.llama`, months to a year
- `L3.Fine-tune cadence.llama`, weekly or faster

### operations
- `L1.flow.train.p-feast`, Feast: feature definitions
- `L1.flow.train.p-kube`, Kubeflow: runs the job
- `L1.flow.registry`, Model registry: MLflow, the seam between the two worlds
- `L1.flow.serve.p-aibrix`, AIBrix: routes and scales
- `L1.flow.serve.p-vllm`, vLLM: runs the forward pass
- `L2[1]`. The shape is not. it is standard MLOps, and Feast, Kubeflow and MLflow all predate LLMs.
- `L2[1]`. What is specific is the inference side: the model is far too big to fit conventional serving assumptions, and generation is sequential, which is why vLLM and AIBrix exist at all.
- `L3.Training cadence.gpt2`, one-off
- `L3.Training cadence.llama`, weeks per major version
- `L3.Serving latency budget.gpt2`, 
- `L3.Serving latency budget.llama`, ~50-300 ms to first token

### training-path
- `L1.prose[2]`. **Three tools, three jobs.** Feast decides what the inputs mean.
- `L1.prose[2]`. Kubeflow runs the job across many machines.
- `L1.prose[2]`. MLflow records what happened and hands the result over.
- `L1.flow.feast`, Feast: one definition of each input
- `L1.flow.kubeflow`, Kubeflow: schedules and runs the pipeline
- `L1.flow.mlflow`, MLflow: records the run, registers the winner
- `L3.Machines in one job.gpt2`, tens
- `L3.Machines in one job.llama`, thousands of GPUs
- `L3.Wall-clock per run.gpt2`, days
- `L3.Wall-clock per run.llama`, weeks

### feast
- `L3.Online lookup budget.llama`, single-digit milliseconds
- `L3.Typical backing stores.gpt2`, 
- `L3.Typical backing stores.llama`. Redis or DynamoDB online, warehouse offline

### kubeflow
- `L1.prose[2]`. Kubeflow places those workers and keeps them alive.
- `L1.flow.out`, Artifacts: weights + metrics, handed to MLflow
- `L2[2]`. What Kubeflow adds is GPU-aware scheduling, gang scheduling (all workers of a distributed job start together or not at all), and native handling of a step that is itself a multi-node job.
- `L3.GPUs in one job.gpt2`, tens
- `L3.GPUs in one job.llama`, thousands
- `L3.What limits throughput.llama`, interconnect bandwidth

### mlflow
- `L3.Runs per registered version.llama`, dozens to hundreds
- `L3.Artifact size.gpt2`, ~0.5 GB
- `L3.Artifact size.llama`, ~16 GB at fp16

### inference-path
- `L1.flow.control`, Control plane: AIBrix, routing, autoscaling, adapters
- `L1.flow.engine`, Engine: vLLM, the actual forward passes
- `L3.Time to first token.llama`, ~50-300 ms
- `L3.Tokens per second.llama`, tens per sequence

### gpu
- `L3.Weights at fp16.gpt2`, ~0.25 GB
- `L3.Weights at fp16.llama`, ~16 GB
- `L3.Typical serving GPU.llama`, 40-80 GB
- `L3.Typical serving GPU.note`, Which leaves roughly 60 GB for cache after an 8B model loads, the number that sets concurrency.

### kv-cache
- `L1.prose[4]`. **PagedAttention stores it in fixed-size pages.** One contiguous block per sequence forces you to reserve for the worst case and wastes most of it.
- `L3.Cache per token.llama`, ~128 KB
- `L3.Cache per token.note`, For Llama-3-8B: 2 (K and V) × 32 layers × 8 KV heads × 128 dims × 2 bytes = 131,072 bytes per token.
- `L3.A full 128k context.llama`, ~16 GB for ONE sequence
- `L3.Why grouped-query attention exists.gpt2`, every head has its own K/V
- `L3.Why grouped-query attention exists.llama`. 8 KV heads shared by 32 query heads

### vllm
- `L1.prose[2]`. **PagedAttention makes that possible.** You cannot swap sequences in and out cheaply if each needs one big contiguous reservation.
- `L3.Throughput vs naive serving.llama`, several times higher
- `L3.Page size.llama`, commonly 16 tokens

### aibrix
- `L0`, Wraps a fleet of vLLM replicas: routes each request to the right one, scales the fleet on the signals that actually matter, and manages adapters and cache across machines.
- `L1.prose[0]`. **One engine is not a service.** vLLM serves a model on a machine.
- `L1.prose[3]`. **Adapters make one base model serve many products.** LoRA adapters are small.
- `L1.flow.gw.lora`, Adapter-aware: send it where the LoRA is loaded
- `L1.flow.fleet`, vLLM replicas: one base model, many adapters
- `L1.flow.fleet.ad`, LoRA adapters: small, hot-swapped
- `L2[1]`. AIBrix orchestrates vLLM, not the reverse.
- `L2[1]`. vLLM runs the model on one machine; AIBrix decides how many machines there are and which one your request goes to.
- `L2[1]`, You can run vLLM alone; you would then be building the routing and scaling yourself.
- `L2[3]`, Because a LoRA adapter is a small patch alongside the base weights rather than a whole new model.
- `L2[4]`, For a single replica, yes, run vLLM directly.
- `L3.Replicas coordinated.llama`, tens to hundreds
- `L3.Adapters per base model.llama`, many, hot-swapped
- `L3.Adapters per base model.note`. A LoRA adapter is a small fraction of the base model's size, so the marginal cost of another variant is close to nothing.
- `L3.Scaling signal.llama`, queue depth + cache occupancy
- `L4`, - **Data plane**, vLLM.
- `L4`, - **Control plane**, AIBrix.

### agent-layer
- `L1.prose[2]`. **MCP is a standard plug for tools.** Rather than hand-writing an integration per service, an MCP server exposes its tools in a common shape and any compatible agent can use them.
- `L1.flow.agent.mcp`, MCP servers: a standard plug for tools
- `L2[5]`. Frameworks give you the loop and the plumbing. Bedrock AgentCore, Foundry Agent Service, LangGraph, but the tools, the permissions and the definition of "done" are application code.
- `L3.Model calls per goal.llama`, one per loop step
- `L3.What bounds a run.llama`. Step limit, token budget, wall clock
- `L3.Where permissions live.llama`, entirely in the loop

### monitoring
- `L3.Systems metrics.llama`, per-request, always on
- `L3.Quality evaluation.llama`, sampled, continuous

## judgement (278)


### llm
- `L3.Parameters.here`, <1,000
- `L3.Trained on.here`, nothing

### model
- `L3.Distinct architectures.here`, 1
- `L4`. The architecture has been close to stable since 2018.

### foundations
- `L3.Operations per token.here`, thousands
- `L4`. An 8B model is about 16 billion operations to produce one word-piece, which is why this needs a GPU and why memory bandwidth, not arithmetic, ends up being the limit.

### linalg
- `L3.Multiplies per token.here`, thousands

### vector
- `L0`, A colour is 3 numbers (R, G, B).
- `L0`. A token is 48 of them here, 4,096 in a real model.
- `L1.prose[0]`. **Order matters and position is meaningful.** Dimension 7 means the same kind of thing for every token. that consistency is what makes comparison possible.
- `L3.Width.here`, 48
- `L3.Bytes per vector at fp16.here`, 96
- `L4`. A vector here is a 1-D tensor of shape `[C]`.

### matrix
- `L1.prose[1]`. **This is where knowledge physically lives.** "A 70B model" means 70 billion numbers, nearly all of them inside matrices like these.
- `L1.prose[3]`. **Shape determines what can connect to what.** A [48, 24] matrix consumes 48 numbers and produces 24, and that constraint is what makes the architecture fit together.
- `L1.flow.in`, Vector in: 48 numbers
- `L1.flow.w`, Matrix [48 × 24]: each column is one detector
- `L1.flow.out`, Vector out: 24 numbers, a different space
- `L3.Largest matrix.here`, 3 × 48
- `L3.Matrices per block.here`, ~6

### matmul
- `L1.prose[1]`. **So the outputs are independent of each other.** Nothing in output 3 depends on output 4, which is precisely why this parallelises across thousands of GPU cores.
- `L1.prose[2]`. **Shapes must line up.** [48] times [48, 24] gives [24].
- `L1.prose[2]`. The shared 48 is what gets summed over and disappears.
- `L1.flow.x`, Input vector: 48 numbers
- `L1.flow.col`, One column: also 48 numbers
- `L3.Multiplies per token.here`, thousands
- `L3.What limits it.here`, 

### dot-product
- `L2[2]`. Over 128 dimensions the scores get large enough that softmax saturates into a near-hard maximum, and learning stalls.
- `L3.Terms per dot product.here`, 24
- `L3.Dot products per layer.here`, 72

### calculus
- `L3.Gradients per step.here`, <1,000
- `L3.Steps in a run.here`, 0

### derivative
- `L1.flow.w`, One weight: currently 0.42, say
- `L2[0]`, For 8 billion weights that is 8 billion passes per step.
- `L3.Derivatives per step.here`, <1,000

### backprop
- `L1.flow.l`, Loss: the starting gradient is 1
- `L3.Cost vs forward pass.here`, ~2×
- `L3.Activation memory.here`, trivial
- `L4`, Roughly 30% more compute for a large reduction in memory, almost always worth it at scale.

### gradient-descent
- `L3.Optimiser memory.here`, 
- `L3.Learning rate.here`, 

### probability
- `L0`, 70% rain, not "it will rain".
- `L1.prose[0]`. **Every pass produces a full distribution.** One number per vocabulary slot, all summing to 1.
- `L1.flow.s`, Softmax: to probabilities summing to 1
- `L3.Numbers per prediction.here`, 3

### logits
- `L1.prose[2]`. **Differences matter, absolute values do not.** Add 5 to every logit and the resulting probabilities are identical.
- `L1.flow.v`, Final vector: one token, 48 wide
- `L2[2]`. APIs commonly expose log-probabilities for a handful of candidate tokens rather than the full 128,256.
- `L3.Logits per token.here`, 3
- `L4`. It changes nothing mathematically and prevents overflow. A logit of 800 would otherwise produce infinity and poison the whole row.

### softmax
- `L0`. Converting raw marks into percentages that must add up to 100.
- `L1.prose[3]`. **Temperature is a divisor applied first.** Dividing logits by a number greater than 1 flattens the distribution; less than 1 sharpens it.
- `L1.flow.n`, ÷ total: now sums to 1
- `L2[0]`. A hard max outputs 1 for the winner and 0 for everything else and has no useful gradient.
- `L2[2]`. Above 1 flattens the distribution and makes unlikely tokens more reachable; below 1 sharpens it; at 0 it becomes always-pick-the-top, which is deterministic.
- `L3.Applied per token.here`, ~13

### sampling
- `L2[0]`. Dividing by a number approaching zero drives the largest logit's share toward 1 and everything else toward 0.
- `L2[2]`. It is also more prone to repetition loops, which is why factual pipelines often use temperature 0 plus a repetition penalty rather than temperature 0 alone.
- `L3.Typical temperature.here`, 
- `L3.Typical top-p.here`, 

### objects
- `L2[1]`. A vector is a 1-D tensor, a matrix 2-D.
- `L2[1]`. Model code uses 3-D and 4-D tensors constantly, which is why the general word is the common one.
- `L3.Weights.here`, <1,000
- `L3.Activations.here`, a few hundred

### parameter
- `L0`. A "70B model" has 70 billion of these, living inside matrices.
- `L1.prose[2]`. **The count is the headline figure.** 8B, 70B, 405B. it is the primary size measure, though not a direct measure of quality.
- `L1.prose[3]`. **Each one costs memory forever.** Two bytes at fp16, so 8 billion parameters is roughly 16 GB you must hold to serve at all.
- `L2[0]`, But a well-trained 8B model routinely beats a poorly-trained 70B one, and the count says nothing about post-training, which is where much of the perceived quality comes from.
- `L2[2]`. The same 8B model is 16 GB, 8 GB or 4 GB depending on quantization.
- `L3.Count.here`, 672
- `L3.Bytes each at fp16.here`, 2

### tensor
- `L0`. The numbers in motion. a token as a vector, a batch as a 3-D array.
- `L1.prose[0]`. **An array with any number of dimensions.** 1-D is a vector, 2-D a matrix, and model code uses 3-D and 4-D routinely.
- `L1.flow.c`, [batch, tokens, 48]: shape restored
- `L3.Common shape.here`, [1, 6, 48]
- `L3.Attention grid.here`, [2, 6, 6]

### neuron
- `L0`. The word survives from a 1950s analogy that stopped being accurate almost immediately.
- `L3.Feed-forward dimensions.here`, ~192

### architecture
- `L1.prose[3]`. **It has barely changed since 2018.** Scale and data moved; the diagram did not.
- `L3.Architecture code.here`, 
- `L3.Weights.here`, <1 KB

### transformer
- `L3.Blocks stacked.here`, 2
- `L3.Vector width.here`, 48
- `L3.Passes for one answer.here`, 

### layer
- `L1.flow.in`, Stream in: T × 48
- `L1.flow.out`, Stream out: same shape, T × 48
- `L3.Blocks.here`, 2
- `L3.Parameter split per block.here`, 

### query
- `L3.Query width.here`, 24
- `L3.Wq size per head.here`, 48 × 24

### key
- `L1.prose[2]`. **Once computed it never changes.** Causal masking means nothing later can affect an earlier token, so token 3's key is identical on every subsequent pass.
- `L2[1]`. Token 3 can only ever be influenced by tokens 0-3, and those are fixed once produced.
- `L3.Key heads.here`, 2
- `L3.Cached per token.here`, negligible

### value
- `L3.Value width.here`, 24
- `L3.Shared with keys?.here`, no

### attention-scores
- `L1.prose[2]`. **Then divide by √(head width).** Dot products over 24 dimensions come out large; over 128 they come out much larger.
- `L3.Grid size.here`, 6 × 6
- `L3.Scale divisor.here`, √24

### attention-weights
- `L1.prose[3]`. **And it disposes of the mask for free.** e raised to minus infinity is 0, so masked tokens get exactly zero weight with no special case anywhere in the code.
- `L3.Rows per layer per head.here`, 6
- `L3.Numerical guard.here`, subtract the row max

### weighted-sum
- `L2[0]`, Because it attends 100% to itself. there is nothing before it and the mask forbids looking ahead.
- `L2[0]`. A weighted average with a single weight of 1 is just that value.
- `L3.Per-head output width.here`, 24
- `L3.After concatenation.here`, 48

### mlp
- `L1.prose[1]`. **Expand, bend, contract.** Up to roughly 4× the width, apply a nonlinearity, come back down.
- `L1.flow.in`, Token vector: 48 wide
- `L1.flow.up`, Up-projection: 48 → ~192
- `L1.flow.down`, Down-projection: ~192 → 48
- `L3.Expansion factor.here`, ~4×
- `L3.Middle width.here`, ~192
- `L3.Share of block parameters.here`, 
- `L4`. That is three matrices instead of two, which is why models using it drop the expansion factor from 4 to about 3.5 to keep the parameter count comparable.

### up-projection
- `L1.flow.x`, x: 48
- `L1.flow.w`, W_up: 48 × 192 learned
- `L1.flow.h`, hidden: 192, one value per detector
- `L2[0]`. Models with gated activations use around 3.5× to keep the total similar.
- `L3.Output width.here`, ~192
- `L3.Parameters.here`, ~9k

### activation
- `L1.flow.x`, x: 48
- `L3.Matrices needed.here`, 3

### down-projection
- `L1.prose[0]`. **Back to 48, so the block's output matches its input.** That shape match is what lets blocks stack.
- `L1.flow.h`, gated hidden: ~192
- `L1.flow.w`, W_down: 192 × 48 learned
- `L1.flow.add`, + residual stream: back to 48
- `L2[0]`. Compressed rather than lost, 192 numbers become 48.
- `L3.Shape.here`, ~192 × 48

### residual
- `L1.flow.b1`, Block 1: reads the stream, adds to it
- `L1.flow.b2`, Block 2: sees everything written so far
- `L2[0]`, Because the derivative of x + f(x) with respect to x is 1 + f′(x).
- `L2[0]`. That 1 is a direct route for the gradient.
- `L3.Stream width.here`, 48
- `L3.Writes into it.here`, 4

### normalization
- `L3.Learned parameters.here`, 48

### rope
- `L2[0]`, So a query at position 10 and a key at position 7 give the same score as positions 100 and 97. The model learns distance rather than absolute place.
- `L3.Method.here`, learned table
- `L3.Positions supported.here`, 11
- `L4`, Each pair of dimensions is treated as a 2D point and rotated:

### unembedding
- `L1.flow.last`, Final vector: last position only, 48 wide
- `L1.flow.proj`, × wte transposed: 48 × vocabulary
- `L3.Logits produced.here`, 3
- `L3.Matrix size.here`, 48 × 3

### the-loop
- `L2[2]`. Token 50 depends on token 49, which did not exist a moment ago.
- `L3.Passes per answer.here`, 
- `L3.Cost shape.here`, 

### tokenization
- `L1.prose[0]`. A real model knows 50,000 to 200,000.
- `L1.prose[3]`. **Character codes already exist and are not the answer.** Your computer has had a number for `C` since Unicode, it is 67.
- `L2[0]`. Unicode numbers letters by historical accident, 67 for C, 66 for B.
- `L2[1]`, "cat" is 1 token; "unhappiness" is roughly 3.
- `L2[4]`, But different models tokenize differently, so the same sentence can be 18 tokens for one model and 23 for another.
- `L3.Vocabulary size.here`, 3
- `L3.What one piece is.here`, one letter
- `L3.How the vocabulary is chosen.here`, hand-picked
- `L4`. - start with one slot per byte (256 slots, so nothing is ever unrepresentable)

### token-id
- `L0`, Seat 42 tells you where to look; it tells you nothing about the person sitting there.
- `L1.prose[0]`. `A` is at position 0, `B` at 1, `C` at 2.
- `L1.prose[1]`. **Counting starts at zero.** The first slot is 0, not 1.
- `L1.prose[2]`. **The number is arbitrary.** If the vocabulary had been built in a different order, `C` might be 0.
- `L1.prose[3]`. **So arithmetic on IDs is meaningless.** `C` is 2 and `A` is 0, but `C` is not "twice" anything, and `B` is not "between" them in any real sense.
- `L2[0]`. "Index" just means "which one in a list, counting from 0".
- `L3.Highest possible ID.here`, 2
- `L3.What holds the rows.here`, 3 × 48 table
- `L3.Special IDs.here`, none

### embedding
- `L1.prose[0]`. **Input**, the letters as ID numbers: `C B A B B C → 2 1 0 1 1 2`.
- `L1.prose[1]`. **Token embed**. look up the *letter* → its meaning-vector (48 numbers).
- `L1.prose[2]`. **Position embed**. look up the *seat* → its position-vector (48 numbers).
- `L2[0]`, Like a colour = 3 numbers (R, G, B); a token's meaning = 48 numbers.
- `L2[2]`. 11 is the model's maximum capacity, its *context window*.
- `L2[2]`. This toy needs room to hold the 6 input letters *and* write the 6-letter sorted answer into the same row, so about 11 seats.
- `L2[3]`. "Index" just means "which one in a list, counting from 0".
- `L2[4]`, No, computers count from 0.
- `L2[4]`, In `C B A B B C`, A is the *3rd letter* but sits at *position 2*.
- `L2[4]`. Position 3 is the *4th letter*, which is a B.
- `L2[4]`, The rule: position = (human count) − 1.
- `L2[5]`. Storing them separately means learning 3 letters + 11 seats = 14 vectors, then *adding* to get any combination.
- `L2[6]`. *Input Embed* is the same letters after embedding, 48 numbers each.
- `L3.Embedding size.here`, 48
- `L3.Context window (seats).here`, 11
- `L3.What one token is.here`, one letter
- `L3.When the sizes are set.here`, before training
- `L4`. - token table `wte`, shape `[vocab, C]`, here `[3, 48]`
- `L4`. - position table `wpe`, shape `[context, C]`, here `[11, 48]`

### attention
- `L2[1]`. Softmax raises e to the power of each score, and e to the minus infinity is 0, so those tokens get exactly zero attention, with no special case needed in the code.
- `L2[2]`. If position 2 could see position 3, it would be handed the answer it is supposed to guess.
- `L2[3]`. Left alone, scores in a 24-wide head come out large, softmax becomes almost a hard maximum, and gradients vanish.
- `L2[5]`. Hover along a row above and the numbers add to 1.00.
- `L3.Heads.here`, 2
- `L3.Width per head.here`, 24
- `L3.Size of the score grid.here`, 6 × 6
- `L3.Variant used.here`, plain multi-head

### build
- `L1.prose[0]`. **One stage dominates everything.** Pretraining is 98%+ of the compute and is where the model learns language, facts and reasoning.
- `L1.flow.pre`, Pretraining: 98% of the compute · learns language itself
- `L2[2]`. Your data is the last 0.001% that makes a generally capable model useful for your job.
- `L3.Share of total compute.here`, 
- `L3.Training tokens.here`, 0

### gather-data
- `L3.Corpus size.here`, 0
- `L3.Kept after filtering.here`, 

### train-tokenizer
- `L1.prose[1]`. **Start from bytes so nothing is unrepresentable.** 256 slots for raw bytes means any input can be encoded, however strange.
- `L1.flow.bytes`, Start from bytes: 256 base slots
- `L3.Vocabulary size.here`, 3
- `L3.Cost to train.here`, 

### pretraining
- `L2[0]`, To predict token 57, the label is token 57, you just hide it.
- `L2[1]`, To finish "the answer to 17 × 24 is", memorising is impossible for every pair; something arithmetic-shaped is cheaper.
- `L3.Tokens seen.here`, 0
- `L3.Wall clock.here`, 
- `L3.Memory vs serving.here`, 
- `L4`. A model that is 99% sure and wrong is punished enormously more than one that was merely unsure, which is what teaches calibration alongside accuracy.

### sft
- `L3.Examples.here`, 
- `L3.Wall clock.here`, 
- `L3.Cost vs pretraining.here`, 
- `L4`. `-100` is the conventional ignore index.

### alignment
- `L3.Preference pairs.here`, 
- `L3.Who compares.here`, 

### lora-dora
- `L1.prose[0]`. **Full fine-tuning updates every weight.** For an 8B model that means optimiser state for 8 billion parameters and a full copy of the model per variant.
- `L1.prose[2]`. A rank-16 adapter on an 8B model is a fraction of a percent of the parameters.
- `L1.flow.note`, With r = 16 the pair is a tiny fraction of W.
- `L1.flow.w`, 4096 × 4096, untouched
- `L1.flow.ab.a`, A: 4096 × r
- `L1.flow.ab.b`, B: r × 4096
- `L2[0]`, 8 to 64 covers most uses.
- `L3.Trainable share.here`, 
- `L3.Adapter file size.here`, 
- `L3.Typical rank.here`, 

### evaluation
- `L3.Suites run per candidate.here`, 
- `L3.Human-reviewed set.here`, 

### deploy-prep
- `L1.prose[0]`. **Training precision is more than serving needs.** Weights are trained in 16 bits.
- `L1.prose[0]`. Serving them in 8 or 4 loses surprisingly little.
- `L1.flow.full`, Evaluated model: 16-bit weights
- `L1.flow.shrink.quant`, Quantize: 16 → 8 → 4 bits
- `L2[0]`. 8-bit is often indistinguishable on most tasks; 4-bit is visible but frequently worth it.
- `L2[2]`. Knowing the teacher put 60% on one word and 30% on another carries far more information than the single word, which is why a student can learn from fewer examples.
- `L3.Weights at each precision.here`, 
- `L3.Typical quality cost.here`, 

### continual
- `L3.Base model cadence.here`, 
- `L3.Fine-tune cadence.here`, 

### operations
- `L2[0]`. Serving wants tiny batches, cannot tolerate a pause, and is judged on the 99th-percentile latency.
- `L3.Training cadence.here`, never
- `L3.Serving latency budget.here`, instant
- `L4`. That indirection buys three things: rollback is a version change rather than a rebuild, two versions can serve side by side for a comparison, and the training side can publish version 4 without touching anything that is currently serving.

### training-path
- `L3.Machines in one job.here`, 0
- `L3.Wall-clock per run.here`, 

### feast
- `L1.prose[0]`. **The problem it solves is called training/serving skew.** Training computes "average order value over 30 days" one way, in a batch job.
- `L2[2]`. The feature "orders in the last 30 days" must be its March value, not today's.
- `L3.Online lookup budget.here`, 
- `L3.Typical backing stores.here`, 

### kubeflow
- `L3.GPUs in one job.here`, 0
- `L3.What limits throughput.here`, 
- `L4`. A distributed training step with 256 workers is useless with 255. they synchronise every step, so a partial placement just holds GPUs idle while waiting for the last one.

### mlflow
- `L3.Runs per registered version.here`, 
- `L3.Artifact size.here`, 
- `L4`. - **rollback**. repoint the `Production` stage at version 3; nothing redeploys
- `L4`. - **A/B**, two deployments, one on `/3` and one on `/4`, running side by side

### inference-path
- `L1.prose[0]`. A 500-token answer is 500 passes, each depending on the last, so you cannot simply parallelise your way out.
- `L3.Time to first token.here`, instant
- `L3.Tokens per second.here`, 

### gpu
- `L1.prose[0]`. An 8-billion-parameter model at 16-bit precision is about 16 GB before anything else exists.
- `L1.prose[3]`. **Quantization buys headroom.** Storing weights in 8 or 4 bits halves or quarters the fixed cost, freeing that memory for more concurrent conversations.
- `L1.flow.vram`, 80 GB
- `L1.flow.vram.w`, Weights: fixed · ~16 GB for 8B at fp16
- `L2[1]`. An 8B model is roughly 16 GB, 8 GB, or 4 GB.
- `L3.Weights at fp16.here`, ~1 KB
- `L3.Typical serving GPU.here`, none

### kv-cache
- `L1.prose[1]`. **Those never change once computed.** Token 5's Key is the same on pass 6 as it was on pass 5, because the causal mask means nothing later can affect it.
- `L1.flow.cache.pages`, 16 tokens each
- `L3.Cache per token.here`, negligible
- `L3.A full 128k context.here`, 
- `L3.Why grouped-query attention exists.here`, 

### vllm
- `L3.Throughput vs naive serving.here`, 
- `L3.Page size.here`, 

### aibrix
- `L3.Replicas coordinated.here`, 0
- `L3.Adapters per base model.here`, 
- `L3.Scaling signal.here`, 

### agent-layer
- `L3.Model calls per goal.here`, 
- `L3.What bounds a run.here`, 
- `L3.Where permissions live.here`, 

### monitoring
- `L3.Systems metrics.here`, 
- `L3.Quality evaluation.here`, 
