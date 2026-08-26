'use client';

import { useEffect, useRef, useState } from 'react';
import type { StationConfig } from '@/lib/types';

type StationState = {
  stationId: number; unlocked: boolean; submitted: boolean; hintsUsed: number; hintPoints: number;
  answer: string; submittedAt: string | null; scorePercent: number | null;
};

export default function StationView({ station, state, onClose, refresh, locked }: {
  station: StationConfig; state: StationState; onClose: () => void; refresh: () => Promise<void>; locked: boolean;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [answer, setAnswer] = useState(state.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const touchStart = useRef<number | null>(null);
  const maxIndex = Math.min(state.hintsUsed, station.images.length - 1);

  useEffect(() => { if (imageIndex > maxIndex) setImageIndex(maxIndex); }, [maxIndex, imageIndex]);
  useEffect(() => { if (state.submitted) setAnswer(state.answer); }, [state.answer, state.submitted]);

  async function nextHint() {
    if (locked || state.hintPoints <= 0 || state.submitted) return;
    if (!confirm('Nächsten Hinweis öffnen? -1 Hinweispunkt')) return;
    setBusy(true); setError('');
    const res = await fetch('/api/team/station-hint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stationId: station.id }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Fehler.');
    await refresh(); setImageIndex(Math.min(maxIndex + 1, station.images.length - 1));
  }

  async function submit() {
    if (locked) return setError('Zeit abgelaufen.');
    if (!answer.trim()) return setError('Antwort fehlt.');
    if (!confirm('Antwort wirklich abschicken? Kann danach nicht mehr bearbeitet werden.')) return;
    setBusy(true); setError('');
    const res = await fetch('/api/team/station-answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stationId: station.id, answer }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Fehler.');
    await refresh();
  }

  function swipeEnd(x: number) {
    if (touchStart.current === null) return;
    const d = x - touchStart.current;
    if (d < -40 && imageIndex < maxIndex) setImageIndex((v) => v + 1);
    if (d > 40 && imageIndex > 0) setImageIndex((v) => v - 1);
    touchStart.current = null;
  }

  return <div className="sheet-page">
    <div className="sheet-head"><div><div className="eyebrow">STATION</div><h2>{station.title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className="points-pill">{state.hintPoints} Hinweispunkte</div>
    <div className="station-image-wrap" onTouchStart={(e) => touchStart.current = e.touches[0].clientX} onTouchEnd={(e) => swipeEnd(e.changedTouches[0].clientX)}>
      <img className="station-image" src={station.images[imageIndex]} alt={`Hinweis ${imageIndex + 1}`} />
      <button className="image-arrow left" onClick={() => setImageIndex((v) => Math.max(0, v - 1))} disabled={imageIndex === 0}>‹</button>
      <button className="image-arrow right" onClick={() => setImageIndex((v) => Math.min(maxIndex, v + 1))} disabled={imageIndex === maxIndex}>›</button>
    </div>
    <div className="image-dots">{Array.from({ length: maxIndex + 1 }).map((_, i) => <button key={i} className={i === imageIndex ? 'active' : ''} onClick={() => setImageIndex(i)} aria-label={`Hinweis ${i + 1}`} />)}</div>
    {!locked && !state.submitted && state.hintPoints > 0 && <button className="secondary full" onClick={nextHint} disabled={busy}>Nächster Hinweis · -1 Punkt</button>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="station-task">
      <p>{station.text}</p>
      <label>{station.answerLabel ?? 'Antwort'}<textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={state.submitted || locked} /></label>
      {state.submitted ? <div className="locked-answer">Antwort fix</div> : !locked && <button className="primary full" onClick={submit} disabled={busy}>Antwort abschicken</button>}
      {error && <p className="error-text">{error}</p>}
    </div>
  </div>;
}
