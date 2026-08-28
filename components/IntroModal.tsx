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
        <h3>Zusätzliche Aufgaben</h3>
        <ul>
          <li><b>Guinness:</b> Außen-Schilder mit Guinness-Logos verschiedener Pubs fotografieren und Fotos in der App hochladen. Harfe + Guinness-Schriftzug müssen sichtbar sein.</li>
          <li><b>Architektur:</b> 5 Gebäude der vorgegebenen Stile fotografieren und Fotos in der App hochladen.</li>
          <li><b>Wegbier:</b> Verschiedene Dosenbiere als Wegbiere kaufen, trinken, in der App fotografieren und eintragen. Radler, Cider oder alkoholfreies Bier zählen nicht!</li>
        </ul>
        <button className="primary full" onClick={onClose}>Los geht&apos;s</button>
      </div>
    </Modal>
  );
}
