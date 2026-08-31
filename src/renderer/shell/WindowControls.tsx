import { Minus, Square, Copy, X } from 'lucide-react';
import { useWindowState } from '../hooks/use-window-state.js';

/**
 * Windows-style ordering on every platform (decision D-09): minimize,
 * maximize/restore, close, right-aligned.
 */
export function WindowControls(): React.JSX.Element {
  const { isMaximized } = useWindowState();

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-controls__button"
        aria-label="Minimize"
        onClick={() => void window.versescape.window.minimize()}
      >
        <Minus size={15} strokeWidth={1.5} aria-hidden />
      </button>

      <button
        type="button"
        className="window-controls__button"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => void window.versescape.window.toggleMaximize()}
      >
        {isMaximized ? (
          <Copy size={13} strokeWidth={1.5} aria-hidden />
        ) : (
          <Square size={12} strokeWidth={1.5} aria-hidden />
        )}
      </button>

      <button
        type="button"
        className="window-controls__button window-controls__button--close"
        aria-label="Close"
        onClick={() => void window.versescape.window.close()}
      >
        <X size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
