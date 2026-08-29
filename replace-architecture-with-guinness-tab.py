from pathlib import Path

root = Path.cwd()

def read(rel):
    return (root / rel).read_text(encoding='utf-8')

def write(rel, content):
    (root / rel).write_text(content, encoding='utf-8')
    print('Geändert:', rel)

def replace_once(text, before, after, label):
    if before not in text:
        raise RuntimeError(f'Nicht gefunden: {label}')
    return text.replace(before, after, 1)

# components/ChallengeTabs.tsx
s = read('components/ChallengeTabs.tsx')
s = replace_once(s,
'''type GuinnessEntry = { id: string; street: string; image_url: string | null };
type ArchitectureEntry = { id: string; style: string; building_name: string; image_url: string | null };
type Beer = { id: string; brand: string; image_url: string | null };
''',
'''type GuinnessEntry = { id: string; street: string; image_url: string | null; created_at?: string };
type ArchitectureEntry = { id: string; style: string; building_name: string; image_url: string | null; created_at?: string };
type Beer = { id: string; brand: string; image_url: string | null; created_at?: string };

function formatUploadTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function isDrinkEntry(entry: ArchitectureEntry) {
  return entry.style.startsWith('drink:');
}

function drinkTypeFromStyle(style: string) {
  return style.startsWith('drink:irish_car_bomb:') ? 'irish_car_bomb' : 'guinness';
}

function drinkLabel(style: string) {
  return drinkTypeFromStyle(style) === 'irish_car_bomb' ? 'Irish Car Bomb' : 'Guinness';
}
''', 'ChallengeTabs types')
s = replace_once(s,
'''      {entry.image_url && <img src={entry.image_url} alt="Guinness-Schild" />}
      <div className="entry-row"><b>{entry.street}</b>{!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}</div>
''',
'''      {entry.image_url && <img src={entry.image_url} alt="Guinness-Schild" />}
      <small className="upload-time">Hochgeladen {formatUploadTime(entry.created_at)}</small>
      <div className="entry-row"><b>{entry.street}</b>{!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}</div>
''', 'Guinness upload time')
old_arch = '''export function ArchitectureTab({ entries, styles, refresh, locked, scoring }: { entries: ArchitectureEntry[]; styles: RallyeConfig['architectureStyles']; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
  return <section className="tab-page">
    <div className="tab-score-row"><span className="count-badge">{entries.length * scoring.architecturePerStyle} P.</span></div>
    <div className="rule-box"><b>Regeln</b><p>Je ein Gebäude pro Stil direkt in der App fotografieren. Gebäudename eintragen und hochladen.</p></div>
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
    const nameToSave = name.trim();
    const fileToSave = file;
    setBusy(true); setError('');
    try {
      const path = await signedUpload('architecture', fileToSave, { style: style.name, buildingName: nameToSave });
      const saveRes = await fetch('/api/team/architecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, style: style.name, buildingName: nameToSave }) });
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
      <label className={`file-button ${busy ? 'disabled' : ''}`}>Foto machen<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Gebäudename<input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
      <button className="secondary" disabled={busy}>{busy ? 'Lädt…' : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form> : <div className="locked-notice">Zeit abgelaufen.</div>}
  </article>;
}
'''
new_arch = '''export function ArchitectureTab({ entries, refresh, locked, scoring }: { entries: ArchitectureEntry[]; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
  const visibleEntries = [...entries].filter(isDrinkEntry).sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime());
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
      const path = await signedUpload('architecture', fileToSave, { drinkType, drinker: drinkerToSave });
      const saveRes = await fetch('/api/team/architecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, drinkType, drinker: drinkerToSave }) });
      const save = await saveRes.json();
      if (!saveRes.ok) throw new Error(save.error ?? 'Speichern fehlgeschlagen.');
      setFile(null); setDrinker('');
      const input = document.getElementById('guinness-drink-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (locked || !confirm('Foto wirklich löschen?')) return;
    await fetch('/api/team/architecture', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refresh();
  }

  return <section className="tab-page">
    <div className="tab-score-row"><span className="count-badge">{visibleEntries.length * scoring.architecturePerStyle} P.</span></div>
    <div className="rule-box">
      <b>Regeln</b>
      <p>Für jedes getrunkene Guinness oder jede Irish Car Bomb direkt in der App ein Foto hochladen.</p>
      <p>Dazu eintragen, wer es getrunken hat. Jeder gültige Eintrag zählt {scoring.architecturePerStyle} Punkt{scoring.architecturePerStyle === 1 ? '' : 'e'}.</p>
    </div>
    {!locked && <form className="upload-form" onSubmit={add}>
      <label className={`file-button ${busy ? 'disabled' : ''}`}>Foto machen<input id="guinness-drink-file" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {file && <span className="file-name">{file.name}</span>}
      <label>Getränk<select value={drinkType} disabled={busy} onChange={(e) => setDrinkType(e.target.value as 'guinness' | 'irish_car_bomb')}><option value="guinness">Guinness</option><option value="irish_car_bomb">Irish Car Bomb</option></select></label>
      <label>Wer hat es getrunken?<input value={drinker} disabled={busy} onChange={(e) => setDrinker(e.target.value)} placeholder="Name" /></label>
      <button className="primary" disabled={busy}>{busy ? 'Lädt…' : 'Hochladen'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>}
    {locked && <div className="locked-notice">Zeit abgelaufen.</div>}
    <div className="entry-list">{visibleEntries.map((entry) => <article className="photo-entry" key={entry.id}>
      {entry.image_url && <img src={entry.image_url} alt={drinkLabel(entry.style)} />}
      <small className="upload-time">Hochgeladen {formatUploadTime(entry.created_at)}</small>
      <div className="entry-row"><div><b>{drinkLabel(entry.style)}</b><div className="muted">{entry.building_name}</div></div>{!locked && <button className="danger-link" onClick={() => remove(entry.id)}>Löschen</button>}</div>
    </article>)}</div>
  </section>;
}
'''
s = replace_once(s, old_arch, new_arch, 'ArchitectureTab block')
s = s.replace("import type { RallyeConfig, ScoringConfig } from '@/lib/types';", "import type { ScoringConfig } from '@/lib/types';")
write('components/ChallengeTabs.tsx', s)

