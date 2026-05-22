'use client';

import { useState, type ChangeEvent } from 'react';
import { Upload, FileText, ArrowRight, Check } from 'lucide-react';
import { Modal } from '@/components/primitives/modal';
import { Button } from '@/components/primitives/button';
import { Field, Select } from '@/components/primitives/field';
import { Alert } from '@/components/primitives/alert';

const TARGET_FIELDS = [
  { value: '', label: '— Skip this column —' },
  { value: 'name', label: 'Product name' },
  { value: 'sku', label: 'SKU' },
  { value: 'basePrice', label: 'Base price' },
  { value: 'compareAtPrice', label: 'Compare-at price' },
  { value: 'stockOnHand', label: 'Stock on hand' },
  { value: 'shortDescription', label: 'Short description' },
  { value: 'description', label: 'Full description' },
  { value: 'categoryName', label: 'Category' },
  { value: 'brandName', label: 'Brand' },
];

export function CsvImportModal({ open, onClose, onImport }: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => void;
}) {
  const [step, setStep] = useState<'upload' | 'map' | 'review'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [filename, setFilename] = useState('');

  const reset = () => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setFilename('');
  };

  const handleClose = () => { reset(); onClose(); };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      // Very basic CSV parsing — production would use papaparse
      const lines = text.split(/\r?\n/).filter(Boolean);
      const [headerLine, ...rest] = lines;
      const splitLine = (l: string) => l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const hdrs = splitLine(headerLine);
      const data = rest.map(splitLine);
      setHeaders(hdrs);
      setRows(data);
      // Auto-detect obvious mappings by header name
      const auto: Record<number, string> = {};
      hdrs.forEach((h, i) => {
        const lc = h.toLowerCase().trim();
        const match = TARGET_FIELDS.find(f => f.value.toLowerCase() === lc || f.label.toLowerCase() === lc);
        if (match) auto[i] = match.value;
      });
      setMapping(auto);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const doImport = () => {
    const mapped = rows.map(row => {
      const out: Record<string, string> = {};
      headers.forEach((_, i) => {
        const target = mapping[i];
        if (target && row[i] !== undefined) out[target] = row[i];
      });
      return out;
    }).filter(r => r.name || r.sku);
    onImport(mapped);
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import products from CSV"
      subtitle={step === 'upload' ? 'Upload a CSV file with one product per row' : step === 'map' ? `Map ${headers.length} columns from ${filename}` : 'Review and confirm import'}
      size="lg"
    >
      <div className="px-6 py-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {['upload', 'map', 'review'].map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full grid place-items-center text-2xs font-medium ${
                step === s ? 'bg-brand-700 text-white' :
                ['upload', 'map', 'review'].indexOf(step) > i ? 'bg-brand-100 text-brand-700' :
                'bg-stone-100 text-stone-400'
              }`}>{i + 1}</span>
              <span className={step === s ? 'text-stone-900 font-medium' : 'text-stone-500'}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              {i < 2 && <ArrowRight className="w-3 h-3 text-stone-300 mx-1" />}
            </span>
          ))}
        </div>

        {step === 'upload' && (
          <label className="block">
            <div className="w-full py-12 border-2 border-dashed border-stone-300 rounded-lg text-center hover:border-brand-600 hover:bg-brand-50/20 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
              <div className="text-sm font-medium text-stone-900">Click to choose a CSV file</div>
              <div className="text-xs text-stone-500 mt-1">First row should be column headers</div>
            </div>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
        )}

        {step === 'map' && (
          <>
            <Alert variant="info" className="mb-4">
              For each column in your CSV, choose which product field it maps to. Skip columns you don't need.
            </Alert>
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-2">
              {headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3 bg-stone-50/40 border border-stone-200 rounded-md">
                  <div>
                    <div className="text-sm font-medium text-stone-900">{h}</div>
                    <div className="text-xs text-stone-500 truncate">Example: {rows[0]?.[i] || '—'}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                  <Select
                    value={mapping[i] || ''}
                    onChange={e => setMapping({ ...mapping, [i]: e.target.value })}
                  >
                    {TARGET_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            <div className="text-xs text-stone-500 mt-3">
              Found <strong>{rows.length}</strong> rows · <strong>{Object.values(mapping).filter(Boolean).length}</strong> columns mapped
            </div>
          </>
        )}

        {step === 'review' && (
          <div>
            <Alert variant="success" className="mb-4">
              Ready to import <strong>{rows.length}</strong> products with <strong>{Object.values(mapping).filter(Boolean).length}</strong> mapped fields.
            </Alert>
            <details className="border border-stone-200 rounded-md">
              <summary className="px-4 py-2 text-sm cursor-pointer">Preview first 3 rows</summary>
              <pre className="px-4 py-3 text-xs bg-stone-50 overflow-x-auto">
{rows.slice(0, 3).map((row, i) =>
  Object.entries(mapping).filter(([_, v]) => v).map(([col, target]) => `${target}: ${row[Number(col)]}`).join('\n')
).join('\n\n')}
              </pre>
            </details>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-stone-50/60 border-t border-stone-200 flex items-center justify-between gap-2">
        <Button onClick={handleClose}>Cancel</Button>
        <div className="flex gap-2">
          {step === 'map' && (
            <Button onClick={() => setStep('upload')}>Back</Button>
          )}
          {step === 'map' && (
            <Button variant="primary" onClick={() => setStep('review')} disabled={!Object.values(mapping).filter(Boolean).length}>
              Continue → Review
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button onClick={() => setStep('map')}>Back</Button>
              <Button variant="primary" onClick={doImport}>
                <Check className="w-3.5 h-3.5" /> Import {rows.length} products
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
