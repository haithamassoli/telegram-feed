"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onSessionExpired?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "An unexpected error occurred" };
  }

  componentDidCatch(error: Error) {
    // Detect GramJS session expiry
    const msg = error.message || "";
    if (
      msg.includes("AuthKey") ||
      msg.includes("AUTH_KEY") ||
      msg.includes("SESSION_EXPIRED") ||
      msg.includes("SESSION_REVOKED")
    ) {
      this.props.onSessionExpired?.();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-atmosphere noise-overlay flex items-center justify-center p-4">
          <div className="text-center max-w-sm animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-error-bg border border-error/15 flex items-center justify-center mx-auto mb-5">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-error/60"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-secondary mb-6 leading-relaxed">
              The app encountered an unexpected error. Try reloading to recover.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 cursor-pointer"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
