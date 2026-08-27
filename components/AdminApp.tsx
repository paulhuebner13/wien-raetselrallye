'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { blockLabel, questionBlocks, questionMaxPoints, questionPoints, rallyeConfig, stationTaskPoints } from '@/lib/config';
import type { Question, ScoringConfig } from '@/lib/types';
import type { MusicRoundSettings } from '@/lib/music-round-settings';
import { parseMusicAnswer } from '@/lib/music-answer';

type EvalType = 'question' | 'station' | 'guinness' | 'architecture' | 'beer';
type Team = { id: string; name: string; station_order: number[] | null };
type Constraint = { id: number; a: string; b: string; mode: 'together' | 'apart' };
type DrawSettings = { playerText: string; teamCount: number; constraints: Constraint[]; drawResult: string[][] | null };
type QuizTimerSettings = { enabled: boolean; durations: Record<string, number> };
type NumericScoringKey = 'guinnessPerLogo' | 'architecturePerStyle' | 'beerPerUniqueCan' | 'pictureRoundPartialThreshold' | 'pictureRoundPartialPoints' | 'pictureRoundFullPoints';
type Overview = {
  teams: Team[];
  progress: Array<{ team_id: string; station_id: number; answer: string | null; submitted_at: string | null; hints_used: number; score_percent: number | null }>;
  quiz: Array<{ team_id: string; question_id: string; answer: string }>;
  beers: Array<{ id: string; team_id: string; brand: string; image_url?: string | null }>;
  guinness: Array<{ id: string; team_id: string; street: string; image_url?: string | null }>;
  architecture: Array<{ id: string; team_id: string; style: string; building_name: string; image_url?: string | null }>;
  evaluations: Array<{ team_id: string; item_type: EvalType; item_id: string; is_valid: boolean }>;
  deadlineAt: string | null;
  scoring: ScoringConfig;
  quizTimer: QuizTimerSettings;
  musicRoundSettings: MusicRoundSettings;
  drawSettings: DrawSettings | null;
};

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
  try { const data = JSON.parse(raw ?? ''); if (Array.isArray(data)) return Array.from({ length: count }, (_, i) => String(data[i] ?? '')); } catch {}
  return Array(count).fill('') as string[];
}
function parseMap(raw: string | undefined) {
  try { const data = JSON.parse(raw ?? ''); if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, string>; } catch {}
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
  const base = Math.floor(names.length / teamCount), extra = names.length % teamCount;
  const capacities = Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
  if (groups.some((g) => g.length > Math.max(...capacities))) throw new Error('Eine Zusammen-Gruppe ist zu groß.');
  const conflicts = (members: string[], group: string[]) => apart.some((c) => (members.includes(c.a) && group.includes(c.b)) || (members.includes(c.b) && group.includes(c.a)));
  for (let attempt = 0; attempt < 500; attempt++) {
    const order = [...groups].sort((a, b) => b.length - a.length || Math.random() - .5);
    const caps = [...capacities].sort(() => Math.random() - .5);
    const teams = Array.from({ length: teamCount }, () => [] as string[]);
    const backtrack = (i: number): boolean => {
      if (i === order.length) return true;
      const group = order[i];
      for (const idx of teams.map((_, n) => n).sort(() => Math.random() - .5)) {
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
  const [quizTimerDraft, setQuizTimerDraft] = useState<QuizTimerSettings | null>(null);
  const [quizTimerSaveState, setQuizTimerSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [musicRoundDraft, setMusicRoundDraft] = useState<MusicRoundSettings | null>(null);
  const [musicRoundSaveState, setMusicRoundSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [playerText, setPlayerText] = useState('');
  const [drawTeamCount, setDrawTeamCount] = useState(2);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [pairA, setPairA] = useState('');
  const [pairB, setPairB] = useState('');
  const [pairMode, setPairMode] = useState<'together' | 'apart'>('apart');
  const [drawResult, setDrawResult] = useState<string[][] | null>(null);
  const [drawError, setDrawError] = useState('');
  const [drawSaveState, setDrawSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [scoringDraft, setScoringDraft] = useState<ScoringConfig | null>(null);
  const [scoringSaveState, setScoringSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const drawHydrated = useRef(false);
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!loggedIn) return;
    const res = await fetch('/api/admin/overview', { cache: 'no-store' });
    if (res.status === 401) { setLoggedIn(false); return; }
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Fehler.');
    setOverview(data);
    setDeadlineLocal(toLocalInput(data.deadlineAt));
    setScoringDraft(data.scoring);
    setQuizTimerDraft(data.quizTimer);
    setMusicRoundDraft(data.musicRoundSettings);
    setOrderInputs(Object.fromEntries((data.teams as Team[]).map((t) => [t.id, (validConfiguredOrder(t.station_order) ? t.station_order! : defaultOrder()).join(', ')])));
    if (!drawHydrated.current) {
      const saved = data.drawSettings as DrawSettings | null;
      if (saved) {
        setPlayerText(saved.playerText ?? '');
        setDrawTeamCount(Math.max(2, Number(saved.teamCount) || 2));
        setConstraints(Array.isArray(saved.constraints) ? saved.constraints : []);
        setDrawResult(Array.isArray(saved.drawResult) ? saved.drawResult : null);
      }
      drawHydrated.current = true;
    }
  }, [loggedIn]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (drawTimer.current) clearTimeout(drawTimer.current); }, []);
  useEffect(() => {
    if (!loggedIn || !drawHydrated.current) return;
    if (drawTimer.current) clearTimeout(drawTimer.current);
    setDrawSaveState('saving');
    drawTimer.current = setTimeout(async () => {
      const res = await fetch('/api/admin/draw-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerText, teamCount: drawTeamCount, constraints, drawResult }) });
      setDrawSaveState(res.ok ? 'saved' : 'error');
    }, 450);
  }, [loggedIn, playerText, drawTeamCount, constraints, drawResult]);

  async function login(e: React.FormEvent) { e.preventDefault(); setError(''); const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); if (!res.ok) return setError('Falsches Passwort.'); setLoggedIn(true); setPassword(''); }
  async function logout() { await fetch('/api/admin/logout', { method: 'POST' }); setLoggedIn(false); setOverview(null); }
  async function addTeam(e: React.FormEvent) { e.preventDefault(); setError(''); const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password: teamPassword }) }); const data = await res.json(); if (!res.ok) return setError(data.error ?? 'Fehler.'); setName(''); setTeamPassword(''); await load(); }
  async function deleteTeam(id: string, teamName: string) { if (!confirm(`${teamName} wirklich löschen? Alle Daten werden gelöscht.`)) return; await fetch('/api/admin/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); await load(); }
  async function resetStation(teamId: string, stationId: number) { if (!confirm('Stationsantwort zurücksetzen?')) return; await fetch('/api/admin/reset-station', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, stationId }) }); await load(); }
  async function saveDeadline() { const deadlineAt = deadlineLocal ? new Date(deadlineLocal).toISOString() : null; const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadlineAt }) }); if (!res.ok) return setError((await res.json()).error ?? 'Fehler.'); await load(); }
  function setBlockDuration(blockId: string, value: number) { const safe = Number.isFinite(value) ? Math.min(180, Math.max(1, Math.round(value))) : 5; setQuizTimerDraft((current) => current ? { ...current, durations: { ...current.durations, [blockId]: safe } } : current); }
  async function saveQuizTimer() {
    if (!quizTimerDraft) return;
    setQuizTimerSaveState('saving');
    const res = await fetch('/api/admin/quiz-timer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quizTimerDraft) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setQuizTimerSaveState('error'); return setError(data.error ?? 'Fehler.'); }
    setQuizTimerDraft(data.quizTimer);
    setOverview((current) => current ? { ...current, quizTimer: data.quizTimer } : current);
    setQuizTimerSaveState('saved');
  }
  function setMusicDuration(index: number, value: number) {
    setMusicRoundDraft((current) => {
      if (!current) return current;
      const next = [...current.stageDurationsSeconds] as [number, number, number, number];
      next[index] = Number.isFinite(value) ? Math.max(0.5, Math.min(120, value)) : next[index];
      return { ...current, stageDurationsSeconds: next };
    });
  }
  async function saveMusicRoundSettings() {
    if (!musicRoundDraft) return;
    setMusicRoundSaveState('saving');
    const res = await fetch('/api/admin/music-round-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(musicRoundDraft) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMusicRoundSaveState('error'); return setError(data.error ?? 'Fehler.'); }
    setMusicRoundDraft(data.musicRoundSettings);
    setOverview((current) => current ? { ...current, musicRoundSettings: data.musicRoundSettings } : current);
    setMusicRoundSaveState('saved');
  }
  function setMusicStagePoint(index: number, value: number) {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    setScoringDraft((current) => {
      if (!current) return current;
      const points = [...current.musicRoundStagePoints] as [number, number, number, number];
      points[index] = safe;
      return { ...current, musicRoundStagePoints: points };
    });
  }

  async function saveOrder(teamId: string) { const stationOrder = (orderInputs[teamId] ?? '').split(',').map((x) => Number(x.trim())).filter(Number.isFinite); const res = await fetch('/api/admin/team-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, stationOrder }) }); const data = await res.json(); if (!res.ok) return setError(data.error ?? 'Fehler.'); await load(); }
  async function setEvaluation(teamId: string, itemType: EvalType, itemId: string, isValid: boolean) {
    const res = await fetch('/api/admin/evaluation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, itemType, itemId, isValid }) });
    if (!res.ok) return setError((await res.json()).error ?? 'Fehler.');
    setOverview((current) => current ? { ...current, evaluations: [...current.evaluations.filter((e) => !(e.team_id === teamId && e.item_type === itemType && e.item_id === itemId)), { team_id: teamId, item_type: itemType, item_id: itemId, is_valid: isValid }] } : current);
  }
  function evaluationIsValid(teamId: string, itemType: EvalType, itemId: string) { return overview?.evaluations.some((e) => e.team_id === teamId && e.item_type === itemType && e.item_id === itemId && e.is_valid) ?? false; }

  const scoring = overview?.scoring;
  function pictureRoundScore(teamId: string, q: Question) {
    if (!scoring) return 0;
    const total = q.images?.length ?? 8;
    const correct = Array.from({ length: total }, (_, i) => evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)).filter(Boolean).length;
    if (correct === total) return scoring.pictureRoundFullPoints;
    if (correct >= scoring.pictureRoundPartialThreshold) return scoring.pictureRoundPartialPoints;
    return 0;
  }
  function specialQuestionScore(teamId: string, q: Question) {
    if (!scoring) return 0;
    if (q.type === 'picture_round') return pictureRoundScore(teamId, q);
    if (q.type === 'music_round') {
      const tracks = q.tracks ?? [];
      const music = parseMusicAnswer(teamAnswerMap(teamId)[q.id], tracks.length);
      return tracks.reduce((sum, _, i) => {
        if (!evaluationIsValid(teamId, 'question', `${q.id}:${i + 1}`)) return sum;
        const stage = Math.min(4, Math.max(1, music.stages[i] ?? 1));
        return sum + (scoring.musicRoundStagePoints[stage - 1] ?? 0);
      }, 0);
    }
    return evaluationIsValid(teamId, 'question', q.id) ? questionPoints(q.id, scoring) : 0;
  }
  function teamScore(teamId: string) {
    if (!overview || !scoring) return { total: 0, hints: 0, stations: 0, quiz: 0, guinness: 0, architecture: 0, beer: 0 };
    const progress = overview.progress.filter((p) => p.team_id === teamId);
    const hints = progress.reduce((sum, p) => sum + (p.submitted_at ? Math.max(0, scoring.hintPointsMax - (p.hints_used ?? 0)) : 0), 0);
    const stations = rallyeConfig.stations.reduce((sum, station) => sum + (evaluationIsValid(teamId, 'station', String(station.id)) ? stationTaskPoints(station.id, scoring) : 0), 0);
    const quiz = questionBlocks.flatMap((b) => b.questions).reduce((sum, q) => sum + specialQuestionScore(teamId, q), 0);
    const guinness = overview.guinness.filter((g) => g.team_id === teamId && evaluationIsValid(teamId, 'guinness', g.id)).length * scoring.guinnessPerLogo;
    const architecture = overview.architecture.filter((a) => a.team_id === teamId && evaluationIsValid(teamId, 'architecture', a.id)).length * scoring.architecturePerStyle;
    const beer = overview.beers.filter((b) => b.team_id === teamId && evaluationIsValid(teamId, 'beer', b.id)).length * scoring.beerPerUniqueCan;
    return { total: hints + stations + quiz + guinness + architecture + beer, hints, stations, quiz, guinness, architecture, beer };
  }

  const players = useMemo(() => parseNames(playerText), [playerText]);
  function addConstraint() { if (!pairA || !pairB || pairA === pairB) return setDrawError('Zwei verschiedene Spieler wählen.'); setConstraints((x) => [...x, { id: Date.now(), a: pairA, b: pairB, mode: pairMode }]); setPairA(''); setPairB(''); setDrawError(''); }
  function drawTeams() { setDrawError(''); try { setDrawResult(generateTeams(players, drawTeamCount, constraints)); } catch (e) { setDrawResult(null); setDrawError(e instanceof Error ? e.message : 'Auslosung fehlgeschlagen.'); } }

  function setScoreField(key: NumericScoringKey, value: number) {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    setScoringDraft((current) => current ? { ...current, [key]: safe } : current);
  }
  function setQuestionScore(id: string, value: number) { const safe = Number.isFinite(value) ? Math.max(0, value) : 0; setScoringDraft((current) => current ? { ...current, questionPoints: { ...current.questionPoints, [id]: safe } } : current); }
  function setStationScore(id: number, value: number) { const safe = Number.isFinite(value) ? Math.max(0, value) : 0; setScoringDraft((current) => current ? { ...current, stationTaskPoints: { ...current.stationTaskPoints, [String(id)]: safe } } : current); }
  async function saveScoring() {
    if (!scoringDraft) return;
    setScoringSaveState('saving');
    const res = await fetch('/api/admin/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scoringDraft) });
    const data = await res.json();
    if (!res.ok) { setScoringSaveState('error'); return setError(data.error ?? 'Fehler.'); }
    setScoringSaveState('saved');
    setOverview((o) => o ? { ...o, scoring: data.scoring } : o);
    setScoringDraft(data.scoring);
  }

  function teamAnswerMap(teamId: string) { return Object.fromEntries((overview?.quiz ?? []).filter((q) => q.team_id === teamId).map((q) => [q.question_id, q.answer])); }
  function teamColumns(children: (team: Team) => ReactNode) {
    return <div className="evaluation-team-grid">{overview?.teams.map((team) => <div className="evaluation-team-cell" key={team.id}><div className="evaluation-team-name">{team.name}</div>{children(team)}</div>)}</div>;
  }

  if (!loggedIn) return <main className="login-shell"><section className="login-card"><div className="eyebrow">ADMIN</div><h1>Rätselrallye</h1><form className="stack" onSubmit={login}><label>Passwort<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error-text">{error}</p>}<button className="primary">Login</button></form></section></main>;
  if (!overview || !scoring || !scoringDraft || !quizTimerDraft) return <main className="loading-screen">Lädt…</main>;

  return <main className="admin-shell">
    <header className="admin-header"><div><div className="eyebrow">ADMIN</div><h1>Übersicht</h1></div><button className="text-button" onClick={logout}>Logout</button></header>
    {error && <p className="error-text">{error}</p>}

    <section className="admin-panel"><h2>Zeitlimit</h2><p className="muted">Gesamt-Zeitlimit bis Johnny's Pub. Leer = kein Gesamt-Zeitlimit.</p><div className="admin-inline"><input type="datetime-local" step="1" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} /><button className="primary" onClick={saveDeadline}>Speichern</button><button className="secondary" onClick={() => setDeadlineLocal('')}>Leeren</button></div></section>

    <section className="admin-panel">
      <div className="section-title-row"><div><h2>Fragenblock-Timer</h2><p className="muted">Aus: Fragen bleiben bis zum Gesamt-Zeitlimit bearbeitbar. An: jeder Block hat seine eigene Zeit.</p></div><button className="primary" onClick={saveQuizTimer}>{quizTimerSaveState === 'saving' ? 'Speichert…' : 'Speichern'}</button></div>
      <label className="timer-toggle"><input type="checkbox" checked={quizTimerDraft.enabled} onChange={(e) => setQuizTimerDraft((current) => current ? { ...current, enabled: e.target.checked } : current)} /><span>Timer für Fragenblöcke aktivieren</span></label>
      {quizTimerDraft.enabled && <div className="block-duration-grid">{questionBlocks.map((block) => <label key={block.id}><span>{blockLabel(block)}</span><div><input type="number" min="1" max="180" value={quizTimerDraft.durations[block.id] ?? 5} onChange={(e) => setBlockDuration(block.id, Number(e.target.value))} /><span>Min.</span></div></label>)}</div>}
      {quizTimerSaveState === 'saved' && <p className="saved-text">Gespeichert.</p>}
    </section>

    {musicRoundDraft && <section className="admin-panel">
      <div className="section-title-row"><div><h2>Music Round</h2><p className="muted">Länge der vier Hörstufen. Die Zeiten sind Sekunden ab Songbeginn.</p></div><button className="primary" onClick={saveMusicRoundSettings}>{musicRoundSaveState === 'saving' ? 'Speichert…' : 'Speichern'}</button></div>
      <div className="music-admin-grid">{musicRoundDraft.stageDurationsSeconds.map((seconds, i) => <label key={i}>Stufe {i + 1}<div><input type="number" min={i === 0 ? 0.5 : musicRoundDraft.stageDurationsSeconds[i - 1] + 0.5} max="120" step="0.5" value={seconds} onChange={(e) => setMusicDuration(i, Number(e.target.value))} /><span>Sek.</span></div></label>)}</div>
      {musicRoundSaveState === 'saved' && <p className="saved-text">Gespeichert.</p>}
    </section>}

    <section className="admin-panel"><h2>Teams</h2><form className="admin-team-form" onSubmit={addTeam}><input placeholder="Teamname" value={name} onChange={(e) => setName(e.target.value)} /><input placeholder="Passwort" value={teamPassword} onChange={(e) => setTeamPassword(e.target.value)} /><button className="primary">Hinzufügen</button></form><div className="team-order-list">{overview.teams.map((t) => <div className="team-order-row" key={t.id}><b>{t.name}</b><label>Stations-Reihenfolge<input value={orderInputs[t.id] ?? ''} onChange={(e) => setOrderInputs((x) => ({ ...x, [t.id]: e.target.value }))} /></label><button className="secondary" onClick={() => saveOrder(t.id)}>Speichern</button><button className="danger-link" onClick={() => deleteTeam(t.id, t.name)}>Löschen</button></div>)}</div><p className="muted">Alle Stations-IDs genau einmal, z. B. 2, 4, 1, 3. Johnny's Pub gehört nicht zur Reihenfolge.</p></section>

    <section className="admin-panel">
      <div className="section-title-row"><h2>Teams auslosen</h2><span className={`save-state ${drawSaveState}`}>{drawSaveState === 'saving' ? 'Speichert…' : drawSaveState === 'saved' ? 'Gespeichert' : drawSaveState === 'error' ? 'Fehler' : ''}</span></div>
      <div className="draw-grid"><label>Spieler<textarea rows={8} value={playerText} onChange={(e) => setPlayerText(e.target.value)} placeholder={'Anna\nMax\nPaul\n…'} /></label><label>Anzahl Teams<input type="number" min="2" value={drawTeamCount} onChange={(e) => setDrawTeamCount(Math.max(2, Number(e.target.value) || 2))} /></label></div>
      <div className="constraint-form"><select value={pairA} onChange={(e) => setPairA(e.target.value)}><option value="">Spieler 1</option>{players.map((p) => <option key={p}>{p}</option>)}</select><select value={pairB} onChange={(e) => setPairB(e.target.value)}><option value="">Spieler 2</option>{players.map((p) => <option key={p}>{p}</option>)}</select><select value={pairMode} onChange={(e) => setPairMode(e.target.value as 'together' | 'apart')}><option value="apart">Nicht im selben Team</option><option value="together">Im selben Team</option></select><button className="secondary" onClick={addConstraint}>Paar hinzufügen</button></div>
      <div className="constraint-list">{constraints.map((c) => <span className="constraint-chip" key={c.id}>{c.a} + {c.b}: {c.mode === 'apart' ? 'getrennt' : 'zusammen'} <button onClick={() => setConstraints((x) => x.filter((v) => v.id !== c.id))}>×</button></span>)}</div>
      <button className="primary" onClick={drawTeams} disabled={players.length < 2}>Generieren</button>{drawError && <p className="error-text">{drawError}</p>}
      {drawResult && <div className="draw-result">{drawResult.map((members, i) => <article className="admin-card" key={i}><b>Team {String.fromCharCode(65 + i)}</b>{members.map((m) => <span key={m}>{m}</span>)}</article>)}</div>}
    </section>

    <section className="admin-panel">
      <div className="section-title-row"><div><h2>Punkte</h2><p className="muted">Direkt hier ändern. Gilt nach dem Speichern für Auswertung und Team-App.</p></div><button className="primary" onClick={saveScoring}>{scoringSaveState === 'saving' ? 'Speichert…' : 'Punkte speichern'}</button></div>
      <div className="scoring-editor-grid">
        <label>Guinness / Logo<input type="number" min="0" value={scoringDraft.guinnessPerLogo} onChange={(e) => setScoreField('guinnessPerLogo', Number(e.target.value))} /></label>
        <label>Architektur / Stil<input type="number" min="0" value={scoringDraft.architecturePerStyle} onChange={(e) => setScoreField('architecturePerStyle', Number(e.target.value))} /></label>
        <label>Wegbier / Bier<input type="number" min="0" value={scoringDraft.beerPerUniqueCan} onChange={(e) => setScoreField('beerPerUniqueCan', Number(e.target.value))} /></label>
        <label>Picture Round: ab richtig<input type="number" min="1" max="8" value={scoringDraft.pictureRoundPartialThreshold} onChange={(e) => setScoreField('pictureRoundPartialThreshold', Number(e.target.value))} /></label>
        <label>Picture Round Teilpunkte<input type="number" min="0" value={scoringDraft.pictureRoundPartialPoints} onChange={(e) => setScoreField('pictureRoundPartialPoints', Number(e.target.value))} /></label>
        <label>Picture Round 8/8<input type="number" min="0" value={scoringDraft.pictureRoundFullPoints} onChange={(e) => setScoreField('pictureRoundFullPoints', Number(e.target.value))} /></label>
        {scoringDraft.musicRoundStagePoints.map((points, i) => <label key={`music-points-${i}`}>Music Stufe {i + 1}<input type="number" min="0" step="0.5" value={points} onChange={(e) => setMusicStagePoint(i, Number(e.target.value))} /></label>)}
      </div>
      <h3>Stationen</h3><div className="scoring-editor-grid">{rallyeConfig.stations.map((station) => <label key={station.id}>{station.title}<input type="number" min="0" value={stationTaskPoints(station.id, scoringDraft)} onChange={(e) => setStationScore(station.id, Number(e.target.value))} /></label>)}</div>
      <h3>Quizfragen</h3><div className="scoring-question-list">{questionBlocks.flatMap((b) => b.questions).filter((q) => q.type !== 'picture_round' && q.type !== 'music_round').map((q) => <label key={q.id}><span><b>{q.category}</b><small>{q.text}</small></span><input type="number" min="0" value={questionPoints(q.id, scoringDraft)} onChange={(e) => setQuestionScore(q.id, Number(e.target.value))} /></label>)}</div>
      {scoringSaveState === 'saved' && <p className="saved-text">Gespeichert.</p>}
    </section>

    <section className="admin-panel"><h2>Quiz-Dateien</h2><p className="muted">Picture Round: <code>public/picture-round/1.png</code> bis <code>8.png</code>. Music Round: <code>public/music-round/1.mp3</code> bis <code>4.mp3</code>.</p></section>

    <section className="admin-panel evaluation-panel">
      <h2>Auswertung</h2>
      <div className="results-grid two-team-results">{overview.teams.map((team) => { const score = teamScore(team.id); return <article className="result-card" key={team.id}><div><span className="eyebrow">{team.name}</span><strong>{score.total} P.</strong></div><p>Hinweise {score.hints} · Stationen {score.stations} · Quiz {score.quiz} · Guinness {score.guinness} · Architektur {score.architecture} · Wegbier {score.beer}</p></article>; })}</div>

      <h3>Stationen</h3>
      {rallyeConfig.stations.map((station) => <div className="evaluation-item" key={`station-${station.id}`}><div className="evaluation-item-title"><b>{station.title}</b><span>Vor-Ort-Antwort · {stationTaskPoints(station.id, scoring)} P.</span></div>{teamColumns((team) => { const p = overview.progress.find((x) => x.team_id === team.id && x.station_id === station.id); return <><p className="evaluation-response">{p?.answer || '—'}</p><small>Hinweise: {p?.hints_used ?? 0} · {p?.submitted_at ? Math.max(0, scoring.hintPointsMax - (p.hints_used ?? 0)) : 0} Hinweispunkte</small><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'station', String(station.id))} onChange={(e) => setEvaluation(team.id, 'station', String(station.id), e.target.checked)} /> Richtig</label><button className="secondary mini" onClick={() => resetStation(team.id, station.id)} disabled={!p?.submitted_at}>Antwort zurücksetzen</button></>; })}</div>)}

      <h3>Quiz</h3>
      {questionBlocks.flatMap((b) => b.questions).map((q) => {
        if (q.type === 'picture_round') {
          const images = q.images ?? Array.from({ length: 8 }, (_, i) => `/picture-round/${i + 1}.png`);
          return <div className="evaluation-item special-comparison" key={q.id}><div className="evaluation-item-title"><b>{q.category}</b><span>{q.text}</span></div>{images.map((src, i) => <div className="picture-eval-row" key={src}><img src={src} alt={`Picture Round ${i + 1}`} /><div className="picture-eval-content"><b>Bild {i + 1}</b>{teamColumns((team) => { const values = parseList(teamAnswerMap(team.id)[q.id], images.length); return <><p className="evaluation-response">{values[i] || '—'}</p><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'question', `${q.id}:${i + 1}`)} onChange={(e) => setEvaluation(team.id, 'question', `${q.id}:${i + 1}`, e.target.checked)} /> Richtig</label></>; })}</div></div>)}{teamColumns((team) => { const correct = images.filter((_, i) => evaluationIsValid(team.id, 'question', `${q.id}:${i + 1}`)).length; return <strong className="special-score">{correct}/8 → {pictureRoundScore(team.id, q)} P.</strong>; })}</div>;
        }
        if (q.type === 'music_round') {
          const tracks = q.tracks ?? [];
          return <div className="evaluation-item special-comparison" key={q.id}><div className="evaluation-item-title"><b>{q.category}</b><span>{q.text}</span></div>{tracks.map((track, i) => <div className="music-eval-row" key={track.src}><audio controls preload="none" src={track.src} /><b>{track.label}</b>{teamColumns((team) => { const music = parseMusicAnswer(teamAnswerMap(team.id)[q.id], tracks.length); const stage = Math.min(4, Math.max(1, music.stages[i] ?? 1)); const points = scoring.musicRoundStagePoints[stage - 1] ?? 0; return <><p className="evaluation-response">{music.answers[i] || '—'}</p><small>Stufe {stage}/4 · {overview.musicRoundSettings.stageDurationsSeconds[stage - 1]} Sek. · max. {String(points).replace('.', ',')} P.</small><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'question', `${q.id}:${i + 1}`)} onChange={(e) => setEvaluation(team.id, 'question', `${q.id}:${i + 1}`, e.target.checked)} /> Richtig (+{String(points).replace('.', ',')} P.)</label></>; })}</div>)}{teamColumns((team) => <strong className="special-score">Music Round → {specialQuestionScore(team.id, q)} P.</strong>)}</div>;
        }
        return <div className="evaluation-item" key={q.id}><div className="evaluation-item-title"><b>{q.category}</b><span>{q.text} · {questionMaxPoints(q.id, scoring)} P.</span></div>{teamColumns((team) => { const raw = teamAnswerMap(team.id)[q.id]; const content = q.type === 'matching' ? Object.entries(parseMap(raw)).map(([k, v]) => `${k}: ${v}`).join(' · ') : raw; return <><p className="evaluation-response">{content || '—'}</p><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'question', q.id)} onChange={(e) => setEvaluation(team.id, 'question', q.id, e.target.checked)} /> Richtig</label></>; })}</div>;
      })}

      <h3>Guinness</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.guinness.filter((g) => g.team_id === team.id).map((g) => <article className="evaluation-photo-entry" key={g.id}>{g.image_url && <img src={g.image_url} alt="Guinness" />}<b>{g.street}</b><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'guinness', g.id)} onChange={(e) => setEvaluation(team.id, 'guinness', g.id, e.target.checked)} /> Gültig (+{scoring.guinnessPerLogo} P.)</label></article>)}</div>)}
      <h3>Architektur</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.architecture.filter((a) => a.team_id === team.id).map((a) => <article className="evaluation-photo-entry" key={a.id}>{a.image_url && <img src={a.image_url} alt={a.style} />}<b>{a.style}</b><span>{a.building_name}</span><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'architecture', a.id)} onChange={(e) => setEvaluation(team.id, 'architecture', a.id, e.target.checked)} /> Gültig (+{scoring.architecturePerStyle} P.)</label></article>)}</div>)}
      <h3>Wegbier</h3>{teamColumns((team) => <div className="evaluation-entry-list">{overview.beers.filter((b) => b.team_id === team.id).map((b) => <article className="evaluation-photo-entry" key={b.id}>{b.image_url && <img src={b.image_url} alt={b.brand} />}<b>{b.brand}</b><label className="evaluation-check"><input type="checkbox" checked={evaluationIsValid(team.id, 'beer', b.id)} onChange={(e) => setEvaluation(team.id, 'beer', b.id, e.target.checked)} /> Gültig (+{scoring.beerPerUniqueCan} P.)</label></article>)}</div>)}
    </section>
  </main>;
}
