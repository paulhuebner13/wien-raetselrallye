'use client';

import { useState } from 'react';
import type { ScoringConfig } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase-browser';
import LoadingSpinner from '@/components/LoadingSpinner';

type GuinnessEntry = { id: string; street: string; image_url: string | null; created_at?: string };
type ArchitectureEntry = { id: string; style: string; building_name: string; image_url: string | null; created_at?: string };
type Beer = { id: string; brand: string; image_url: string | null; created_at?: string };

function formatUploadTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function isDrinkEntry(entry: ArchitectureEntry) {
  return entry.style.startsWith('drink:');
}

function drinkLabel(style: string) {
  return style.startsWith('drink:irish_car_bomb:') ? 'Irish Car Bomb' : 'Guinness';
}

async function signedUpload(kind: 'guinness' | 'architecture' | 'beer', file: File, extra: Record<string, string>) {
  const ticketRes = await fetch('/api/team/upload-ticket', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, fileName: file.name, contentType: file.type, ...extra }),
  });
  const ticket = await ticketRes.json();
  if (!ticketRes.ok) throw new Error(ticket.error ?? 'Fehler.');
  const upload = await supabaseBrowser().storage.from('team-uploads').uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (upload.error) throw new Error('Upload fehlgeschlagen.');
  return ticket.path as string;
}

