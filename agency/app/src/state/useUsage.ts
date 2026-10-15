import type { UsageSummary } from '@pixel-agency/shared';
import { useEffect, useState } from 'react';

import { useAgency } from './store';

const REFRESH_MS = 60_000;

/** Usage summary from the backend, refreshed on `usageChanged` and every minute. */
export function useUsageSummary(): {
  summary: UsageSummary | null;
  error: string | null;
  updatedAt: number | null;
} {
  const api = useAgency((s) => s.api);
  const version = useAgency((s) => s.usageVersion);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    api
      .usageSummary()
      .then((s) => {
        if (!alive) return;
        setSummary(s);
        setError(null);
        setUpdatedAt(Date.now());
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [api, version, tick]);

  return { summary, error, updatedAt };
}
