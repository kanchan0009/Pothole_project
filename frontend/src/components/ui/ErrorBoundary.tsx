import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in React component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '40px auto', background: '#fff0f0', borderRadius: '12px', border: '1px solid #f5c6cb' }}>
          <h1 style={{ color: '#721c24', fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong.</h1>
          <p style={{ color: '#333', marginBottom: '1rem' }}>The application encountered an unexpected runtime error:</p>
          <pre style={{ background: '#222', color: '#ff79c6', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.875rem' }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <details style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', color: '#666', fontSize: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Component Stack Trace</summary>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear Local Storage & Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
