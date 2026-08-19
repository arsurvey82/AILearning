/**
 * App state, CLAUDE.md §3: a small store, no Redux.
 *
 * Deliberately tiny. Only the four things both views need to agree on, plus the
 * theme. Everything else stays local component state.
 */

import { create } from 'zustand';
import { DEFAULT_INPUT } from './model/toyModel';
import { ENTRY_NODE_ID } from './content';
import type { NodeId } from './content/schema';
import { PROVIDERS, type ProviderId } from './ai/providers';

export type View = 'map' | 'notebook';
export type Layer = 'L1' | 'L2' | 'L3' | 'L4';
export type Theme = 'dark' | 'light';

/**
 * How much scaffolding to show. The EXPERTISE REVERSAL EFFECT made operable.
 *
 * The finding (Kalyuga and colleagues, replicated across a large literature):
 * novices learn better under high-assistance instruction, and experts learn
 * better under LOW-assistance instruction. The same analogy, worked-out step or
 * redundant restatement that helps a beginner measurably *hurts* someone who
 * already holds the schema, because it duplicates guidance their prior
 * knowledge already supplies and they must spend effort reconciling the two.
 *
 * So "novice to expert" cannot mean adding more. It means the app taking
 * scaffolding away as the learner stops needing it.
 *
 * See docs/pedagogy.md for sources.
 */
export type Level = 'learning' | 'practised';

/** Layers are tracked per node so opening L4 on Embedding doesn't open it everywhere. */
type LayerKey = `${NodeId}:${Layer}`;

interface State {
  view: View;
  focusNodeId: NodeId;
  openLayers: Set<LayerKey>;
  runInput: string;
  /** Bumped on every Run, so visuals can pulse without diffing every number. */
  runNonce: number;
  visited: Set<NodeId>;
  theme: Theme;
  level: Level;
  setLevel: (l: Level) => void;
  /**
   * Which token is "looking", shared by the arcs and the number grid on the
   * Attention node. Two independent selectors for one idea is a split-attention
   * problem. The learner has to reconcile two views that disagree, which is
   * exactly the extraneous load the material does not need.
   */
  queryToken: number;
  setQueryToken: (i: number) => void;
  /** Autoplay through the pipeline. Paused by default, learner-paced wins. */
  playing: boolean;
  setPlaying: (p: boolean) => void;
  /**
   * Force the abstract map into the graphic pane.
   *
   * Off by default: the pane's job is to show the concrete thing, the data,
   * or the structure as boxes. Circles are for finding your way around, which
   * is a navigation question and does not deserve the largest surface on
   * screen. One click away, not the default.
   */
  showMap: boolean;
  setShowMap: (v: boolean) => void;
  /**
   * The trained-model experience, built on src/learn.
   *
   * A separate surface rather than a rewrite of the existing one. The old views
   * run on the seeded random toy and 64 authored nodes; this runs on real
   * trained weights. Keeping them apart means neither has to be broken while
   * the other is being built.
   */
  learn: boolean;
  setLearn: (v: boolean) => void;

  /**
   * The trail of terms the reader has dug into, oldest first.
   *
   * A stack rather than a single value, because opening a word from inside an
   * explanation does not cancel the question that led there. Keeping the path
   * is what makes depth inviting instead of disorienting.
   */
  dig: string[];
  digTo: (id: string, truncateAt?: number) => void;
  digBack: () => void;
  digClose: () => void;

  /**
   * AI configuration. Deliberately plain zustand state with no persist
   * middleware: the key lives in memory for this page session and is gone on
   * reload. It is never written to localStorage and never bundled.
   */
  aiProvider: ProviderId;
  aiKey: string;
  aiModel: string;
  /** OpenRouter's `reasoning` parameter. Off by default, it bills as output tokens. */
  aiReasoning: boolean;
  aiSettingsOpen: boolean;
  setAI: (cfg: {
    provider?: ProviderId;
    key?: string;
    model?: string;
    reasoning?: boolean;
  }) => void;
  clearAI: () => void;
  openAISettings: () => void;
  closeAISettings: () => void;

