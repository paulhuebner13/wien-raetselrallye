import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const targetFiles = [
  'components/ChallengeTabs.tsx',
  'components/RallyeApp.tsx',
  'components/IntroModal.tsx',
  'app/api/team/upload-ticket/route.ts',
  'app/api/team/architecture/route.ts',
  'components/AdminApp.tsx',
  'app/globals.css',
];
const backupDir = path.join(root, '.guinness-tab-backup');
fs.rmSync(backupDir, { recursive: true, force: true });
for (const rel of targetFiles) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) throw new Error(`Datei fehlt: ${rel}`);
  const dst = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
let finished = false;
process.on('uncaughtException', (error) => {
  if (!finished) {
    for (const rel of targetFiles) {
      const src = path.join(backupDir, rel);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(root, rel));
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  console.error(`FEHLER: ${error.message}`);
  console.error('Alle bereits vorgenommenen Änderungen dieses Scripts wurden zurückgesetzt.');
  process.exit(1);
});

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Datei fehlt: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(path.join(root, rel), text, 'utf8');
  console.log(`Geändert: ${rel}`);
}

function replaceBetween(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Nicht gefunden: ${label} (Start)`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Nicht gefunden: ${label} (Ende)`);
  return text.slice(0, start) + replacement.trimEnd() + '\n\n' + text.slice(end);
}

