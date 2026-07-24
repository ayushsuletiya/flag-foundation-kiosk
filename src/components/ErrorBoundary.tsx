/**
 * ErrorBoundary — the kiosk's last line of defence.
 *
 * In React 18 an uncaught error thrown while rendering ANY screen unmounts the
 * whole root tree, leaving the panel on a permanently black #06070e screen with
 * the idle-reset listeners gone — a bricked kiosk until someone reboots it. The
 * most realistic trigger is a client edit to the (hot-reloading) content.xlsx
 * that leaves a screen indexing an empty array or reading a prop of undefined.
 *
 * This boundary catches the throw, shows a calm holding screen, then sends the
 * visitor home (a simple, safe screen) and clears the error so the route tree
 * remounts. The kiosk self-heals instead of dead-ending.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** How long the holding screen shows before we reset to home. */
const RECOVER_MS = 2500

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  private recoverTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for the onsite console; there is no dev overlay in the packaged build.
    console.error('[kiosk] screen crashed — recovering to home:', error, info.componentStack)
    if (this.recoverTimer !== null) return
    this.recoverTimer = setTimeout(() => {
      this.recoverTimer = null
      // HashRouter navigation is a plain hash change — works even though this
      // boundary sits outside the router hooks.
      if (window.location.hash !== '#/' && window.location.hash !== '') {
        window.location.hash = '#/'
      }
      this.setState({ hasError: false })
    }, RECOVER_MS)
  }

  componentWillUnmount(): void {
    if (this.recoverTimer !== null) clearTimeout(this.recoverTimer)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#06070e',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            fontFamily: 'var(--font-ui)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 600, color: '#fff5d2' }}>One moment…</div>
          <div style={{ fontSize: 22, color: 'rgba(255, 255, 255, 0.7)' }}>
            Returning to the home screen
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