# components/RallyeApp.tsx
s = read('components/RallyeApp.tsx')
s = replace_once(s,
'''  beers: Array<{ id: string; brand: string; image_url: string | null }>;
  guinness: Array<{ id: string; street: string; image_url: string | null }>;
  architecture: Array<{ id: string; style: string; building_name: string; image_url: string | null }>;
''',
'''  beers: Array<{ id: string; brand: string; image_url: string | null; created_at?: string }>;
  guinness: Array<{ id: string; street: string; image_url: string | null; created_at?: string }>;
  architecture: Array<{ id: string; style: string; building_name: string; image_url: string | null; created_at?: string }>;
''', 'RallyeApp state types')
s = replace_once(s,
'''      <div><span className="eyebrow">{teamName}</span><h1>{tab === 'rallye' ? 'Rallye' : tab === 'guinness' ? 'Guinness' : tab === 'architecture' ? 'Architektur' : 'Wegbier'}</h1></div>''',
'''      <div><span className="eyebrow">{teamName}</span><h1>{tab === 'rallye' ? 'Rallye' : tab === 'guinness' ? 'Guinness' : tab === 'architecture' ? 'Guinness trinken' : 'Wegbier'}</h1></div>''', 'RallyeApp title')
s = replace_once(s,
'''      {tab === 'architecture' && <ArchitectureTab entries={state.architecture} styles={config.architectureStyles} refresh={refresh} locked={localLocked} scoring={state.scoring} />}''',
'''      {tab === 'architecture' && <ArchitectureTab entries={state.architecture} refresh={refresh} locked={localLocked} scoring={state.scoring} />}''', 'RallyeApp ArchitectureTab props')
s = replace_once(s,
'''      <button className={tab === 'architecture' ? 'active' : ''} onClick={() => setTab('architecture')}><span>⌂</span>Architektur</button>''',
'''      <button className={tab === 'architecture' ? 'active' : ''} onClick={() => setTab('architecture')}><span>⌂</span>Guinness trinken</button>''', 'RallyeApp tab button')
write('components/RallyeApp.tsx', s)

