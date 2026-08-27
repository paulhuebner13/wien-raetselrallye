'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { blockLabel, questionMaxPoints } from '@/lib/config';
import type { Question, QuestionBlock, ScoringConfig } from '@/lib/types';
import type { MusicRoundSettings } from '@/lib/music-round-settings';
import { parseMusicAnswer, type MusicAnswerState } from '@/lib/music-answer';

type BlockState = { timerEnabled: boolean; startedAt: string | null; expiresAt: string | null; durationMinutes: number } | undefined;

function formatBlockRemaining(ms: number) {
  const safe = Math.max(0, ms);
  const total = Math.ceil(safe / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuizBlock({ block, blockState, answers, onClose, onStarted, allBlocks, review = false, reviewEditable = false, locked = false, scoring, musicRoundSettings }: {
  block?: QuestionBlock;
  blockState?: BlockState;
  answers: Record<string, string>;
  onClose: () => void;
  onStarted?: () => Promise<void> | void;
  allBlocks?: QuestionBlock[];
  review?: boolean;
  reviewEditable?: boolean;
  locked?: boolean;
  scoring: ScoringConfig;
  musicRoundSettings: MusicRoundSettings;
}) {
  const [now, setNow] = useState(Date.now());
  const [localStartedAt, setLocalStartedAt] = useState(blockState?.startedAt ?? null);
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const timerEnabled = blockState?.timerEnabled ?? false;
  const durationMinutes = blockState?.durationMinutes ?? block?.durationMinutes ?? 5;

  useEffect(() => { setLocalStartedAt(blockState?.startedAt ?? null); }, [blockState?.startedAt]);
  useEffect(() => {
    if (review || !timerEnabled || !localStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [review, timerEnabled, localStartedAt]);

  const expiresAt = useMemo(() => {
    if (!block || !timerEnabled || !localStartedAt) return null;
    return new Date(localStartedAt).getTime() + durationMinutes * 60_000;
  }, [block, timerEnabled, localStartedAt, durationMinutes]);
  const blockTimeExpired = expiresAt !== null && now >= expiresAt;
  const blockLocked = locked || blockTimeExpired;

  async function startBlock() {
    if (!block || starting || locked) return;
    setStarting(true);
    setStartError('');
    const res = await fetch('/api/team/block-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId: block.id }),
    });
    const data = await res.json().catch(() => ({}));
    setStarting(false);
    if (!res.ok) return setStartError(data.error ?? 'Start nicht möglich.');
    setLocalStartedAt(data.startedAt);
    setNow(Date.now());
    await onStarted?.();
  }

  if (!review && block && timerEnabled && !localStartedAt) {
    return <div className="sheet-page quiz-start-page">
      <div className="sheet-head">
        <div><div className="eyebrow">FRAGENBLOCK</div><h2>{blockLabel(block)}</h2></div>
        <button className="icon-button" onClick={onClose}>×</button>
      </div>
      <div className="quiz-start-card">
        <span className="quiz-start-icon">?</span>
        <h2>Diesen Fragenblock beantworten?</h2>
        <p>Ihr habt {durationMinutes} Minuten Zeit.</p>
        <p className="muted">Nach Ablauf der Zeit sind die Antworten gesperrt.</p>
        {startError && <p className="error-text">{startError}</p>}
        <button className="primary full" onClick={startBlock} disabled={starting || locked}>{starting ? 'Startet…' : 'Los'}</button>
        {locked && <p className="error-text">Zeit abgelaufen.</p>}
      </div>
    </div>;
  }

  const blocks = review ? (allBlocks ?? []) : (block ? [block] : []);
  return <div className="sheet-page">
    <div className="sheet-head quiz-sheet-head">
      <div>
        <div className="eyebrow">{review ? 'CHECK' : 'FRAGENBLOCK'}</div>
        <h2>{review ? 'Antworten prüfen' : block ? blockLabel(block) : 'Fragen'}</h2>
        <p className="muted">{review ? (reviewEditable ? 'Antworten können bis zum Gesamt-Zeitlimit geändert werden.' : 'Antworten sind nur noch lesbar.') : blockLocked ? 'Zeit abgelaufen. Antworten sind gesperrt.' : timerEnabled ? 'Antworten werden automatisch gespeichert.' : 'Kein Blocktimer. Antworten bleiben bis zum Gesamt-Zeitlimit bearbeitbar.'}</p>
      </div>
      <button className="icon-button" onClick={onClose}>×</button>
    </div>
    {!review && timerEnabled && expiresAt !== null && <div className={`block-timer ${blockLocked ? 'expired' : ''}`}>
      <span>Zeit</span><b>{formatBlockRemaining(expiresAt - now)}</b>
    </div>}
    {blocks.map((b) => <section key={b.id} className="question-section">
      {review && <h3>{blockLabel(b)}</h3>}
      {b.questions.map((q) => <QuestionCard key={q.id} question={q} serverValue={answers[q.id] ?? ''} locked={blockLocked || (review && !reviewEditable)} scoring={scoring} musicRoundSettings={musicRoundSettings} />)}
    </section>)}
  </div>;
}

function useAutosave(questionId: string, serverValue: string, locked: boolean) {
  const [value, setValueState] = useState(serverValue);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setValueState(serverValue); }, [serverValue]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function setValue(next: string) {
    if (locked) return;
    setValueState(next);
    dirty.current = true;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch('/api/team/quiz-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer: next }),
      });
      dirty.current = false;
      setStatus(res.ok ? 'saved' : 'error');
    }, 400);
  }

  return { value, setValue, status };
}

