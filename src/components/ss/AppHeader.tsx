import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, ListChecks } from "lucide-react";
import { signOut } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader({ subtitle = "Find a quiet space", showNav = true, signedIn = true }: { subtitle?: string; showNav?: boolean; signedIn?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xl font-bold leading-tight">StudySpace</span>
            <span className="block text-sm opacity-80">{subtitle}</span>
          </span>
        </Link>
        {showNav && !signedIn && (
          <nav className="flex items-center gap-2">
            <Link to="/login" className="inline-flex h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring">Log in</Link>
          </nav>
        )}
        {showNav && signedIn && (
          <nav className="flex items-center gap-1">
            <Link to="/my-bookings" className="grid h-12 w-12 place-items-center rounded-xl hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-ring" aria-label="My bookings">
              <ListChecks className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await qc.cancelQueries();
                qc.clear();
                await signOut();
                navigate({ to: "/login", replace: true });
              }}
              className="grid h-12 w-12 place-items-center rounded-xl hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
