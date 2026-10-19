import { Component, type ErrorInfo, type ReactNode } from 'react'
import { readRawData } from '../storage'

type Props = { children: ReactNode }
type State = { error: Error | null }

// If something throws while the app is drawing, show this instead of a white page.
// It never touches saved data, and lets the raw data be downloaded.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Cairn crashed:', error, info.componentStack)
  }

  downloadData = () => {
    const raw = readRawData()
    if (!raw) return
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cairn-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="home">
        <h1>Something went wrong</h1>
        <section className="card">
          <p>Your data is safe on this device; this screen couldn't be drawn.</p>
          <p className="muted">{this.state.error.message}</p>
          <div className="form-buttons">
            <button className="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
          {readRawData() && (
            <button className="link" onClick={this.downloadData}>
              Download my data
            </button>
          )}
        </section>
      </main>
    )
  }
}
