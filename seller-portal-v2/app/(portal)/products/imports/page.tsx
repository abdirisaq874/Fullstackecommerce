'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, RotateCcw, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { useListImportsQuery, useRetryImportMutation, type ImportJob } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import clsx from 'clsx';

function statusBadge(status: ImportJob['status']) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  if (status === 'failed') return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="warning">Processing…</Badge>;
}

export default function ImportHistoryPage() {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<string | null>(null);

  const { data: jobs = [], isLoading, isError, refetch, isFetching } = useListImportsQuery();
  // While anything is still processing, poll so counters/progress update live.
  const anyProcessing = jobs.some((j) => j.status === 'processing');
  useListImportsQuery(undefined, { pollingInterval: anyProcessing ? 3000 : 0, skip: !anyProcessing });

  const [retryImport] = useRetryImportMutation();

  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const onRetry = async (job: ImportJob) => {
    setRetrying(job._id);
    try {
      const res = await retryImport(job._id).unwrap();
      toast.success(`Retrying ${res.total} failed item${res.total === 1 ? '' : 's'}…`);
    } catch (e) {
      toast.error((e as { data?: { message?: string } })?.data?.message || 'Could not start retry');
    } finally {
      setRetrying(null);
    }
  };

  const subtitle = useMemo(() => `${jobs.length} import${jobs.length === 1 ? '' : 's'}`, [jobs.length]);

  return (
    <>
      <PageHeader
        title="Import history"
        subtitle={subtitle}
        actions={
          <>
            <Button onClick={() => router.push('/products')}><ArrowLeft className="w-3.5 h-3.5" /> Products</Button>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className={clsx('w-3.5 h-3.5', isFetching && 'animate-spin')} /> Refresh
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <Card><TableSkeleton rows={5} columns={4} /></Card>
      ) : jobs.length === 0 ? (
        <EmptyState title="No imports yet" description="Bulk-import a CSV/XLSX from the Products page and it'll show up here." />
      ) : (
        <Card className="divide-y divide-stone-100">
          {jobs.map((job) => {
            const isOpen = expanded.has(job._id);
            const pct = job.total ? Math.round((job.processed / job.total) * 100) : 0;
            const canRetry = (job.retriableCount ?? 0) > 0;
            return (
              <div key={job._id} className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggle(job._id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                  >
                    {(job.errors?.length ?? 0) > 0
                      ? (isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-stone-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-stone-400" />)
                      : <span className="w-4 shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">
                        {job.retryOf ? '↻ ' : ''}{job.filename || 'import'}
                      </div>
                      <div className="text-xs text-stone-500">
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="text-green-700">{job.created} created</span>
                    <span className={job.failed ? 'text-red-700' : 'text-stone-400'}>{job.failed} failed</span>
                    <span className={job.skipped ? 'text-amber-700' : 'text-stone-400'}>{job.skipped} skipped</span>
                  </div>

                  {statusBadge(job.status)}

                  {canRetry && (
                    <Button
                      variant="primary"
                      onClick={() => onRetry(job)}
                      disabled={retrying === job._id}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {retrying === job._id ? 'Starting…' : `Retry ${job.retriableCount} failed`}
                    </Button>
                  )}
                </div>

                {job.status === 'processing' && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {isOpen && (job.errors?.length ?? 0) > 0 && (
                  <ul className="mt-3 space-y-1 rounded-md bg-stone-50 p-3 text-xs">
                    {job.errors.map((er, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-red-600">•</span>
                        <span className="text-stone-700">
                          <span className="font-medium">{er.name || er.handle || 'row'}</span>
                          {er.stage ? <span className="text-stone-400"> ({er.stage})</span> : null}
                          {' — '}{er.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
