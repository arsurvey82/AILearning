# History spine audit

An audit of `src/content/origins.ts`, focused on gaps a learner will hit before the transformer story starts in 2017.

## Timeline of every 'fix' origin

Ordered oldest to newest. One row per dated origin found in `origins.ts`.

| Year | Concept id | Source label |
|------|------------|--------------|
| 1847 | gradient-descent | Cauchy, Methode generale pour la resolution des systemes d equations simultanees |
| 1958 | neuron | Rosenblatt, The Perceptron: A Probabilistic Model for Information Storage and Organization |
| 1986 | backprop | Rumelhart, Hinton and Williams, Learning representations by back-propagating errors |
| 1986 | embedding | Rumelhart, Hinton and Williams, Learning representations by back-propagating errors |
| 1989 | continual | McCloskey and Cohen, Catastrophic Interference in Connectionist Networks |
| 1990 | softmax | Bridle, Probabilistic Interpretation of Feedforward Classification Network Outputs |
| 2012 | gpu | Krizhevsky, Sutskever and Hinton, ImageNet Classification with Deep Convolutional Neural Networks |
| 2014 | attention | Bahdanau, Cho and Bengio, Neural Machine Translation by Jointly Learning to Align and Translate |
| 2015 | residual | He, Zhang, Ren and Sun, Deep Residual Learning for Image Recognition |
| 2015 | kubeflow | Verma et al, Large-scale cluster management at Google with Borg |
| 2016 | normalization | Ba, Kiros and Hinton, Layer Normalization |
| 2016 | train-tokenizer | Sennrich, Haddow and Birch, Neural Machine Translation of Rare Words with Subword Units |
| 2017 | transformer | Vaswani et al, Attention Is All You Need |
| 2017 | kv-cache | Vaswani et al, Attention Is All You Need |
| 2017 | unembedding | Press and Wolf, Using the Output Embedding to Improve Language Models |
| 2017 | mlp | Vaswani et al, Attention Is All You Need |
| 2017 | feast | Uber Engineering, Meet Michelangelo: Uber Machine Learning Platform |
| 2018 | pretraining | Radford et al, Improving Language Understanding by Generative Pre-Training |
| 2018 | mlflow | Zaharia et al, Accelerating the Machine Learning Lifecycle with MLflow |
| 2019 | sampling | Holtzman et al, The Curious Case of Neural Text Degeneration |
| 2020 | diffusion | Ho et al, Denoising Diffusion Probabilistic Models |
| 2020 | multimodal | Dosovitskiy et al, An Image is Worth 16x16 Words |
| 2020 | evaluation | Kaplan et al, Scaling Laws for Neural Language Models |
| 2020 | gather-data | Raffel et al, Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer |
| 2021 | rope | Su et al, RoFormer: Enhanced Transformer with Rotary Position Embedding |
| 2021 | lora-dora | Hu et al, LoRA: Low-Rank Adaptation of Large Language Models |
| 2022 | sft | Ouyang et al, Training language models to follow instructions with human feedback |
| 2022 | alignment | Ouyang et al, Training language models to follow instructions with human feedback |
| 2022 | agent-layer | Yao et al, ReAct: Synergizing Reasoning and Acting in Language Models |
| 2023 | vllm | Kwon et al, Efficient Memory Management for LLM Serving with PagedAttention |
| 2024 | aibrix | AIBrix, Cost-Effective and Scalable Control Plane for vLLM |

## Gaps before the transformer story

Each item is one of:

- (a) missing entirely from `origins.ts`
- (b) present but not sourced
- (c) present but disconnected from the story before or after it

### 1943 McCulloch and Pitts, A Logical Calculus of the Ideas Immanent in Nervous Activity

Category (a), missing entirely.

