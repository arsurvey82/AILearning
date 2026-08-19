/**
 * A deliberately tiny markdown renderer.
 *
 * Content is authored with a little inline markup (**bold**, *italic*, `code`)
 * and L4 adds fenced code blocks and bullet lists. That is the entire grammar,
 * so a real markdown dependency would be more surface area than the job needs.
 *
 * It builds React elements rather than HTML strings, there is no
 * dangerouslySetInnerHTML anywhere in this app, so authored content can never
 * become an injection path.
 */

import type { ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/** **bold**, *italic*, `code` */
export function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/** Block-level: paragraphs, `- ` lists, and ``` fenced code. */
export function Markdown({ source }: { source: string }): ReactNode {
  const blocks: ReactNode[] = [];
  const chunks = source.split(/```/);

  chunks.forEach((chunk, ci) => {
    // Odd chunks are inside fences.
    if (ci % 2 === 1) {
      const body = chunk.replace(/^[a-z]*\n/i, '');
      blocks.push(
        <pre className="md-pre" key={`c${ci}`}>
          <code>{body.replace(/\n$/, '')}</code>
        </pre>,
      );
      return;
    }

    for (const para of chunk.split(/\n{2,}/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      if (lines.every((l) => l.trimStart().startsWith('- '))) {
        blocks.push(
          <ul className="md-ul" key={`${ci}-${blocks.length}`}>
            {lines.map((l, li) => (
              <li key={li}>{inline(l.trimStart().slice(2))}</li>
            ))}
          </ul>,
        );
      } else {
        blocks.push(
          <p className="md-p" key={`${ci}-${blocks.length}`}>
            {inline(trimmed.replace(/\n/g, ' '))}
          </p>,
        );
      }
    }
  });

  return <>{blocks}</>;
}
