/**
 * ChakraExplorerScreen — the Ashok Chakra category, route /chakra.
 *
 * Three tab states of one Figma frame family:
 *   Values (795:5832)          — interactive 3D wheel + scrollable 24-virtue list
 *   Values, spoke selected (795:5991) — left column swaps to the virtue detail
 *   Design (795:6157)          — wheel as an engineering drawing (3D dims overlay:
 *                                the callouts live in the scene and track drag spin)
 *   Chakra in Flag (795:6208)  — live Tiranga hero (Chakra3D mode="flag": the
 *                                wheel shrinks + docks into the flag's white
 *                                band, then the cloth waves in the breeze)
 *                                + colour symbolism + facts carousel
 *
 * The three.js wheel (Chakra3D) is lazy-loaded via dynamic import so three
 * stays out of the main bundle; the Figma wheel render is the poster while it
 * loads. (Manual lazy mount, not React.lazy/Suspense: a sync navigation that
 * suspends makes React 18 replay the sibling tree from scratch, which loops
 * against ScrollList's measure-on-mount layout effect.)
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BlurTypeText } from '../../components/BlurTypeText.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { TabPills } from '../../components/TabPills.tsx'
import { animateScrollTo, ScrollList } from '../../components/ScrollList.tsx'
import { PaginationDots } from '../../components/PaginationDots.tsx'
import type { ChakraVirtue } from '../../data/schema.ts'
import {
  buildDidYouKnowFacts,
  chakraMeaningLine,
  chakraRowHex,
  chakraSpokeCount,
  COLOUR_SYMBOLISM,
  DESIGN_SPEC_CREDIT,
  DESIGN_SPEC_ROWS,
  DESIGN_SUBTITLE,
  FIGMA_ICON_SLUGS,
  fitHeadlineMeasured,
  splitTwoLines,
  TIRANGA_INTRO,
  VALUES_INTRO,
  virtueDescription,
  virtueIconSlug,
} from './chakraData.ts'
import type { Chakra3DProps } from './Chakra3D.tsx'
import { DynamicBackground } from '../../components/DynamicBackground.tsx'
import { previousPathname } from '../../app/navTrace.ts'
import { CHAKRA } from '../../assets/paths.ts'
import './ChakraExplorerScreen.css'

const BG_BASE = CHAKRA.background

// Pill widths are the Figma audit values (795:5985/5977/5980: 222/204/276).
const TABS = [
  { id: 'values', label: 'Values', width: 222 },
  { id: 'design', label: 'Design', width: 204 },
  { id: 'flag', label: 'Chakra in Flag', width: 276 },
] as const
type TabId = (typeof TABS)[number]['id']

const ROW_PITCH = 112
const ROWS_PER_PAGE = 6
const DYK_INTERVAL_MS = 7000

/* ------------------------------------------------------------------ */

