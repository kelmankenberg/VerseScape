import { useCallback, useRef } from 'react';
import { useWorkspace } from './store.js';
import type { Direction, SplitNode } from '@shared/workspace/index.js';

/**
 * Resizes the two panes either side of it. Sizes are recomputed from the
 * container's own geometry rather than accumulated deltas, so the splitter
 * cannot drift away from the pointer during a long drag.
 */
export function Splitter({
  split,
  index,
  containerRef,
}: {
  split: SplitNode;
  index: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element {
  const resizeSplit = useWorkspace((state) => state.resizeSplit);
  const dragging = useRef(false);

  const horizontal = split.direction === 'row';

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const total = horizontal ? rect.width : rect.height;
      if (total <= 0) return;

      const offset = horizontal ? clientX - rect.left : clientY - rect.top;

      // Fraction of the container consumed by every pane before this pair.
      const before = split.sizes.slice(0, index).reduce((sum, size) => sum + size, 0);
      const pair = (split.sizes[index] ?? 0) + (split.sizes[index + 1] ?? 0);
      const withinPair = offset / total - before;

      const first = Math.min(Math.max(withinPair, 0), pair);
      const sizes = [...split.sizes];
      sizes[index] = first;
      sizes[index + 1] = pair - first;
      resizeSplit(split.id, sizes);
    },
    [containerRef, horizontal, index, resizeSplit, split.id, split.sizes],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) return;
    applyFromPointer(event.clientX, event.clientY);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudge = (delta: number): void => {
    const pair = (split.sizes[index] ?? 0) + (split.sizes[index + 1] ?? 0);
    const first = Math.min(Math.max((split.sizes[index] ?? 0) + delta, 0), pair);
    const sizes = [...split.sizes];
    sizes[index] = first;
    sizes[index + 1] = pair - first;
    resizeSplit(split.id, sizes);
  };

  return (
    <div
      className={`splitter splitter--${split.direction as Direction}`}
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label="Resize panes"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) nudge(-0.02);
        if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) nudge(0.02);
      }}
    >
      <span className="splitter__grip" aria-hidden />
    </div>
  );
}
