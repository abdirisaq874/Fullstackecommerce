'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ViewedItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency?: string;
  imageUrl?: string;
}

const KEY = 'suuq:recentlyViewed';
const MAX = 12;

function read(): ViewedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * Client-side recently-viewed products (localStorage). Powers the "Recently
 * viewed" rail and feeds the personalized "For you" recommendations.
 */
export function useRecentlyViewed() {
  const [items, setItems] = useState<ViewedItem[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  const track = useCallback((item: ViewedItem) => {
    if (typeof window === 'undefined' || !item?.id) return;
    const next = [item, ...read().filter((v) => v.id !== item.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    setItems(next);
  }, []);

  return { items, ids: items.map((i) => i.id), track };
}
