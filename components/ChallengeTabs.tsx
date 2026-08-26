'use client';

import { useState } from 'react';
import type { RallyeConfig } from '@/lib/types';
import { scoringConfig } from '@/lib/config';
import { supabaseBrowser } from '@/lib/supabase-browser';

type GuinnessEntry = { id: string; street: string; image_url: string | null };
type ArchitectureEntry = { id: string; style: string; building_name: string; image_url: string | null };
type Beer = { id: string; brand: string; image_url: string | null };

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

export function GuinnessTab({ entries, refresh, locked }: { entries: GuinnessEntry[]; refresh: () => Promise<void>; locked: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [street, setStreet] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return setError('Zeit abgelaufen.');
    if (!file || !street.trim()) return setError('Foto und Straße angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    setBusy(true); setError('');
    try {
      const path = await signedUpload('guinness', file, { street });
      const saveRes = await fetch('/api/team/guinness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, street }) });
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
    <div className="section-title"><div><div className="eyebrow">CHALLENGE</div><h2>Guinness</h2></div><span className="count-badge">{entries.length * scoringConfig.guinnessPerLogo} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>Außen-Schild eines Pubs. Harfe + Guinness-Schriftzug müssen sichtbar sein.</p>
      <p>Verschiedene Pubs. Mindestens 3. Jedes gültige Foto: {scoringConfig.guinnessPerLogo} Punkt{scoringConfig.guinnessPerLogo === 1 ? '' : 'e'}.</p>
    </div>
    {!locked && <form className="upload-form" onSubmit={add}>
      <label className="file-button">Foto auswählen<input id="guinness-file" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Straße<input value={street} onChange={(e) => setStreet(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy ? 'Lädt…' : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="entry-list">{entries.map((entry) => <article className="photo-entry" key={entry.id}>
      {entry.image_url && <img src={entry.image_url} alt="Guinness-Schild" />}
      <div className="entry-row"><b>{entry.street}</b>{!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}</div>
    </article>)}</div>
  </section>;
}

export function ArchitectureTab({ entries, styles, refresh, locked }: { entries: ArchitectureEntry[]; styles: RallyeConfig['architectureStyles']; refresh: () => Promise<void>; locked: boolean }) {
  return <section className="tab-page">
    <div className="section-title"><div><div className="eyebrow">CHALLENGE</div><h2>Architektur</h2></div><span className="count-badge">{entries.length * scoringConfig.architecturePerStyle} P.</span></div>
    <div className="rule-box"><b>Regeln</b><p>Je ein Gebäude pro Stil. Gebäudename + Foto hochladen.</p></div>
    <div className="style-list">{styles.map((style) => {
      const entry = entries.find((e) => e.style === style.name);
      return <ArchitectureStyle key={style.name} style={style} entry={entry} refresh={refresh} locked={locked} />;
    })}</div>
  </section>;
}

function ArchitectureStyle({ style, entry, refresh, locked }: { style: RallyeConfig['architectureStyles'][number]; entry?: ArchitectureEntry; refresh: () => Promise<void>; locked: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return setError('Zeit abgelaufen.');
    if (!file || !name.trim()) return setError('Foto und Gebäudename angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    setBusy(true); setError('');
    try {
      const path = await signedUpload('architecture', file, { style: style.name, buildingName: name });
      const saveRes = await fetch('/api/team/architecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, style: style.name, buildingName: name }) });
      const save = await saveRes.json();
      if (!saveRes.ok) throw new Error(save.error ?? 'Speichern fehlgeschlagen.');
      setFile(null); setName(''); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!entry || locked || !confirm('Foto wirklich löschen?')) return;
    await fetch('/api/team/architecture', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id }) });
    await refresh();
  }

  return <article className={`style-card ${entry ? 'complete' : ''}`}>
    <div className="style-head"><div><h3>{style.name}</h3><p className="style-description">{style.description}</p></div>{entry && <span>✓</span>}</div>
    {entry ? <>
      {entry.image_url && <img className="style-image" src={entry.image_url} alt={style.name} />}
      <div className="entry-row"><b>{entry.building_name}</b>{!locked && <button className="danger-link" onClick={remove}>Löschen</button>}</div>
    </> : !locked ? <form className="upload-form compact" onSubmit={add}>
      <label className="file-button">Foto auswählen<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Gebäudename<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <button className="secondary" disabled={busy}>{busy ? 'Lädt…' : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form> : <div className="locked-notice">Zeit abgelaufen.</div>}
  </article>;
}

export function BeerTab({ beers, refresh, locked }: { beers: Beer[]; refresh: () => Promise<void>; locked: boolean }) {
  const [brand, setBrand] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (locked) return setError('Zeit abgelaufen.');
    if (!brand.trim() || !file) return setError('Bier und Foto angeben.');
    if (file.size > 20 * 1024 * 1024) return setError('Foto ist größer als 20 MB.');
    setBusy(true);
    try {
      const path = await signedUpload('beer', file, { brand });
      const res = await fetch('/api/team/beer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand, path }) });
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
    <div className="section-title"><div><div className="eyebrow">CHALLENGE</div><h2>Wegbier</h2></div><span className="count-badge">{beers.length * scoringConfig.beerPerUniqueCan} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>{scoringConfig.beerPerUniqueCan} Punkt pro unterschiedlichem Dosenbier. Kein Radler, Cider oder alkoholfreies Bier.</p>
      <p>Sorten zählen getrennt: z. B. Stiegl, Stiegl Goldbräu und Stiegl Hell. 0,33 l und 0,5 l derselben Sorte zählen nicht doppelt.</p>
    </div>
    {!locked && <form className="upload-form" onSubmit={add}>
      <label className="file-button">Foto auswählen<input id="beer-file" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Bier<input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="z. B. Stiegl Goldbräu" /></label>
      <button className="primary" disabled={busy}>{busy ? 'Lädt…' : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="beer-list">{[...beers].sort((a, b) => a.brand.localeCompare(b.brand, 'de')).map((beer) => <article key={beer.id} className="photo-entry beer-entry">
      {beer.image_url && <img src={beer.image_url} alt={beer.brand} />}
      <div className="entry-row"><b>{beer.brand}</b>{!locked && <button className="danger-link" onClick={() => remove(beer.id)}>Löschen</button>}</div>
    </article>)}</div>
  </section>;
}
