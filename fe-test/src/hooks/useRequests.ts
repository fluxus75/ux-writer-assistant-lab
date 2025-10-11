import React from 'react';
import type { RequestSummary } from '../lib/types';
import { getRequests } from '../lib/api';

export function useRequests(autoLoad: boolean = true) {
  const [requests, setRequests] = React.useState<RequestSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRequests();
      setRequests(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  return { requests, loading, error, refresh };
}
