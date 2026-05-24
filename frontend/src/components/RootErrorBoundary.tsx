import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught root error:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.href = "/";
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-destructive/10 text-destructive mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred in the application. You can try refreshing the page or clearing the local data cache.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-muted p-4 rounded-lg overflow-x-auto border max-h-40 font-mono text-destructive">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={() => window.location.reload()}
                className="font-semibold"
              >
                Reload page
              </Button>
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="font-semibold"
              >
                Reset application cache
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
