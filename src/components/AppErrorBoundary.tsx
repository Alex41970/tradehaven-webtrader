import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(e: unknown) { console.error(e); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-primary">DealStream FX</p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 max-w-md text-muted-foreground">Please reload the page. Your account and positions are safe.</p>
        <div className="mt-8 flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>Go home</Button>
        </div>
      </div>
    );
  }
}
