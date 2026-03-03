import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { compressDirections } from './internal/gestureCompression';
import { ACTION_LABELS, DEFAULT_SETTINGS, type ExtensionSettings } from './shared';

function Options(): React.JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [pattern, setPattern] = useState('');
  const points = useRef<{x:number;y:number}[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    chrome.storage.local.get('settings').then((result) => {
      setSettings({ ...DEFAULT_SETTINGS, ...(result.settings ?? {}) });
    });
  }, []);

  const save = (): void => {
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  };

  const clear = (): void => {
    points.current = [];
    setPattern('');
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const gallery = useMemo(() => Object.entries(ACTION_LABELS), []);

  const draw = (x: number, y: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: x - rect.left, y: y - rect.top };
    points.current.push(point);
    const ctx = canvas.getContext('2d');
    if (!ctx || points.current.length < 2) return;
    const prev = points.current[points.current.length - 2];
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setPattern(compressDirections(points.current, settings.directionThreshold));
  };

  return <main className="container space">
    <section className="card space">
      <h1 className="title">TabiNeko Settings</h1>
      <div className="grid">
        <label className="space">Min gesture distance <input className="input" type="number" value={settings.minGestureDistance} onChange={(e)=>setSettings({...settings,minGestureDistance:Number(e.target.value)})} /></label>
        <label className="space">Direction threshold <input className="input" type="number" value={settings.directionThreshold} onChange={(e)=>setSettings({...settings,directionThreshold:Number(e.target.value)})} /></label>
        <label className="space">Throttle (ms) <input className="input" type="number" value={settings.moveThrottleMs} onChange={(e)=>setSettings({...settings,moveThrottleMs:Number(e.target.value)})} /></label>
      </div>
      <div className="row">
        <label><input type="checkbox" checked={settings.advanced.rockerGestures} onChange={(e)=>setSettings({...settings,advanced:{...settings.advanced,rockerGestures:e.target.checked}})} /> Rocker gestures</label>
        <label><input type="checkbox" checked={settings.advanced.wheelGestures} onChange={(e)=>setSettings({...settings,advanced:{...settings.advanced,wheelGestures:e.target.checked}})} /> Scroll wheel</label>
        <label><input type="checkbox" checked={settings.advanced.chainedGestures} onChange={(e)=>setSettings({...settings,advanced:{...settings.advanced,chainedGestures:e.target.checked}})} /> Chained</label>
      </div>
      <button className="button" onClick={save}>Save settings</button>
    </section>

    <section className="card space">
      <h2 className="title">Live gesture predictor</h2>
      <canvas ref={canvasRef} width={700} height={260} style={{ border:'1px dashed #cbd5e1', borderRadius: 10 }} onPointerDown={clear} onPointerMove={(e)=>{if(e.buttons===1) draw(e.clientX, e.clientY);}} />
      <div className="row"><span className="badge">Pattern: {pattern || '—'}</span><button className="button secondary" onClick={clear}>Clear</button></div>
    </section>

    <section className="card">
      <h2 className="title">Gesture gallery</h2>
      <table className="table"><tbody>{gallery.map(([k,v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Options />);
