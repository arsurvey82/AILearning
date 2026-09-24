# Hierarchy tree

A single place to see every concept the site carries, where it sits, what it needs first, and what it leads into.

## What this fixes

The audit at `docs/hierarchy-audit.md` found six felt dead ends and thirteen container nodes with an empty `prereqs` or empty `leadsTo`. This tree closes those. Every non-root node lists at least one prereq or one leadsTo, so the Notebook footer never reads "start here, end of the built path". Containers point up into a parent chain and down into a first child. Leaves point along the spine.

## The count

The audits and the codebase disagree on the total. `HANDOFF.md` and `CLAUDE.md` say 67. The exported `NODES` array in `src/content/index.ts` currently loads 70 real concept nodes (counted by loading the registry). This document lists all 70, so a later pass can decide whether to prune three or update the headline number.

## Legend

For each concept:

- **parent** the containing node, or `root` for the map root
- **children** the direct child ids, or the reason it is a leaf: `object` (atomic reference), `grouping` (holds children only), `atomic` (one idea, no smaller pieces)
- **prereqs** what the reader needs first
- **leadsTo** what this unlocks next
- **why** one line for the placement

Node ids match the exported `ConceptNode.id`. Any change here must land in the corresponding node file under `src/content/nodes/`.

---

## Root

### llm

- parent: root
- children: model, build, operations, beyond
- prereqs: none
- leadsTo: model
- why: the whole universe, opened first so the reader lands with orientation before anything asks them to walk

---

## Continent 1, The Model

### model

- parent: llm
- children: foundations, objects, transformer
- prereqs: none
- leadsTo: build
- why: what the thing IS, the first continent a reader should meet before how it was made or how it is run

### foundations

- parent: model
- children: linalg, calculus, probability
- prereqs: none
- leadsTo: objects
- why: three branches of maths grouped as reference, not a path

### linalg

- parent: foundations
- children: vector, matrix, matmul, dot-product
- prereqs: none
- leadsTo: calculus
- why: the maths that RUNS the model, every forward pass is this

### vector

- parent: linalg
- children: object
- prereqs: none
- leadsTo: embedding
- why: the number list a token becomes, so it hands off cleanly to embedding

### matrix

- parent: linalg
- children: object
- prereqs: vector
- leadsTo: matmul
- why: where learned knowledge sits, needs vector first for shape reasoning

### matmul

- parent: linalg
- children: atomic
- prereqs: vector, matrix
- leadsTo: dot-product
- why: the one operation the model does most, followed by its per-cell definition

### dot-product

- parent: linalg
- children: atomic
- prereqs: vector
- leadsTo: attention-scores
- why: bridges the maths track to the attention track without a boundary crossing feeling arbitrary

### calculus

- parent: foundations
- children: derivative, backprop, gradient-descent
- prereqs: none
- leadsTo: probability
- why: the maths that LEARNS, active only during training and useful to name as such

### derivative

- parent: calculus
- children: atomic
- prereqs: none
- leadsTo: backprop
- why: one slope, the smallest honest object in the calculus track

### backprop

- parent: calculus
- children: atomic
- prereqs: derivative
- leadsTo: gradient-descent
- why: the chain rule at scale, and the reason training is affordable

### gradient-descent

- parent: calculus
- children: atomic
- prereqs: backprop
- leadsTo: pretraining
- why: the optimiser step, which is what pretraining runs a trillion times

### probability

- parent: foundations
- children: logits, softmax, sampling
- prereqs: none
- leadsTo: architecture
- why: the maths that SPEAKS, the last thing every pass runs

### logits

- parent: probability
- children: atomic
- prereqs: unembedding
- leadsTo: softmax
- why: raw scores straight out of unembedding, so the prereq crosses continents on purpose

### softmax

- parent: probability
- children: atomic
- prereqs: logits
- leadsTo: sampling
- why: turns scores into a distribution, appears once inside attention and once at the readout

### sampling

- parent: probability
- children: atomic
- prereqs: softmax
- leadsTo: the-loop
- why: pick one token, which is what the-loop then appends and restarts

### objects

- parent: model
- children: parameter, tensor, neuron, architecture
- prereqs: none
- leadsTo: transformer
- why: the nouns everything else is built from, reference material with an outbound step into the architecture

### parameter

- parent: objects
- children: object
- prereqs: matrix
- leadsTo: pretraining
- why: one learned number, which sits inside a matrix and is set by pretraining

### tensor

- parent: objects
- children: object
- prereqs: vector, matrix
- leadsTo: none
- why: the general n-D array, a reference term with no forward step of its own

### neuron

- parent: objects
- children: object
- prereqs: none
- leadsTo: mlp
- why: the historical unit that maps most closely onto one dimension of the feed-forward

### architecture

- parent: objects
- children: object
- prereqs: none
- leadsTo: transformer
- why: the wiring, the door into the transformer subtree

