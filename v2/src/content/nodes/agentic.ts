/**
 * Agentic systems: workflows, agents, and how to tell them apart.
 *
 * Grounded in Anthropic's published guidance rather than invented. The two
 * definitions, the five workflow patterns and the "when to use" advice are all
 * theirs, and the piece is explicit that the patterns are not a prescription:
 *
 *   "These building blocks aren't prescriptive. They're common patterns that
 *    developers can shape and combine to fit different use cases."
 *
 * That flag is quoted rather than asserted, which is stronger than adding it as
 * an opinion of ours. Add complexity "only when it demonstrably improves
 * outcomes" is the other line worth keeping, and it is the reason the parent
 * node leads with the question of whether you need an agent at all.
 *
 * Source: anthropic.com/engineering/building-effective-agents
 */

import { outline } from '../outline';
import type { ConceptNode } from '../schema';

const SRC = {
  patterns: {
    label: 'Anthropic, Building Effective Agents',
    url: 'https://www.anthropic.com/engineering/building-effective-agents',
  },
  context: {
    label: 'Anthropic, Effective Context Engineering for AI Agents',
    url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
  },
  tools: {
    label: 'Anthropic, Writing Tools for Agents',
    url: 'https://www.anthropic.com/engineering/writing-tools-for-agents',
  },
};

