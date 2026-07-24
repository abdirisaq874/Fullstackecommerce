'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Upload, Download, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '@/components/primitives/modal';
import { Button } from '@/components/primitives/button';
import { Alert } from '@/components/primitives/alert';
import { useImportProductsMutation, useGetImportJobQuery, useCancelImportMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

const ACCEPT =
  '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TEMPLATE_HEADERS = [
  'handle', 'name', 'brand', 'basePrice', 'compareAtPrice', 'currency', 'stock', 'status',
  'imageUrls', 'variantImageUrl', 'sourceUrl', 'attributes', 'variantSku',
  'option1Name', 'option1Value', 'option2Name', 'option2Value', 'variantPrice', 'variantBarcode', 'variantWeightGrams',
];
const TEMPLATE_ROWS = [
  ['gsoemon-anc-earbuds', 'Gsoemon Wireless Earbuds with ANC', 'Gsoemon', '39.99', '54.99', 'USD', '120', 'active', 'https://source-cdn.example.com/earbuds.jpg', '', 'https://www.amazon.com/dp/B09K67QXKT', 'Battery Life:30h|Waterproof:IPX8', '', '', '', '', '', '', '', ''],
  ['classic-cotton-tee', 'Classic Cotton Crew Tee', 'Gaarsii Basics', '19.99', '', 'USD', '300', 'active', 'https://source-cdn.example.com/tee-black.jpg', 'https://source-cdn.example.com/tee-black.jpg', '', 'Material:100% Cotton', 'TEE-BLK-S', 'Color', 'Black', 'Size', 'S', '', '', '180'],
  ['classic-cotton-tee', '', '', '', '', '', '', '', '', 'https://source-cdn.example.com/tee-white.jpg', '', '', 'TEE-WHT-M', 'Color', 'White', 'Size', 'M', '', '', '185'],
];

function downloadTemplate() {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-upload-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' | 'amber' | 'stone' }) {
  const tones = {
    green: 'text-green-700 bg-green-50',
    red: 'text-red-700 bg-red-50',
    amber: 'text-amber-700 bg-amber-50',
    stone: 'text-stone-700 bg-stone-100',
  };
  return (
    <div className={clsx('rounded-md py-2', tones[tone])}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-2xs uppercase tracking-wide">{label}</div>
    </div>
  );
}

export function BulkImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const [importProducts, { isLoading: uploading }] = useImportProductsMutation();
  const [cancelImport, { isLoading: cancelling }] = useCancelImportMutation();
  const { data: job } = useGetImportJobQuery(jobId ?? '', {
    skip: !jobId || finished,
    pollingInterval: 1500,
  });

  // Stop polling once the backend reports a terminal status, and refresh the list.
  useEffect(() => {
    if (job && job.status !== 'processing') {
      setFinished(true);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const reset = () => {
    setFile(null);
    setJobId(null);
    setFinished(false);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = '';
  };

  const start = async () => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await importProducts(fd).unwrap();
      setJobId(res.jobId);
      setFinished(false);
      toast.info(
        `Import started — ${res.total} product${res.total === 1 ? '' : 's'} queued${res.skipped ? `, ${res.skipped} skipped` : ''}`,
      );
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message || 'Import failed to start';
      toast.error(msg);
    }
  };

  const onCancel = async () => {
    if (!jobId) return;
    try {
      await cancelImport(jobId).unwrap();
      toast.info('Cancelling — remaining products will be skipped (created ones stay).');
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message || 'Could not cancel import';
      toast.error(msg);
    }
  };

  const running = !!jobId;
  const done = finished && !!job;
  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk import products"
      subtitle={
        running
          ? 'Importing — this runs in the background; you can keep working.'
          : 'Upload a CSV or Excel file. The AI writes the description and assigns the category for every product.'
      }
      size="lg"
    >
      <div className="px-6 py-5">
        {!running && (
          <>
            <label className="block">
              <div className="w-full py-12 border-2 border-dashed border-stone-300 rounded-lg text-center hover:border-brand-600 hover:bg-brand-50/20 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
                <div className="text-sm font-medium text-stone-900">
                  {file ? file.name : 'Click to choose a CSV or Excel file'}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  .csv or .xlsx · one row per variant, grouped by handle
                </div>
              </div>
              <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 text-brand-700 hover:underline shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Download template
              </button>
              <span className="text-stone-500 text-right">
                Images are re-hosted to your storage · descriptions &amp; categories are AI-generated
              </span>
            </div>
          </>
        )}

        {running && job && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-stone-900">
                  {done ? (job.status === 'failed' ? 'Import failed' : job.status === 'cancelled' ? 'Import cancelled' : 'Import complete') : 'Importing…'}
                </span>
                <span className="text-stone-500">
                  {job.processed} / {job.total}
                </span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    done && job.status === 'failed' ? 'bg-red-500' : done && job.status === 'cancelled' ? 'bg-amber-500' : 'bg-brand-600',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Created" value={job.created} tone="green" />
              <Stat label="Failed" value={job.failed} tone={job.failed ? 'red' : 'stone'} />
              <Stat label="Skipped" value={job.skipped} tone={job.skipped ? 'amber' : 'stone'} />
            </div>

            {job.errors?.length > 0 && (
              <details className="border border-stone-200 rounded-md">
                <summary className="px-4 py-2 text-sm cursor-pointer">
                  {job.errors.length} issue{job.errors.length === 1 ? '' : 's'}
                </summary>
                <div className="px-4 py-2 max-h-48 overflow-y-auto scrollbar-thin text-xs space-y-1">
                  {job.errors.slice(0, 100).map((er, i) => (
                    <div key={i} className="text-stone-600">
                      <span className="text-stone-400">[{er.stage}]</span> {er.name || er.handle}: {er.message}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {done && (
              <Alert variant={job.status === 'failed' ? 'danger' : job.status === 'cancelled' ? 'info' : 'success'}>
                {job.status === 'cancelled' ? 'Cancelled — ' : ''}{job.created} product{job.created === 1 ? '' : 's'} imported
                {job.failed ? ` · ${job.failed} failed` : ''}
                {job.skipped ? ` · ${job.skipped} skipped` : ''}.
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-stone-50/60 border-t border-stone-200 flex items-center justify-end gap-2">
        {!running ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={start} disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" /> Start import
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {!done && (
              <Button variant="danger-ghost" onClick={onCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel import'}
              </Button>
            )}
            <Button variant={done ? 'primary' : 'secondary'} onClick={handleClose}>
              {done ? 'Done' : 'Close (keeps running)'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
