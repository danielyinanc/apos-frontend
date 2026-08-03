'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { PacksActive } from '@/lib/format/capability';
import {
  PortfolioSnapshot,
  Problem,
  RegimeCurrent,
  RiskMeasures,
  type Problem as ProblemType,
} from '@/lib/format/schemas';

export class ApiError extends Error {
  status: number;
  problem?: ProblemType;
  constructor(message: string, status: number, problem?: ProblemType) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const problem = Problem.safeParse(body);
    throw new ApiError(
      problem.success ? (problem.data.detail ?? problem.data.title) : `${url} -> ${res.status}`,
      res.status,
      problem.success ? problem.data : undefined,
    );
  }
  return res.json();
}

export function usePacksActive() {
  return useQuery({
    queryKey: qk.packs,
    queryFn: () => fetchJson('/api/apos/packs/active').then((d) => PacksActive.parse(d)),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortfolioSnapshot() {
  return useQuery({
    queryKey: qk.portfolio,
    queryFn: () =>
      fetchJson('/api/apos/portfolio/snapshot').then((d) => PortfolioSnapshot.parse(d)),
  });
}

export function useRegimeCurrent() {
  return useQuery({
    queryKey: qk.regime,
    // A 503 here is DATA (which capability is unavailable), not a transient
    // failure worth retrying.
    retry: false,
    queryFn: () => fetchJson('/api/apos/regime/current').then((d) => RegimeCurrent.parse(d)),
  });
}

export function useRiskMeasures() {
  return useQuery({
    queryKey: qk.risk,
    queryFn: () => fetchJson('/api/apos/risk/measures').then((d) => RiskMeasures.parse(d)),
  });
}
