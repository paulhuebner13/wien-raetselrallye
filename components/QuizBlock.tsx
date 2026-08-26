'use client';

import { useEffect, useRef, useState } from 'react';
import { blockLabel, questionPoints } from '@/lib/config';
import type { QuestionBlock } from '@/lib/types';

type PictureImage = { slot: number; image_url: string | null };

export default function QuizBlock({ block, answers, onClose, allBlocks, review = false, pictureRoundImages = [], locked = false }: {
  block?: QuestionBlock;
  answers: Record<string, string>;
  onClose: () => void;
  allBlocks?: QuestionBlock[];
  review?: boolean;
  pictureRoundImages?: PictureImage[];
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
      {b.questions.map((q) => <AutoSaveQuestion key={q.id} question={q} serverValue={answers[q.id] ?? ''} pictureRoundImages={pictureRoundImages} locked={locked} />)}
    </section>)}
  </div>;
}

function AutoSaveQuestion({ question, serverValue, pictureRoundImages, locked }: {
  question: QuestionBlock['questions'][number];
  serverValue: string;
  pictureRoundImages: PictureImage[];
  locked: boolean;
}) {
  const [value, setValue] = useState(serverValue);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setValue(serverValue); }, [serverValue]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function change(next: string) {
    if (locked) return;
    setValue(next); dirty.current = true; setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch('/api/team/quiz-answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: question.id, answer: next }) });
      dirty.current = false;
      setStatus(res.ok ? 'saved' : 'error');
    }, 500);
  }

  return <label className={`question-card ${status === 'saved' ? 'saved' : ''}`}>
    <span className="question-meta"><span className="category">{question.category}</span><span>{questionPoints(question.id)} P.</span></span>
    <span className="question-text">{question.text}</span>
    {question.type === 'picture_round' && <div className="picture-round-grid">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((slot) => {
        const image = pictureRoundImages.find((x) => x.slot === slot)?.image_url;
        return <div className="picture-round-item" key={slot}><span>{slot}</span>{image ? <img src={image} alt={`Länderumriss ${slot}`} /> : <div className="picture-missing">Bild fehlt</div>}</div>;
      })}
    </div>}
    <textarea rows={question.type === 'picture_round' ? 5 : 2} value={value} onChange={(e) => change(e.target.value)} disabled={locked} />
    <span className="save-state">{status === 'saving' ? 'Speichert…' : status === 'saved' ? 'Gespeichert' : status === 'error' ? 'Fehler' : ''}</span>
  </label>;
}
