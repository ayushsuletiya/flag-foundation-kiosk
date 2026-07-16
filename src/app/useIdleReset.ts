/**
 * useIdleReset — kiosk attract-loop hook point.
 *
 * After `seconds` (default 120) with no touch/pointer/key activity anywhere in
 * the window, navigates back to the home route. The timer re-arms itself, so
 * when Phase 7 adds the attract loop it can hang extra behavior off the same
 * hook (e.g. start the ambient video after the second consecutive timeout).
 *
 * Must be called from a component rendered inside the router.
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const IDLE_RESET_DEFAULT_SECONDS = 120

/** Window events that count as visitor activity on the touchscreen (plus dev mouse/keys). */
const ACTIVITY_EVENTS: readonly (keyof WindowEventMap)[] = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'wheel',
  'keydown',
]

export function useIdleReset(seconds: number = IDLE_RESET_DEFAULT_SECONDS): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Keep the current path in a ref so activity listeners never re-subscribe
  // on navigation.
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const ms = Math.max(1, seconds) * 1000
    let timer = 0

    const onTimeout = () => {
      if (pathRef.current !== '/') {
        navigate('/')
      }
      timer = window.setTimeout(onTimeout, ms) // re-arm (attract-loop hook point)
    }

    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(onTimeout, ms)
    }

    reset()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true })
    }
    return () => {
      window.clearTimeout(timer)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset)
      }
    }
  }, [seconds, navigate])
}
