import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { api, setAuthTokenProvider } from "@/lib/api";

/**
 * Bridges Clerk auth into the API client:
 *  - Registers a token provider so every fetch sends a fresh JWT.
 *  - Syncs the signed-in user into the backend DB exactly once per session.
 *  - Calls user.reload() after sync so publicMetadata.role is fresh
 *    (Clerk caches the session; reload forces a re-fetch of publicMetadata).
 *
 * Render this once inside <SignedIn> (after <ClerkProvider>).
 */
export function AuthBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      setAuthTokenProvider(() => getToken());
    } else {
      setAuthTokenProvider(null);
      syncedRef.current = false;
    }

    return () => {
      // On unmount, leave the provider in place — the component lives for the
      // whole signed-in session, so this only fires on full teardown.
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncedRef.current) return;
    syncedRef.current = true;

    api.syncUser({
        full_name: user?.fullName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
      })
      .then(() => {
        // Force Clerk to re-fetch the user profile so publicMetadata.role
        // (set by the backend via Clerk Management API) is available immediately.
        return user?.reload();
      })
      .catch((err) => {
        console.warn("User sync failed:", err);
        // Allow a retry on the next mount if it failed.
        syncedRef.current = false;
      });
  }, [isLoaded, isSignedIn, user]);

  return null;
}