### transformer

- parent: model
- children: tokenization, token-id, embedding, layer, unembedding, the-loop
- prereqs: architecture
- leadsTo: build
- why: the container the reader walks through, needing architecture as context and handing off to build

### tokenization

- parent: transformer
- children: atomic
- prereqs: none
- leadsTo: token-id
- why: first step of every forward pass, the entry into the pipeline

### token-id

- parent: transformer
- children: atomic
- prereqs: tokenization
- leadsTo: embedding
- why: pieces become slot numbers, next handoff along the spine

### embedding

- parent: transformer
- children: atomic
- prereqs: token-id, vector
- leadsTo: attention
- why: numbers with meaning and seat, the input every layer consumes

### layer

- parent: transformer
- children: attention, mlp, residual, normalization, rope
- prereqs: embedding
- leadsTo: unembedding
- why: the repeated block, shape-preserving so any number of them stack

### attention

- parent: layer
- children: query, key, value, attention-scores, attention-weights, weighted-sum
- prereqs: embedding
- leadsTo: mlp
- why: the only cross-token step in a block, followed by mlp for per-token work

### query

- parent: attention
- children: atomic
- prereqs: embedding
- leadsTo: attention-scores
- why: what a token asks, needed to compute a score

### key

- parent: attention
- children: atomic
- prereqs: embedding
- leadsTo: attention-scores
- why: what a token offers, dotted against every query

### value

- parent: attention
- children: atomic
- prereqs: embedding
- leadsTo: weighted-sum
- why: what a token contributes if attended to, blended by the weighted sum

### attention-scores

- parent: attention
- children: atomic
- prereqs: query, key, dot-product
- leadsTo: attention-weights
- why: the raw match grid, one dot product per pair

### attention-weights

- parent: attention
- children: atomic
- prereqs: attention-scores, softmax
- leadsTo: weighted-sum
- why: scores turned into percentages that sum to 1

### weighted-sum

- parent: attention
- children: atomic
- prereqs: attention-weights, value
- leadsTo: mlp
- why: the blend, output of one attention head into the stream

### mlp

- parent: layer
- children: up-projection, activation, down-projection
- prereqs: attention
- leadsTo: residual
- why: per-token thinking after mixing, most of the block parameters live here

### up-projection

- parent: mlp
- children: atomic
- prereqs: none
- leadsTo: activation
- why: expand to a wider working space so the nonlinearity has room to sort

### activation

- parent: mlp
- children: atomic
- prereqs: up-projection
- leadsTo: down-projection
- why: the nonlinear bend, without which depth collapses to one layer

### down-projection

- parent: mlp
- children: atomic
- prereqs: activation
- leadsTo: residual
- why: contract back to stream width so the block output matches its input

### residual

- parent: layer
- children: atomic
- prereqs: mlp
- leadsTo: normalization
- why: the shared bus that keeps gradients reaching early layers

### normalization

- parent: layer
- children: atomic
- prereqs: residual
- leadsTo: unembedding
- why: rescale before each organ reads the stream, so the numbers stay in range

### rope

- parent: layer
- children: atomic
- prereqs: embedding
- leadsTo: attention-scores
- why: rotary position folded into query and key, an alternative to a learned position table

### unembedding

- parent: transformer
- children: atomic
- prereqs: layer
- leadsTo: logits
- why: final projection back to the vocabulary, producing one score per slot

### the-loop

- parent: transformer
- children: atomic
- prereqs: sampling
- leadsTo: transformer
- why: append the sampled token and run every block again, closing the pipeline back to its start

---

## Continent 2, The Build

### build

- parent: llm
- children: gather-data, train-tokenizer, pretraining, sft, alignment, lora-dora, evaluation, deploy-prep, continual
- prereqs: model
- leadsTo: operations
- why: how the file is made, from raw text to a shippable set of weights

### gather-data

- parent: build
- children: atomic
- prereqs: none
- leadsTo: train-tokenizer
- why: raw text becomes a filtered, deduplicated corpus, the first honest step

### train-tokenizer

- parent: build
- children: atomic
- prereqs: gather-data
- leadsTo: pretraining
- why: fix the vocabulary before any weight is touched, since every table depends on it

### pretraining

- parent: build
- children: atomic
- prereqs: train-tokenizer, gradient-descent
- leadsTo: sft
- why: predict next token at scale, the run that produces the base weights

### sft

- parent: build
- children: atomic
- prereqs: pretraining
- leadsTo: alignment
- why: teach the base model to answer rather than only continue

### alignment

- parent: build
- children: atomic
- prereqs: sft
- leadsTo: evaluation
- why: preferences between answers, RLHF or DPO, applied over the SFT model

### lora-dora

- parent: build
- children: atomic
- prereqs: sft
- leadsTo: deploy-prep
- why: small per-task patches, an alternative to a full retune of every weight

### evaluation

