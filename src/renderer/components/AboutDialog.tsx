import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { AppInfo } from '@shared/ipc/contracts.js';
import { LIBRARIES_NOTE, RESOURCE_ATTRIBUTIONS } from '../about/attributions.js';
import './about-dialog.css';

/** Opens in the user's browser: in-app navigation is blocked by design. */
function ExternalLink({ href, children }: { href: string; children: string }): React.JSX.Element {
  return (
    <a className="about__link" href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

export function AboutDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.versescape.app.getInfo().then((result) => {
      if (!cancelled && result.ok) setInfo(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="about__backdrop" role="presentation" onClick={onClose}>
      <div
        className="about"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="about__header">
          <h2 id="about-title" className="about__title">
            VerseScape
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="about__body">
          <p className="about__lead">An offline-first Bible study workspace. {LIBRARIES_NOTE}</p>

          {info && (
            <dl className="about__facts">
              <dt>Version</dt>
              <dd>{info.version}</dd>
              <dt>Electron</dt>
              <dd>{info.electron}</dd>
              <dt>Chromium</dt>
              <dd>{info.chrome}</dd>
              <dt>Platform</dt>
              <dd>{info.platform}</dd>
            </dl>
          )}

          <h3 className="about__section-title">Resource sources</h3>
          <p className="about__note">
            VerseScape ships only public-domain or openly licensed texts. With gratitude to:
          </p>

          <ul className="about__attributions">
            {RESOURCE_ATTRIBUTIONS.map((entry) => (
              <li key={entry.name} className="about__attribution">
                <div className="about__attribution-head">
                  <ExternalLink href={entry.url}>{entry.name}</ExternalLink>
                  <span className="about__licence">{entry.licence}</span>
                </div>
                <p className="about__attribution-what">{entry.what}</p>
              </li>
            ))}
          </ul>

          <p className="about__note">
            Full provenance, including licence text and retrieval dates, is recorded in the
            project&rsquo;s <code>LICENSES.md</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