# IntroModal
s = read('components/IntroModal.tsx')
s = replace_once(s,
'''          <li><b>Guinness:</b> Außen-Schilder mit Guinness-Logos verschiedener Pubs fotografieren und direkt in der App hochladen. Harfe + Guinness-Schriftzug müssen sichtbar sein.</li>
          <li><b>Architektur:</b> 5 Gebäude der vorgegebenen Stile fotografieren und direkt in der App hochladen.</li>
          <li><b>Wegbier:</b> Verschiedene Dosenbiere trinken, direkt in der App fotografieren und eintragen. Kein Radler, Cider oder alkoholfreies Bier.</li>
''',
'''          <li><b>Guinness-Logos:</b> Außen-Schilder mit Guinness-Logos verschiedener Pubs fotografieren und direkt in der App hochladen. Harfe + Guinness-Schriftzug müssen sichtbar sein.</li>
          <li><b>Guinness trinken:</b> Jedes Guinness oder jede Irish Car Bomb direkt in der App fotografieren und eintragen, wer es getrunken hat.</li>
          <li><b>Wegbier:</b> Verschiedene Dosenbiere trinken, direkt in der App fotografieren und eintragen. Kein Radler, Cider oder alkoholfreies Bier.</li>
''', 'IntroModal challenges')
write('components/IntroModal.tsx', s)

# upload-ticket
s = read('app/api/team/upload-ticket/route.ts')
s = replace_once(s,
'''  } else if (kind === 'architecture') {
    const style = String(body.style ?? '').trim();
    const buildingName = String(body.buildingName ?? '').trim();
    const styleNames = rallyeConfig.architectureStyles.map((s) => s.name);
    if (!buildingName || !styleNames.includes(style)) return bad('Stil oder Gebäudename fehlt.');
    const { data: existing } = await db.from('architecture_entries').select('id').eq('team_id', session.teamId).eq('style', style).maybeSingle();
    if (existing) return bad('Für diesen Stil gibt es schon ein Foto.');
    folder = 'architecture';
''',
'''  } else if (kind === 'architecture') {
    const drinkType = String(body.drinkType ?? '').trim();
    const drinker = String(body.drinker ?? '').trim();
    if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType)) return bad('Getränk oder Name fehlt.');
    folder = 'architecture';
''', 'upload-ticket architecture branch')
s = s.replace("import { rallyeConfig } from '@/lib/config';\n", '')
write('app/api/team/upload-ticket/route.ts', s)

# team architecture route
s = read('app/api/team/architecture/route.ts')
s = replace_once(s,
"import { rallyeConfig } from '@/lib/config';\n",
"import { randomUUID } from 'crypto';\n", 'architecture import')
s = replace_once(s,
'''  const body = await request.json().catch(() => ({}));
  const style = String(body.style ?? '').trim();
  const buildingName = String(body.buildingName ?? '').trim();
  const path = String(body.path ?? '');
  const styleNames = rallyeConfig.architectureStyles.map((s) => s.name);
  if (!buildingName || !styleNames.includes(style) || !path.startsWith(`${session.teamId}/architecture/`)) return bad('Ungültige Daten.');

  const db = supabaseAdmin();
  const insert = await db.from('architecture_entries').insert({ team_id: session.teamId, style, building_name: buildingName, storage_path: path }).select('*').single();
''',
'''  const body = await request.json().catch(() => ({}));
  const drinkType = String(body.drinkType ?? '').trim();
  const drinker = String(body.drinker ?? '').trim();
  const path = String(body.path ?? '');
  if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType) || !path.startsWith(`${session.teamId}/architecture/`)) return bad('Ungültige Daten.');

  const db = supabaseAdmin();
  const style = `drink:${drinkType}:${randomUUID()}`;
  const insert = await db.from('architecture_entries').insert({ team_id: session.teamId, style, building_name: drinker, storage_path: path }).select('*').single();
''', 'architecture POST')
s = replace_once(s,
'''    return bad(insert.error.code === '23505' ? 'Für diesen Stil gibt es schon ein Foto.' : insert.error.message);
''',
'''    return bad(insert.error.message);
''', 'architecture duplicate message')
write('app/api/team/architecture/route.ts', s)

