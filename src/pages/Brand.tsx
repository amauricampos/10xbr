import { ArrowRight, Download } from 'lucide-react';
import { Chip, Nav } from '../ui';

const colors = [
  { name: 'Ink 950', hex: '#070B14', use: 'Page background' },
  { name: 'Ink 900', hex: '#0B1220', use: 'Raised surfaces, text on light' },
  { name: 'Ink 700', hex: '#1C2740', use: 'Lines on solid surfaces' },
  { name: 'Mint', hex: '#34E0C2', use: 'Aurora start, icons' },
  { name: 'Azure', hex: '#3B9BFF', use: 'Focus, links, selection' },
  { name: 'Iris', hex: '#7B6CFF', use: 'Aurora end' },
  { name: 'Cloud', hex: '#F2F6FF', use: 'Primary text' },
  { name: 'Mist', hex: '#B6C2D9', use: 'Secondary text' },
  { name: 'Good', hex: '#3DDC97', use: 'Pass, healthy, clear' },
  { name: 'Caution', hex: '#FFC857', use: 'Needs attention' },
  { name: 'Stop', hex: '#FF6B7A', use: 'Fail, stopped' },
];

const assets = [
  { file: 'logo-on-dark.svg', label: 'Logo, dark backgrounds' },
  { file: 'logo-on-light.svg', label: 'Logo, light backgrounds' },
  { file: 'mark.svg', label: 'Mark' },
  { file: 'mark-mono.svg', label: 'Mark, one color' },
];

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div>
        <p className="eyebrow">{n}</p>
        <h2 style={{ marginTop: 4 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Brand() {
  return (
    <>
      <Nav />
      <main className="wrap stack" style={{ padding: '56px 0 96px', '--gap': '64px' } as React.CSSProperties}>
        <header className="stack" style={{ '--gap': '16px', maxWidth: 720 } as React.CSSProperties}>
          <p className="eyebrow">Brand guidelines · v1.0</p>
          <h1>
            Clarity, <span className="gradient-text">stage by stage.</span>
          </h1>
          <p className="muted" style={{ fontSize: '1.15rem' }}>
            10xBR helps business owners find out whether a move to the United States is feasible before they commit to it. The brand is calm, exact and
            transparent, like good glass: you see straight through to the answer.
          </p>
        </header>

        <Section n="01" title="Logo">
          <div className="grid two">
            <div className="logo-tile" style={{ background: '#070B14' }}>
              <img src="/brand/logo-on-dark.svg" alt="10xBR logo on dark" height={64} />
            </div>
            <div className="logo-tile" style={{ background: '#F4F7FB' }}>
              <img src="/brand/logo-on-light.svg" alt="10xBR logo on light" height={64} />
            </div>
          </div>
          <div className="grid three">
            <div className="glass pad stack">
              <img src="/brand/mark.svg" alt="" width={72} height={72} />
              <h3>The mark</h3>
              <p className="small muted">
                An × whose rising stroke becomes an arrow: the multiplier in 10x, and the move across a border. It sits on an aurora glass tile.
              </p>
            </div>
            <div className="glass pad stack">
              <h3>The wordmark</h3>
              <p className="small muted">
                Sora. “10x” in Bold, “BR” in Regular and tinted Azure. Always written 10xBR: lowercase x, capital BR, no space.
              </p>
            </div>
            <div className="glass pad stack">
              <h3>Space and size</h3>
              <p className="small muted">
                Keep clear space equal to half the mark’s height on every side. Minimum height: 20 px for the logo, 16 px for the mark.
              </p>
            </div>
          </div>
          <div className="glass pad stack">
            <h3>Do not</h3>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18, columns: 2, columnGap: 32 }}>
              <li>Recolor the mark or change its gradient.</li>
              <li>Stretch, rotate or add shadows.</li>
              <li>Place the color logo on busy photos.</li>
              <li>Set the wordmark in another typeface.</li>
            </ul>
          </div>
          <div className="row wrapping">
            {assets.map((a) => (
              <a key={a.file} className="btn sm" href={`/brand/${a.file}`} download>
                <Download size={14} /> {a.label}
              </a>
            ))}
          </div>
        </Section>

        <Section n="02" title="Color">
          <div className="swatch">
            <i style={{ background: 'var(--aurora)', height: 110 }} />
            <div>
              <strong>Aurora</strong> · 135° · Mint #34E0C2 → Azure #3B9BFF (52%) → Iris #7B6CFF. Reserved for the mark, the primary action and progress. One
              aurora element per view.
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {colors.map((c) => (
              <div key={c.hex} className="swatch">
                <i style={{ background: c.hex }} />
                <div>
                  <strong>{c.name}</strong>
                  <br />
                  <code>{c.hex}</code>
                  <br />
                  <span className="faint">{c.use}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">
            Signal colors carry meaning and nothing else: green passes, amber needs attention, red stops. Always pair them with a word, never color alone.
          </p>
        </Section>

        <Section n="03" title="Typography">
          <div className="grid two">
            <div className="glass pad stack">
              <p className="eyebrow">Display · Sora 600</p>
              <p style={{ fontFamily: 'var(--display)', fontSize: '2.6rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Know before you go.</p>
              <p className="small muted">Headlines and numbers. Tracking −2%. Sentence case.</p>
            </div>
            <div className="glass pad stack">
              <p className="eyebrow">Text · Inter 400 / 500 / 600</p>
              <p>Body copy is 16 px with a 1.55 line height. Questions are short, answers are one tap, and every number says what it means.</p>
              <p className="small muted">Labels 14 px · Captions 12.5 px · Eyebrows 12 px uppercase, +12% tracking.</p>
            </div>
          </div>
        </Section>

        <Section n="04" title="Glass">
          <div className="grid two">
            <div className="glass pad stack">
              <h3>Surface</h3>
              <dl className="kv">
                <dt>Fill</dt>
                <dd>White at 5.5%</dd>
                <dt>Blur</dt>
                <dd>22 px, saturation 150%</dd>
                <dt>Edge</dt>
                <dd>1 px white at 12%</dd>
                <dt>Highlight</dt>
                <dd>Inset top line, white at 10%</dd>
                <dt>Radius</dt>
                <dd>24 px panels · 16 px cards · 10 px inputs · pill buttons</dd>
              </dl>
            </div>
            <div className="glass pad stack">
              <h3>Rules</h3>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Glass floats over the aurora backdrop, never over flat color.</li>
                <li>Two levels at most: a panel, and insets within it.</li>
                <li>Text on glass is Cloud or Mist. Contrast stays above 4.5:1.</li>
                <li>Motion is brief: 150–300 ms, ease. Respect reduced-motion.</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section n="05" title="Components">
          <div className="glass pad stack" style={{ '--gap': '22px' } as React.CSSProperties}>
            <div className="row wrapping">
              <button className="btn primary lg">
                Primary action <ArrowRight size={18} />
              </button>
              <button className="btn">Secondary</button>
              <button className="btn ghost">Quiet</button>
            </div>
            <div className="row wrapping">
              <Chip tone="good">
                <i className="dot" /> Strong fit
              </Chip>
              <Chip tone="warn">
                <i className="dot" /> Possible fit
              </Chip>
              <Chip tone="bad">
                <i className="dot" /> Not a fit yet
              </Chip>
              <Chip tone="info">AI reading</Chip>
              <Chip>Draft</Chip>
            </div>
            <div className="grid two">
              <div className="field">
                <label>Field label</label>
                <input className="input" placeholder="Placeholder" />
                <span className="help">Help text sits below, in one short sentence.</span>
              </div>
              <button className="option">
                <span>A one-tap answer</span>
              </button>
            </div>
          </div>
        </Section>

        <Section n="06" title="Voice">
          <div className="grid two">
            <div className="glass pad stack">
              <h3>We sound like</h3>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                <li>A senior advisor who respects your time.</li>
                <li>Plain words. Short sentences. One idea each.</li>
                <li>Honest about a “not yet”, and specific about the fix.</li>
                <li>Careful: we screen, the attorney decides.</li>
              </ul>
            </div>
            <div className="glass pad stack">
              <h3>For example</h3>
              <p className="small">
                <Chip tone="good">Say</Chip> “Your profile can work. A few points need attention.”
              </p>
              <p className="small">
                <Chip tone="bad">Not</Chip> “Congratulations! You qualify for the L-1 visa!”
              </p>
              <p className="small">
                <Chip tone="good">Say</Chip> “Formalize payroll now: the record takes 12 months to build.”
              </p>
              <p className="small">
                <Chip tone="bad">Not</Chip> “Insufficient documentary evidence of qualifying employment.”
              </p>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
