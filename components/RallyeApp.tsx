'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionBlock, RallyeConfig, ScoringConfig } from '@/lib/types';
import type { MusicRoundSettings } from '@/lib/music-round-settings';
import { blockLabel, distributeBlocks } from '@/lib/config';
import IntroModal from './IntroModal';
import StationView from './StationView';
import QuizBlock from './QuizBlock';
import { ArchitectureTab, BeerTab, GuinnessTab } from './ChallengeTabs';

type BlockState = { timerEnabled: boolean; startedAt: string | null; expiresAt: string | null; durationMinutes: number };
type TeamState = {
  team: { id: string; name: string };
  stationOrder: number[];
  stationStates: Array<{ stationId: number; unlocked: boolean; submitted: boolean; hintsUsed: number; hintPoints: number; answer: string; submittedAt: string | null; scorePercent: number | null }>;
  blockStates: Record<string, BlockState>;
  quizTimer: { enabled: boolean; durations: Record<string, number> };
  quiz: Record<string, string>;
  beers: Array<{ id: string; brand: string; image_url: string | null }>;
  guinness: Array<{ id: string; street: string; image_url: string | null }>;
  architecture: Array<{ id: string; style: string; building_name: string; image_url: string | null }>;
  deadlineAt: string | null;
  locked: boolean;
  finalStationTitle: string;
  reviewUnlocked: boolean;
  scoring: ScoringConfig;
  musicRoundSettings: MusicRoundSettings;
};

type OpenItem = { type: 'station'; id: number } | { type: 'block'; id: string } | { type: 'review' } | null;
type NodeState = 'done' | 'open' | 'locked';
type PathNode =
  | { key: string; kind: 'station'; label: string; stationId: number; state: NodeState }
  | { key: string; kind: 'block'; label: string; block: QuestionBlock; state: NodeState }
  | { key: string; kind: 'review'; label: string; state: 'open' | 'locked' }
  | { key: string; kind: 'finish'; label: string; state: 'open' | 'locked' };

type PathCell = PathNode | null;

