'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/product/product-form';
import { useCreateProductMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

export default function NewProductPage() {
  const router = useRouter();
  const [createProduct, { isLoading }] = useCreateProductMutation();
  const toast = useToast();

  return (
    <ProductForm
      mode="new"
      saving={isLoading}
      onSave={async (dto, status) => {
        await createProduct({ ...dto, status }).unwrap();
        toast.success(status === 'active' ? 'Product published' : 'Draft saved');
        router.push('/products');
      }}
    />
  );
}