  setView: (v: View) => void;
  /** Focus a node; optionally jump to the other view at the same time. */
  focusNode: (id: NodeId, view?: View) => void;
  toggleLayer: (id: NodeId, layer: Layer) => void;
  isLayerOpen: (id: NodeId, layer: Layer) => boolean;
  collapseAll: (id: NodeId) => void;
  setRunInput: (s: string) => void;
  toggleTheme: () => void;
}

export const useStore = create<State>((set, get) => ({
  // design-spec §1: land on the Map. Orientation before detail.
  view: 'map',
  focusNodeId: ENTRY_NODE_ID,
  openLayers: new Set<LayerKey>(),
  runInput: DEFAULT_INPUT,
  runNonce: 0,
  visited: new Set<NodeId>([ENTRY_NODE_ID]),
  theme: 'dark',
  level: 'learning',
  setLevel: (level) => set({ level }),
  queryToken: 0,
  setQueryToken: (queryToken) => set({ queryToken }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  showMap: false,
  setShowMap: (showMap) => set({ showMap }),
  /* On. Seven words and four numbers is where a reader should land: at that
     size the whole table is printable and readable, and the trained
     transformer is a deliberate second step rather than an ambush. The concept
     map is one click away in the header. */
  learn: true,
  setLearn: (learn) => set({ learn }),

  dig: [],
  digTo: (id, truncateAt) =>
    set((s) => {
      // Clicking a crumb rewinds to it rather than pushing a duplicate.
      if (truncateAt !== undefined) return { dig: s.dig.slice(0, truncateAt + 1) };
      // Re-opening the term already on top is a no-op, not a repeat.
      if (s.dig[s.dig.length - 1] === id) return {};
      return { dig: [...s.dig, id] };
    }),
  digBack: () => set((s) => ({ dig: s.dig.slice(0, -1) })),
  digClose: () => set({ dig: [] }),

  aiProvider: 'anthropic',
  aiKey: '',
  aiModel: PROVIDERS.anthropic.defaultModel,
  aiReasoning: false,

  setAI: (cfg) =>
    set((s) => {
      const provider = cfg.provider ?? s.aiProvider;
      // Switching provider resets the model, because a model name from one
      // provider is meaningless to another and silently 404s.
      const model =
        cfg.model ?? (cfg.provider && cfg.provider !== s.aiProvider ? PROVIDERS[provider].defaultModel : s.aiModel);
      return {
        aiProvider: provider,
        aiKey: cfg.key ?? s.aiKey,
        aiModel: model,
        aiReasoning: cfg.reasoning ?? s.aiReasoning,
      };
    }),

  clearAI: () => set({ aiKey: '' }),
  aiSettingsOpen: false,
  openAISettings: () => set({ aiSettingsOpen: true }),
  closeAISettings: () => set({ aiSettingsOpen: false }),

  setView: (v) => set({ view: v }),

  focusNode: (id, view) =>
    set((s) => ({
      focusNodeId: id,
      visited: new Set(s.visited).add(id),
      ...(view ? { view } : {}),
    })),

  toggleLayer: (id, layer) =>
    set((s) => {
      const key: LayerKey = `${id}:${layer}`;
      const next = new Set(s.openLayers);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { openLayers: next };
    }),

  isLayerOpen: (id, layer) => get().openLayers.has(`${id}:${layer}`),

  collapseAll: (id) =>
    set((s) => {
      const next = new Set(s.openLayers);
      for (const k of next) if (k.startsWith(`${id}:`)) next.delete(k);
      return { openLayers: next };
    }),

  setRunInput: (runInput) => set((s) => ({ runInput, runNonce: s.runNonce + 1 })),

  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      return { theme };
    }),
}));