function replaceRegex(text, regex, replacement, label, required = true) {
  if (!regex.test(text)) {
    if (required) throw new Error(`Nicht gefunden: ${label}`);
    return text;
  }
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

// 1) ChallengeTabs: Architektur-UI gezielt durch Guinness-Trinken ersetzen.
{
  let s = read('components/ChallengeTabs.tsx');

  if (!s.includes("import LoadingSpinner from '@/components/LoadingSpinner';")) {
    s = s.replace("import { supabaseBrowser } from '@/lib/supabase-browser';", "import { supabaseBrowser } from '@/lib/supabase-browser';\nimport LoadingSpinner from '@/components/LoadingSpinner';");
  }

  s = s.replace("import type { RallyeConfig, ScoringConfig } from '@/lib/types';", "import type { ScoringConfig } from '@/lib/types';");

  s = replaceRegex(s, /type GuinnessEntry = \{[^\n]+\};/, "type GuinnessEntry = { id: string; street: string; image_url: string | null; created_at?: string };", 'GuinnessEntry');
  s = replaceRegex(s, /type ArchitectureEntry = \{[^\n]+\};/, "type ArchitectureEntry = { id: string; style: string; building_name: string; image_url: string | null; created_at?: string };", 'ArchitectureEntry');
  s = replaceRegex(s, /type Beer = \{[^\n]+\};/, "type Beer = { id: string; brand: string; image_url: string | null; created_at?: string };", 'Beer');

  if (!s.includes('function formatUploadTime(')) {
    const beerType = "type Beer = { id: string; brand: string; image_url: string | null; created_at?: string };";
    const helpers = `

function formatUploadTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function isDrinkEntry(entry: ArchitectureEntry) {
  return entry.style.startsWith('drink:');
}

function drinkLabel(style: string) {
  return style.startsWith('drink:irish_car_bomb:') ? 'Irish Car Bomb' : 'Guinness';
}`;
    s = s.replace(beerType, beerType + helpers);
  }

  // Upload-Uhrzeit bei Guinness-Logos ergänzen.
  if (!s.includes('formatUploadTime(entry.created_at)')) {
    s = s.replace(
      /({entry\.image_url && <img src={entry\.image_url} alt="Guinness-Schild" \/>}\r?\n)(\s*<div className="entry-row">)/,
      '$1      <small className="upload-time">Hochgeladen {formatUploadTime(entry.created_at)}</small>\n$2'
    );
  }

  const newDrinkTab = `export function ArchitectureTab({ entries, refresh, locked, scoring }: { entries: ArchitectureEntry[]; refresh: () => Promise<void>; locked: boolean; scoring: ScoringConfig }) {
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
      <label className={\`file-button \${busy ? 'disabled' : ''}\`}>Foto machen<input id="guinness-drink-file" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
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
}`;

  s = replaceBetween(s, 'export function ArchitectureTab(', 'export function BeerTab(', newDrinkTab, 'ArchitectureTab → Guinness trinken');

  // Upload-Uhrzeit bei Wegbier ergänzen.
  if (!s.includes('formatUploadTime(beer.created_at)')) {
    s = s.replace(
      /({beer\.image_url && <img src={beer\.image_url} alt={beer\.brand} \/>}\r?\n)(\s*<div className="entry-row">)/,
      '$1      <small className="upload-time">Hochgeladen {formatUploadTime(beer.created_at)}</small>\n$2'
    );
  }

  write('components/ChallengeTabs.tsx', s);
}

// 2) Navigation: Architektur-Tab sichtbar zu "Trinken" umbenennen.
{
  let s = read('components/RallyeApp.tsx');

  s = s.replace(/architecture: Array<\{ id: string; style: string; building_name: string; image_url: string \| null(?:; created_at\?: string)? \}>;/,
    "architecture: Array<{ id: string; style: string; building_name: string; image_url: string | null; created_at?: string }>;"
  );
  s = s.replace(/guinness: Array<\{ id: string; street: string; image_url: string \| null(?:; created_at\?: string)? \}>;/,
    "guinness: Array<{ id: string; street: string; image_url: string | null; created_at?: string }>;"
  );
  s = s.replace(/beers: Array<\{ id: string; brand: string; image_url: string \| null(?:; created_at\?: string)? \}>;/,
    "beers: Array<{ id: string; brand: string; image_url: string | null; created_at?: string }>;"
  );

  s = s.replace("tab === 'architecture' ? 'Architektur'", "tab === 'architecture' ? 'Guinness trinken'");
  s = s.replace(/<ArchitectureTab entries=\{state\.architecture\} styles=\{config\.architectureStyles\} refresh=\{refresh\} locked=\{localLocked\} scoring=\{state\.scoring\} \/>/,
    '<ArchitectureTab entries={state.architecture} refresh={refresh} locked={localLocked} scoring={state.scoring} />'
  );
  s = s.replace(/(<button className=\{tab === 'architecture' \? 'active' : ''\} onClick=\{\(\) => setTab\('architecture'\)\}><span>.*?<\/span>)Architektur(<\/button>)/,
    '$1Trinken$2'
  );

  write('components/RallyeApp.tsx', s);
}

// 3) Regelübersicht: Architektur entfernen, Getränk-Challenge einsetzen.
{
  let s = read('components/IntroModal.tsx');
  s = s.replace(/<li><b>Guinness:<\/b>/, '<li><b>Guinness-Logos:</b>');
  s = replaceRegex(s,
    /\s*<li><b>Architektur:<\/b>.*?<\/li>/,
    "\n          <li><b>Guinness trinken:</b> Guinness oder Irish Car Bomb fotografieren und eintragen, wer es getrunken hat.</li>",
    'Architektur-Regel'
  );
  write('components/IntroModal.tsx', s);
}

// 4) Upload-Ticket: bisheriger Architektur-Upload wird intern für Getränke genutzt.
{
  let s = read('app/api/team/upload-ticket/route.ts');
  s = s.replace("import { rallyeConfig } from '@/lib/config';\n", '');

  const start = "  } else if (kind === 'architecture') {";
  const end = "  } else if (kind === 'beer') {";
  const startIndex = s.indexOf(start);
  const endIndex = s.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error('Upload-Ticket: architecture-Branch nicht gefunden.');

  const replacement = `  } else if (kind === 'architecture') {
    const drinkType = String(body.drinkType ?? '').trim();
    const drinker = String(body.drinker ?? '').trim();
    if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType)) return bad('Getränk oder Name fehlt.');
    folder = 'architecture';
`;
  s = s.slice(0, startIndex) + replacement + s.slice(endIndex);
  write('app/api/team/upload-ticket/route.ts', s);
}

// 5) Bestehende Architecture-API intern zu Guinness/Irish-Car-Bomb-API umfunktionieren.
{
  const s = `import { randomUUID } from 'crypto';
import { deadlinePassed } from '@/lib/deadline';
import { bad, ok } from '@/lib/http';
import { requireTeam } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const body = await request.json().catch(() => ({}));
  const drinkType = String(body.drinkType ?? '').trim();
  const drinker = String(body.drinker ?? '').trim();
  const storagePath = String(body.path ?? '');
  if (!drinker || !['guinness', 'irish_car_bomb'].includes(drinkType) || !storagePath.startsWith(\`${'${session.teamId}'}/architecture/\`)) return bad('Ungültige Daten.');

  const db = supabaseAdmin();
  const style = \`drink:${'${drinkType}'}:${'${randomUUID()}'}\`;
  const insert = await db.from('architecture_entries').insert({
    team_id: session.teamId,
    style,
    building_name: drinker,
    storage_path: storagePath,
  }).select('*').single();

  if (insert.error) {
    await db.storage.from('team-uploads').remove([storagePath]);
    return bad(insert.error.message);
  }
  return ok({ entry: insert.data });
}

export async function DELETE(request: Request) {
  const session = await requireTeam();
  if (!session) return bad('Nicht angemeldet.', 401);
  if (await deadlinePassed()) return bad('Zeit abgelaufen.', 403);
  const { id } = await request.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data } = await db.from('architecture_entries').select('storage_path,style').eq('id', String(id)).eq('team_id', session.teamId).maybeSingle();
  if (!data || !String(data.style).startsWith('drink:')) return bad('Eintrag nicht gefunden.', 404);
  await db.storage.from('team-uploads').remove([data.storage_path]);
  const { error } = await db.from('architecture_entries').delete().eq('id', String(id)).eq('team_id', session.teamId);
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
`;
  write('app/api/team/architecture/route.ts', s);
}

// 6) Admin: alte Architektur-Einträge ausblenden, neue Getränk-Einträge bewerten.
{
  let s = read('components/AdminApp.tsx');

  s = s.replace(/architecture: Array<\{ id: string; team_id: string; style: string; building_name: string; image_url\?: string \| null(?:; created_at\?: string)? \}>;/,
    "architecture: Array<{ id: string; team_id: string; style: string; building_name: string; image_url?: string | null; created_at?: string }>;"
  );

  if (!s.includes('function isDrinkEntry(')) {
    const marker = "  function evaluationIsValid(teamId: string, itemType: EvalType, itemId: string)";
    const pos = s.indexOf(marker);
    if (pos < 0) throw new Error('AdminApp: evaluationIsValid nicht gefunden.');
    const lineEnd = s.indexOf('\n', pos);
    s = s.slice(0, lineEnd + 1) +
      "  function isDrinkEntry(entry: { style: string }) { return entry.style.startsWith('drink:'); }\n" +
      "  function drinkLabel(style: string) { return style.startsWith('drink:irish_car_bomb:') ? 'Irish Car Bomb' : 'Guinness'; }\n" +
      s.slice(lineEnd + 1);
  }

  s = s.replace(
    /const architecture = overview\.architecture\.filter\(\(a\) => a\.team_id === teamId && evaluationIsValid\(teamId, 'architecture', a\.id\)\)\.length \* scoring\.architecturePerStyle;/,
    "const architecture = overview.architecture.filter((a) => a.team_id === teamId && isDrinkEntry(a) && evaluationIsValid(teamId, 'architecture', a.id)).length * scoring.architecturePerStyle;"
  );

  s = s.replace(
    `<label>Architektur / Stil<input type="number" min="0" value={scoringDraft.architecturePerStyle} onChange={(e) => setScoreField('architecturePerStyle', Number(e.target.value))} /></label>`,
    `<label>Guinness trinken / Getränk<input type="number" min="0" value={scoringDraft.architecturePerStyle} onChange={(e) => setScoreField('architecturePerStyle', Number(e.target.value))} /></label>`
  );
  s = s.replace('· Architektur {score.architecture}', '· Guinness trinken {score.architecture}');

  const start = s.indexOf('      <h3>Architektur</h3>');
  const end = s.indexOf('      <h3>Wegbier</h3>', start);
  if (start < 0 || end < 0) throw new Error('AdminApp: Architektur-Auswertung nicht gefunden.');

  const adminDrinkBlock = `      <h3>Guinness trinken</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.architecture.filter((a) => a.team_id === team.id && isDrinkEntry(a)).map((a) => <article className="evaluation-photo-entry" key={a.id}>{a.image_url && <img src={a.image_url} alt={drinkLabel(a.style)} />}<b>{drinkLabel(a.style)}</b><span>{a.building_name}</span>{a.created_at && <small>Hochgeladen {new Date(a.created_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</small>}<label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'architecture', a.id)} onChange={(e) => setEvaluation(team.id, 'architecture', a.id, e.target.checked)} /> Gültig (+{scoring.architecturePerStyle} P.)</label></article>)}</div>)}
`;
  s = s.slice(0, start) + adminDrinkBlock + s.slice(end);

  write('components/AdminApp.tsx', s);
}

// 7) Kleine Zeitangabe stylen.
{
  let s = read('app/globals.css');
  if (!s.includes('.upload-time {')) {
    s += '\n.upload-time { display: block; margin: 6px 0 4px; color: var(--muted); font-size: 11px; font-weight: 400; }\n';
  }
  write('app/globals.css', s);
}

console.log('');
console.log('Fertig. Keine Supabase-SQL-Änderung nötig.');
console.log('Danach: npm.cmd run build');
finished = true;
fs.rmSync(backupDir, { recursive: true, force: true });