function parseList(raw: string, count: number) {
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return Array.from({ length: count }, (_, i) => String(data[i] ?? ''));
  } catch {}
  return Array(count).fill('') as string[];
}

function parseMap(raw: string) {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, string>;
  } catch {}
  return {} as Record<string, string>;
}

function SaveState({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  return <span className="save-state">{status === 'saving' ? 'Speichert…' : status === 'saved' ? 'Gespeichert' : status === 'error' ? 'Fehler' : ''}</span>;
}

function QuestionHeader({ question, scoring }: { question: Question; scoring: ScoringConfig }) {
  return <>
    <span className="question-meta"><span className="category">{question.category}</span><span>{questionMaxPoints(question.id, scoring)} P.</span></span>
    <span className="question-text">{question.text}</span>
  </>;
}

function QuestionCard({ question, serverValue, locked, scoring, musicRoundSettings }: { question: Question; serverValue: string; locked: boolean; scoring: ScoringConfig; musicRoundSettings: MusicRoundSettings }) {
  const autosave = useAutosave(question.id, serverValue, locked);
  const savedClass = autosave.status === 'saved' ? 'saved' : '';
  const [preview, setPreview] = useState<{ src: string; index: number } | null>(null);

  if (question.type === 'picture_round') {
    const images = question.images ?? Array.from({ length: 8 }, (_, i) => `/picture-round/${i + 1}.png`);
    const values = parseList(autosave.value, images.length);
    return <div className={`question-card ${savedClass}`}>
      <QuestionHeader question={question} scoring={scoring} />
      <div className="picture-round-grid">
        {images.map((image, index) => <div className="picture-round-item" key={image}>
          <span>{index + 1}</span>
          <button type="button" className="picture-round-zoom-button" onClick={() => setPreview({ src: image, index })} aria-label={`Bild ${index + 1} groß ansehen`}>
            <img src={image} alt={`Picture-Round-Bild ${index + 1}`} />
            <span className="zoom-hint">Vergrößern</span>
          </button>
          <input
            type="text"
            aria-label={`Person ${index + 1}`}
            placeholder="Person"
            value={values[index]}
            disabled={locked}
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              autosave.setValue(JSON.stringify(next));
            }}
          />
        </div>)}
      </div>
      <SaveState status={autosave.status} />
      {preview && <Modal wide onClose={() => setPreview(null)}>
        <div className="picture-lightbox">
          <div className="eyebrow">PICTURE ROUND · {preview.index + 1}</div>
          <img src={preview.src} alt={`Picture-Round-Bild ${preview.index + 1} groß`} />
        </div>
      </Modal>}
    </div>;
  }

  if (question.type === 'matching') {
    const items = question.items ?? [];
    const values = parseMap(autosave.value);
    return <div className={`question-card ${savedClass}`}>
      <QuestionHeader question={question} scoring={scoring} />
      <div className="matching-grid">
        {items.map((item) => <label className="matching-row" key={item}>
          <span>{item}</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Jahr"
            value={values[item] ?? ''}
            disabled={locked}
            onChange={(e) => autosave.setValue(JSON.stringify({ ...values, [item]: e.target.value }))}
          />
        </label>)}
      </div>
      <SaveState status={autosave.status} />
    </div>;
  }

  if (question.type === 'music_round') {
    return <MusicRoundCard question={question} serverValue={serverValue} locked={locked} scoring={scoring} settings={musicRoundSettings} />;
  }

  return <label className={`question-card ${savedClass}`}>
    <QuestionHeader question={question} scoring={scoring} />
    <textarea rows={question.type === 'textarea' ? 5 : 2} value={autosave.value} onChange={(e) => autosave.setValue(e.target.value)} disabled={locked} />
    <SaveState status={autosave.status} />
  </label>;
}