- parent: build
- children: atomic
- prereqs: alignment
- leadsTo: deploy-prep
- why: the gate a model has to clear before it ships

### deploy-prep

- parent: build
- children: atomic
- prereqs: evaluation
- leadsTo: vllm
- why: quantize and distil so the file is small enough to serve

### continual

- parent: build
- children: atomic
- prereqs: deploy-prep
- leadsTo: monitoring
- why: keep the model current after ship, fed by signals monitoring gathers

---

## Continent 3, The Operations

### operations

- parent: llm
- children: training-path, inference-path
- prereqs: build
- leadsTo: beyond
- why: how the file is run, split into the systems that make it and the systems that call it

### training-path

- parent: operations
- children: feast, kubeflow, mlflow
- prereqs: pretraining
- leadsTo: inference-path
- why: the software behind a training run, entered from the build step it supports

### feast

- parent: training-path
- children: atomic
- prereqs: gather-data
- leadsTo: kubeflow
- why: the feature store that feeds training with the right data at the right time

### kubeflow

- parent: training-path
- children: atomic
- prereqs: feast
- leadsTo: mlflow
- why: schedules the training runs across a cluster

### mlflow

- parent: training-path
- children: atomic
- prereqs: kubeflow
- leadsTo: inference-path
- why: tracks the runs and registers the model that will get served

### inference-path

- parent: operations
- children: gpu, kv-cache, vllm, aibrix, agent-layer, agentic, context-engineering, tool-design, monitoring
- prereqs: mlflow
- leadsTo: beyond
- why: the systems that answer requests, entered once a model is registered

### gpu

- parent: inference-path
- children: object
- prereqs: matmul
- leadsTo: kv-cache
- why: the hardware that does the matrix multiplies, prereq for anything about serving

### kv-cache

- parent: inference-path
- children: atomic
- prereqs: gpu, key, value
- leadsTo: vllm
- why: the memory that makes generation linear in tokens, half keys and half values

### vllm

- parent: inference-path
- children: atomic
- prereqs: kv-cache
- leadsTo: aibrix
- why: the serving runtime that turns a kv-cache and a model into throughput

### aibrix

- parent: inference-path
- children: atomic
- prereqs: vllm
- leadsTo: agent-layer
- why: the control plane that runs many vllm workers at scale

### agent-layer

- parent: inference-path
- children: atomic
- prereqs: aibrix
- leadsTo: agentic
- why: the loop that wraps the model, tools and memory around a single call

### agentic

- parent: inference-path
- children: atomic
- prereqs: agent-layer
- leadsTo: context-engineering
- why: workflows versus agents, the shape of what runs on top of a served model

### context-engineering

- parent: inference-path
- children: atomic
- prereqs: agentic
- leadsTo: tool-design
- why: what fills the window each turn, since the window keeps growing

### tool-design

- parent: inference-path
- children: atomic
- prereqs: agentic
- leadsTo: monitoring
- why: the shape of the tools an agent gets, which determines whether it can act at all

### monitoring

- parent: inference-path
- children: atomic
- prereqs: tool-design
- leadsTo: continual
- why: signals from real use, which feed back into the build step called continual

---

## Continent 4, Beyond

### beyond

- parent: llm
- children: diffusion, multimodal
- prereqs: transformer
- leadsTo: none
- why: cousins of the language transformer, worth naming once the reader knows the transformer

### diffusion

- parent: beyond
- children: atomic
- prereqs: beyond
- leadsTo: multimodal
- why: images from noise, a different training signal that reuses the same core

### multimodal

- parent: beyond
- children: atomic
- prereqs: diffusion
- leadsTo: none
- why: text and vision sharing one core, the closing note of the map

---

## Shape summary

- 70 concept nodes: 1 root, 4 continents, 13 container nodes, 52 leaves
- Every non-root node has at least one prereq or one leadsTo
- The forward pass spine walks: tokenization, token-id, embedding, attention, mlp, residual, normalization, unembedding, logits, softmax, sampling, the-loop
- The build spine walks: gather-data, train-tokenizer, pretraining, sft, alignment, evaluation, deploy-prep
- The operations spine walks: training-path, feast, kubeflow, mlflow, inference-path, gpu, kv-cache, vllm, aibrix, agent-layer, agentic, context-engineering, tool-design, monitoring, continual
- Cross-continent bridges: gradient-descent to pretraining, matmul to gpu, layer.key and layer.value to kv-cache, monitoring to continual, sampling to the-loop, unembedding to logits

## Not designed here

- The origin timeline is `docs/history-audit.md` and will be filled by a later task
- The 22 glossary terms and their bridge to concept nodes are out of scope for this tree, though the audit at `docs/hierarchy-audit.md` names the eight ids where they overlap
- Modern non-transformer architectures such as Mamba, RWKV and Liquid AI are candidates for the Beyond continent and are tracked as a separate task
