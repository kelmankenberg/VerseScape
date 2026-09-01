import type { PanelProps } from './registry.js';

function readText(state: unknown): string {
  return typeof state === 'object' && state !== null && 'text' in state
    ? String((state as { text: unknown }).text ?? '')
    : '';
}

/**
 * Exists to prove panel state survives tab switching, splitting and (from step
 * 8) LRU unmount and remount.
 */
export function ScratchPanel({ state, setState }: PanelProps): React.JSX.Element {
  return (
    <div className="scratch-panel">
      <textarea
        className="scratch-panel__input"
        value={readText(state)}
        placeholder="Type here, then switch tabs or split the group — the text should survive."
        onChange={(event) => setState({ text: event.target.value })}
      />
    </div>
  );
}
