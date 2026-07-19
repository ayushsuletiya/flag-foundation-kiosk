/**
 * ScrollList — touch-drag scrollable column with the custom gold scrollbar.
 *
 * Audit (installations list, nodes 795:6023-6028): thumb 14px wide, radius 7,
 * signature gold gradient (90deg #F6D568 → #DCA32E 50.96% → #EFC453); optional
 * 33x33 cream chevron pagers (mingcute:up-fill) above/below the track.
 *
 * Touch scrolling is native (touch-action: pan-y); mouse pointers get
 * drag-to-scroll so the kiosk interaction can be developed on a laptop.
 * The native scrollbar is hidden via ScrollList.css.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ChevronUpIcon } from './icons.tsx'
import './ScrollList.css'

export interface ScrollListProps {
  width: number
  height: number
  children: ReactNode
  /** Show the 33px chevron pagers above/below the track (audit default). */
  chevrons?: boolean
  /** Track/thumb width, px (audit: 14, one frame shows 10). */
  trackWidth?: number
  /** Horizontal gap between the content viewport and the track. */
  trackGap?: number
  /** Which side the rail sits on (map explorer list rails LEFT). */
  railSide?: 'left' | 'right'
  /**
   * Extra invisible margin pushed onto the scroll viewport's clip box beyond
   * the content's own bounds, so effects that need to paint past a child's
   * edges (e.g. a card's box-shadow glow) aren't hard-clipped by `overflow`
   * — a scrollable axis can't be `visible`, so *something* always clips.
   * Content is inset by the same amount so its on-screen position is
   * unaffected; only the invisible clip/hit-test boundary moves. The rail
   * is unaffected either way (anchored to the outer box, not the viewport).
   */
  overscan?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Fires on mount and on every scroll with the viewport's current scrollTop. */
  onScrollTopChange?: (scrollTop: number) => void
  className?: string
  style?: CSSProperties
}

interface ThumbMetrics {
  top: number
  height: number
  scrollable: boolean
}

const CHEVRON_SIZE = 33
const CHEVRON_TRACK_GAP = 24
const MIN_THUMB = 40

/**
 * rAF-driven eased scroll. Native `scrollTo({behavior:'smooth'})` is
 * unreliable here (silently a no-op under some Chromium configurations,
 * and cancellable by concurrent DOM churn), so animate scrollTop manually.
 */
const activeScrollAnims = new WeakMap<HTMLElement, number>()
export function animateScrollTo(el: HTMLElement, top: number, duration = 450): void {
  const prev = activeScrollAnims.get(el)
  if (prev !== undefined) cancelAnimationFrame(prev)
  const start = el.scrollTop
  const delta = top - start
  if (Math.abs(delta) < 1) {
    el.scrollTop = top
    return
  }
  const t0 = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / duration)
    el.scrollTop = start + delta * ease(k)
    if (k < 1) activeScrollAnims.set(el, requestAnimationFrame(step))
    else activeScrollAnims.delete(el)
  }
  activeScrollAnims.set(el, requestAnimationFrame(step))
}

