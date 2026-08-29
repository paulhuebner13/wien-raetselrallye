import fs from 'node:fs';

const componentFile = 'components/ChallengeTabs.tsx';
const cssFile = 'app/globals.css';

const originalComponent = fs.readFileSync(componentFile, 'utf8');
const originalCss = fs.readFileSync(cssFile, 'utf8');

function restoreAndFail(message) {
  fs.writeFileSync(componentFile, originalComponent, 'utf8');
  fs.writeFileSync(cssFile, originalCss, 'utf8');
  throw new Error(message);
}

try {
  let s = originalComponent;

  const beerStart = s.indexOf('export function BeerTab(');
  if (beerStart < 0) restoreAndFail('BeerTab nicht gefunden.');

  const beerEnd = s.length;
  let beerPart = s.slice(beerStart, beerEnd);

  // States für Karten-Overlay ergänzen.
  if (!beerPart.includes('marketMapOpen')) {
    const errorState = "  const [error, setError] = useState('');";
    const errorPos = s.indexOf(errorState, beerStart);
    if (errorPos < 0) restoreAndFail('BeerTab-State nicht gefunden.');

    const insertPos = errorPos + errorState.length;
    s =
      s.slice(0, insertPos) +
      "\n  const [marketMapOpen, setMarketMapOpen] = useState(false);" +
      "\n  const [marketMapZoom, setMarketMapZoom] = useState(1);" +
      s.slice(insertPos);
  }

  // Nach State-Einfügung Position neu bestimmen.
  const freshBeerStart = s.indexOf('export function BeerTab(');
  const freshBeerPart = s.slice(freshBeerStart);

  if (!freshBeerPart.includes('supermarket-map.png')) {
    // Direkt vor das erste Wegbier-Uploadformular einsetzen.
    const uploadMarker = '    {!locked && <form className="upload-form" onSubmit={add}>';
    const uploadPos = s.indexOf(uploadMarker, freshBeerStart);
    if (uploadPos < 0) restoreAndFail('Wegbier-Uploadformular nicht gefunden.');

    const block = `    <div className="guinness-map-card supermarket-card">
      <b>Spät offene Einkaufsmöglichkeiten</b>
      <div className="supermarket-list">
        <p><b>BILLA CORSO Herrnhuterhaus</b><br />Neuer Markt 17 · bis 20:00</p>
        <p><b>SPAR Babenbergerstraße</b><br />Babenbergerstraße 9 · bis 21:00 <small>(nach 18:00 nur Bistro)</small></p>
        <p><b>INTERSPAR-pronto Wien Mitte</b><br />Landstraßer Hauptstraße 1b · bis 23:00</p>
        <p><b>OKAY Markt Schottentor</b><br />U-Bahn-Station Schottentor 1 · bis 21:45</p>
      </div>

      <button
        type="button"
        className="guinness-map-preview"
        onClick={() => { setMarketMapZoom(1); setMarketMapOpen(true); }}
        aria-label="Supermarkt-Karte vergrößern"
      >
        <img src="/supermarket-map.png" alt="Karte mit spät offenen Einkaufsmöglichkeiten" />
        <span>Zum Vergrößern antippen</span>
      </button>
    </div>

    {marketMapOpen && <div
      className="guinness-map-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Supermarkt-Karte"
      onClick={() => setMarketMapOpen(false)}
    >
      <div className="guinness-map-toolbar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setMarketMapZoom((z) => Math.max(1, z - 0.5))}>−</button>
        <span>{Math.round(marketMapZoom * 100)}%</span>
        <button type="button" onClick={() => setMarketMapZoom((z) => Math.min(4, z + 0.5))}>+</button>
        <button type="button" onClick={() => setMarketMapOpen(false)} aria-label="Schließen">×</button>
      </div>
      <div className="guinness-map-viewport" onClick={(e) => e.stopPropagation()}>
        <img
          src="/supermarket-map.png"
          alt="Karte mit spät offenen Einkaufsmöglichkeiten"
          className="guinness-map-full"
          style={{ width: \`\${marketMapZoom * 100}%\` }}
          draggable={false}
        />
      </div>
    </div>}

`;

    s = s.slice(0, uploadPos) + block + s.slice(uploadPos);
  }

  fs.writeFileSync(componentFile, s, 'utf8');

  let css = originalCss;

  if (!css.includes('.supermarket-card')) {
    css += `
.supermarket-card > b {
  display: block;
  margin-bottom: 10px;
}

.supermarket-list {
  margin-bottom: 12px;
}

.supermarket-list p {
  margin: 0 0 8px;
  line-height: 1.35;
}

.supermarket-list small {
  font-size: 11px;
  color: var(--muted);
}
`;
  }

  // Falls die Guinness-Karten-CSS bei diesem Stand noch nicht vorhanden ist.
  if (!css.includes('.guinness-map-card {')) {
    css += `
.guinness-map-card { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 13px 14px; margin: 0 0 18px; }
.guinness-map-card p { margin: 0 0 10px; line-height: 1.4; font-size: 13px; color: var(--muted); }
.guinness-map-preview { width: 100%; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f7f7f4; position: relative; display: block; }
.guinness-map-preview img { width: 100%; max-height: 340px; object-fit: cover; display: block; }
.guinness-map-preview span { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); white-space: nowrap; background: rgba(0,0,0,.72); color: #fff; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 800; }
.guinness-map-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.88); display: grid; grid-template-rows: auto 1fr; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); }
.guinness-map-toolbar { display: flex; justify-content: center; align-items: center; gap: 8px; padding-bottom: 10px; color: #fff; font-weight: 800; }
.guinness-map-toolbar button { width: 42px; height: 42px; border: 0; border-radius: 12px; background: #fff; color: #171714; font-size: 22px; font-weight: 900; }
.guinness-map-toolbar span { min-width: 58px; text-align: center; }
.guinness-map-viewport { overflow: auto; overscroll-behavior: contain; border-radius: 12px; background: #222; touch-action: pan-x pan-y pinch-zoom; }
.guinness-map-full { min-width: 100%; height: auto; display: block; max-width: none; user-select: none; }
`;
  }

  fs.writeFileSync(cssFile, css, 'utf8');

  console.log('Fertig: Supermarkt-Liste und Wegbier-Karte wurden eingebaut.');
  console.log('Karte ablegen unter: public/supermarket-map.png');
} catch (error) {
  fs.writeFileSync(componentFile, originalComponent, 'utf8');
  fs.writeFileSync(cssFile, originalCss, 'utf8');
  console.error('FEHLER:', error instanceof Error ? error.message : error);
  console.error('Es wurden keine Änderungen behalten.');
  process.exit(1);
}
