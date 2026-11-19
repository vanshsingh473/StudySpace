import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession, type StudentInfo } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";

/** Renders children with the session once loaded; sends signed-out users to /login. */
export function RequireStudent({ children }: { children: (s: { token: string; student: StudentInfo }) => ReactNode }) {
  const { ready, session } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !session) navigate({ to: "/login", replace: true });
  }, [ready, session, navigate]);
  if (!ready || !session) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }
  return <>{children(session)}</>;
}
