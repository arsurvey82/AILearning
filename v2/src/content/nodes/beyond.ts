/**
 * Continent 4, BEYOND TEXT: what this does not cover, and how much transfers.
 *
 * A reader asked the question this exists to answer: "is everything an LLM in
 * 2026?" The app never said. Teaching only language models and never naming
 * the boundary leaves a beginner to assume there is no boundary, which is a
 * false impression created by silence rather than by any sentence.
 *
 * The honest answer turns out to be better than an apology. The transformer is
 * the shared engine; "LLM" is one training objective running on it. Image and
 * video models moved onto the same backbone, and the mainstream unified
 * multimodal design now hangs a diffusion or flow-matching head off a shared
 * transformer. So nearly everything on the other three continents transfers,
 * and what does not transfer is small enough to name exactly.
 *
 * That makes this section load-bearing rather than a disclaimer: it converts
 * "you only learned one thing" into "you learned the substrate".
 */

import { outline } from '../outline';
import type { ConceptNode, Source } from '../schema';

const DIT: Source = {
  label: 'Peebles and Xie, Scalable Diffusion Models with Transformers',
  url: 'https://arxiv.org/abs/2212.09748',
};
const DDPM: Source = {
  label: 'Ho et al, Denoising Diffusion Probabilistic Models',
  url: 'https://arxiv.org/abs/2006.11239',
};
const LDM: Source = {
  label: 'Rombach et al, High-Resolution Image Synthesis with Latent Diffusion Models',
  url: 'https://arxiv.org/abs/2112.10752',
};
const VIT: Source = {
  label: 'Dosovitskiy et al, An Image is Worth 16x16 Words',
  url: 'https://arxiv.org/abs/2010.11929',
};
const LLAVA: Source = {
  label: 'Liu et al, Visual Instruction Tuning (LLaVA)',
  url: 'https://arxiv.org/abs/2304.08485',
};
const UMM: Source = {
  label: 'Unified Multimodal Understanding and Generation Models, survey',
  url: 'https://arxiv.org/pdf/2505.02567',
};

