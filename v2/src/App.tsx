/**
 * App shell, split, not toggled.
 *
 * The first build made Map and Notebook two full-screen views with a toggle
 * between them, reading design-spec §1's "one toggle" literally. That was
 * wrong, and the symptom was exactly what a reader reported: the notebook felt
 * like a wall of information with no sense of flow.
 *
 * bbycroft never toggles. The visual is ALWAYS on screen and moves as you
 * read, so a paragraph about one stage never floats free of where that stage
 * sits in the whole. A toggle makes "where am I" and "what is this" mutually
 * exclusive, which is the one combination a learner needs together.
 *
 * So on a wide screen both are visible at once, and the map follows the
 * notebook automatically. They already share `focusNodeId`, so the camera
 * moves as you step. Below the breakpoint there is not room for two columns,
 * and the toggle returns as the honest fallback.
 */

import { useEffect, useState } from 'react';
import { AISettings } from './ai/AISettings';
import { Learn } from './learn/Learn';
import { NODES, ROOT_ID, getNode, hasChildren } from './content';
import { InsideChips } from './map/InsideChips';
import { MapCanvas } from './map/MapCanvas';
import { UniverseButton } from './map/UniverseButton';
import { WalkStart } from './map/WalkStart';
import { Notebook } from './notebook/Notebook';
import { StageFlow } from './stage/StageFlow';
import { StageView, hasStage } from './stage/StageView';
import { useStore } from './store';
import { ViewToggle } from './ui/ViewToggle';
import './App.css';

/** Below this there is not room for a map and a readable column of prose. */
const SPLIT_AT = 1100;

function useSplit(): boolean {
  const [split, setSplit] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= SPLIT_AT,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SPLIT_AT}px)`);
    const on = () => setSplit(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return split;
}

export function App() {
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const openAISettings = useStore((s) => s.openAISettings);
  const aiKey = useStore((s) => s.aiKey);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const showMap = useStore((s) => s.showMap);
  const setView = useStore((s) => s.setView);
  const learn = useStore((s) => s.learn);
  const setLearn = useStore((s) => s.setLearn);
  const split = useSplit();
  const onStage = hasStage(focusNodeId);
  const node = getNode(focusNodeId);
  const flow = showMap ? undefined : node?.L1?.flow;

  return (
    <div className={`app${split ? ' split' : ''}`}>
      <header className="app-bar">
        <div className="app-brand">
          <h1>LLM Learner</h1>
          <p>How a language model actually works, on one real tiny model.</p>
        </div>
        <div className="app-actions">
          {/* Only meaningful when the two cannot be shown together. */}
          {!split && <ViewToggle />}

          {/* The universe, promoted to a first-class entry.
              It stopped being the default graphic because circles teach
              nothing about how a model works, but as an INDEX it is the best
              thing here: sixty-four concepts, nested by what contains what,
              every one a click from its lesson. That is a real job, and it
              deserves a real door rather than a toggle buried in a node. */}
          <button
            className={`app-index${learn ? ' on' : ''}`}
            onClick={() => setLearn(!learn)}
            title={learn ? 'The original map and notebook' : 'The trained model'}
          >
            {learn ? 'Concept map' : 'Trained model'}
          </button>
          {!learn && <UniverseButton />}
          <button
            className={`app-ai${aiKey ? ' on' : ''}`}
            onClick={openAISettings}
            title={aiKey ? 'LLM connected' : 'Connect an LLM (optional)'}
          >
            <span className="app-ai-dot" aria-hidden="true" />
            {aiKey ? 'LLM on' : 'Connect LLM'}
          </button>
          <button
            className="app-theme"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {learn ? (
        <main className="app-body app-learn">
          <Learn />
        </main>
      ) : (
      <main className="app-body">
        <div
          className={`app-view app-map${split || view === 'map' ? ' on' : ''}`}
          inert={!split && view !== 'map'}
        >
          {/* The graphic pane shows the concrete thing, never an abstract
              circle. Pipeline stages get their data; everything else gets its
              own structure as boxes. The map is navigation, and navigation is
              not what the largest pane on screen is for, it is one click away
              on "show on map". */}
          {showMap ? (
            /* The index wins over everything, including a pipeline stage , 
               otherwise asking for the index on one of the twelve stages
               silently does nothing, which reads as a broken button. */
            <MapCanvas compact={split} />
          ) : onStage ? (
            <StageView />
          ) : flow ? (
            <div className="app-flowpane">
              <header className="app-flowhead">
                <span className="app-flowkicker">{node?.tag}</span>
                <h2>{node?.title}</h2>
              </header>

              {/* Stacked, the two panes are alternatives, so the structure
                  needs its own way through to the reading. Split, the lesson is
                  already beside it and this would be a button to nowhere. */}
              {!split && (
                <button className="map-open" onClick={() => setView('notebook')}>
                  Open the lesson →
                </button>
              )}
              <StageFlow spec={flow} nodeId={focusNodeId} />

              {/* Without this the fourteen container nodes that have a flow , 
                  the root among them. Would have no way down, because the
                  chips used to live in the map this pane replaced. */}
              {hasChildren(focusNodeId) && (
                <div className="app-flowkids">
                  <p className="map-kids-l">Inside {node?.title}</p>
                  <InsideChips nodeId={focusNodeId} />
                </div>
              )}

              {/* The front door. Only at the root, where "what do I do with
                  this" is the actual question, repeating it on every
                  container would make it furniture. */}
              {focusNodeId === ROOT_ID && (
                <div className="app-flowstart">
                  <WalkStart />
                  {/* The honest headline about how much of this is real. It
                      belongs wherever the front door is. */}
                  <p className="map-count">
                    {NODES.length} concepts · {NODES.filter((n) => n.L1?.flow).length} diagrams ·{' '}
                    {NODES.filter((n) => n.L1?.example).length} with live numbers
                  </p>
                </div>
              )}
            </div>
          ) : (
            <MapCanvas compact={split} />
          )}
        </div>
        <div
          className={`app-view app-note${split || view === 'notebook' ? ' on' : ''}`}
          inert={!split && view !== 'notebook'}
        >
          <Notebook />
        </div>
      </main>
      )}

      <AISettings />
    </div>
  );
}
