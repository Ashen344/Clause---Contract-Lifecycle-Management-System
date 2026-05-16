import { useUser } from "@clerk/clerk-react";

/**
 * Returns a function that resolves a Clerk user ID to a display string.
 * If the ID matches the current user, shows their email (or full name).
 * Otherwise returns the ID unchanged.
 */
export function useResolveUser() {
  const { user } = useUser();

  return (clerkId: string | null | undefined): string => {
    if (!clerkId) return "—";
    if (clerkId === user?.id) {
      return (
        user.primaryEmailAddress?.emailAddress ||
        user.fullName ||
        clerkId
      );
    }
    return clerkId;
  };
}
