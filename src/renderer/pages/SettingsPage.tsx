import { useState } from 'react';
import { themePreference } from '@shared/settings.js';
import type { ThemePreference } from '@shared/settings.js';
import { useSettings } from '../stores/settings.js';
import { AboutDialog } from '../components/AboutDialog.js';

const themeLabels: Record<ThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'Follow system',
};

export function SettingsPage(): React.JSX.Element {
  const settings = useSettings((state) => state.settings);
  const setTheme = useSettings((state) => state.setTheme);
  const patch = useSettings((state) => state.patch);
  const [aboutOpen, setAboutOpen] = useState(false);

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

      <section className="settings__section" aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="settings__section-title">
          Coming later
        </h2>
        <ul className="settings__pending">
          <li>Reading typography and display defaults — M3</li>
          <li>Keyboard shortcuts and rebinding — M7</li>
          <li>Library and resource locations — M6</li>
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