function VirtueIcon({ virtue }: { virtue: string }) {
  const slug = virtueIconSlug(virtue)
  const url = `${CHAKRA.virtueIcons}/${slug}.svg`
  if (FIGMA_ICON_SLUGS.has(slug)) {
    return <img src={url} width={48} height={48} alt="" draggable={false} />
  }
  return (
    <span
      className="ck-virtue-icon-mask"
      style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` }}
    />
  )
}

/**
 * Manual lazy wrapper — renders nothing until the three.js chunk is in. The
 * resolved component is cached module-wide so later mounts (tab switches)
 * render the live wheel immediately.
 *
 * There used to be a poster here (the original light-blue Figma wheel render)
 * covering the chunk load. It was removed: the poster predates the navy 3D
 * wheel, so the handoff read as a colour pop rather than a smooth reveal.
 * Nothing is drawn during the load instead, so the wheel slot is briefly empty
 * on the first cold entry to this screen (~575 kB chunk). Warming the import
 * from an earlier screen would close that gap entirely.
 */
let chakra3DComponent: ComponentType<Chakra3DProps> | null = null
function LazyChakra3D(props: Chakra3DProps) {
  // Note the initializer arrow: passing the component directly would make
  // React CALL it as a lazy state initializer.
  const [comp, setComp] = useState<ComponentType<Chakra3DProps> | null>(() => chakra3DComponent)
  useEffect(() => {
    if (comp !== null) return
    let alive = true
    void import('./Chakra3D.tsx').then((m) => {
      chakra3DComponent = m.default
      if (alive) setComp(() => m.default)
    })
    return () => {
      alive = false
    }
  }, [comp])
  if (comp === null) return null
  const Comp = comp
  // Fade the canvas in — on cold entries the chunk lands well after the
  // route transition, and even warm tab switches remount the scene.
  return (
    <div className="ck-3d-enter">
      <Comp {...props} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface ValuesTabProps {
  virtues: ChakraVirtue[]
  spoke: number | null
  onSelect: (spoke: number | null) => void
  /** Section entrance: 'roll' while the wheel is still due to roll in. */
  entrance: 'roll' | 'none'
  onRollDone: () => void
}

function ValuesTab({ virtues, spoke, onSelect, entrance, onRollDone }: ValuesTabProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  // The scene drives this box during the rolling entrance (onRollFrame) —
  // translating the BOX keeps its edge-feather mask travelling with the wheel.
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(virtues.length / ROWS_PER_PAGE))

  const viewport = () =>
    panelRef.current?.querySelector<HTMLDivElement>('.scroll-list-viewport') ?? null

  // Live page indicator driven by real list scroll position.
  useEffect(() => {
    const vp = viewport()
    if (vp === null) return
    const onScroll = () => {
      const p = Math.round(vp.scrollTop / (ROW_PITCH * ROWS_PER_PAGE))
      setPage(Math.max(0, Math.min(pageCount - 1, p)))
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => vp.removeEventListener('scroll', onScroll)
  }, [pageCount])

  // Wheel tap (or list tap) → bring the selected virtue into view.
  useEffect(() => {
    if (spoke === null) return
    const vp = viewport()
    if (vp === null) return
    const max = vp.scrollHeight - vp.clientHeight
    const target = Math.max(0, Math.min(max, (spoke - 1) * ROW_PITCH - 2 * ROW_PITCH))
    animateScrollTo(vp, target, 550)
  }, [spoke])

  const selected = spoke !== null ? virtues.find((v) => v.spoke === spoke) : undefined

  return (
    <>
      {/* Left column — intro state or selected-virtue state */}
      {selected === undefined ? (
        <>
          <div className="ck-big-24 ck-gold-text">24</div>
          <div className="ck-spokes-word">SPOKES</div>
          <div className="ck-gold-rule" />
          <div className="ck-values-word">VALUES</div>
          <p className="ck-values-intro">{VALUES_INTRO}</p>
          <button
            type="button"
            className="ck-cta"
            onClick={() => onSelect(1 + Math.floor(Math.random() * Math.max(1, virtues.length)))}
          >
            Touch a Spoke
          </button>
        </>
      ) : (
        (() => {
          // One CONSISTENT headline size: multi-word virtues stack as two
          // lines ("Spiritual" / "Knowledge") instead of shrinking to a
          // sliver — only the longest LINE drives the fit. The underline and
          // description slide down to clear a second line.
          const lines = splitTwoLines(selected.virtue)
          const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '')
          // Measured fit (not the char-count heuristic) + room up to the
          // wheel's ink edge — long words stay near the 88.5px target.
          const headlineSize = fitHeadlineMeasured(longest, 88.5, 500)
          const headlineBottom = 330 + lines.length * headlineSize * 1.226
          const underlineTop = Math.max(465, headlineBottom + 27)
          return (
            <>
              <div
                key={selected.virtue}
                className="ck-virtue-headline ck-gold-text"
                style={{ fontSize: headlineSize }}
              >
                {lines.map((line, i) => (
                  <span key={line} style={{ display: 'block' }}>
                    <BlurTypeText text={line} delay={i * 200} stagger={36} budget={300} />
                  </span>
                ))}
              </div>
              <div className="ck-underline" style={{ left: 109, top: underlineTop, width: 332 }} />
              <p className="ck-virtue-desc" style={{ top: underlineTop + 27 }}>
                {virtueDescription(selected.virtue)}
              </p>
            </>
          )
        })()
      )}

      {/* Center — interactive 3D wheel over its ground shadow */}
      <div className="ck-ground-shadow" />
      <div
        ref={wheelRef}
        className="ck-wheel"
        // Off-stage from the FIRST commit while the entrance is due — the
        // scene's own start pose (-1420px) lands with its first frame and
        // both values keep the box fully past the stage's left edge.
        style={entrance === 'roll' ? { transform: 'translateX(-1500px)' } : undefined}
      >
        <LazyChakra3D
          size={910}
          selectedSpoke={spoke}
          spin
          interactive
          entrance={entrance}
          onRollFrame={(x) => {
            wheelRef.current?.style.setProperty('transform', `translateX(${x.toFixed(2)}px)`)
          }}
          onRollDone={onRollDone}
          onSpokeTap={(s) => onSelect(s)}
          onBackgroundTap={() => onSelect(null)}
        />
      </div>

      {/* Right — glass panel with the 24-virtue scroll list */}
      <div ref={panelRef} className="ck-panel">
        <ScrollList
          width={488}
          height={659}
          style={{ position: 'absolute', left: 21, top: 50 }}
        >
          {virtues.map((v) => {
            const active = v.spoke === spoke
            // Long multi-word names ("Spiritual Knowledge") overflow the
            // 381px pill at 30px nowrap — stack them as two lines at the
            // SAME size instead of clipping. Long single words fit-shrink.
            const lines = v.virtue.length > 12 ? splitTwoLines(v.virtue) : [v.virtue]
            const stacked = lines.length > 1
            const single = !stacked && v.virtue.length > 13
            return (
              <button
                key={v.spoke}
                type="button"
                className={active ? 'ck-virtue-row is-active' : 'ck-virtue-row'}
                onClick={() => onSelect(active ? null : v.spoke)}
              >
                {active && <span className="ck-virtue-row-pill" />}
                <span className="ck-virtue-ring">
                  <VirtueIcon virtue={v.virtue} />
                </span>
                <span
                  className={stacked ? 'ck-virtue-label ck-virtue-label--stacked' : 'ck-virtue-label'}
                  style={
                    single
                      ? { fontSize: Math.max(22, 240 / (0.62 * v.virtue.length)) }
                      : undefined
                  }
                >
                  {stacked
                    ? lines.map((line) => (
                        <span key={line} style={{ display: 'block' }}>
                          {line}
                        </span>
                      ))
                    : v.virtue}
                </span>
              </button>
            )
          })}
        </ScrollList>
      </div>

      {/* Page-dot pill (Figma shows it in the selected state) */}
      {selected !== undefined && (
        <div className="ck-dots-pill">
          <PaginationDots count={pageCount} activeIndex={page} inactiveColor="#B9B9B9" />
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

interface DesignTabProps {
  colorCode: string
  spokeCount: string
  meaning: string
}

function DesignTab({ colorCode, spokeCount, meaning }: DesignTabProps) {
  return (
    <>
      <div className="ck-design-headline ck-gold-text">
        <BlurTypeText text="Ashok" stagger={36} budget={220} />
        <br />
        <BlurTypeText text="Chakra" delay={220} stagger={36} budget={260} />
      </div>
      <div className="ck-underline" style={{ left: 109, top: 533, width: 332 }} />
      <p className="ck-design-subtitle">{DESIGN_SUBTITLE}</p>
      {/* Anchors the otherwise-empty lower half of the left column. */}
      <p className="ck-design-meaning">{meaning}</p>

      {/* Center — dims mode: the wheel carries its own construction callouts
          (dashed IS1 circles, 15° wedge, leader lines, chip sprites) inside
          the 3D scene, so they track the wheel as visitors drag-spin it.
          Starts upright, turntable off — like the source build's dims view. */}
      <div className="ck-ground-shadow ck-ground-shadow--dims" />
      <div className="ck-wheel">
        <LazyChakra3D size={910} spin={false} interactive={false} dims />
      </div>

      {/* Right — stats card (Color code / Spokes) */}
      <div className="ck-card ck-card--stats">
        <div className="ck-stat-card ck-stat-card--color">
          <div className="ck-stat-label">Color code</div>
          <div className="ck-stat-swatch" style={{ background: colorCode }}>
            {colorCode}
          </div>
        </div>
        <div className="ck-stat-card ck-stat-card--spokes">
          <div className="ck-stat-label">Spokes</div>
          <div className="ck-stat-value">{spokeCount}</div>
        </div>
      </div>

      {/* Right — Chakra Design title block (label → value, like a spec sheet) */}
      <div className="ck-card ck-card--spec">
        <div className="ck-card-heading">Chakra Design</div>
        <dl className="ck-spec-table">
          {DESIGN_SPEC_ROWS.map((r) => (
            <div key={r.label} className="ck-spec-row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="ck-spec-credit">{DESIGN_SPEC_CREDIT}</div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

interface FlagTabProps {
  headline: string
  facts: string[]
}

function FlagTab({ headline, facts }: FlagTabProps) {
  const [fact, setFact] = useState(0)
  const count = Math.max(1, facts.length)

  useEffect(() => {
    if (facts.length < 2) return
    const timer = setInterval(() => setFact((f) => (f + 1) % facts.length), DYK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [facts.length])

  return (
    <>
      <div key={headline} className="ck-flag-headline ck-gold-text">
        <BlurTypeText text={headline} stagger={34} budget={480} />
      </div>
      <div className="ck-underline" style={{ left: 109, top: 461, width: 332 }} />
      <p className="ck-flag-intro">{TIRANGA_INTRO}</p>

      {/* Live hero — the source build's "See chakra in flag" scene: the wheel
          shrinks, docks into the white band of the Tiranga (⌀185 = 92.5% of
          the band) and the flag waves on. Remounts on every tab entry, so the
          docking animation replays each visit. 961x1436 = the original
          801x1197 slot scaled 1.2x (same aspect → same camera framing). */}
      <div className="ck-flag-hero">
        <LazyChakra3D mode="flag" width={961} height={1436} spin={false} interactive={false} />
      </div>

      <div className="ck-card ck-card--symbolism">
        <div className="ck-symbolism-title">Symbolism of Colours</div>
        {COLOUR_SYMBOLISM.map((c, i) => (
          <div key={c.name} className="ck-swatch-row" style={{ top: 111 + i * 93 }}>
            <span className="ck-swatch" style={{ background: c.swatch }} />
            <span className="ck-swatch-text">
              <b>{c.name}</b>
              <span>{c.description}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="ck-card ck-card--dyk">
        <div className="ck-card-heading" style={{ left: 39, top: 47 }}>
          Did You Know?
        </div>
        <p className="ck-dyk-fact">{facts[fact % count]}</p>
        <div className="ck-fact-dots">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="ck-fact-line" />}
              <button
                type="button"
                aria-label={`Fact ${i + 1}`}
                className={i === fact % count ? 'ck-fact-dot is-active' : 'ck-fact-dot'}
                onClick={() => setFact(i)}
              />
            </span>
          ))}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

export function ChakraExplorerScreen() {
  const navigate = useNavigate()
  const { content } = useContent()

  const [tab, setTab] = useState<TabId>('values')
  const [spoke, setSpoke] = useState<number | null>(null)

  // Section entrance (user 2026-07-20): arriving from OUTSIDE /chakra, the
  // sunset background gets a beat alone, the finished wheel ROLLS in from
  // stage left, and only then does the chrome rise in. In-section activity
  // (tab hops are state, not routes) never replays it. 'hold' = background
  // only, wheel travelling; 'reveal' = chrome rising; 'done' = plain screen
  // (classes dropped so the rise-in can never fight later transforms).
  const [intro, setIntro] = useState<'hold' | 'reveal' | 'done'>(() =>
    (previousPathname() ?? '').startsWith('/chakra') ? 'done' : 'hold',
  )
  const reveal = () => setIntro((p) => (p === 'hold' ? 'reveal' : p))

  // The kiosk must never dead-end behind the intro: if the wheel chunk (or
  // WebGL) never delivers onRollDone, force the reveal on wall-clock time.
  useEffect(() => {
    if (intro !== 'hold') return
    const t = window.setTimeout(reveal, 7000)
    return () => window.clearTimeout(t)
  }, [intro])
  useEffect(() => {
    if (intro !== 'reveal') return
    const t = window.setTimeout(() => setIntro('done'), 1400)
    return () => window.clearTimeout(t)
  }, [intro])

  const chakra = content?.chakra
  const virtues = chakra?.virtues ?? []

  const colorCode = useMemo(() => chakraRowHex(chakra?.rows ?? []), [chakra])
  const spokeCount = useMemo(() => chakraSpokeCount(chakra?.rows ?? []), [chakra])
  const meaning = useMemo(() => chakraMeaningLine(chakra?.rows ?? []), [chakra])

  const flagHeadline = useMemo(() => {
    const id = content?.symbolIdentities.find((s) => /tiranga/i.test(s.symbol))
    return id?.symbol ?? 'The Tiranga'
  }, [content])

  const facts = useMemo(
    () =>
      buildDidYouKnowFacts({
        chakra,
        carouselFacts: (content?.symbolCarouselCards ?? [])
          .filter((c) => /tiranga/i.test(c.symbol))
          .sort((a, b) => a.cardNumber - b.cardNumber)
          .map((c) => c.bodyText),
        flagFactAnswers: (content?.flagFacts ?? [])
          .filter((f) => /chakra|spokes/i.test(f.question) && f.answer.length <= 180)
          .map((f) => f.answer),
      }),
    [content, chakra],
  )

  return (
    <div
      className={
        intro === 'hold'
          ? 'ck-screen ck-intro-hold'
          : intro === 'reveal'
            ? 'ck-screen ck-intro-reveal'
            : 'ck-screen'
      }
    >
      <div className="ck-bg" style={{ overflow: 'hidden' }}>
        <DynamicBackground base={BG_BASE} />
      </div>
      <div className="ck-scrim" />

      <h1 className="ck-title">
        <span className="ck-title-main">Ashok </span>
        <span className="ck-title-script">Chakra</span>
      </h1>

      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      <TabPills
        className="ck-tabs"
        tabs={TABS}
        activeId={tab}
        onChange={(id) => {
          setTab(id as TabId)
          setSpoke(null)
        }}
        style={{ position: 'absolute', left: 95, top: 180 }}
      />

      {tab === 'values' && (
        <ValuesTab
          virtues={virtues}
          spoke={spoke}
          onSelect={setSpoke}
          entrance={intro === 'hold' ? 'roll' : 'none'}
          onRollDone={reveal}
        />
      )}
      {tab === 'design' && (
        <DesignTab colorCode={colorCode} spokeCount={spokeCount} meaning={meaning} />
      )}
      {tab === 'flag' && <FlagTab headline={flagHeadline} facts={facts} />}

      {/* Any touch skips the entrance — museum visitors never wait twice. */}
      {intro === 'hold' && <div className="ck-intro-touch" onPointerDown={reveal} />}
    </div>
  )
}
