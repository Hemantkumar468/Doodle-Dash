import React from 'react';
import { HeartCrack, House, RefreshCw } from 'lucide-react';
import { messages } from '../lib/messages';
import { Button } from './ui';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[ui error]', error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app-bg safe-all flex min-h-dvh items-center justify-center p-3 sm:p-5">
        <section className="surface-dark w-full max-w-md p-5 text-center sm:p-7" role="alert">
          <HeartCrack className="mx-auto h-12 w-12 text-rose-300" aria-hidden="true" />
          <h1 className="mt-4 break-words font-display text-2xl font-bold text-white">{messages.crash.title}</h1>
          <p className="mt-2 break-words text-base leading-relaxed text-violet-200">{messages.crash.text}</p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button full onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" aria-hidden="true" />{messages.crash.reload}</Button>
            <a className="secondary-button w-full" href="/"><House className="h-4 w-4" aria-hidden="true" />{messages.crash.home}</a>
          </div>
        </section>
      </main>
    );
  }
}
