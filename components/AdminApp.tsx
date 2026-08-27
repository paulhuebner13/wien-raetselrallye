'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { blockLabel, questionBlocks, questionPoints, rallyeConfig, scoringConfig, stationTaskPoints } from '@/lib/config';
import type { Question } from '@/lib/types';

type EvalType = 'question' | 'station' | 'guinness' | 'architecture' | 'beer';
type Team = { id: string; name: string; station_order: number[] | null };
type Overview = {
  teams: Team[];
  progress: Array<{ team_id: string; station_id: number; answer: string | null; submitted_at: string | null; hints_used: number; score_percent: number | null }>;
  quiz: Array<{ team_id: string; question_id: string; answer: string }>;
  beers: Array<{ id: string; team_id: string; brand: string; image_url?: string | null }>;
  guinness: Array<{ id: string; team_id: string; street: string; image_url?: string | null }>;
  architecture: Array<{ id: string; team_id: string; style: string; building_name: string; image_url?: string | null }>;
  evaluations: Array<{ team_id: string; item_type: EvalType; item_id: string; is_valid: boolean }>;
  deadlineAt: string | null;
};

type Constraint = { id: number; a: string; b: string; mode: 'together' | 'apart' };

function defaultOrder() { return rallyeConfig.stations.map((s) => s.id); }

function validConfiguredOrder(order: number[] | null | undefined) {
  if (!Array.isArray(order)) return false;
  const ids = rallyeConfig.stations.map((s) => s.id);
  return order.length === ids.length && new Set(order).size === ids.length && ids.every((id) => order.includes(id));
}

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}

function parseNames(raw: string) { return [...new Set(raw.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))]; }

function parseList(raw: string | undefined, count: number) {
  try {
    const data = JSON.parse(raw ?? '');
    if (Array.isArray(data)) return Array.from({ length: count }, (_, i) => String(data[i] ?? ''));
  } catch {}
  return Array(count).fill('') as string[];
}

function parseMap(raw: string | undefined) {
  try {
    const data = JSON.parse(raw ?? '');
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, string>;
  } catch {}
  return {} as Record<string, string>;
}