function MusicRoundCard({ question, serverValue, locked, scoring, settings }: { question: Question; serverValue: string; locked: boolean; scoring: ScoringConfig; settings: MusicRoundSettings }) {
  const tracks = question.tracks ?? [];
  const [music, setMusic] = useState<MusicAnswerState>(() => parseMusicAnswer(serverValue, tracks.length));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [revealing, setRevealing] = useState<number | null>(null);
  const dirty = useRef(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!dirty.current) setMusic(parseMusicAnswer(serverValue, tracks.length));
  }, [serverValue, tracks.length]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  function updateAnswer(index: number, value: string) {
    if (locked) return;
    setMusic((current) => ({ ...current, answers: current.answers.map((v, i) => i === index ? value : v) }));
    dirty.current = true;
    setStatus('saving');
    if (timers.current[index]) clearTimeout(timers.current[index]);
    timers.current[index] = setTimeout(async () => {
      const res = await fetch('/api/team/music-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, trackIndex: index, answer: value }),
      });
      const data = await res.json().catch(() => ({}));
      dirty.current = false;
      if (res.ok && data.music) { setMusic(data.music); setStatus('saved'); }
      else setStatus('error');
    }, 350);
  }

  async function reveal(index: number) {
    if (locked || revealing !== null) return music.stages[index];
    setRevealing(index);
    const res = await fetch('/api/team/music-stage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: question.id, trackIndex: index }),
    });
    const data = await res.json().catch(() => ({}));
    setRevealing(null);
    if (!res.ok || !data.music) { setStatus('error'); return music.stages[index]; }
    setMusic(data.music);
    setStatus('saved');
    return data.music.stages[index] as number;
  }

  return <div className={`question-card ${status === 'saved' ? 'saved' : ''}`}>
    <QuestionHeader question={question} scoring={scoring} />
    <div className="music-round-list staged-music-round">
      {tracks.map((track, index) => <MusicTrackCard
        key={track.src}
        track={track}
        index={index}
        answer={music.answers[index] ?? ''}
        stage={music.stages[index] ?? 1}
        durations={settings.stageDurationsSeconds}
        stagePoints={scoring.musicRoundStagePoints}
        locked={locked}
        revealing={revealing === index}
        onAnswer={(value) => updateAnswer(index, value)}
        onReveal={() => reveal(index)}
      />)}
    </div>
    <SaveState status={status} />
  </div>;
}

function MusicTrackCard({ track, index, answer, stage, durations, stagePoints, locked, revealing, onAnswer, onReveal }: {
  track: { label: string; src: string };
  index: number;
  answer: string;
  stage: number;
  durations: [number, number, number, number];
  stagePoints: [number, number, number, number];
  locked: boolean;
  revealing: boolean;
  onAnswer: (value: string) => void;
  onReveal: () => Promise<number>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const clipLimit = useRef(durations[Math.max(0, stage - 1)] ?? durations[0]);
  const currentDuration = durations[Math.max(0, stage - 1)] ?? durations[0];
  const currentPoints = stagePoints[Math.max(0, stage - 1)] ?? 0;

  function stop() {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(false);
  }

  async function play(duration = currentDuration) {
    const audio = audioRef.current;
    if (!audio) return;
    clipLimit.current = duration;
    audio.pause();
    audio.currentTime = 0;
    setElapsed(0);
    try { await audio.play(); setPlaying(true); } catch { setPlaying(false); }
  }

  async function more() {
    const nextStage = await onReveal();
    const nextDuration = durations[Math.max(0, nextStage - 1)] ?? currentDuration;
    await play(nextDuration);
  }

  return <div className="music-round-item staged-track">
    <div className="music-track-head"><b>{track.label || `Song ${index + 1}`}</b><span>Stufe {stage}/4 · max. {String(currentPoints).replace('.', ',')} P.</span></div>
    <audio
      ref={audioRef}
      preload="metadata"
      src={track.src}
      onTimeUpdate={(e) => {
        const audio = e.currentTarget;
        setElapsed(Math.min(audio.currentTime, clipLimit.current));
        if (audio.currentTime >= clipLimit.current) { audio.pause(); setPlaying(false); }
      }}
      onEnded={() => setPlaying(false)}
      onPause={() => setPlaying(false)}
    />
    <div className="music-preview-controls">
      <button type="button" className="primary" onClick={() => playing ? stop() : play()}>{playing ? 'Stopp' : `${currentDuration}s anhören`}</button>
      {stage < 4 && <button type="button" className="secondary" disabled={locked || revealing} onClick={more}>{revealing ? 'Öffnet…' : `Mehr hören: ${durations[stage]}s · danach max. ${String(stagePoints[stage] ?? 0).replace('.', ',')} P.`}</button>}
    </div>
    <div className="music-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, currentDuration > 0 ? (elapsed / currentDuration) * 100 : 0)}%` }} /></div>
    <input type="text" placeholder="Songtitel" value={answer} disabled={locked} onChange={(e) => onAnswer(e.target.value)} />
  </div>;
}
