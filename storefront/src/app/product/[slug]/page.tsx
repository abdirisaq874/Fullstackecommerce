import type { Metadata } from 'next';
import { ProductDetail } from '@/components/product/ProductDetail';
import { API_URL } from '@/lib/utils';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/products/${params.slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Product' };
    const body = await res.json();
    // Backend wraps responses in { success, data, timestamp } — unwrap to the product.
    const p = body?.data ?? body;
    return {
      title: p.name,
      description: p.shortDescription || (p.description ? String(p.description).slice(0, 150) : undefined),
      openGraph: { title: p.name, images: p.images?.[0]?.url ? [p.images[0].url] : undefined },
    };
  } catch {
    return { title: 'Product' };
  }
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  return <ProductDetail slug={params.slug} />;
}