function generateTeams(names: string[], teamCount: number, constraints: Constraint[]) {
  if (teamCount < 2 || teamCount > names.length) throw new Error('Teamanzahl ungültig.');
  const nameSet = new Set(names);
  for (const c of constraints) if (!nameSet.has(c.a) || !nameSet.has(c.b)) throw new Error(`Name in Paar fehlt: ${c.a} / ${c.b}`);

  const parent = new Map(names.map((n) => [n, n]));
  const find = (x: string): string => { const p = parent.get(x)!; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  constraints.filter((c) => c.mode === 'together').forEach((c) => union(c.a, c.b));

  const groupMap = new Map<string, string[]>();
  names.forEach((n) => { const r = find(n); groupMap.set(r, [...(groupMap.get(r) ?? []), n]); });
  const groups = [...groupMap.values()];
  const apart = constraints.filter((c) => c.mode === 'apart');
  for (const c of apart) if (find(c.a) === find(c.b)) throw new Error(`${c.a} und ${c.b} müssen zusammen und getrennt sein.`);

  const base = Math.floor(names.length / teamCount);
  const extra = names.length % teamCount;
  const capacities = Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
  if (groups.some((g) => g.length > Math.max(...capacities))) throw new Error('Eine Zusammen-Gruppe ist zu groß.');

  const conflicts = (members: string[], group: string[]) => apart.some((c) =>
    (members.includes(c.a) && group.includes(c.b)) || (members.includes(c.b) && group.includes(c.a)),
  );

  for (let attempt = 0; attempt < 500; attempt++) {
    const order = [...groups].sort((a, b) => b.length - a.length || Math.random() - .5);
    const caps = [...capacities].sort(() => Math.random() - .5);
    const teams = Array.from({ length: teamCount }, () => [] as string[]);
    const backtrack = (i: number): boolean => {
      if (i === order.length) return true;
      const group = order[i];
      const candidates = teams.map((_, idx) => idx).sort(() => Math.random() - .5);
      for (const idx of candidates) {
        if (teams[idx].length + group.length > caps[idx] || conflicts(teams[idx], group)) continue;
        teams[idx].push(...group);
        if (backtrack(i + 1)) return true;
        teams[idx].splice(teams[idx].length - group.length, group.length);
      }
      return false;
    };
    if (backtrack(0)) return teams;
  }
  throw new Error('Keine gültige Auslosung gefunden. Constraints prüfen.');
}

export default function AdminApp({ initiallyLoggedIn }: { initiallyLoggedIn: boolean }) {
  const [loggedIn, setLoggedIn] = useState(initiallyLoggedIn);
  const [password, setPassword] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [name, setName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [error, setError] = useState('');
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [playerText, setPlayerText] = useState('');
  const [drawTeamCount, setDrawTeamCount] = useState(2);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [pairA, setPairA] = useState('');
  const [pairB, setPairB] = useState('');
  const [pairMode, setPairMode] = useState<'together' | 'apart'>('apart');
  const [drawResult, setDrawResult] = useState<string[][] | null>(null);
  const [drawError, setDrawError] = useState('');

  const load = useCallback(async () => {
    if (!loggedIn) return;
    const res = await fetch('/api/admin/overview', { cache: 'no-store' });
    if (res.status === 401) { setLoggedIn(false); return; }
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Fehler.');
    setOverview(data);
    setDeadlineLocal(toLocalInput(data.deadlineAt));
    setOrderInputs(Object.fromEntries((data.teams as Team[]).map((t) => [t.id, (validConfiguredOrder(t.station_order) ? t.station_order! : defaultOrder()).join(', ')])));
  }, [loggedIn]);

  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!res.ok) return setError('Falsches Passwort.');
    setLoggedIn(true); setPassword('');
  }
  async function logout() { await fetch('/api/admin/logout', { method: 'POST' }); setLoggedIn(false); setOverview(null); }
  async function addTeam(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password: teamPassword }) });
    const data = await res.json(); if (!res.ok) return setError(data.error ?? 'Fehler.');
    setName(''); setTeamPassword(''); await load();
  }
  async function deleteTeam(id: string, teamName: string) {
    if (!confirm(`${teamName} wirklich löschen? Alle Daten werden gelöscht.`)) return;
    await fetch('/api/admin/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); await load();
  }
  async function resetStation(teamId: string, stationId: number) {
    if (!confirm('Stationsantwort zurücksetzen?')) return;
    await fetch('/api/admin/reset-station', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, stationId }) }); await load();
  }
  async function saveDeadline() {
    const deadlineAt = deadlineLocal ? new Date(deadlineLocal).toISOString() : null;
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadlineAt }) });
    if (!res.ok) return setError((await res.json()).error ?? 'Fehler.'); await load();
  }
  async function saveOrder(teamId: string) {
    const stationOrder = (orderInputs[teamId] ?? '').split(',').map((x) => Number(x.trim())).filter(Number.isFinite);
    const res = await fetch('/api/admin/team-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, stationOrder }) });
    const data = await res.json(); if (!res.ok) return setError(data.error ?? 'Fehler.'); await load();
  }
  async function setEvaluation(teamId: string, itemType: EvalType, itemId: string, isValid: boolean) {
    const res = await fetch('/api/admin/evaluation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, itemType, itemId, isValid }) });
    if (!res.ok) return setError((await res.json()).error ?? 'Fehler.');
    setOverview((current) => current ? { ...current, evaluations: [
      ...current.evaluations.filter((e) => !(e.team_id === teamId && e.item_type === itemType && e.item_id === itemId)),
      { team_id: teamId, item_type: itemType, item_id: itemId, is_valid: isValid },
    ] } : current);
  }
  function evaluationIsValid(teamId: string, itemType: EvalType, itemId: string) {
    return overview?.evaluations.some((e) => e.team_id === teamId && e.item_type === itemType && e.item_id === itemId && e.is_valid) ?? false;
  }

  function specialQuestionScore(teamId: string, q: Question) {
    if (q.type === 'picture_round') {
      const count = (q.images ?? []).filter((_, i) => evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)).length;
      return count === 8 ? 2 : count > 4 ? 1 : 0;
    }
    if (q.type === 'music_round') {
      return (q.tracks ?? []).filter((_, i) => evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)).length;
    }
    return evaluationIsValid(teamId, 'question', q.id) ? questionPoints(q.id) : 0;
  }

  function teamScore(teamId: string) {
    if (!overview) return { total: 0, hints: 0, stations: 0, quiz: 0, guinness: 0, architecture: 0, beer: 0 };
    const progress = overview.progress.filter((p) => p.team_id === teamId);
    const hints = progress.reduce((sum, p) => sum + (p.submitted_at ? Math.max(0, scoringConfig.hintPointsMax - (p.hints_used ?? 0)) : 0), 0);
    const stations = rallyeConfig.stations.reduce((sum, station) => sum + (evaluationIsValid(teamId, 'station', String(station.id)) ? stationTaskPoints(station.id) : 0), 0);
    const quiz = questionBlocks.flatMap((b) => b.questions).reduce((sum, q) => sum + specialQuestionScore(teamId, q), 0);
    const guinness = overview.guinness.filter((g) => g.team_id === teamId && evaluationIsValid(teamId, 'guinness', g.id)).length * scoringConfig.guinnessPerLogo;
    const architecture = overview.architecture.filter((a) => a.team_id === teamId && evaluationIsValid(teamId, 'architecture', a.id)).length * scoringConfig.architecturePerStyle;
    const beer = overview.beers.filter((b) => b.team_id === teamId && evaluationIsValid(teamId, 'beer', b.id)).length * scoringConfig.beerPerUniqueCan;
    return { total: hints + stations + quiz + guinness + architecture + beer, hints, stations, quiz, guinness, architecture, beer };
  }

  const players = useMemo(() => parseNames(playerText), [playerText]);
  function addConstraint() {
    if (!pairA || !pairB || pairA === pairB) return setDrawError('Zwei verschiedene Spieler wählen.');
    setConstraints((x) => [...x, { id: Date.now(), a: pairA, b: pairB, mode: pairMode }]); setPairA(''); setPairB(''); setDrawError('');
  }
  function drawTeams() {
    setDrawError('');
    try { setDrawResult(generateTeams(players, drawTeamCount, constraints)); }
    catch (e) { setDrawResult(null); setDrawError(e instanceof Error ? e.message : 'Auslosung fehlgeschlagen.'); }
  }

  function renderQuestionEvaluation(teamId: string, q: Question, rawAnswer: string | undefined) {
    if (q.type === 'picture_round') {
      const images = q.images ?? Array.from({ length: 8 }, (_, i) => `/picture-round/${i + 1}.png`);
      const values = parseList(rawAnswer, images.length);
      const correct = images.filter((_, i) => evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)).length;
      const points = correct === 8 ? 2 : correct > 4 ? 1 : 0;
      return <div className="special-eval-grid">
        {images.map((src, i) => <article className="special-eval-item" key={src}>
          <img src={src} alt={`Picture Round ${i + 1}`} />
          <b>{i + 1}. {values[i] || '—'}</b>
          <label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)} onChange={(e) => setEvaluation(teamId, 'question', `${q.id}:${i + 1}`, e.target.checked)} /> Richtig</label>
        </article>)}
        <strong className="special-score">{correct}/8 richtig → {points} P.</strong>
      </div>;
    }
    if (q.type === 'music_round') {
      const tracks = q.tracks ?? [];
      const values = parseList(rawAnswer, tracks.length);
      const correct = tracks.filter((_, i) => evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)).length;
      return <div className="special-eval-grid music-admin-grid">
        {tracks.map((track, i) => <article className="special-eval-item" key={track.src}>
          <b>{track.label}</b>
          <audio controls preload="none" src={track.src} />
          <span>{values[i] || '—'}</span>
          <label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)} onChange={(e) => setEvaluation(teamId, 'question', `${q.id}:${i + 1}`, e.target.checked)} /> Richtig</label>
        </article>)}
        <strong className="special-score">{correct}/2 richtig → {correct} P.</strong>
      </div>;
    }
    if (q.type === 'matching') {
      const values = parseMap(rawAnswer);
      return <div className="evaluation-answer matching-admin-answer">
        <div>{(q.items ?? []).map((item) => <span key={item}><b>{item}</b>: {values[item] || '—'}</span>)}</div>
        <label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(teamId, 'question', q.id)} onChange={(e) => setEvaluation(teamId, 'question', q.id, e.target.checked)} /> Richtig (+{questionPoints(q.id)} P.)</label>
      </div>;
    }
    return <div className="evaluation-answer"><strong>{rawAnswer || '—'}</strong><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(teamId, 'question', q.id)} onChange={(e) => setEvaluation(teamId, 'question', q.id, e.target.checked)} /> Richtig (+{questionPoints(q.id)} P.)</label></div>;
  }

  if (!loggedIn) return <main className="login-shell"><section className="login-card"><div className="eyebrow">ADMIN</div><h1>Rätselrallye</h1><form className="stack" onSubmit={login}><label>Passwort<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error-text">{error}</p>}<button className="primary">Login</button></form></section></main>;
  if (!overview) return <main className="loading-screen">Lädt…</main>;

  return <main className="admin-shell">
    <header className="admin-header"><div><div className="eyebrow">ADMIN</div><h1>Übersicht</h1></div><button className="text-button" onClick={logout}>Logout</button></header>
    {error && <p className="error-text">{error}</p>}

    <section className="admin-panel">
      <h2>Zeitlimit</h2>
      <p className="muted">Beliebiger Zeitpunkt in Vergangenheit oder Zukunft. Ein neuer Zeitpunkt in der Zukunft entsperrt die Rallye wieder.</p>
      <div className="admin-inline"><input type="datetime-local" step="1" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} /><button className="primary" onClick={saveDeadline}>Speichern</button><button className="secondary" onClick={() => setDeadlineLocal('')}>Leeren</button></div>
    </section>

    <section className="admin-panel">
      <h2>Teams</h2>
      <form className="admin-team-form" onSubmit={addTeam}><input placeholder="Teamname" value={name} onChange={(e) => setName(e.target.value)} /><input placeholder="Passwort" value={teamPassword} onChange={(e) => setTeamPassword(e.target.value)} /><button className="primary">Hinzufügen</button></form>
      <div className="team-order-list">{overview.teams.map((t) => <div className="team-order-row" key={t.id}>
        <b>{t.name}</b><label>Stations-Reihenfolge<input value={orderInputs[t.id] ?? ''} onChange={(e) => setOrderInputs((x) => ({ ...x, [t.id]: e.target.value }))} /></label><button className="secondary" onClick={() => saveOrder(t.id)}>Speichern</button><button className="danger-link" onClick={() => deleteTeam(t.id, t.name)}>Löschen</button>
      </div>)}</div>
      <p className="muted">Alle Stations-IDs genau einmal, z. B. 2, 4, 1, 3. Johnny's Pub gehört nicht zur Reihenfolge.</p>
    </section>

    <section className="admin-panel">
      <h2>Teams auslosen</h2>
      <div className="draw-grid"><label>Spieler<textarea rows={8} value={playerText} onChange={(e) => setPlayerText(e.target.value)} placeholder={'Anna\nMax\nPaul\n…'} /></label><label>Anzahl Teams<input type="number" min="2" value={drawTeamCount} onChange={(e) => setDrawTeamCount(Math.max(2, Number(e.target.value) || 2))} /></label></div>
      <div className="constraint-form"><select value={pairA} onChange={(e) => setPairA(e.target.value)}><option value="">Spieler 1</option>{players.map((p) => <option key={p}>{p}</option>)}</select><select value={pairB} onChange={(e) => setPairB(e.target.value)}><option value="">Spieler 2</option>{players.map((p) => <option key={p}>{p}</option>)}</select><select value={pairMode} onChange={(e) => setPairMode(e.target.value as 'together' | 'apart')}><option value="apart">Nicht im selben Team</option><option value="together">Im selben Team</option></select><button className="secondary" onClick={addConstraint}>Paar hinzufügen</button></div>
      <div className="constraint-list">{constraints.map((c) => <span className="constraint-chip" key={c.id}>{c.a} + {c.b}: {c.mode === 'apart' ? 'getrennt' : 'zusammen'} <button onClick={() => setConstraints((x) => x.filter((v) => v.id !== c.id))}>×</button></span>)}</div>
      <button className="primary" onClick={drawTeams} disabled={players.length < 2}>Generieren</button>
      {drawError && <p className="error-text">{drawError}</p>}
      {drawResult && <div className="draw-result">{drawResult.map((members, i) => <article className="admin-card" key={i}><b>Team {String.fromCharCode(65 + i)}</b>{members.map((m) => <span key={m}>{m}</span>)}</article>)}</div>}
    </section>

    <section className="admin-panel"><h2>Quiz-Dateien</h2><p className="muted">Picture Round: <code>public/picture-round/1.png</code> bis <code>8.png</code>. Music Round: <code>public/music-round/1.mp3</code> und <code>2.mp3</code>.</p></section>

    <section className="admin-panel"><h2>Punkte</h2><p className="muted">Bearbeiten in <code>config/scoring.json</code>.</p><div className="score-summary"><span>Standardfrage: <b>{scoringConfig.questionDefault}</b></span><span>Picture Round: <b>0/1/2</b></span><span>Music Round: <b>0/1/2</b></span><span>Guinness: <b>{scoringConfig.guinnessPerLogo}/Logo</b></span><span>Architektur: <b>{scoringConfig.architecturePerStyle}/Stil</b></span><span>Wegbier: <b>{scoringConfig.beerPerUniqueCan}/Bier</b></span></div></section>

    <section className="admin-panel">
      <h2>Auswertung</h2>
      <div className="results-grid">{[...overview.teams].sort((a, b) => teamScore(b.id).total - teamScore(a.id).total).map((team) => {
        const score = teamScore(team.id);
        return <article className="result-card" key={team.id}><div><span className="eyebrow">{team.name}</span><strong>{score.total} P.</strong></div><p>Hinweise {score.hints} · Stationen {score.stations} · Quiz {score.quiz} · Guinness {score.guinness} · Architektur {score.architecture} · Wegbier {score.beer}</p></article>;
      })}</div>
    </section>

    {overview.teams.map((team) => {
      const progress = overview.progress.filter((p) => p.team_id === team.id);
      const answers = Object.fromEntries(overview.quiz.filter((q) => q.team_id === team.id).map((q) => [q.question_id, q.answer]));
      const beers = overview.beers.filter((b) => b.team_id === team.id);
      const guinness = overview.guinness.filter((g) => g.team_id === team.id);
      const architecture = overview.architecture.filter((a) => a.team_id === team.id);
      return <section className="admin-panel" key={team.id}>
        <h2>{team.name}</h2>
        <h3>Stationen</h3>
        <div className="admin-grid">{rallyeConfig.stations.map((station) => {
          const p = progress.find((x) => x.station_id === station.id);
          return <article className="admin-card" key={station.id}><b>{station.title}</b><p className="admin-answer">{p?.answer || '—'}</p><small>Hinweise: {p?.hints_used ?? 0} · Hinweispunkte: {p?.submitted_at ? Math.max(0, scoringConfig.hintPointsMax - (p?.hints_used ?? 0)) : 0}/{scoringConfig.hintPointsMax}</small><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'station', String(station.id))} onChange={(e) => setEvaluation(team.id, 'station', String(station.id), e.target.checked)} /> Vor-Ort-Antwort richtig (+{stationTaskPoints(station.id)} P.)</label><button className="secondary" onClick={() => resetStation(team.id, station.id)} disabled={!p?.submitted_at}>Antwort zurücksetzen</button></article>;
        })}</div>

        <h3>Quiz</h3>
        {questionBlocks.map((block) => <div key={block.id} className="admin-question-block"><b>{blockLabel(block)}</b><div className="admin-list">{block.questions.map((q) => <div key={q.id} className={`admin-answer-row ${q.type === 'picture_round' || q.type === 'music_round' ? 'special-question-row' : ''}`}><span><b>{q.category} · max. {questionPoints(q.id)} P.</b><br />{q.text}</span>{renderQuestionEvaluation(team.id, q, answers[q.id])}</div>)}</div></div>)}

        <h3>Guinness</h3>
        <div className="admin-photo-grid">{guinness.map((g) => <div className="admin-photo" key={g.id}>{g.image_url && <img src={g.image_url} alt="Guinness" />}<b>{g.street}</b><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'guinness', g.id)} onChange={(e) => setEvaluation(team.id, 'guinness', g.id, e.target.checked)} /> Gültig (+{scoringConfig.guinnessPerLogo} P.)</label></div>)}</div>
        <h3>Architektur</h3>
        <div className="admin-photo-grid">{architecture.map((a) => <div className="admin-photo" key={a.id}>{a.image_url && <img src={a.image_url} alt={a.style} />}<b>{a.style}</b><span>{a.building_name}</span><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'architecture', a.id)} onChange={(e) => setEvaluation(team.id, 'architecture', a.id, e.target.checked)} /> Gültig (+{scoringConfig.architecturePerStyle} P.)</label></div>)}</div>
        <h3>Wegbier</h3>
        <div className="admin-photo-grid">{beers.map((b) => <div className="admin-photo" key={b.id}>{b.image_url && <img src={b.image_url} alt={b.brand} />}<b>{b.brand}</b><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'beer', b.id)} onChange={(e) => setEvaluation(team.id, 'beer', b.id, e.target.checked)} /> Gültig (+{scoringConfig.beerPerUniqueCan} P.)</label></div>)}</div>
      </section>;
    })}
  </main>;
}
