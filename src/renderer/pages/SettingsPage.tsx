import { useEffect, useState } from 'react';
import { themePreference } from '@shared/settings.js';
import type { AppSettings, ThemePreference } from '@shared/settings.js';
import { useSettings } from '../stores/settings.js';
import { AboutDialog } from '../components/AboutDialog.js';

const themeLabels: Record<ThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'Follow system',
};

const readingToggles: Array<{
  key: keyof AppSettings['reading'];
  label: string;
  hint: string;
}> = [
  {
    key: 'versePerLine',
    label: 'Verse per line',
    hint: 'Off groups same-paragraph verses together.',
  },
  { key: 'redLetter', label: 'Red letter', hint: 'Colour the words of Christ.' },
  { key: 'showFootnotes', label: 'Footnotes', hint: 'Show footnote markers.' },
  {
    key: 'showHeadings',
    label: 'Section headings',
    hint: "Show the resource's section headings.",
  },
  {
    key: 'showCrossReferences',
    label: 'Cross references',
    hint: 'Show the cross-reference button on each verse.',
  },
];

export function SettingsPage(): React.JSX.Element {
  const settings = useSettings((state) => state.settings);
  const setTheme = useSettings((state) => state.setTheme);
  const patch = useSettings((state) => state.patch);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [libraryLocation, setLibraryLocation] = useState<{ path: string | null; available: boolean } | null>(null);

  useEffect(() => {
    void window.versescape.resources.getLibraryLocation().then((result) => {
      if (result.ok) setLibraryLocation(result.data);
    });
  }, []);

  const chooseLibraryLocation = (): void => {
    void window.versescape.resources.chooseLibraryLocation().then((result) => {
      if (!result.ok) return;
      setLibraryLocation(result.data);
      void patch({ library: { location: result.data.path } });
    });
  };

  return (
    <div className="settings">
      <header className="settings__header">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__subtitle">
          Stored locally in <code>settings.json</code>. Nothing leaves this machine.
        </p>
      </header>

      <section className="settings__section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="settings__section-title">
          Appearance
        </h2>

        <div className="settings__row">
          <div className="settings__label">
            <span>Theme</span>
            <span className="settings__hint">Dark is the default.</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {themePreference.options.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={settings.appearance.theme === option}
                className={`segmented__option${
                  settings.appearance.theme === option ? ' segmented__option--active' : ''
                }`}
                onClick={() => void setTheme(option)}
              >
                {themeLabels[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <div className="settings__label">
            <span>Status bar</span>
            <span className="settings__hint">Show the bar along the bottom edge.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.shell.statusBarVisible}
              onChange={(event) =>
                void patch({ shell: { statusBarVisible: event.target.checked } })
              }
            />
            <span className="switch__track" aria-hidden />
          </label>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="reading-heading">
        <h2 id="reading-heading" className="settings__section-title">
          Reading
        </h2>
        <p className="settings__subtitle">
          Global defaults for Bible and commentary panels; each panel can override them from its own
          display options menu.
        </p>

        {readingToggles.map(({ key, label, hint }) => (
          <div className="settings__row" key={key}>
            <div className="settings__label">
              <span>{label}</span>
              <span className="settings__hint">{hint}</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                aria-label={label}
                checked={settings.reading[key]}
                onChange={(event) => void patch({ reading: { [key]: event.target.checked } })}
              />
              <span className="switch__track" aria-hidden />
            </label>
          </div>
        ))}
      </section>

      <section className="settings__section" aria-labelledby="library-heading">
        <h2 id="library-heading" className="settings__section-title">Library</h2>
        <div className="settings__row">
          <div className="settings__label">
            <span>Resource location</span>
            <span className={`settings__hint${libraryLocation && !libraryLocation.available ? ' settings__hint--error' : ''}`}>
              {libraryLocation?.path ?? 'Default application data location'}
              {libraryLocation && !libraryLocation.available ? ' is unavailable.' : ''}
            </span>
          </div>
          <button type="button" className="button" onClick={chooseLibraryLocation}>Choose folder</button>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="settings__section-title">
          Coming later
        </h2>
        <ul className="settings__pending">
          <li>Keyboard shortcuts and rebinding — M7</li>
          <li>Data, backup and export — M8</li>
        </ul>
      </section>

      <section className="settings__section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="settings__section-title">
          About
        </h2>
        <div className="settings__row">
          <div className="settings__label">
            <span>About VerseScape</span>
            <span className="settings__hint">Version details and resource acknowledgements.</span>
          </div>
          <button type="button" className="button" onClick={() => setAboutOpen(true)}>
            About VerseScape
          </button>
        </div>
      </section>

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
