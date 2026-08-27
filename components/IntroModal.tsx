'use client';

import type { RallyeConfig } from '@/lib/types';
import Modal from './Modal';

export default function IntroModal({ config, onClose }: { config: RallyeConfig; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="intro">
        <div className="eyebrow">REGELN</div>
        <h2>{config.intro.title}</h2>
        {config.intro.body.map((line) => <p key={line}>{line}</p>)}
        <h3>Handy</h3>
        <ul>{config.intro.phoneRules.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Zusätzliche Challenges</h3>
        <ul>
          <li><b>Guinness:</b> Außen-Schilder mit Guinness-Logos verschiedener Pubs fotografieren und direkt in der App hochladen. Harfe + Guinness-Schriftzug müssen sichtbar sein.</li>
          <li><b>Architektur:</b> 5 Gebäude der vorgegebenen Stile fotografieren und direkt in der App hochladen.</li>
          <li><b>Wegbier:</b> Verschiedene Dosenbiere trinken, direkt in der App fotografieren und eintragen. Kein Radler, Cider oder alkoholfreies Bier.</li>
        </ul>
        <button className="primary full" onClick={onClose}>Los geht&apos;s</button>
      </div>
    </Modal>
  );
}
