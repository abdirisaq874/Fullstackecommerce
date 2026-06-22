'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/product/product-form';
import { TableSkeleton, ErrorState } from '@/components/data/states';
import { Card } from '@/components/primitives/card';
import { useGetProductQuery, useUpdateProductMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: product, isLoading, isError, refetch } = useGetProductQuery(params.id);
  const [updateProduct, { isLoading: saving }] = useUpdateProductMutation();
  const toast = useToast();

  if (isLoading) return <Card><TableSkeleton rows={4} columns={3} /></Card>;
  if (isError || !product) return <ErrorState onRetry={refetch} message="We couldn’t load this product." />;

  return (
    <ProductForm
      mode="edit"
      existing={product}
      saving={saving}
      onSave={async (dto, status, stock) => {
        await updateProduct({ id: product.id, patch: { ...dto, status, stock } }).unwrap();
        toast.success(status === 'active' ? 'Product published' : 'Saved');
        router.push('/products');
      }}
    />
  );
}
