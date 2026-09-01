import { useDroppable } from '@dnd-kit/core';
import type { Edge, NodeId } from '@shared/workspace/index.js';

const EDGES: Edge[] = ['left', 'right', 'top', 'bottom'];

function Zone({
  groupId,
  edge,
  active,
}: {
  groupId: NodeId;
  edge: Edge | 'center';
  active: boolean;
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${groupId}:${edge}`,
    data: { groupId, edge },
  });

  return (
    <div
      ref={setNodeRef}
      className={`dropzone dropzone--${edge}${isOver ? ' dropzone--over' : ''}`}
      data-active={active}
      aria-hidden
    />
  );
}

/**
 * Centre zone appends to the group's tabs; four edge zones at 25% inset split
 * (FR-WS-04).
 *
 * Always mounted, even when idle: dnd-kit measures droppables when a drag
 * begins, so zones that appear mid-drag are never seen. `pointer-events: none`
 * keeps them from swallowing clicks, and collision detection works from rects
 * rather than hit testing.
 */
export function DropZones({
  groupId,
  active,
}: {
  groupId: NodeId;
  active: boolean;
}): React.JSX.Element {
  return (
    <div className="dropzones" data-active={active}>
      {EDGES.map((edge) => (
        <Zone key={edge} groupId={groupId} edge={edge} active={active} />
      ))}
      <Zone groupId={groupId} edge="center" active={active} />
    </div>
  );
}
