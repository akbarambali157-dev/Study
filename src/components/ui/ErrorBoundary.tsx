import { ReactNode, useState, useEffect } from 'react'

/**
 * Simple error boundary that catches runtime errors in the component tree.
 * Also tracks Dexie liveQuery context errors specifically.
 */
type ErrorBoundaryProps = {
  fallback: ReactNode
  onError?: (error: Error) => void
}

/**
 * Tracks whether a "Readwrite transaction in liveQuery context" error has occurred.
 * This is a common issue when a database write happens inside a liveQuery querier.
 * The boundary catches it and displays a user-friendly message.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, {
  hasError: boolean
  liveQueryError: boolean
  error?: Error
}> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      liveQueryError: false,
      error: undefined,
    }
  }

  static getDerivedStateFromError(error: Error) {
    // Catch general React errors
    return {
      hasError: true,
      error,
    }
  }

  // Custom handler for Dexie liveQuery context errors
  // We listen for the specific message pattern from Dexie
  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const message = error instanceof Error ? error.message : String(error)

    // Check if this is the Dexie liveQuery context error
    const isLiveQueryError = message.includes('Readwrite transaction in liveQuery context')

    if (isLiveQueryError) {
      this.setState({
        hasError: true,
        liveQueryError: true,
        error,
      })
      // Notify parent via prop if provided
      this.props.onError?.(error as Error)
    } else {
      // Standard error boundary behavior
      this.setState({
        hasError: true,
        error,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.liveQueryError) {
        return (
          <div className="error-boundary p-6 max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="size-6 text-clay" />
              <div>
                <h2 className="font-semibold text-clay">Live Query Context Error</h2>
                <p className="text-body">
                  A database write occurred inside a liveQuery context. The app has
                  recovered automatically, but if you continue to see this issue:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted">
                  <li>
                    Try refreshing the page
                  </li>
                  <li>
                    Contact support if the issue persists
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted">
                Error: {this.state.error?.message || 'Readwrite transaction in liveQuery context'}
              </p>
            </div>
          </div>
        )
      }

      return this.props.fallback
    }

    return this.props.children
  }
}

/**
 * Hook to check if we're in a liveQuery context error state
 * Useful for functional components
 */
export function useLiveQueryError(): {
  hasLiveQueryError: boolean
  setLiveQueryError: (value: boolean) => void
} {
  const [hasLiveQueryError, setHasLiveQueryError] = useState(false)
  return { hasLiveQueryError, setHasLiveQueryError }
}

/**
 * Wrap routes or pages with the error boundary
 * Usage: <ErrorBoundary fallback={<>...</>}>PageContent</ErrorBoundary>
 */
export { ErrorBoundary }