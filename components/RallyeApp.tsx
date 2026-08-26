'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionBlock, RallyeConfig } from '@/lib/types';
import { blockLabel, distributeBlocks } from '@/lib/config';
import IntroModal from './IntroModal';
import StationView from './StationView';
import QuizBlock from './QuizBlock';
import { ArchitectureTab, BeerTab, GuinnessTab } from './ChallengeTabs';

type TeamState = {
  team: { id: string; name: string };
  stationOrder: number[];
  stationStates: Array<{ stationId: number; unlocked: boolean; submitted: boolean; hintsUsed: number; hintPoints: number; answer: string; submittedAt: string | null; scorePercent: number | null }>;
  quiz: Record<string, string>;
  beers: Array<{ id: string; brand: string; image_url: string | null }>;
  guinness: Array<{ id: string; street: string; image_url: string | null }>;
  architecture: Array<{ id: string; style: string; building_name: string; image_url: string | null }>;
  pictureRoundImages: Array<{ slot: number; image_url: string | null }>;
  deadlineAt: string | null;
  locked: boolean;
  finalStationTitle: string;
  reviewUnlocked: boolean;
};

type OpenItem = { type: 'station'; id: number } | { type: 'block'; id: string } | { type: 'review' } | null;
type PathNode =
  | { key: string; kind: 'station'; label: string; stationId: number; state: 'done' | 'open' | 'locked' }
  | { key: string; kind: 'block'; label: string; block: QuestionBlock; state: 'done' | 'open' | 'locked' }
  | { key: string; kind: 'review'; label: string; state: 'open' | 'locked' };

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
  const [showIntro, setShowIntro] = useState(true);
  const [state, setState] = useState<TeamState | null>(null);
  const [open, setOpen] = useState<OpenItem>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    const res = await fetch('/api/team/state', { cache: 'no-store' });
    if (res.status === 401) { router.push('/'); return; }
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Fehler beim Laden.');
    setState(data);
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const deadlineMs = state?.deadlineAt ? new Date(state.deadlineAt).getTime() : null;
  const localLocked = !!state && (state.locked || (deadlineMs !== null && now >= deadlineMs));
  const remaining = deadlineMs === null ? null : deadlineMs - now;
  const groupedBlocks = useMemo(() => distributeBlocks(blocks, config.stations.length), [blocks, config.stations.length]);
  const orderedStations = useMemo(() => {
    if (!state) return [];
    return state.stationOrder.map((id) => config.stations.find((s) => s.id === id)).filter(Boolean) as RallyeConfig['stations'];
  }, [state, config.stations]);

  const nodes = useMemo<PathNode[]>(() => {
    if (!state) return [];
    const out: PathNode[] = [];
    orderedStations.forEach((station, index) => {
      const ss = state.stationStates.find((s) => s.stationId === station.id)!;
      out.push({ key: `s-${station.id}`, kind: 'station', label: `Station ${index + 1}`, stationId: station.id, state: ss.submitted ? 'done' : ss.unlocked ? 'open' : 'locked' });
      const blockUnlocked = ss.submitted;
      groupedBlocks[index].forEach((block) => {
        const complete = block.questions.every((q) => (state.quiz[q.id] ?? '').trim());
        out.push({ key: `b-${block.id}`, kind: 'block', label: blockLabel(block), block, state: complete ? 'done' : blockUnlocked ? 'open' : 'locked' });
      });
    });
    out.push({ key: 'review', kind: 'review', label: 'Antworten prüfen', state: state.reviewUnlocked ? 'open' : 'locked' });
    return out;
  }, [state, orderedStations, groupedBlocks]);

  const rows = useMemo(() => {
    const pairs: PathNode[][] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const pair = nodes.slice(i, i + 2);
      if ((i / 2) % 2 === 1) pair.reverse();
      pairs.push(pair);
    }
    return pairs;
  }, [nodes]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); }
  function openNode(node: PathNode) {
    if (node.state === 'locked') return;
    if (node.kind === 'station') setOpen({ type: 'station', id: node.stationId });
    if (node.kind === 'block') setOpen({ type: 'block', id: node.block.id });
    if (node.kind === 'review') setOpen({ type: 'review' });
  }

  if (!state) return <main className="loading-screen">{error || 'Lädt…'}</main>;
  const openStation = open?.type === 'station' ? config.stations.find((s) => s.id === open.id) : undefined;
  const openStationState = openStation ? state.stationStates.find((s) => s.stationId === openStation.id) : undefined;
  const openBlock = open?.type === 'block' ? blocks.find((b) => b.id === open.id) : undefined;

  return <main className="app-shell">
    <header className="app-header">
      <div><span className="eyebrow">{teamName}</span><h1>{tab === 'rallye' ? 'Rallye' : tab === 'guinness' ? 'Guinness' : tab === 'architecture' ? 'Architektur' : 'Wegbier'}</h1></div>
      <div className="header-actions"><button className="icon-button" onClick={() => setShowIntro(true)}>i</button><button className="text-button" onClick={logout}>Logout</button></div>
    </header>
    <div className={`deadline-bar ${localLocked ? 'expired' : ''}`}>
      {remaining === null ? <span>Zeitlimit noch nicht gesetzt</span> : localLocked ? <><b>Zeit abgelaufen</b><span>Keine Änderungen mehr</span></> : <><b>{formatRemaining(remaining)}</b><span>bis {state.finalStationTitle}</span></>}
    </div>

    <div className="content-area">
      {tab === 'rallye' && <section className="path-wrap">{rows.map((row, rowIndex) => <div className="path-row" key={rowIndex}>
        {row.map((node) => <button key={node.key} className={`path-node ${node.kind} ${node.state}`} onClick={() => openNode(node)} disabled={node.state === 'locked'}>
          <span className="node-icon">{node.kind === 'station' ? '●' : node.kind === 'block' ? '?' : '✓'}</span><span>{node.label}</span>
        </button>)}
        {row.length === 1 && <div />}
      </div>)}</section>}
      {tab === 'guinness' && <GuinnessTab entries={state.guinness} refresh={refresh} locked={localLocked} />}
      {tab === 'architecture' && <ArchitectureTab entries={state.architecture} styles={config.architectureStyles} refresh={refresh} locked={localLocked} />}
      {tab === 'beer' && <BeerTab beers={state.beers} refresh={refresh} locked={localLocked} />}
    </div>

    <nav className="bottom-nav">
      <button className={tab === 'rallye' ? 'active' : ''} onClick={() => setTab('rallye')}><span>⌁</span>Rallye</button>
      <button className={tab === 'guinness' ? 'active' : ''} onClick={() => setTab('guinness')}><span>G</span>Guinness</button>
      <button className={tab === 'architecture' ? 'active' : ''} onClick={() => setTab('architecture')}><span>⌂</span>Architektur</button>
      <button className={tab === 'beer' ? 'active' : ''} onClick={() => setTab('beer')}><span>▥</span>Wegbier</button>
    </nav>

    {showIntro && <IntroModal config={config} onClose={() => setShowIntro(false)} />}
    {openStation && openStationState && <div className="full-sheet"><StationView station={openStation} state={openStationState} onClose={() => setOpen(null)} refresh={refresh} locked={localLocked} /></div>}
    {openBlock && <div className="full-sheet"><QuizBlock block={openBlock} answers={state.quiz} pictureRoundImages={state.pictureRoundImages} locked={localLocked} onClose={() => setOpen(null)} /></div>}
    {open?.type === 'review' && <div className="full-sheet"><QuizBlock review allBlocks={blocks} answers={state.quiz} pictureRoundImages={state.pictureRoundImages} locked={localLocked} onClose={() => setOpen(null)} /></div>}
  </main>;
}