export function ScrollList({
  width,
  height,
  children,
  chevrons = true,
  trackWidth = 14,
  trackGap = 20,
  railSide = 'right',
  overscan,
  onScrollTopChange,
  className,
  style,
}: ScrollListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startY: number
    startScroll: number
    scale: number
    captured: boolean
  } | null>(null)
  const [thumb, setThumb] = useState<ThumbMetrics>({ top: 0, height: MIN_THUMB, scrollable: false })

  const updateThumb = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (viewport === null || track === null) return
    const trackH = track.clientHeight
    const scrollable = viewport.scrollHeight > viewport.clientHeight + 1
    const ratio = scrollable ? viewport.clientHeight / viewport.scrollHeight : 1
    const thumbH = Math.min(trackH, Math.max(MIN_THUMB, trackH * ratio))
    const maxScroll = viewport.scrollHeight - viewport.clientHeight
    const top = maxScroll > 0 ? (viewport.scrollTop / maxScroll) * (trackH - thumbH) : 0
    setThumb((prev) =>
      prev.top === top && prev.height === thumbH && prev.scrollable === scrollable
        ? prev
        : { top, height: thumbH, scrollable },
    )
    onScrollTopChange?.(viewport.scrollTop)
  }, [onScrollTopChange])

  // Measure on mount, then re-measure when the viewport resizes or its
  // content changes (Excel rows arriving, images decoding). Deliberately NOT
  // an every-render effect: an unconditional layout-effect setState chains
  // nested sync updates and can trip React's update-depth guard.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    updateThumb()
    const ro = new ResizeObserver(updateThumb)
    ro.observe(viewport)
    const observeChildren = () => {
      for (const child of Array.from(viewport.children)) ro.observe(child)
    }
    observeChildren()
    const mo = new MutationObserver(() => {
      observeChildren()
      updateThumb()
    })
    mo.observe(viewport, { childList: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [updateThumb])

  const page = useCallback((direction: 1 | -1) => {
    const viewport = viewportRef.current
    if (viewport === null) return
    animateScrollTo(viewport, viewport.scrollTop + direction * viewport.clientHeight * 0.8)
  }, [])

  // Mouse drag-to-scroll (touch uses native pan-y scrolling).
  // Pointer capture is deferred until real movement: capturing on pointerdown
  // would retarget the eventual click at the viewport, so stationary clicks
  // on row buttons inside the list would never fire.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const viewport = viewportRef.current
    if (viewport === null) return
    // The Stage may be CSS-scaled in dev; convert window px → stage px.
    const rect = viewport.getBoundingClientRect()
    const scale = viewport.clientHeight > 0 ? rect.height / viewport.clientHeight : 1
    dragRef.current = { startY: e.clientY, startScroll: viewport.scrollTop, scale, captured: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const viewport = viewportRef.current
    if (drag === null || viewport === null) return
    const dy = e.clientY - drag.startY
    if (!drag.captured) {
      if (Math.abs(dy) < 5) return // still a click, not a drag
      drag.captured = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    viewport.scrollTop = drag.startScroll - dy / drag.scale
  }
  const endDrag = () => {
    dragRef.current = null
  }

  const railWidth = Math.max(trackWidth, chevrons ? CHEVRON_SIZE : 0)
  const trackTop = chevrons ? CHEVRON_SIZE + CHEVRON_TRACK_GAP : 0
  const ov = {
    top: overscan?.top ?? 0,
    right: overscan?.right ?? 0,
    bottom: overscan?.bottom ?? 0,
    left: overscan?.left ?? 0,
  }

  return (
    <div className={className} style={{ position: 'relative', width, height, ...style }}>
      <div
        ref={viewportRef}
        className="scroll-list-viewport"
        onScroll={updateThumb}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'absolute',
          left: (railSide === 'left' ? railWidth + trackGap : 0) - ov.left,
          top: -ov.top,
          bottom: -ov.bottom,
          right: (railSide === 'right' ? railWidth + trackGap : 0) - ov.right,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ paddingTop: ov.top, paddingRight: ov.right, paddingBottom: ov.bottom, paddingLeft: ov.left }}>
          {children}
        </div>
      </div>

      {/* Scrollbar rail */}
      <div
        style={{
          position: 'absolute',
          ...(railSide === 'right' ? { right: 0 } : { left: 0 }),
          top: 0,
          bottom: 0,
          width: railWidth,
          display: thumb.scrollable ? 'block' : 'none',
        }}
      >
        {chevrons && (
          <button
            type="button"
            aria-label="Scroll up"
            onClick={() => page(-1)}
            style={{
              position: 'absolute',
              top: 0,
              left: (railWidth - CHEVRON_SIZE) / 2,
              width: CHEVRON_SIZE,
              height: CHEVRON_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronUpIcon size={CHEVRON_SIZE} />
          </button>
        )}

        <div
          ref={trackRef}
          style={{
            position: 'absolute',
            top: trackTop,
            bottom: trackTop,
            left: (railWidth - trackWidth) / 2,
            width: trackWidth,
            borderRadius: 'var(--radius-scrollbar)',
            background: 'rgba(255, 255, 255, 0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: thumb.top,
              left: 0,
              width: trackWidth,
              height: thumb.height,
              borderRadius: 'var(--radius-scrollbar)',
              background: 'var(--gold-gradient)',
            }}
          />
        </div>

        {chevrons && (
          <button
            type="button"
            aria-label="Scroll down"
            onClick={() => page(1)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: (railWidth - CHEVRON_SIZE) / 2,
              width: CHEVRON_SIZE,
              height: CHEVRON_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronUpIcon size={CHEVRON_SIZE} style={{ transform: 'scaleY(-1)' }} />
          </button>
        )}
      </div>
    </div>
  )
}
