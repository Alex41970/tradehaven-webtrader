import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
    <Logo size="md" />
    <p className="mt-10 font-mono text-6xl font-bold text-primary">404</p>
    <h1 className="mt-4 text-2xl font-semibold text-foreground">Page not found</h1>
    <p className="mt-2 max-w-md text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
    <div className="mt-8 flex gap-3">
      <Button asChild><Link to="/">Go home</Link></Button>
      <Button asChild variant="outline"><Link to="/dashboard">Open dashboard</Link></Button>
    </div>
  </div>
);
export default NotFound;