# AdminApp
s = read('components/AdminApp.tsx')
s = replace_once(s,
'''  architecture: Array<{ id: string; team_id: string; style: string; building_name: string; image_url?: string | null }>;
''',
'''  architecture: Array<{ id: string; team_id: string; style: string; building_name: string; image_url?: string | null; created_at?: string }>;
''', 'AdminApp architecture type')
s = replace_once(s,
'''function evaluationIsValid(teamId: string, itemType: EvalType, itemId: string) { return overview?.evaluations.some((e) => e.team_id === teamId && e.item_type === itemType && e.item_id === itemId && e.is_valid) ?? false; }

  const scoring = overview?.scoring;
''',
'''function evaluationIsValid(teamId: string, itemType: EvalType, itemId: string) { return overview?.evaluations.some((e) => e.team_id === teamId && e.item_type === itemType && e.item_id === itemId && e.is_valid) ?? false; }
  function isDrinkEntry(entry: { style: string }) { return entry.style.startsWith('drink:'); }
  function drinkLabel(style: string) { return style.startsWith('drink:irish_car_bomb:') ? 'Irish Car Bomb' : 'Guinness'; }

  const scoring = overview?.scoring;
''', 'AdminApp helpers')
s = replace_once(s,
'''    const architecture = overview.architecture.filter((a) => a.team_id === teamId && evaluationIsValid(teamId, 'architecture', a.id)).length * scoring.architecturePerStyle;
''',
'''    const architecture = overview.architecture.filter((a) => a.team_id === teamId && isDrinkEntry(a) && evaluationIsValid(teamId, 'architecture', a.id)).length * scoring.architecturePerStyle;
''', 'AdminApp teamScore architecture')
s = replace_once(s,
'''        <label>Architektur / Stil<input type="number" min="0" value={scoringDraft.architecturePerStyle} onChange={(e) => setScoreField('architecturePerStyle', Number(e.target.value))} /></label>
''',
'''        <label>Guinness trinken / Getränk<input type="number" min="0" value={scoringDraft.architecturePerStyle} onChange={(e) => setScoreField('architecturePerStyle', Number(e.target.value))} /></label>
''', 'AdminApp scoring label')
s = replace_once(s,
'''      <div className="results-grid two-team-results">{overview.teams.map((team) => { const score = teamScore(team.id); return <article className="result-card" key={team.id}><div><span className="eyebrow">{team.name}</span><strong>{score.total} P.</strong></div><p>Hinweise {score.hints} · Stationen {score.stations} · Quiz {score.quiz} · Guinness {score.guinness} · Architektur {score.architecture} · Wegbier {score.beer}</p></article>; })}</div>
''',
'''      <div className="results-grid two-team-results">{overview.teams.map((team) => { const score = teamScore(team.id); return <article className="result-card" key={team.id}><div><span className="eyebrow">{team.name}</span><strong>{score.total} P.</strong></div><p>Hinweise {score.hints} · Stationen {score.stations} · Quiz {score.quiz} · Guinness {score.guinness} · Guinness trinken {score.architecture} · Wegbier {score.beer}</p></article>; })}</div>
''', 'AdminApp results label')
s = replace_once(s,
'''      <h3>Architektur</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.architecture.filter((a) => a.team_id === team.id).map((a) => <article className="evaluation-photo-entry" key={a.id}>{a.image_url && <img src={a.image_url} alt={a.style} />}<b>{a.style}</b><span>{a.building_name}</span><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'architecture', a.id)} onChange={(e) => setEvaluation(team.id, 'architecture', a.id, e.target.checked)} /> Gültig (+{scoring.architecturePerStyle} P.)</label></article>)}</div>)}
''',
'''      <h3>Guinness trinken</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.architecture.filter((a) => a.team_id === team.id && isDrinkEntry(a)).map((a) => <article className="evaluation-photo-entry" key={a.id}>{a.image_url && <img src={a.image_url} alt={drinkLabel(a.style)} />}<b>{drinkLabel(a.style)}</b><span>{a.building_name}</span>{a.created_at && <small>Hochgeladen {new Date(a.created_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</small>}<label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'architecture', a.id)} onChange={(e) => setEvaluation(team.id, 'architecture', a.id, e.target.checked)} /> Gültig (+{scoring.architecturePerStyle} P.)</label></article>)}</div>)}
''', 'AdminApp evaluation block')
write('components/AdminApp.tsx', s)

# globals.css
s = read('app/globals.css')
if '.upload-time' not in s:
    s += '\n.upload-time { display: block; margin: 6px 0 4px; color: var(--muted); font-size: 12px; }\n'
write('app/globals.css', s)

print('Fertig.')