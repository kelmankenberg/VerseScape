import { Fragment, useRef } from 'react';
import { Splitter } from './Splitter.js';
import { TabGroupView } from './TabGroupView.js';
import { isGroup } from '@shared/workspace/index.js';
import type { LayoutNode, SplitNode } from '@shared/workspace/index.js';

function SplitView({
  split,
  dragging,
}: {
  split: SplitNode;
  dragging: boolean;
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} className={`split split--${split.direction}`}>
      {split.children.map((child, index) => (
        <Fragment key={child.id}>
          <div className="split__pane" style={{ flexBasis: `${(split.sizes[index] ?? 0) * 100}%` }}>
            <LayoutNodeView node={child} dragging={dragging} />
          </div>
          {index < split.children.length - 1 && (
            <Splitter split={split} index={index} containerRef={containerRef} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function LayoutNodeView({
  node,
  dragging,
}: {
  node: LayoutNode;
  dragging: boolean;
}): React.JSX.Element {
  return isGroup(node) ? (
    <TabGroupView group={node} dragging={dragging} />
  ) : (
    <SplitView split={node} dragging={dragging} />
  );
}
