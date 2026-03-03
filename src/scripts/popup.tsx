import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ACTION_LABELS, DEFAULT_SETTINGS, type ExtensionSettings, type GestureAction } from './shared';

function Popup(): React.JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    chrome.storage.local.get('settings').then((result) => {
      setSettings({ ...DEFAULT_SETTINGS, ...(result.settings ?? {}) });
    });
  }, []);

  const updateGesture = (pattern: string, action: GestureAction): void => {
    const next = { ...settings, gestures: { ...settings.gestures, [pattern]: action } };
    setSettings(next);
  };

  const save = async (): Promise<void> => {
    await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  };

  const exportSettings = async (): Promise<void> => {
    const { settings: exported } = await chrome.runtime.sendMessage({ type: 'EXPORT_SETTINGS' });
    await navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
  };

  const importSettings = async (): Promise<void> => {
    const pasted = prompt('Paste exported settings JSON');
    if (!pasted) return;
    const parsed = JSON.parse(pasted) as ExtensionSettings;
    setSettings(parsed);
  };

  return (
    <main className="container space" style={{ width: 360 }}>
      <section className="card space">
        <h1 className="title">TabiNeko</h1>
        <p className="small">High-performance right-click gestures (MV3)</p>
      </section>
      <section className="card">
        <table className="table">
          <thead><tr><th>Gesture</th><th>Action</th></tr></thead>
          <tbody>
            {Object.entries(settings.gestures).map(([pattern, action]) => (
              <tr key={pattern}>
                <td><span className="badge">{pattern}</span></td>
                <td>
                  <select className="select" value={action} onChange={(e) => updateGesture(pattern, e.target.value as GestureAction)}>
                    {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="row">
        <button className="button" onClick={save}>Save</button>
        <button className="button secondary" onClick={exportSettings}>Export</button>
        <button className="button secondary" onClick={importSettings}>Import</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
