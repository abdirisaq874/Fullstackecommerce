'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { cn, formatDate, initials } from '@/lib/utils';
import { Button, Input, Rating, EmptyState } from '@/components/ui';
import { useListReviewsQuery, useCreateReviewMutation } from '@/store/api/reviewsApi';
import { useAppSelector } from '@/store';

export function ProductReviews({ productId }: { productId: string }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const { data, isLoading } = useListReviewsQuery({ productId });
  const [createReview, { isLoading: posting }] = useCreateReviewMutation();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showForm, setShowForm] = useState(false);

  const reviews = data?.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createReview({ productId, rating, title: title || undefined, body: body || undefined }).unwrap();
      toast.success('Thanks for your review!');
      setTitle(''); setBody(''); setRating(5); setShowForm(false);
    } catch {
      toast.error('Could not submit review');
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Be the first to share your thoughts." />
        ) : (
          <ul className="space-y-6">
            {reviews.map((r) => (
              <li key={r._id} className="border-b border-line pb-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand">
                    {initials(r.authorName)}
                  </div>
                  <div>
                    <p className="font-bold">{r.authorName || 'Verified buyer'}</p>
                    <Rating value={r.rating} />
                  </div>
                  <span className="ml-auto text-sm text-muted-fg">{formatDate(r.createdAt)}</span>
                </div>
                {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                {r.body && <p className="mt-1 text-ink/90">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Write a review */}
      <aside>
        <div className="rounded-2xl border border-line bg-muted/40 p-5">
          <h3 className="font-display text-lg font-bold">Write a review</h3>
          {!token ? (
            <p className="mt-2 text-sm text-muted-fg">Please sign in to leave a review.</p>
          ) : !showForm ? (
            <Button className="mt-3 w-full" onClick={() => setShowForm(true)}>Rate this product</Button>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={cn('h-7 w-7', n <= rating ? 'fill-sale text-sale' : 'fill-muted text-muted')} />
                  </button>
                ))}
              </div>
              <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea
                placeholder="Share details of your experience"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="focus-ring w-full rounded-xl border-2 border-line bg-surface p-3 text-sm focus:border-brand"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={posting} className="flex-1">Submit</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
