import fs from 'node:fs';

const file = 'components/ChallengeTabs.tsx';
const original = fs.readFileSync(file, 'utf8');
let s = original;

function fail(msg) {
  fs.writeFileSync(file, original, 'utf8');
  throw new Error(msg);
}

const beerStart = s.indexOf('export function BeerTab(');
if (beerStart < 0) fail('BeerTab nicht gefunden.');

const beerPart = s.slice(beerStart);

// 1) States nur im BeerTab ergänzen
if (!beerPart.includes('marketMapOpen')) {
  const needle = "  const [error, setError] = useState('');";
  const pos = s.indexOf(needle, beerStart);
  if (pos < 0) fail('BeerTab error-state nicht gefunden.');
  const insertPos = pos + needle.length;
  s = s.slice(0, insertPos) +
    "\n  const [marketMapOpen, setMarketMapOpen] = useState(false);\n  const [marketMapZoom, setMarketMapZoom] = useState(1);" +
    s.slice(insertPos);
}

// 2) Karte + Supermarkt-Liste nach dem Regelblock einfügen
if (!s.includes('supermarket-map.png')) {
  const rulesNeedle = `    <div className="rule-box">
      <b>Regeln</b>
      <p>{scoring.beerPerUniqueCan} Punkt pro unterschiedlichem Dosenbier. Kein Radler, Cider oder alkoholfreies Bier.</p>
      <p>Sorten zählen getrennt: z. B. Stiegl Goldbräu und Stiegl Hell. 0,33 l und 0,5 l derselben Sorte zählen nicht doppelt.</p>
    </div>`;

  const rulesPos = s.indexOf(rulesNeedle, beerStart);
  if (rulesPos < 0) fail('Wegbier-Regelblock nicht gefunden.');
  const insertPos = rulesPos + rulesNeedle.length;

  const block = `
    <div className="guinness-map-card supermarket-card">
      <b>Spät offene Einkaufsmöglichkeiten</b>
      <div className="supermarket-list">
        <p><b>BILLA CORSO Herrnhuterhaus</b><br />Neuer Markt 17 · bis 20:00</p>
        <p><b>SPAR Babenbergerstraße</b><br />Babenbergerstraße 9 · bis 21:00</p>
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
    </div>}`;

  s = s.slice(0, insertPos) + block + s.slice(insertPos);
}

fs.writeFileSync(file, s, 'utf8');

// CSS nur ergänzen, falls die kleine Ladenliste noch kein Styling hat
const cssFile = 'app/globals.css';
let css = fs.readFileSync(cssFile, 'utf8');
if (!css.includes('.supermarket-card')) {
  css += `
.supermarket-card > b { display: block; margin-bottom: 10px; }
.supermarket-list { margin-bottom: 12px; }
.supermarket-list p { margin: 0 0 8px; line-height: 1.35; }
`;
  fs.writeFileSync(cssFile, css, 'utf8');
}

console.log('Fertig: Supermarkt-Liste + Wegbier-Karte eingebaut.');
console.log('Karte ablegen unter: public/supermarket-map.png');
