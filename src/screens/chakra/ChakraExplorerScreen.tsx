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
import { DynamicBackground, useDynamicBackground } from '../../components/DynamicBackground.tsx'
import { previousPathname } from '../../app/navTrace.ts'
import { CHAKRA } from '../../assets/paths.ts'
import { playDock, playSpokeChime, startWheelRoll, type WheelRoll } from '../../audio/sfx.ts'
import './ChakraExplorerScreen.css'

/** The wheel always renders 24 tappable spokes — the pitch ladder spans them. */
const CHAKRA_SPOKE_COUNT = 24

/** Matches the page cross-dissolve (`.page-enter`, 300ms in App.tsx) plus a
 *  frame, so the three.js scene is built once the transition is off screen. */
const MOUNT_3D_AFTER_MS = 320

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
}

// The 3D wheel itself is NOT here — one persistent Chakra3D lives in the
// screen root and survives every pill switch (the chakra never disappears).
function ValuesTab({ virtues, spoke, onSelect }: ValuesTabProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
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
            data-sfx="off"
            onClick={() => onSelect(virtues[Math.floor(Math.random() * virtues.length)]?.spoke ?? null)}
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
                data-sfx="off"
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

      {/* The persistent wheel (screen root) carries the dims callouts here. */}

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

      {/* The persistent wheel (screen root) plays the docking scene here. */}

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

  // Pill switch: the leaving tab plays a fast shrink+fade (240ms) before the
  // next one mounts — never a hard cut (user 2026-07-20). The old tab keeps
  // rendering inside .ck-tab-body--leave; the pill highlights the destination
  // immediately. Scenes stay sequential (old disposes before new mounts).
  const [leaveTo, setLeaveTo] = useState<TabId | null>(null)
  const leaveTimer = useRef<number | undefined>(undefined)
  // The wheel itself never leaves — the persistent scene below starts its
  // transition (camera glide / dock / undock) the moment the pill is tapped
  // (visTab), while only the DOM content fades between tab bodies.
  const switchTab = (next: TabId) => {
    // Re-targetable: a tap during the 240ms leave window used to be DROPPED
    // (early return on leaveTo), so a quick second pill press did nothing
    // and the kiosk felt stuck. Now it retargets — the scene follows via
    // visTab and the timer restarts for the new destination.
    const from = leaveTo ?? tab
    if (next === from) return
    // The scene docks the wheel into the flag (or lifts it back out) on the
    // flag tab — voice that motion with a low airy whoosh. This intentionally
    // LAYERS over the pill's generic UiSounds tap (finger press + wheel motion):
    // the flag pill is the only one that drives a scene transition, so it's the
    // only one that sounds richer than a plain tap. (Values/Design just tap.)
    if (next === 'flag') playDock(true)
    else if (from === 'flag') playDock(false)
    window.clearTimeout(leaveTimer.current)
    setSpoke(null)
    setLeaveTo(next)
    leaveTimer.current = window.setTimeout(() => {
      setLeaveTo(null)
      setTab(next)
    }, 240)
  }
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])
  /** The tab the SCENE should already be showing (destination during a leave). */
  const visTab = leaveTo ?? tab

  // The scene drives this box during the rolling entrance (onRollFrame) —
  // translating the BOX keeps its edge-feather mask travelling with the wheel.
  const wheelRef = useRef<HTMLDivElement | null>(null)
  // Entrance-roll sound: a rolling rumble whose body tracks the roll speed,
  // landing on a settle thud. Lives only while the wheel actually rolls in.
  const rollSndRef = useRef<WheelRoll | null>(null)
  const rollLastX = useRef<number | null>(null)
  const rollSndAt = useRef(0)

  // Build the scene AFTER the page cross-dissolve, not during it.
  //
  // History, because this looks like a change that was already reverted once:
  // deferring the mount was tried on 2026-07-26 and made the entrance stutter,
  // because back then the roll's clock started on a wall clock — so the compile
  // landed on the first frames of the roll and ate 30-60% of the travel.
  // That cause is gone: Chakra3D now holds the wheel off-stage and only starts
  // the roll once a frame has rendered AND every program is linked
  // (bootDone && programsReady). So the build can no longer be "inside" the
  // roll, and the remaining question is only which idle moment pays for it.
  // During the dissolve is the worst possible moment — two full page trees are
  // alive and the home tiles are animating out. Afterwards, the sunset is
  // static on screen and nothing is animating, so the same work is invisible.
  const [mount3D, setMount3D] = useState(false)
  useEffect(() => {
    if (mount3D) return
    const t = window.setTimeout(() => setMount3D(true), MOUNT_3D_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [mount3D])

  // Section entrance (user 2026-07-20): arriving from OUTSIDE /chakra, the
  // sunset background gets a beat alone, the finished wheel ROLLS in from
  // stage left, and only then does the chrome rise in. In-section activity
  // (tab hops are state, not routes) never replays it.
  //   'wait'   — background still probing/decoding, wheel parked off-stage
  //              (the roll must never enter a gradient void — user report:
  //              "background loads very lazy");
  //   'roll'   — background landed + a 700ms beat → wheel rolls in;
  //   'reveal' — chrome rising; 'done' — plain screen (classes dropped so
  //              the rise-in can never fight later transforms).
  const [intro, setIntro] = useState<'wait' | 'roll' | 'reveal' | 'done'>(() =>
    (previousPathname() ?? '').startsWith('/chakra') ? 'done' : 'wait',
  )
  const bg = useDynamicBackground(BG_BASE) // probe results are cached — the
  // child <DynamicBackground> re-uses them, so this costs nothing extra.
  const reveal = () => setIntro((p) => (p === 'wait' || p === 'roll' ? 'reveal' : p))


  // Background ready → a short beat (the bg keeps fading in UNDER the rolling
  // wheel — 250ms feels immediate, not lazy — user 2026-07-25) → roll. If the
  // folder is empty/broken, don't stall the visitor: force the roll at 2.2s.
  useEffect(() => {
    if (intro !== 'wait') return
    const advance = () => setIntro((p) => (p === 'wait' ? 'roll' : p))
    const t = window.setTimeout(advance, bg.ready ? 250 : 2200)
    return () => window.clearTimeout(t)
  }, [intro, bg.ready])
  // The kiosk must never dead-end behind the intro: if the wheel chunk (or
  // WebGL) never delivers onRollDone, force the reveal on wall-clock time.
  // BUDGET (keep in sync with Chakra3D): the roll is ROLL_MS 1500, and its
  // clock only starts once the shader programs are linked — worst case that
  // hold runs to its own 1500ms backstop. So a normal entrance reveals via
  // onRollDone at ~1.5s, and this timer must sit past the WORST case or it
  // would raise the chrome while the wheel is still travelling. Still a long
  // way below the 7000ms this used to be: a stalled GPU shows the UI in ~3.4s
  // rather than holding a near-empty stage.
  useEffect(() => {
    if (intro !== 'roll') return
    const t = window.setTimeout(reveal, 3400)
    return () => window.clearTimeout(t)
  }, [intro])
  // The rolling rumble lives exactly as long as the visual roll. 'roll' only
  // happens on section-entry from outside /chakra, so this never fires on
  // in-section tab hops. end() spins it down on skip / fallback / unmount.
  useEffect(() => {
    if (intro !== 'roll') return
    const snd = startWheelRoll()
    rollSndRef.current = snd
    rollLastX.current = null
    return () => {
      snd.end()
      rollSndRef.current = null
    }
  }, [intro])
  useEffect(() => {
    if (intro !== 'reveal') return
    const t = window.setTimeout(() => setIntro('done'), 1400)
    return () => window.clearTimeout(t)
  }, [intro])

  const chakra = content?.chakra
  const virtues = chakra?.virtues ?? []
  // The wheel always draws 24 tappable spokes, but content.xlsx can hot-reload
  // with fewer virtues — ignore selecting a spoke that has no backing virtue
  // (it would ease/pulse the wheel while the left column silently showed the
  // intro). null always clears.
  const validSpokes = useMemo(() => new Set(virtues.map((v) => v.spoke)), [virtues])
  const selectSpoke = (s: number | null) => {
    if (s === null || validSpokes.has(s)) {
      // The single choke point for BOTH the 3D canvas tap (onSpokeTap) and the
      // DOM virtue rows / CTA (onSelect). Chime only on a CHANGE of selection,
      // so wheel-tap and list-tap sound identical: re-tapping the already-active
      // spoke stays silent (the wheel never toggles-off, unlike the list's
      // silent deselect) instead of spamming the chime. Deselect (null) is
      // silent. Canvas taps aren't <button>s, so UiSounds can't voice them.
      if (s !== null && s !== spoke) playSpokeChime(s, CHAKRA_SPOKE_COUNT)
      setSpoke(s)
    }
  }

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
        intro === 'wait' || intro === 'roll'
          ? 'ck-screen ck-intro-hold'
          : intro === 'reveal'
            ? 'ck-screen ck-intro-reveal'
            : 'ck-screen'
      }
    >
      <div className="ck-bg" style={{ overflow: 'hidden' }}>
        {/* fadeIn={false}: the sunset is pre-warmed (App.tsx WarmChakra), so it
            paints on the first frame instead of fading up from the dark base —
            that fade was the "black dip" on entry (user 2026-07-25). */}
        <DynamicBackground base={BG_BASE} fadeIn={false} />
        {/* Progressive blur: a blurred copy masked to die out by the ground
            (see .ck-bg-blur). Probes are cached, so the second mount costs
            no extra requests. (A bg.mp4 drop-in would double video decode —
            the chakra folder convention is a bg.png still.) */}
        <div className="ck-bg-blur" aria-hidden="true">
          <DynamicBackground base={BG_BASE} fadeIn={false} />
        </div>
      </div>
      <div className="ck-scrim" />

      {/* Ground shadow tracks the wheel's tab pose (values ↔ dims geometry
          transitions via CSS; hidden under the flag scene). */}
      <div
        className={
          visTab === 'flag'
            ? 'ck-ground-shadow ck-ground-shadow--off'
            : visTab === 'design'
              ? 'ck-ground-shadow ck-ground-shadow--dims'
              : 'ck-ground-shadow'
        }
      />

      {/* THE wheel — one persistent scene for all three tabs. Pill switches
          re-pose it live (camera tweens, dims fade, dock/undock timeline);
          it must never unmount while the visitor is inside the section. */}
      <div
        ref={wheelRef}
        className="ck-wheel-stage"
        // Off-stage from the FIRST commit while the entrance is due — the
        // scene's own start pose (-1420px) lands with its first frame and
        // both values keep the box fully past the stage's left edge.
        style={intro === 'wait' || intro === 'roll' ? { transform: 'translateX(-1500px)' } : undefined}
      >
        {mount3D && (
        <LazyChakra3D
          width={1920}
          height={1080}
          mode={visTab === 'flag' ? 'flag' : 'wheel'}
          dims={visTab === 'design'}
          spin={visTab === 'values'}
          interactive={visTab === 'values'}
          selectedSpoke={spoke}
          entrance={intro === 'wait' ? 'hold' : intro === 'roll' ? 'roll' : 'none'}
          onRollFrame={(x) => {
            wheelRef.current?.style.setProperty('transform', `translateX(${x.toFixed(2)}px)`)
            // Audio params are re-targeted at ~20Hz, NOT every frame: this
            // callback runs on every frame of the entrance roll, and that is
            // the one moment the GPU is busiest. setTargetAtTime glides between
            // updates anyway, so the rumble sounds identical.
            const snd = rollSndRef.current
            if (snd === null) return
            const last = rollLastX.current
            const now = performance.now()
            if (last !== null && now - rollSndAt.current >= 50) {
              rollSndAt.current = now
              snd.frame(Math.min(1, Math.abs(x - last) / 40)) // px/frame → 0..1 speed
              rollLastX.current = x
            } else if (last === null) {
              rollLastX.current = x
            }
          }}
          onRollDone={() => {
            rollSndRef.current?.land() // settle thud only on the real roll-settle
            reveal()
          }}
          onSpokeTap={selectSpoke}
          onBackgroundTap={() => setSpoke(null)}
        />
        )}
      </div>

      {/* Vignette OVER the light, UNDER all content (z2). During the intro
          it hides with the chrome, so the bare sunset stays unframed. */}
      <div className="ck-vignette" />

      <h1 className="ck-title">
        <span className="ck-title-main">Ashok </span>
        <span className="ck-title-script">Chakra</span>
      </h1>

      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36, zIndex: 2 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36, zIndex: 2 }} />

      <TabPills
        className="ck-tabs"
        tabs={TABS}
        activeId={leaveTo ?? tab}
        onChange={(id) => switchTab(id as TabId)}
        style={{ position: 'absolute', left: 95, top: 180 }}
      />

      <div
        key={tab}
        className={leaveTo !== null ? 'ck-tab-body ck-tab-body--leave' : 'ck-tab-body'}
      >
        {tab === 'values' && <ValuesTab virtues={virtues} spoke={spoke} onSelect={selectSpoke} />}
        {tab === 'design' && (
          <DesignTab colorCode={colorCode} spokeCount={spokeCount} meaning={meaning} />
        )}
        {tab === 'flag' && <FlagTab headline={flagHeadline} facts={facts} />}
      </div>

      {/* Any touch skips the entrance — museum visitors never wait twice. */}
      {(intro === 'wait' || intro === 'roll') && (
        <div className="ck-intro-touch" onPointerDown={reveal} />
      )}
    </div>
  )
}