The current spine opens the neural side of the story at 1958 with Rosenblatt. That skips the earlier claim that a network of threshold gates can compute any propositional function, which is where the idea of a neuron as a mathematical object begins. A reader arriving at Rosenblatt has no model of what a neuron even is. Verifiable at [https://link.springer.com/article/10.1007/BF02478259](https://link.springer.com/article/10.1007/BF02478259).

### 1957 to 1958 Rosenblatt Perceptron

Category (c), present but disconnected from what comes after.

The `neuron` entry cites Rosenblatt at 1958. The immediate next dated entry is 1986 backprop. Twenty-eight years pass with no explanation for why nothing happened. A reader will assume steady progress; the truth is closer to a stall triggered by the 1969 book below. Without that pivot the 1986 revival has no dramatic weight and the reader cannot tell why "backprop" was celebrated.

### 1969 Minsky and Papert, Perceptrons

Category (a), missing entirely.

This is the book that proved a single-layer perceptron cannot compute XOR, and by association slowed funding for neural research through the 1970s. It is the reason the neuron entry and the backprop entry sit seventeen years apart. Adding it turns a silent gap into a story. Verifiable at [https://mitpress.mit.edu/9780262630221/perceptrons/](https://mitpress.mit.edu/9780262630221/perceptrons/).

### 1986 Rumelhart, Hinton and Williams, backpropagation

Category (c), present but disconnected from what comes before.

The entry is sourced correctly. The disconnect is the same one flagged above: without a named earlier failure to point back at, "the layer in the middle had no known way to assign blame" reads as a fact, not as a fix. Adding Minsky and Papert as the failure it repaired closes the loop.

### 1990s distributional semantics

Category (a), missing entirely.

The `embedding` entry jumps from a 1986 paper about dense representations straight to a 2014 story about attention. In between sits a body of work on the distributional hypothesis, where nearness is defined by the words a word tends to appear beside. This is the conceptual ground under every embedding table in the app. Starting points: Deerwester et al 1990 on latent semantic analysis at [https://asistdl.onlinelibrary.wiley.com/doi/10.1002/(SICI)1097-4571(199009)41:6%3C391::AID-ASI1%3E3.0.CO;2-9](https://asistdl.onlinelibrary.wiley.com/doi/10.1002/(SICI)1097-4571(199009)41:6%3C391::AID-ASI1%3E3.0.CO;2-9).

### 2003 Bengio et al, A Neural Probabilistic Language Model

Category (a), missing entirely.

This paper is the direct ancestor of every neural language model that followed. It shows that predicting the next word can be done by learning a dense vector per word and running the vectors through a small network. Without it there is nothing on the timeline between 1986 backprop and 2013 word2vec, and a reader who has heard the phrase "language model" outside this site will wonder where it entered. Verifiable at [https://www.jmlr.org/papers/v3/bengio03a.html](https://www.jmlr.org/papers/v3/bengio03a.html).

### 2013 Mikolov et al, word2vec

Category (a), missing entirely.

Word2vec is what made word vectors a universal ingredient. The `embedding` entry as written cites Rumelhart 1986 for the idea of dense representations. That is honest about the conceptual origin, and dishonest about the practical origin: nobody was carrying dense word vectors around as a building block until word2vec made them cheap to train and easy to reuse. A reader who has ever heard of embeddings anywhere else will notice the omission. Verifiable at [https://arxiv.org/abs/1301.3781](https://arxiv.org/abs/1301.3781).

### 2014 Bahdanau, Cho and Bengio, attention

Category (c), present but disconnected from what comes before.

The entry is sourced correctly. The disconnect is a silent premise: "translators crushed an entire sentence into one fixed-size summary" only lands if the reader already knows that "translators" here means the 2014 sequence-to-sequence model by Sutskever, Vinyals and Le. That paper is not on the timeline. Adding it, at [https://arxiv.org/abs/1409.3215](https://arxiv.org/abs/1409.3215), turns "translators" from a vague noun into a named prior system that attention actually replaced.

## Related gaps worth noting

Not on the requested candidate list, but visible while walking the timeline:

- 1997 LSTM (Hochreiter and Schmidhuber). The transformer entry says "reading a sentence one word at a time cannot be parallelised", which is an accurate description of an LSTM. The LSTM itself is nowhere on the timeline, so the sentence has no antecedent.
- 2015 seq2seq with attention as the context for machine translation more broadly. Related to the Bahdanau disconnect above.

## Summary

The spine has a strong pre-1990 opening, a strong post-2017 body, and a hollow middle. The 1986 to 2014 stretch, which is where neural language modeling and word embeddings actually happened, is represented by two entries that both point at the same 1986 paper. A reader who lands there will not understand how the field got from "layers can be trained" to "attention", and therefore will not understand why the transformer story is a language-model story rather than a general deep-learning story.
