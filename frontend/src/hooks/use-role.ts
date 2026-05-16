import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { api } from "@/lib/api";

/**
 * Returns the current user's role from the backend DB (authoritative source).
 *
 * Why not just read user.publicMetadata.role?
 *   Clerk caches the session JWT — after an admin changes your role,
 *   publicMetadata won't update in the frontend until the JWT refreshes
 *   (up to 60 s). This hook reads directly from our MongoDB via /api/auth/me
 *   and refreshes every 30 s, so role changes are reflected almost immediately.
 *
 * The Clerk publicMetadata value is used as a fast initial value so the UI
 * never flickers for users whose role is already baked into the JWT.
 */
export function useRole() {
  const { user, isLoaded } = useUser();

  // Seed from Clerk JWT for instant render (may be stale, gets overwritten below)
  const clerkRole = String(
    user?.publicMetadata?.role || user?.unsafeMetadata?.role || ""
  )
    .trim()
    .toLowerCase();

  const [role, setRole] = useState<string>(clerkRole);

  // Keep Clerk fast-path seed in sync if the JWT updates (e.g. user.reload())
  useEffect(() => {
    if (clerkRole && !role) setRole(clerkRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkRole]);

  // Fetch the authoritative role from our backend, then poll every 30 s.
  useEffect(() => {
    if (!isLoaded || !user) return;

    // Sync name/email on first load so "Uploaded by" shows username not clerk_id
    api.syncUser({
      full_name: user.fullName ?? undefined,
      email: user.primaryEmailAddress?.emailAddress ?? undefined,
    }).catch(() => {});

    const fetchRole = () => {
      api
        .getMyProfile()
        .then((profile) => {
          const r = String(profile?.role ?? "").trim().toLowerCase();
          if (r) setRole(r);
        })
        .catch(() => {
          // Silently fall back to the Clerk JWT value already in state.
        });
    };

    fetchRole();
    const timer = setInterval(fetchRole, 30_000);
    return () => clearInterval(timer);
  }, [isLoaded, user?.id]);

  return {
    role,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isAdminOrManager: role === "admin" || role === "manager",
  };
}
