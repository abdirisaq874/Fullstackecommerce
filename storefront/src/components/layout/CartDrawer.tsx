'use client';

import Link from 'next/link';
import Image from 'next/image';
import { X, ShoppingBag, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Button, QtyStepper, EmptyState } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeCart } from '@/store/slices/uiSlice';
import {
  useGetCartQuery, useUpdateCartItemMutation, useRemoveCartItemMutation,
} from '@/store/api/cartApi';

export function CartDrawer() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.cartDrawerOpen);
  // Guests have carts too — see Header. Skipping here left the drawer empty for
  // exactly the shoppers we most want to convert.
  const { data: cart, isLoading } = useGetCartQuery();
  const [updateItem] = useUpdateCartItemMutation();
  const [removeItem] = useRemoveCartItemMutation();

  if (!open) return null;

  const items = cart?.items ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 animate-fade-up" onClick={() => dispatch(closeCart())} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            <ShoppingBag className="h-5 w-5" /> Your cart
          </h2>
          <button onClick={() => dispatch(closeCart())} className="focus-ring grid h-10 w-10 place-items-center rounded-lg hover:bg-muted" aria-label="Close cart">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-10 w-10" />}
              title="Your cart is empty"
              description="Find something you love."
              action={<Link href="/search"><Button>Start shopping</Button></Link>}
            />
          ) : (
            <ul className="space-y-4">
              {items.map((it) => (
                <li key={it.variantSku} className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {it.imageUrl && <Image src={it.imageUrl} alt={it.productName} fill className="object-cover" sizes="80px" />}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">{it.productName}</p>
                      <button onClick={() => removeItem(it.variantSku)} aria-label="Remove" className="text-muted-fg hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {it.variantName && <p className="text-xs text-muted-fg">{it.variantName}</p>}
                    <div className="mt-auto flex items-center justify-between">
                      <QtyStepper value={it.quantity} onChange={(q) => updateItem({ sku: it.variantSku, quantity: q })} />
                      <span className="font-bold">{formatPrice(it.unitPrice * it.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line p-5">
            <div className="mb-3 flex items-center justify-between text-lg font-bold">
              <span>Subtotal</span>
              <span>{formatPrice(cart?.subtotal ?? 0)}</span>
            </div>
            <p className="mb-3 text-xs text-muted-fg">Shipping & taxes calculated at checkout.</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/cart" onClick={() => dispatch(closeCart())}><Button variant="outline" className="w-full">View cart</Button></Link>
              <Link href="/checkout" onClick={() => dispatch(closeCart())}><Button className="w-full">Checkout</Button></Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