function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function RallyeApp({ config, blocks, teamName }: { config: RallyeConfig; blocks: QuestionBlock[]; teamName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<'rallye' | 'guinness' | 'architecture' | 'beer'>('rallye');
  const [showIntro, setShowIntro] = useState(false);
  const [state, setState] = useState<TeamState | null>(null);
  const [open, setOpen] = useState<OpenItem>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const refreshSequence = useRef(0);
  const appliedRefreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const res = await fetch('/api/team/state', { cache: 'no-store' });
    if (res.status === 401) { router.push('/'); return; }
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Fehler beim Laden.');
    if (sequence < appliedRefreshSequence.current) return;
    appliedRefreshSequence.current = sequence;
    setState(data);
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const id = setInterval(refresh, 2000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (sessionStorage.getItem('rallye-show-intro') === '1') {
      sessionStorage.removeItem('rallye-show-intro');
      setShowIntro(true);
    }
  }, []);

  const deadlineMs = state?.deadlineAt ? new Date(state.deadlineAt).getTime() : null;
  const localLocked = !!state && (state.locked || (deadlineMs !== null && now >= deadlineMs));
  const remaining = deadlineMs === null ? null : deadlineMs - now;

  const orderedStations = useMemo(() => {
    if (!state) return [];
    return state.stationOrder.map((id) => config.stations.find((s) => s.id === id)).filter(Boolean) as RallyeConfig['stations'];
  }, [state, config.stations]);
  const groupedBlocks = useMemo(() => distributeBlocks(blocks, Math.max(1, orderedStations.length)), [blocks, orderedStations.length]);

  const mainNodes = useMemo<PathNode[]>(() => {
    if (!state) return [];
    const out: PathNode[] = [];
    orderedStations.forEach((station, index) => {
      const ss = state.stationStates.find((s) => s.stationId === station.id)!;
      out.push({ key: `s-${station.id}`, kind: 'station', label: `Station ${index + 1}`, stationId: station.id, state: ss.submitted ? 'done' : ss.unlocked ? 'open' : 'locked' });
      const blockUnlocked = ss.submitted;
      (groupedBlocks[index] ?? []).forEach((block) => {
        const blockState = state.blockStates[block.id];
        const expired = !!blockState?.timerEnabled && !!blockState?.expiresAt && now >= new Date(blockState.expiresAt).getTime();
        out.push({ key: `b-${block.id}`, kind: 'block', label: blockLabel(block), block, state: expired ? 'done' : blockUnlocked ? 'open' : 'locked' });
      });
    });
    return out;
  }, [state, orderedStations, groupedBlocks, now]);

  const rows = useMemo<PathCell[][]>(() => {
    if (!state) return [];
    const sequence: PathNode[] = [
      ...mainNodes,
      { key: 'review', kind: 'review', label: 'Antworten prüfen', state: state.reviewUnlocked ? 'open' : 'locked' },
      { key: 'finish', kind: 'finish', label: config.finish.title, state: state.reviewUnlocked ? 'open' : 'locked' },
    ];
    const result: PathCell[][] = [];
    for (let i = 0; i < sequence.length; i += 2) {
      const pair: PathCell[] = sequence.slice(i, i + 2);
      if (pair.length === 1) pair.push(null);
      if ((i / 2) % 2 === 1) pair.reverse();
      result.push(pair);
    }
    return result;
  }, [state, mainNodes, config.finish.title]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); }
  function openNode(node: PathNode) {
    if (node.state === 'locked' || node.kind === 'finish') return;
    if (node.kind === 'station') setOpen({ type: 'station', id: node.stationId });
    if (node.kind === 'block') setOpen({ type: 'block', id: node.block.id });
    if (node.kind === 'review') setOpen({ type: 'review' });
  }

  if (!state) return <main className="loading-screen">{error || 'Lädt…'}</main>;
  const openStation = open?.type === 'station' ? config.stations.find((s) => s.id === open.id) : undefined;
  const openStationState = openStation ? state.stationStates.find((s) => s.stationId === openStation.id) : undefined;
  const openBlock = open?.type === 'block' ? blocks.find((b) => b.id === open.id) : undefined;
  const openBlockState = openBlock ? state.blockStates[openBlock.id] : undefined;

  return <main className="app-shell">
    <header className="app-header">
      <div><span className="eyebrow">{teamName}</span><h1>{tab === 'rallye' ? 'Rallye' : tab === 'guinness' ? 'Guinness' : tab === 'architecture' ? 'Architektur' : 'Wegbier'}</h1></div>
      <div className="header-actions"><button className="icon-button" onClick={() => setShowIntro(true)}>i</button><button className="text-button" onClick={logout}>Logout</button></div>
    </header>
    <div className={`deadline-bar ${localLocked ? 'expired' : ''}`}>
      {remaining === null ? <span>Zeitlimit noch nicht gesetzt</span> : localLocked ? <><b>Zeit abgelaufen</b><span>Keine Änderungen mehr</span></> : <><b>{formatRemaining(remaining)}</b><span>bis {state.finalStationTitle}</span></>}
    </div>

    <div className="content-area">
      {tab === 'rallye' && <section className="path-wrap">{rows.map((row, rowIndex) => {
        const single = row.filter(Boolean).length === 1;
        return <div className={`path-row ${single ? 'single' : ''}`} key={rowIndex}>
          {row.map((node, cellIndex) => node ? node.kind === 'finish'
            ? <div key={node.key} className={`path-node finish ${node.state}`}><span className="node-icon">◆</span><span>{node.label}</span></div>
            : <button key={node.key} className={`path-node ${node.kind} ${node.state}`} onClick={() => openNode(node)} disabled={node.state === 'locked'}>
              <span className="node-icon">{node.kind === 'station' ? '●' : node.kind === 'block' ? '?' : '✓'}</span><span>{node.label}</span>
            </button>
            : <div className="path-placeholder" key={`empty-${cellIndex}`} />)}
        </div>;
      })}</section>}
      {tab === 'guinness' && <GuinnessTab entries={state.guinness} refresh={refresh} locked={localLocked} scoring={state.scoring} />}
      {tab === 'architecture' && <ArchitectureTab entries={state.architecture} styles={config.architectureStyles} refresh={refresh} locked={localLocked} scoring={state.scoring} />}
      {tab === 'beer' && <BeerTab beers={state.beers} refresh={refresh} locked={localLocked} scoring={state.scoring} />}
    </div>

    <nav className="bottom-nav">
      <button className={tab === 'rallye' ? 'active' : ''} onClick={() => setTab('rallye')}><span>⌁</span>Rallye</button>
      <button className={tab === 'guinness' ? 'active' : ''} onClick={() => setTab('guinness')}><span>G</span>Guinness</button>
      <button className={tab === 'architecture' ? 'active' : ''} onClick={() => setTab('architecture')}><span>⌂</span>Architektur</button>
      <button className={tab === 'beer' ? 'active' : ''} onClick={() => setTab('beer')}><span>▥</span>Wegbier</button>
    </nav>

    {showIntro && <IntroModal config={config} onClose={() => setShowIntro(false)} />}
    {openStation && openStationState && <div className="full-sheet"><StationView station={openStation} state={openStationState} onClose={() => setOpen(null)} refresh={refresh} locked={localLocked} /></div>}
    {openBlock && <div className="full-sheet"><QuizBlock block={openBlock} blockState={openBlockState} answers={state.quiz} locked={localLocked} scoring={state.scoring} musicRoundSettings={state.musicRoundSettings} onStarted={refresh} onClose={() => setOpen(null)} /></div>}
    {open?.type === 'review' && <div className="full-sheet"><QuizBlock review reviewEditable={!state.quizTimer.enabled && !localLocked} allBlocks={blocks} answers={state.quiz} locked={localLocked} scoring={state.scoring} musicRoundSettings={state.musicRoundSettings} onClose={() => setOpen(null)} /></div>}
  </main>;
}