export const agenticNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'agentic',
      title: 'Agentic systems',
      tag: 'above the model',
      color: 'violet',
      order: 5,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Everything built around a model to make it do work rather than only answer. The first question is not which pattern to use, it is whether you need one at all.',
      L0_analogy:
        'The difference between a recipe and a cook. A recipe runs the same steps every time. A cook decides what to do next based on how it is going.',
      prereqs: ['agent-layer'],
      related: ['vllm', 'aibrix'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One split, and it is about who decides the path.** A *workflow* runs the model through steps you wrote in code. An *agent* lets the model choose its own steps and its own tools. Anthropic puts it plainly: workflows are "systems where LLMs and tools are orchestrated through predefined code paths", agents are "systems where LLMs dynamically direct their own processes and tool usage".',
        '**Both are built on the same block.** An augmented model: one with retrieval, tools and memory attached, "generating their own search queries, selecting appropriate tools, and determining what information to retain".',
        '**Start with the simplest thing that works.** The published advice is to add complexity "only when it demonstrably improves outcomes". A workflow is cheaper, faster and easier to debug, and most tasks that sound agentic are workflows.',
        '**There is no correct pattern.** The source says so directly: these "aren\'t prescriptive. They\'re common patterns that developers can shape and combine". Anyone presenting a fixed architecture for agents is adding certainty that does not exist.',
      ],
      flow: {
        caption: 'Who decides what happens next. That is the whole distinction.',
        steps: [
          { id: 'task', label: 'A task arrives', kind: 'input' },
          {
            id: 'q',
            label: 'Can you write the steps down in advance?',
            kind: 'control',
            sub: 'not "is it complicated", but "is the path predictable"',
          },
          {
            id: 'wf',
            label: 'Yes: a workflow',
            kind: 'stage',
            sub: 'you own the control flow, the model fills in the steps',
            parts: [
              { id: 'p1', label: 'Prompt chaining', sub: 'fixed sequence of steps', kind: 'stage' },
              { id: 'p2', label: 'Routing', sub: 'classify, then send to a specialist', kind: 'control' },
              { id: 'p3', label: 'Parallelisation', sub: 'split up, or vote', kind: 'stage' },
              { id: 'p4', label: 'Orchestrator and workers', sub: 'a model decides the subtasks', kind: 'control' },
              { id: 'p5', label: 'Evaluator and optimiser', sub: 'generate, critique, repeat', kind: 'stage' },
            ],
          },
          {
            id: 'ag',
            label: 'No: an agent',
            kind: 'control',
            sub: 'the model decides the steps, using tools, in a loop',
            parts: [
              { id: 'a1', label: 'Costs more', sub: 'more calls, more latency', kind: 'store' },
              { id: 'a2', label: 'Errors compound', sub: 'a wrong step feeds the next one', kind: 'store' },
              { id: 'a3', label: 'Needs stopping conditions', sub: 'and usually a human checkpoint', kind: 'control' },
            ],
          },
          { id: 'out', label: 'Work done', kind: 'output' },
        ],
        note: 'The five workflow patterns are common shapes, not a menu you must pick from. They combine, and most real systems are a mixture.',
      },
    },
    origin: {
      kind: 'fix',
      year: 2022,
      problem:
        'A single model call answers a question and stops. Anything needing several steps, outside information, or a check on its own output had a person stitching the calls together by hand.',
      gained:
        'Named shapes for stitching those calls together, and a way to talk about when the model should choose the path instead of you.',
      source: SRC.patterns,
    },
    L2_snags: [
      {
        q: 'Is an agent just a chatbot with plugins?',
        a: 'The loop is the difference. A chatbot answers and waits. An agent calls a tool, looks at what came back, decides what to do next, and keeps going until it is done or you stop it. Remove the loop and it is a chatbot again.',
      },
      {
        q: 'Which of the five patterns should I use?',
        a: 'Possibly none. The source is explicit that they are "common patterns" rather than a prescription, and that you should add complexity only when it demonstrably improves outcomes. Start with one model call. Add a second step when one is not enough.',
      },
      {
        q: 'Why would I ever choose a workflow if agents are more capable?',
        a: 'Because you can test a workflow. The steps are fixed, so you know what it will do, what it costs and where it broke. An agent trades that away for the ability to handle tasks you could not plan. Pay that price when you have to, not by default.',
      },
      {
        q: 'Do I need a framework for this?',
        a: 'The guidance is to be careful: frameworks "help you get started quickly", but they add abstraction that hides the prompts and responses, and the advice is to "reduce abstraction layers and build with basic components as you move to production".',
      },
    ],
    L3_atScale: [
      {
        label: 'Where the cost goes',
        here: 'one call',
        llama: 'tens to hundreds of calls per task',
        note: 'Agentic systems trade latency and money for the ability to handle open-ended work.',
        source: SRC.patterns,
      },
      {
        label: 'Failure mode',
        here: 'a wrong answer',
        llama: 'compounding errors',
        note: 'Each step builds on the last, so an early mistake is amplified rather than corrected.',
        source: SRC.patterns,
      },
    ],
    L4_underHood: `The five workflow patterns, with the situation each is for.

**Prompt chaining.** Each call processes the output of the last, with optional checks between steps. For tasks that "can be easily and cleanly decomposed into fixed subtasks".

**Routing.** Classify the input, then send it to a specialised follow-up. For "distinct categories that are better handled separately".

**Parallelisation.** Two shapes: *sectioning* splits a task into independent parts run at once, *voting* runs the same task several times for confidence. For speed, or "when multiple perspectives or attempts are needed".

**Orchestrator and workers.** A central model breaks the task down, delegates, and combines the results. For "complex tasks where you can't predict the subtasks needed".

**Evaluator and optimiser.** One call generates, another critiques, in a loop. For when there are "clear evaluation criteria" and "iterative refinement provides measurable value".

Agents proper are "LLMs using tools based on environmental feedback in a loop", for "open-ended problems where it's difficult or impossible to predict the required number of steps".`,
    checkpoint: {
      question:
        'You need to translate support tickets, then classify them, then draft a reply. The steps never change. What is this?',
      options: [
        {
          text: 'A workflow, because you can write the steps down in advance',
          correct: true,
          feedback:
            'Right. The path is fixed, so you own the control flow and the model just fills in each step. It is cheaper, faster and testable.',
        },
        {
          text: 'An agent, because it uses a model several times',
          feedback:
            'Using a model repeatedly does not make something an agent. What makes it an agent is the model choosing the steps. Here you already know them.',
        },
        {
          text: 'An agent, because it is a multi-step task',
          feedback:
            'Multi-step is not the test. The test is whether the path is predictable. Three known steps in a known order is a workflow.',
        },
      ],
    },
  },

  {
    ...outline({
      id: 'context-engineering',
      title: 'Context engineering',
      tag: 'above the model',
      color: 'violet',
      order: 6,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Deciding what to put in front of the model on each turn, and what to leave out. Attention is finite, so every token you add costs you somewhere else.',
      L0_analogy:
        'A desk, not a filing cabinet. What matters is what is on the desk right now, and a desk covered in paper is worse than a clear one.',
      prereqs: ['agentic'],
      related: ['attention', 'kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Different from prompt engineering.** Writing a good instruction is a one-off task. Context engineering is ongoing: an agent in a loop "generates more and more data that could be relevant for the next turn of inference, and this information must be cyclically refined".',
        '**There is an attention budget, and it is spent.** Models have "an *attention budget* that they draw on when parsing large volumes of context. Every new token introduced depletes this budget by some amount." This is not a metaphor: the transformer compares every token to every other, giving n squared relationships for n tokens.',
        '**Which is why a bigger window is not a free lunch.** Performance degrades as the window fills, gradually rather than at a cliff. Filling a large window because you can is a way to make a model worse.',
        '**Four ways to spend the budget better.** Fetch on demand, summarise and restart, take notes outside the window, and hand focused work to a fresh sub-agent.',
      ],
      flow: {
        caption: 'Four techniques for keeping the desk usable.',
        steps: [
          { id: 'grow', label: 'The context keeps growing', kind: 'input', sub: 'every turn adds to it' },
          {
            id: 'jit',
            label: 'Fetch just in time',
            kind: 'stage',
            sub: 'hold identifiers like file paths, load the content only when it is needed',
          },
          {
            id: 'compact',
            label: 'Compact',
            kind: 'stage',
            sub: 'summarise a nearly full conversation and start again from the summary',
          },
          {
            id: 'notes',
            label: 'Take notes outside',
            kind: 'store',
            sub: 'write to memory, pull it back later when relevant',
          },
          {
            id: 'sub',
            label: 'Send work to a sub-agent',
            kind: 'control',
            sub: 'a clean window for a focused task, returning only the result',
          },
          { id: 'ok', label: 'The window stays usable', kind: 'output' },
        ],
        note: 'All four are the same move: keep the model looking at less, so it looks at it better.',
      },
    },
    origin: {
      kind: 'fix',
      year: 2025,
      problem:
        'Context windows grew large enough to fill, and filling them made models worse. Performance degrades as the window fills, because every token competes for the same finite attention.',
      gained:
        'Naming the budget, and a set of techniques for spending it: retrieve late, compact, take notes, delegate.',
      source: SRC.context,
    },
    L2_snags: [
      {
        q: 'If the window is a million tokens, why not just use it?',
        a: 'Because attention is spread across everything in it. The published framing is an "attention budget" that every token depletes. A million tokens of mostly irrelevant material is worse than ten thousand of relevant material, and it costs more.',
      },
      {
        q: 'Is this just retrieval-augmented generation?',
        a: 'Retrieval is one of the four techniques. Context engineering also covers what to throw away, what to summarise, what to write down outside the model, and when to hand work to a separate agent with a clean window.',
      },
      {
        q: 'Why does performance degrade gradually rather than at the limit?',
        a: 'The limit is a hard edge: past it there is no position to put a token in. The degradation before it is different, and comes from attention being divided. Both are real and they are not the same problem.',
      },
    ],
    L3_atScale: [
      {
        label: 'Why it degrades',
        here: '6 tokens',
        llama: 'n squared pairwise comparisons',
        note: 'Every token attends to every other, so cost and dilution both grow with the square of the length.',
        source: SRC.context,
      },
    ],
    L4_underHood: `The four named techniques.

**Just-in-time retrieval.** Keep "lightweight identifiers (file paths, stored queries, web links)" and load the content at the moment it is needed, rather than pre-loading everything that might matter.

**Compaction.** Take "a conversation nearing the context window limit, summarizing its contents, and reinitiating a new context window with the summary".

**Structured note-taking.** The agent "regularly writes notes persisted to memory outside of the context window", pulled back in later.

**Sub-agent architectures.** "Specialized sub-agents can handle focused tasks with clean context windows. The main agent coordinates with a high-level plan while subagents perform deep technical work."`,
  },

  {
    ...outline({
      id: 'tool-design',
      title: 'Designing tools',
      tag: 'above the model',
      color: 'violet',
      order: 7,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Tools are the contract between a deterministic system and a model that is not deterministic. Writing them well is a different job from writing an API.',
      L0_analogy:
        'Instructions for a capable new colleague who cannot ask you a follow-up question. Everything they need has to be in the note.',
      prereqs: ['agentic'],
      related: ['agent-layer'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Fewer, bigger tools beat many small ones.** "More tools don\'t always lead to better outcomes." A single `schedule_event` is better than separate calls to list users, list events and create an event, because it matches what someone actually wants to do.',
        '**Every response costs context.** A tool returning a huge blob spends the model\'s attention budget on your behalf. Paginate, filter and truncate by default. Claude Code caps tool responses at 25,000 tokens, which pushes towards "many small and targeted searches instead of a single, broad search".',
        '**Group names so boundaries are obvious.** Prefixes like `asana_search` and `jira_search` "help delineate boundaries between lots of tools" when there are many.',
        '**Errors should say what to do next.** Give "specific and actionable improvements, rather than opaque error codes or tracebacks". A model reading a stack trace has no idea what you wanted it to do differently.',
      ],
      flow: {
        caption: 'A tool is a contract, and these are its terms.',
        steps: [
          { id: 'need', label: 'A real task someone has', kind: 'input', sub: 'not an endpoint you happen to own' },
          {
            id: 'shape',
            label: 'One tool that does it',
            kind: 'stage',
            sub: 'consolidated, rather than three the model must chain',
          },
          {
            id: 'name',
            label: 'Named so the boundary is clear',
            kind: 'control',
            sub: 'grouped by service or by resource',
          },
          {
            id: 'resp',
            label: 'A response sized for a context window',
            kind: 'store',
            sub: 'paginated, filtered, truncated by default',
          },
          {
            id: 'err',
            label: 'Errors that suggest the fix',
            kind: 'output',
            sub: 'not a code, and not a traceback',
          },
        ],
        note: 'Tools are "a new kind of software which reflects a contract between deterministic systems and non-deterministic agents".',
      },
    },
    origin: {
      kind: 'fix',
      year: 2024,
      problem:
        'Tools were exposed to models the way APIs are exposed to programmers: many small endpoints, verbose responses, error codes. Models chained them badly, filled their own context with noise, and could not act on failures.',
      gained:
        'Treating the tool surface as an interface designed for a model rather than for a developer, with consolidation, token-aware responses and errors written to be acted on.',
      source: SRC.tools,
    },
    L2_snags: [
      {
        q: 'Why not just expose our whole API and let the model figure it out?',
        a: 'Because every tool description sits in the context window, competing for attention with the actual task, and a model chaining five calls has five chances to get it wrong. Consolidating around what people actually want to do costs you a wrapper and buys reliability.',
      },
      {
        q: 'Is this the same as writing good API docs?',
        a: 'Related, but the reader is different. A developer can read the source, ask a colleague or try again tomorrow. A model has one shot with whatever is in front of it, so anything implicit is simply missing.',
      },
    ],
    L3_atScale: [
      {
        label: 'Response cap',
        here: 'n/a',
        llama: '25,000 tokens by default in Claude Code',
        note: 'A limit that pushes towards many small targeted searches rather than one broad one.',
        source: SRC.tools,
      },
    ],
    L4_underHood: `A tool definition is a name, a description and a parameter schema. The model never runs anything: it emits a structured request, and the loop around it executes that request and feeds the result back.

Which means the description is the interface. It is the only thing the model has to decide with, so it has to say what the tool is for and when to reach for it, not merely what its arguments are called.

Four things the published guidance keeps returning to:

- **Consolidate.** Build \`schedule_event\` rather than \`list_users\`, \`list_events\` and \`create_event\`, because the first matches a task and the others match your database.
- **Namespace.** Prefixes such as \`asana_search\` and \`jira_search\` "help delineate boundaries between lots of tools".
- **Budget the response.** "Pagination, range selection, filtering, and/or truncation with sensible default parameter values", because whatever comes back is spent from the model's attention.
- **Make errors actionable.** "Specific and actionable improvements, rather than opaque error codes or tracebacks."

The framing worth keeping: tools are "a new kind of software which reflects a contract between deterministic systems and non-deterministic agents".`,
  },
];
