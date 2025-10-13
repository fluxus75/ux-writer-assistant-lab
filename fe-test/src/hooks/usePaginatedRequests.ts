import React from 'react';
import { getRequests, type GetRequestsParams, type PaginationMeta } from '../lib/api';
import type { RequestSummary } from '../lib/types';

interface UsePaginatedRequestsParams {
  autoLoad?: boolean;
  initialPageSize?: number;
}

export function usePaginatedRequests({ autoLoad = true, initialPageSize = 20 }: UsePaginatedRequestsParams = {}) {
  const [requests, setRequests] = React.useState<RequestSummary[]>([]);
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState<Omit<GetRequestsParams, 'page' | 'page_size'>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRequests({
        page,
        page_size: pageSize,
        ...filters,
      });
      setRequests(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  React.useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  const updateFilters = React.useCallback((newFilters: Omit<GetRequestsParams, 'page' | 'page_size'>) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const updatePage = React.useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const updatePageSize = React.useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  }, []);

  return {
    requests,
    pagination,
    loading,
    error,
    filters,
    page,
    pageSize,
    setFilters: updateFilters,
    setPage: updatePage,
    setPageSize: updatePageSize,
    refresh,
  };
}
