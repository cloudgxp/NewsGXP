import { JobsApiResponse, WeeklyDigestResponse } from '../types';

export interface JobsQueryFilters {
  company?: string | null;
  category?: string | null;
  region?: string | null;
  q?: string;
  newThisWeek?: boolean;
  limit?: number;
  forceFresh?: boolean;
}

export async function fetchJobs(filters?: JobsQueryFilters): Promise<JobsApiResponse> {
  const params = new URLSearchParams();
  if (filters?.company) params.set('company', filters.company);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.region) params.set('region', filters.region);
  if (filters?.q?.trim()) params.set('q', filters.q.trim());
  if (filters?.newThisWeek) params.set('newThisWeek', '1');
  params.set('limit', String(filters?.limit || 200));
  if (filters?.forceFresh) params.set('_t', String(Date.now()));

  const res = await fetch(`/api/jobs?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Unable to load remote AI jobs (HTTP ${res.status}).`);
  }

  return (await res.json()) as JobsApiResponse;
}

export async function fetchWeeklyDigest(): Promise<WeeklyDigestResponse> {
  const res = await fetch('/api/digest/weekly', {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Unable to generate weekly digest (HTTP ${res.status}).`);
  }

  return (await res.json()) as WeeklyDigestResponse;
}
