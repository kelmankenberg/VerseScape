import { useEffect, useState } from 'react';
import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useWorkspace } from './store.js';
import { useWorkspacePersistence } from './use-workspace-persistence.js';
import { LayoutNodeView } from './LayoutNodeView.js';
import { findGroup } from '@shared/workspace/index.js';
import type { Edge } from '@shared/workspace/index.js';
import './workspace.css';

function isEdge(value: unknown): value is Edge {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
}

export function WorkspaceView(): React.JSX.Element {
  const workspace = useWorkspace((state) => state.workspace);
  const moveTab = useWorkspace((state) => state.moveTab);
  const dropTabOnEdge = useWorkspace((state) => state.dropTabOnEdge);
  const openPanel = useWorkspace((state) => state.openPanel);
  const closeTab = useWorkspace((state) => state.closeTab);
  const splitGroup = useWorkspace((state) => state.splitGroup);
  const reopenLastClosed = useWorkspace((state) => state.reopenLastClosed);

  const [dragging, setDragging] = useState(false);
  const ready = useWorkspacePersistence();

  // A small activation distance keeps a plain click on a tab from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (event: DragEndEvent): void => {
    setDragging(false);
    const tabId = event.active.data.current?.['tabId'] as string | undefined;
    const over = event.over?.data.current as { groupId?: string; edge?: unknown } | undefined;
    if (!tabId || !over?.groupId) return;

    if (isEdge(over.edge)) {
      dropTabOnEdge(tabId, over.groupId, over.edge);
    } else {
      moveTab(tabId, over.groupId);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return;
      const group = workspace.focusedGroup;

      if (event.key.toLowerCase() === 't' && !event.shiftKey) {
        event.preventDefault();
        openPanel('placeholder', group);
      } else if (event.key.toLowerCase() === 'f' && event.shiftKey) {
        event.preventDefault();
        openPanel('search-results', group);
      } else if (event.key.toLowerCase() === 'w' && !event.shiftKey) {
        event.preventDefault();
        const active = findGroup(workspace.root, group)?.activeTab;
        if (active) closeTab(active);
      } else if (event.key === '\\') {
        event.preventDefault();
        splitGroup(group, event.shiftKey ? 'column' : 'row');
      } else if (event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        reopenLastClosed();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspace, openPanel, closeTab, splitGroup, reopenLastClosed]);

  const maximized = workspace.maximizedGroup
    ? findGroup(workspace.root, workspace.maximizedGroup)
    : null;

  if (!ready) return <div className="workspace workspace--loading" />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={onDragEnd}
    >
      <div className="workspace">
        {maximized ? (
          <LayoutNodeView node={maximized} dragging={dragging} />
        ) : (
          <LayoutNodeView node={workspace.root} dragging={dragging} />
        )}
      </div>
    </DndContext>
  );
}
