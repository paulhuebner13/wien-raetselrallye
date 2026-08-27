'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { blockLabel, questionPoints } from '@/lib/config';
import type { Question, QuestionBlock } from '@/lib/types';

export default function QuizBlock({ block, answers, onClose, allBlocks, review = false, locked = false }: {
  block?: QuestionBlock;
  answers: Record<string, string>;
  onClose: () => void;
  allBlocks?: QuestionBlock[];
  review?: boolean;
  locked?: boolean;
}) {
  const blocks = review ? (allBlocks ?? []) : (block ? [block] : []);
  return <div className="sheet-page">
    <div className="sheet-head">
      <div>
        <div className="eyebrow">{review ? 'CHECK' : 'QUIZ'}</div>
        <h2>{review ? 'Antworten prüfen' : block ? blockLabel(block) : 'Fragen'}</h2>
        <p className="muted">{locked ? 'Zeit abgelaufen. Antworten sind gesperrt.' : 'Antworten werden automatisch gespeichert.'}</p>
      </div>
      <button className="icon-button" onClick={onClose}>×</button>
    </div>
    {blocks.map((b) => <section key={b.id} className="question-section">
      {review && <h3>{blockLabel(b)}</h3>}
      {b.questions.map((q) => <QuestionCard key={q.id} question={q} serverValue={answers[q.id] ?? ''} locked={locked} />)}
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
    }, 500);
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

function QuestionHeader({ question }: { question: Question }) {
  return <>
    <span className="question-meta"><span className="category">{question.category}</span><span>{questionPoints(question.id)} P.</span></span>
    <span className="question-text">{question.text}</span>
  </>;
}

function QuestionCard({ question, serverValue, locked }: { question: Question; serverValue: string; locked: boolean }) {
  const autosave = useAutosave(question.id, serverValue, locked);
  const savedClass = autosave.status === 'saved' ? 'saved' : '';
  const [preview, setPreview] = useState<{ src: string; index: number } | null>(null);

  if (question.type === 'picture_round') {
    const images = question.images ?? Array.from({ length: 8 }, (_, i) => `/picture-round/${i + 1}.jpg`);
    const values = parseList(autosave.value, images.length);
    return <div className={`question-card ${savedClass}`}>
      <QuestionHeader question={question} />
      <div className="picture-round-grid">
        {images.map((image, index) => <div className="picture-round-item" key={image}>
          <span>{index + 1}</span>
          <button type="button" className="picture-round-zoom-button" onClick={() => setPreview({ src: image, index })} aria-label={`Bild ${index + 1} groß ansehen`}>
            <img src={image} alt={`Länderumriss ${index + 1}`} />
            <span className="zoom-hint">Vergrößern</span>
          </button>
          <input
            type="text"
            aria-label={`Land ${index + 1}`}
            placeholder="Land"
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
          <img src={preview.src} alt={`Länderumriss ${preview.index + 1} groß`} />
        </div>
      </Modal>}
    </div>;
  }

  if (question.type === 'matching') {
    const items = question.items ?? [];
    const values = parseMap(autosave.value);
    return <div className={`question-card ${savedClass}`}>
      <QuestionHeader question={question} />
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
    const tracks = question.tracks ?? [];
    const values = parseList(autosave.value, tracks.length);
    return <div className={`question-card ${savedClass}`}>
      <QuestionHeader question={question} />
      <div className="music-round-list">
        {tracks.map((track, index) => <label className="music-round-item" key={track.src}>
          <b>{track.label}</b>
          <audio controls preload="none" src={track.src} />
          <input
            type="text"
            placeholder="Songtitel"
            value={values[index]}
            disabled={locked}
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              autosave.setValue(JSON.stringify(next));
            }}
          />
        </label>)}
      </div>
      <SaveState status={autosave.status} />
    </div>;
  }

  return <label className={`question-card ${savedClass}`}>
    <QuestionHeader question={question} />
    <textarea rows={question.type === 'textarea' ? 5 : 2} value={autosave.value} onChange={(e) => autosave.setValue(e.target.value)} disabled={locked} />
    <SaveState status={autosave.status} />
  </label>;
}
