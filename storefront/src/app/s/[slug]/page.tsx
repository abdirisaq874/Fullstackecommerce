import { SellerStorefront } from '@/components/seller/SellerStorefront';

export const dynamic = 'force-dynamic';

export default function SellerPage({ params }: { params: { slug: string } }) {
  return <SellerStorefront idOrSlug={params.slug} />;
}
