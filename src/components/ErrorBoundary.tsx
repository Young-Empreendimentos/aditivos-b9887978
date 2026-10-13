import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Captura erros de renderização do React e mostra uma tela de recuperação em vez
 * de ficar com a tela branca. Causa mais comum no celular: o tradutor do navegador
 * (Google Tradutor) mexe no DOM e o React estoura num removeChild/insertBefore.
 * Mesmo com a blindagem do DOM em main.tsx, este boundary é a rede de segurança final.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] erro de renderização:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Ops, algo deu errado ao exibir a tela.</h1>
            <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
              Se você estiver no celular com a <strong>tradução do navegador</strong> ligada,
              desligue a tradução desta página e recarregue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                fontSize: 16,
                borderRadius: 8,
                border: 'none',
                background: '#1a1a2e',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