export function GuinnessTab({ entries, refresh, locked, scoring }: { entries: GuinnessEntry[]; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [street, setStreet] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return setError('Zeit abgelaufen.');
    if (!file || !street.trim()) return setError('Foto und Straße angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    const streetToSave = street.trim();
    const fileToSave = file;
    setBusy(true); setError('');
    try {
      const path = await signedUpload('guinness', fileToSave, { street: streetToSave });
      const saveRes = await fetch('/api/team/guinness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, street: streetToSave }) });
      const save = await saveRes.json();
      if (!saveRes.ok) throw new Error(save.error ?? 'Speichern fehlgeschlagen.');
      setFile(null); setStreet('');
      const input = document.getElementById('guinness-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (locked) return;
    if (!confirm('Foto wirklich löschen?')) return;
    await fetch('/api/team/guinness', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refresh();
  }

  return <section className="tab-page">
    <div className="tab-score-row"><span className="count-badge">{entries.length * scoring.guinnessPerLogo} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>Außen-Schilder mit Guinness-Logos verschiedener Pubs fotografieren. Harfe + Guinness-Schriftzug müssen sichtbar sein.</p>
      <p>Jedes gültige Foto: {scoring.guinnessPerLogo} Punkt{scoring.guinnessPerLogo === 1 ? '' : 'e'}.</p>
    </div>
    <div className="guinness-map-card">
      <p>Die Karte zeigt Suchergebnisse für „Irish Pub“ bei Google Maps und dient nur als Orientierung. Das bedeutet nicht, dass bei jedem eingezeichneten Pub auch ein Guinness-Logo zu finden ist.</p>
      <button
        type="button"
        className="guinness-map-preview"
        onClick={() => { setMapZoom(1); setMapOpen(true); }}
        aria-label="Karte vergrößern"
      >
        <img src="/guinness-map.png" alt="Karte mit Suchergebnissen für Irish Pubs" />
        <span>Zum Vergrößern antippen</span>
      </button>
    </div>
    {mapOpen && <div
      className="guinness-map-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Irish-Pub-Karte"
      onClick={() => setMapOpen(false)}
    >
      <div className="guinness-map-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setMapZoom((z) => Math.max(1, z - 0.5))}>−</button>
        <span>{Math.round(mapZoom * 100)}%</span>
        <button type="button" onClick={() => setMapZoom((z) => Math.min(4, z + 0.5))}>+</button>
        <button type="button" onClick={() => setMapOpen(false)} aria-label="Schließen">×</button>
      </div>
      <div className="guinness-map-viewport" onClick={(e) => e.stopPropagation()}>
        <img
          src="/guinness-map.png"
          alt="Karte mit Suchergebnissen für Irish Pubs"
          className="guinness-map-full"
          style={{ width: `${mapZoom * 100}%` }}
          draggable={false}
        />
      </div>
    </div>}
    {!locked && <form className="upload-form" onSubmit={add}>
      <label className={`file-button ${busy ? 'disabled' : ''}`}>Foto machen<input id="guinness-file" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Straße<input value={street} disabled={busy} onChange={(e) => setStreet(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy ? <><LoadingSpinner small /> Wird hochgeladen…</> : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="entry-list">{entries.map((entry) => <article className="photo-entry" key={entry.id}>
      {entry.image_url && <img src={entry.image_url} alt="Guinness-Schild" />}
      <small className="upload-time">Hochgeladen {formatUploadTime(entry.created_at)}</small>
      <div className="entry-row"><b>{entry.street}</b>{!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}</div>
    </article>)}</div>
  </section>;
}

export function ArchitectureTab({ entries, refresh, locked, scoring }: { entries: ArchitectureEntry[]; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
  const visibleEntries = [...entries]
    .filter(isDrinkEntry)
    .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime());
  const [file, setFile] = useState<File | null>(null);
  const [drinker, setDrinker] = useState('');
  const [drinkType, setDrinkType] = useState<'guinness' | 'irish_car_bomb'>('guinness');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return setError('Zeit abgelaufen.');
    if (!file || !drinker.trim()) return setError('Foto und Name angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    const drinkerToSave = drinker.trim();
    const fileToSave = file;
    setBusy(true); setError('');
    try {
      const uploadPath = await signedUpload('architecture', fileToSave, { drinkType, drinker: drinkerToSave });
      const saveRes = await fetch('/api/team/architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: uploadPath, drinkType, drinker: drinkerToSave }),
      });
      const save = await saveRes.json();
      if (!saveRes.ok) throw new Error(save.error ?? 'Speichern fehlgeschlagen.');
      setFile(null); setDrinker('');
      const input = document.getElementById('guinness-drink-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (locked || !confirm('Foto wirklich löschen?')) return;
    await fetch('/api/team/architecture', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refresh();
  }

  return <section className="tab-page">
    <div className="tab-score-row"><span className="count-badge">{visibleEntries.length * scoring.architecturePerStyle} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>Jedes getrunkene Guinness und jede Irish Car Bomb zählt.</p>
      <p>Foto machen und eintragen, wer es getrunken hat. Jeder gültige Eintrag: {scoring.architecturePerStyle} Punkt{scoring.architecturePerStyle === 1 ? '' : 'e'}.</p>
    </div>
    {!locked && <form className="upload-form" onSubmit={add}>
      <label className={`file-button ${busy ? 'disabled' : ''}`}>Foto machen<input id="guinness-drink-file" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Getränk<select value={drinkType} disabled={busy} onChange={(e) => setDrinkType(e.target.value as 'guinness' | 'irish_car_bomb')}><option value="guinness">Guinness</option><option value="irish_car_bomb">Irish Car Bomb</option></select></label>
      <label>Wer hat es getrunken?<input value={drinker} disabled={busy} onChange={(e) => setDrinker(e.target.value)} placeholder="Name" /></label>
      <button className="primary" disabled={busy}>{busy ? <><LoadingSpinner small /> Wird hochgeladen…</> : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="entry-list">{visibleEntries.map((entry) => <article className="photo-entry" key={entry.id}>
      {entry.image_url && <img src={entry.image_url} alt={drinkLabel(entry.style)} />}
      <small className="upload-time">Hochgeladen {formatUploadTime(entry.created_at)}</small>
      <div className="entry-row">
        <div><b>{drinkLabel(entry.style)}</b><div className="muted">{entry.building_name}</div></div>
        {!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}
      </div>
    </article>)}</div>
  </section>;
}

export function BeerTab({ beers, refresh, locked, scoring }: { beers: Beer[]; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
  const [brand, setBrand] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [marketMapOpen, setMarketMapOpen] = useState(false);
  const [marketMapZoom, setMarketMapZoom] = useState(1);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (locked) return setError('Zeit abgelaufen.');
    if (!brand.trim() || !file) return setError('Bier und Foto angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    const brandToSave = brand.trim();
    const fileToSave = file;
    setBusy(true);
    try {
      const path = await signedUpload('beer', fileToSave, { brand: brandToSave });
      const res = await fetch('/api/team/beer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand: brandToSave, path }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler.');
      setBrand(''); setFile(null);
      const input = document.getElementById('beer-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (locked || !confirm('Bier wirklich löschen?')) return;
    await fetch('/api/team/beer', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refresh();
  }

  return <section className="tab-page">
    <div className="tab-score-row"><span className="count-badge">{beers.length * scoring.beerPerUniqueCan} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>{scoring.beerPerUniqueCan} Punkt pro unterschiedlichem Dosenbier. Kein Radler, Cider oder alkoholfreies Bier.</p>
      <p>Sorten zählen getrennt: z. B. Stiegl Goldbräu und Stiegl Hell. 0,33 l und 0,5 l derselben Sorte zählen nicht doppelt.</p>
    </div>
    <div className="guinness-map-card supermarket-card">
      <b>Spät offene Einkaufsmöglichkeiten</b>
      <div className="supermarket-list">
        <p><b>BILLA CORSO Herrnhuterhaus</b><br />Neuer Markt 17 · bis 20:00</p>
        <p><b>SPAR Babenbergerstraße</b><br />Babenbergerstraße 9 · bis 21:00 <small>(nach 18:00 nur Bistro)</small></p>
        <p><b>INTERSPAR-pronto Wien Mitte</b><br />Landstraßer Hauptstraße 1b · bis 23:00</p>
        <p><b>OKAY Markt Schottentor</b><br />U-Bahn-Station Schottentor 1 · bis 21:45</p>
      </div>

      <button
        type="button"
        className="guinness-map-preview"
        onClick={() => { setMarketMapZoom(1); setMarketMapOpen(true); }}
        aria-label="Supermarkt-Karte vergrößern"
      >
        <img src="/supermarket-map.png" alt="Karte mit spät offenen Einkaufsmöglichkeiten" />
        <span>Zum Vergrößern antippen</span>
      </button>
    </div>

    {marketMapOpen && <div
      className="guinness-map-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Supermarkt-Karte"
      onClick={() => setMarketMapOpen(false)}
    >
      <div className="guinness-map-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setMarketMapZoom((z) => Math.max(1, z - 0.5))}>−</button>
        <span>{Math.round(marketMapZoom * 100)}%</span>
        <button type="button" onClick={() => setMarketMapZoom((z) => Math.min(4, z + 0.5))}>+</button>
        <button type="button" onClick={() => setMarketMapOpen(false)} aria-label="Schließen">×</button>
      </div>
      <div className="guinness-map-viewport" onClick={(e) => e.stopPropagation()}>
        <img
          src="/supermarket-map.png"
          alt="Karte mit spät offenen Einkaufsmöglichkeiten"
          className="guinness-map-full"
          style={{ width: `${marketMapZoom * 100}%` }}
          draggable={false}
        />
      </div>
    </div>}

    {!locked && <form className="upload-form" onSubmit={add}>
      <label className={`file-button ${busy ? 'disabled' : ''}`}>Foto machen<input id="beer-file" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Bier<input value={brand} disabled={busy} onChange={(e) => setBrand(e.target.value)} placeholder="z. B. Stiegl Goldbräu" /></label>
      <button className="primary" disabled={busy}>{busy ? <><LoadingSpinner small /> Wird hochgeladen…</> : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="beer-list">{[...beers].sort((a, b) => a.brand.localeCompare(b.brand, 'de')).map((beer) => <article key={beer.id} className="photo-entry beer-entry">
      {beer.image_url && <img src={beer.image_url} alt={beer.brand} />}
      <small className="upload-time">Hochgeladen {formatUploadTime(beer.created_at)}</small>
      <div className="entry-row"><b>{beer.brand}</b>{!locked && <button className="danger-link" onClick={() => remove(beer.id)}>Löschen</button>}</div>
    </article>)}</div>
  </section>;
}
