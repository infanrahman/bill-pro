import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
 children: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
 errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false,
 error: null,
 errorInfo: null
 };

 public static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error, errorInfo: null };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error('Uncaught error:', error, errorInfo);
 this.setState({ error, errorInfo });
 }

 public render() {
 if (this.state.hasError) {
 return (
 <div style={{ padding: '20px', backgroundColor: '#fff', color: '#000', height: '100vh', overflow: 'auto' }}>
 <h1>Something went wrong.</h1>
 <h2 style={{ color: 'red' }}>{this.state.error?.message}</h2>
 <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
 <summary>Stack Trace</summary>
 {this.state.errorInfo?.componentStack}
 </details>
 <button type="button"
 onClick={() => window.location.reload()}
 style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
 >
 Reload Application
 </button>
 </div>
);
 }

 return this.props.children;
 }
}

export default ErrorBoundary;
