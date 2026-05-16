import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardSection, PinnedContract, SectionVisibility, UserPreferences, WidgetVisibility } from "@/types/api";

const DEFAULT_PREFS: UserPreferences = {
  widget_visibility: {
    total_contracts: true,
    active_contracts: true,
    pending_approvals: true,
    high_risk: true,
  },
  section_visibility: {},
  default_contract_filter: "",
  pinned_contracts: [],
  accent_color: "indigo",
  activity_count: 10,
};

const LS_KEY = "clause_user_prefs";

function loadFromLS(): UserPreferences | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserPreferences;
  } catch {
    return null;
  }
}

function saveToLS(prefs: UserPreferences): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(
    () => loadFromLS() ?? DEFAULT_PREFS
  );
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .getPreferences()
      .then((data) => {
        const merged: UserPreferences = {
          ...DEFAULT_PREFS,
          ...data,
          widget_visibility: {
            ...DEFAULT_PREFS.widget_visibility,
            ...(data.widget_visibility ?? {}),
          },
        };
        setPrefs(merged);
        saveToLS(merged);
      })
      .catch(() => {
        // Backend unreachable — keep localStorage silently
      })
      .finally(() => setLoading(false));
  }, []);

  const debounce = useCallback((fn: () => void, ms: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  }, []);

  const setWidgetVisibility = useCallback(
    (key: keyof WidgetVisibility, visible: boolean) => {
      setPrefs((prev) => {
        const next: UserPreferences = {
          ...prev,
          widget_visibility: { ...prev.widget_visibility, [key]: visible },
        };
        saveToLS(next);
        debounce(() => {
          api.updatePreferences({ widget_visibility: next.widget_visibility }).catch(() => {});
        }, 500);
        return next;
      });
    },
    [debounce]
  );

  const setSectionVisibility = useCallback(
    (key: DashboardSection, visible: boolean) => {
      setPrefs((prev) => {
        const next: UserPreferences = {
          ...prev,
          section_visibility: { ...prev.section_visibility, [key]: visible },
        };
        saveToLS(next);
        debounce(() => {
          api.updatePreferences({ section_visibility: next.section_visibility }).catch(() => {});
        }, 500);
        return next;
      });
    },
    [debounce]
  );

  const setActivityCount = useCallback(
    (count: number) => {
      setPrefs((prev) => {
        const next: UserPreferences = { ...prev, activity_count: count };
        saveToLS(next);
        debounce(() => { api.updatePreferences({ activity_count: count }).catch(() => {}); }, 300);
        return next;
      });
    },
    [debounce]
  );

  const setDefaultFilter = useCallback(
    (filter: string) => {
      setPrefs((prev) => {
        const next: UserPreferences = { ...prev, default_contract_filter: filter };
        saveToLS(next);
        debounce(() => {
          api.updatePreferences({ default_contract_filter: filter }).catch(() => {});
        }, 300);
        return next;
      });
    },
    [debounce]
  );

  const setAccentColor = useCallback((color: string) => {
    setPrefs((prev) => {
      const next: UserPreferences = { ...prev, accent_color: color };
      saveToLS(next);
      api.updatePreferences({ accent_color: color }).catch(() => {});
      return next;
    });
  }, []);

  const pinContract = useCallback((contract: PinnedContract) => {
    setPrefs((prev) => {
      if (prev.pinned_contracts.some((p) => p.id === contract.id)) return prev;
      if (prev.pinned_contracts.length >= 5) return prev;
      const next: UserPreferences = {
        ...prev,
        pinned_contracts: [...prev.pinned_contracts, contract],
      };
      saveToLS(next);
      api.updatePreferences({ pinned_contracts: next.pinned_contracts }).catch(() => {});
      return next;
    });
  }, []);

  const unpinContract = useCallback((contractId: string) => {
    setPrefs((prev) => {
      const next: UserPreferences = {
        ...prev,
        pinned_contracts: prev.pinned_contracts.filter((p) => p.id !== contractId),
      };
      saveToLS(next);
      api.updatePreferences({ pinned_contracts: next.pinned_contracts }).catch(() => {});
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (contractId: string) => prefs.pinned_contracts.some((p) => p.id === contractId),
    [prefs.pinned_contracts]
  );

  const canPin = prefs.pinned_contracts.length < 5;

  return {
    prefs,
    loading,
    setWidgetVisibility,
    setSectionVisibility,
    setActivityCount,
    setDefaultFilter,
    setAccentColor,
    pinContract,
    unpinContract,
    isPinned,
    canPin,
  };
}