'use client';

import type { RallyeConfig } from '@/lib/types';
import Modal from './Modal';

export default function IntroModal({ config, onClose }: { config: RallyeConfig; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="intro">
        <div className="eyebrow">REGELN</div>
        <h2>{config.intro.title}</h2>
        <h3>So funktioniert&apos;s</h3>
        {config.intro.body.map((line) => <p key={line}>{line}</p>)}
        <h3>Handy</h3>
        <ul>{config.intro.phoneRules.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Zusätzliche Challenges</h3>
        <ul>
          <li><b>Guinness:</b> Außen-Schilder verschiedener Pubs fotografieren. Harfe + Guinness-Schriftzug müssen sichtbar sein. Mindestens 3.</li>
          <li><b>Architektur:</b> 5 Gebäude in den vorgegebenen Stilen fotografieren.</li>
          <li><b>Wegbier:</b> Verschiedene Dosenbiere trinken und mit Foto eintragen. Kein Radler, Cider oder alkoholfreies Bier.</li>
        </ul>
        <button className="primary full" onClick={onClose}>Los geht&apos;s</button>
      </div>
    </Modal>
  );
}