export const beyondNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'beyond',
      title: 'Beyond Text',
      tag: 'what this does not cover',
      color: 'magenta',
      order: 4,
      track: 'beyond',
      parent: 'llm',
      L0_oneLiner:
        'Language models are not all of it. Images, video and audio are made differently, and most of what you have learned still applies to them.',
      L0_analogy:
        'Learning to drive one car. A van has different doors and a different load, and the engine, the steering and the road are the same.',
      prereqs: ['transformer'],
      leadsTo: ['diffusion'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The transformer is the engine, not the application.** Everything on the other three continents. attention, embeddings, the residual stream, normalisation, backprop, the GPU. belongs to the transformer rather than to text. Swap what you feed it and what you ask it to predict, and the same machine makes pictures.',
        '**"LLM" names an objective, not an architecture.** A language model is a transformer trained to predict the next token of text. Change that objective to "remove the noise from this image" and you have a diffusion model, running on largely the same blocks.',
        '**The split is smaller than it looks.** Two things genuinely differ: what the model is asked to predict, and how you get an answer out of it. A language model emits one token at a time and stops. A diffusion model starts from noise and refines the whole output over many passes.',
        '**This is converging, not diverging.** The current mainstream design for models that both understand and generate images attaches a diffusion or flow-matching head to a shared transformer backbone, rather than running two separate systems.',
      ],
      flow: {
        caption: 'One backbone, three jobs. Only the ends change.',
        steps: [
          {
            id: 'in',
            label: 'What goes in',
            kind: 'input',
            sub: 'text, or image patches, or audio frames',
            parts: [
              { id: 'tok', label: 'Text tokenizer', sub: 'words to ids', kind: 'input' },
              { id: 'vit', label: 'Vision encoder', sub: 'patches to vectors', kind: 'input' },
            ],
          },
          {
            id: 'core',
            label: 'Transformer backbone',
            kind: 'stage',
            sub: 'attention, MLP, residual stream. the part this app teaches',
          },
          {
            id: 'head',
            label: 'What it predicts',
            kind: 'stage',
            sub: 'this is the part that differs',
            parts: [
              { id: 'ar', label: 'Next token', sub: 'language models', kind: 'stage' },
              { id: 'diff', label: 'Remove the noise', sub: 'image and video', kind: 'stage' },
            ],
          },
          {
            id: 'out',
            label: 'How you get an answer',
            kind: 'output',
            sub: 'one token at a time, or many refining passes',
          },
        ],
        note: 'The middle box is the whole of the rest of this app. The boxes on either side are what a different modality changes.',
      },
    },
    L2_snags: [
      {
        q: 'So is everything an LLM now?',
        a: 'No. Image, video and audio generation are mostly diffusion, which is a different training objective and a different way of producing an answer. What IS nearly universal is the transformer underneath: it became the backbone for media generation too, replacing the older convolutional design.',
      },
      {
        q: 'Did I waste my time learning about text models?',
        a: 'The opposite. Attention, embeddings, the residual stream, normalisation, backprop, the KV cache and everything about GPUs are properties of the transformer, not of text. You learned the part that transfers. What you still need for images is the objective and the sampling loop, which is two ideas, not a second education.',
      },
      {
        q: 'Why did this app pick text then?',
        a: 'Because you can check it. You already know whether "the cat near the dogs sits" is correct English, so you can verify the model without trusting anyone. Nobody can look at a generated image and say whether the denoising step was right.',
      },
      {
        q: 'Is a "multimodal" model one model or several?',
        a: 'Usually one transformer with different front ends. Text arrives through a tokenizer, images through a vision encoder that cuts the picture into patches and turns each into a vector, and from there both are just sequences of vectors, which is the only thing the backbone ever handles.',
      },
    ],
    L3_atScale: [
      {
        label: 'Shared with this app',
        here: 'all of it',
        llama: 'attention, MLP, residual, norm, backprop, KV cache',
        note: 'Everything on the Model continent is a property of the transformer rather than of language.',
      },
      {
        label: 'Genuinely different',
        here: 'none',
        llama: 'the objective, and the sampling loop',
        note: 'Two ideas. That is the whole distance between this app and an image model.',
        source: UMM,
      },
    ],
    L4_underHood: `The backbone call is the same function in both cases:

\`\`\`
h = transformer(x)          # identical machinery
\`\`\`

What differs is what sits on each end.

\`\`\`
language    x = token_ids            loss = cross_entropy(h, next_token)
diffusion   x = noisy_patches + t    loss = mse(h, the_noise_that_was_added)
\`\`\`

One predicts the next symbol. The other predicts the noise so it can be
subtracted. Both are "guess the thing you were not shown", and both are trained
by exactly the backprop and gradient descent described on the Foundations
branch.`,
  },

  {
    ...outline({
      id: 'diffusion',
      title: 'Diffusion',
      tag: 'how pictures are made',
      color: 'violet',
      order: 1,
      track: 'beyond',
      parent: 'beyond',
      L0_oneLiner:
        'Start from pure noise and remove a little of it at a time, many times, until a picture is left.',
      L0_analogy:
        'A photograph developing. Not drawn stroke by stroke; the whole frame gets less murky at once, over and over.',
      prereqs: ['beyond'],
      leadsTo: ['multimodal'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Training is deliberately destructive.** Take a real picture, add a measured amount of random noise, and ask the model one question: what noise did I just add? It never has to draw anything. It only has to recognise the mess.',
        '**Generation runs that backwards.** Start from nothing but noise, ask the model what noise it sees, subtract a fraction of it, and ask again. After enough passes a picture is what remains.',
        '**This is why images are slow.** A language model does one pass per token. A diffusion model does many passes for the whole image, historically dozens, and each pass is a full trip through the network.',
        '**The backbone became a transformer.** The original design used a convolutional U-Net. Replacing it with a transformer over image patches scaled better, and became the backbone for the state of the art in media generation.',
      ],
      flow: {
        caption: 'The same model, run in both directions.',
        steps: [
          { id: 'real', label: 'A real image', kind: 'input', sub: 'training only' },
          {
            id: 'add',
            label: 'Add known noise',
            kind: 'stage',
            sub: 'you know the answer, because you made the mess',
          },
          {
            id: 'pred',
            label: 'Predict the noise',
            kind: 'stage',
            sub: 'a transformer over image patches',
          },
          {
            id: 'loop',
            label: 'Subtract a little, repeat',
            kind: 'control',
            sub: 'generation only, many passes',
          },
          { id: 'img', label: 'An image', kind: 'output', sub: 'what is left when the noise is gone' },
        ],
        loop: 'Generation is this loop run from pure noise, with no real image anywhere in it.',
        note: 'Training and generation are the same network. One adds noise and checks; the other only subtracts.',
      },
    },
    L2_snags: [
      {
        q: 'Where does the picture come from if it starts as noise?',
        a: 'From the weights. The model has seen enough images to know what noise looks like on top of a plausible picture, so subtracting what it thinks is noise pushes whatever is left toward being a plausible picture. Nothing is retrieved; the same noise with a different prompt gives a different result.',
      },
      {
        q: 'Why does it need so many steps?',
        a: 'Removing all the noise in one jump asks the model to produce a finished image from static, which it cannot do well. Small steps let each pass make a modest correction that the next pass can build on. It is gradient descent in spirit: many small moves beat one large guess.',
      },
      {
        q: 'Is the prompt doing the same job as a prompt to a chatbot?',
        a: 'It is conditioning rather than a question. The text is encoded and fed alongside the image patches, so the noise prediction is nudged toward pictures that match the words. The model is still only ever predicting noise.',
      },
    ],
    L3_atScale: [
      {
        label: 'Passes per output',
        here: 'none',
        llama: 'one per token for text, many per image for diffusion',
        note: 'This is the main reason an image takes seconds while a sentence takes milliseconds per word.',
        source: DDPM,
      },
      {
        label: 'Backbone',
        here: 'none',
        llama: 'transformer over patches, replacing the earlier U-Net',
        note: 'The switch to a transformer backbone scaled better and is now standard for state-of-the-art media generation.',
        source: DIT,
      },
      {
        label: 'Where the work happens',
        here: 'none',
        llama: 'a compressed latent space, not raw pixels',
        note: 'Denoising a small latent instead of full-resolution pixels is what made high-resolution generation affordable.',
        source: LDM,
      },
    ],
    L4_underHood: `Training, in full:

\`\`\`
t      = random_timestep()
noise  = randn_like(image)
noisy  = sqrt(a[t]) * image + sqrt(1 - a[t]) * noise
loss   = mse(model(noisy, t, prompt), noise)
\`\`\`

The model is a regression: given a noisy picture and how noisy it is, output
the noise. Generation inverts it, one step at a time, from \`noisy = randn()\`.

Note what is absent. No vocabulary, no softmax over tokens, no sampling
temperature. The output is not a probability distribution over choices; it is a
direct prediction of a quantity. That is the real difference from everything
else in this app.`,
  },

  {
    ...outline({
      id: 'multimodal',
      title: 'Multimodal',
      tag: 'one backbone, many front ends',
      color: 'aqua',
      order: 2,
      track: 'beyond',
      parent: 'beyond',
      L0_oneLiner:
        'A model that takes pictures as well as text does not have a second brain. It has a second door into the same one.',
      L0_analogy:
        'Two languages, one translator. Both get turned into the same internal notes before any thinking happens.',
      prereqs: ['diffusion'],
      leadsTo: [],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The backbone only ever sees vectors.** It has no idea whether a vector came from a word or a corner of a photograph. That indifference is what makes multimodality cheap: you do not change the model, you change what you hand it.',
        '**An image becomes a sequence.** Cut the picture into fixed squares, flatten each into a vector, add a position marker, and you have exactly the shape a transformer already eats. That is the whole trick, and it is the same trick as the token table in Embedding.',
        '**Understanding and generating are converging.** The current mainstream design puts a diffusion or flow-matching head on a shared transformer backbone, so one model can both read an image and make one, rather than two systems bolted together.',
        '**The hard part is alignment, not architecture.** Getting the image vectors into the same space the text vectors live in, so that "a picture of a dog" and an actual picture of a dog land near each other, is the work.',
      ],
      flow: {
        caption: 'Two doors, one room.',
        steps: [
          {
            id: 'src',
            label: 'Two kinds of input',
            kind: 'input',
            sub: 'they must end up the same shape',
            parts: [
              { id: 't', label: 'Text', sub: 'tokenizer, then the token table', kind: 'input' },
              { id: 'i', label: 'Image', sub: 'cut into patches, each one encoded', kind: 'input' },
            ],
          },
          {
            id: 'proj',
            label: 'Put them in one space',
            kind: 'stage',
            sub: 'a small learned projection, so a patch vector sits beside a word vector',
          },
          {
            id: 'core',
            label: 'The same transformer',
            kind: 'stage',
            sub: 'unchanged. it never learns which door a vector came through',
          },
          { id: 'out', label: 'Text out, or an image head', kind: 'output', sub: 'or both' },
        ],
        note: 'Nothing in the middle box knows about pictures. That is the point.',
      },
    },
    L2_snags: [
      {
        q: 'Does it actually see the image, or read a description of it?',
        a: 'It sees it, in the only sense the model has. The picture is cut into patches and each becomes a vector, in the same way a word becomes a vector. There is no intermediate English caption. The model attends over image patches and text tokens in one sequence.',
      },
      {
        q: 'Why can it describe a picture but get the number of fingers wrong?',
        a: 'Patches are coarse and the training signal rewards plausible descriptions rather than careful counting. The model is very good at what a region resembles and comparatively weak at how many of a thing there are, because nothing in the objective made counting matter.',
      },
      {
        q: 'Is the image encoder trained with the language model?',
        a: 'Often the vision encoder is trained separately first and then connected, with only the small projection between them trained at the start. It is cheaper, and it means one good vision encoder can serve many language models.',
      },
    ],
    L3_atScale: [
      {
        label: 'How an image is chopped',
        here: 'none',
        llama: 'fixed square patches, each one flattened into a vector',
        note: 'The same move as splitting text into tokens, applied to pixels.',
        source: VIT,
      },
      {
        label: 'What connects the two',
        here: 'none',
        llama: 'a small learned projection, trained first while the rest stays frozen',
        note: 'The cheap step that makes a vision encoder and a language model into one system.',
        source: LLAVA,
      },
      {
        label: 'Understanding plus generation',
        here: 'none',
        llama: 'a diffusion or flow-matching head on the shared backbone',
        note: 'This has overtaken the purely next-token approach as the mainstream design for models that do both.',
        source: UMM,
      },
    ],
    L4_underHood: `The join is smaller than people expect:

\`\`\`
text_vecs  = token_table[ids]                  # as in Embedding
patches    = cut(image, 14, 14)                # squares of pixels
img_vecs   = projection(vision_encoder(patches))
h          = transformer(concat(img_vecs, text_vecs))
\`\`\`

\`projection\` is usually one or two matrix multiplies. Everything expensive on
either side of it was trained before they met. The transformer call is the same
line as every other page in this app.`,
  },
];
