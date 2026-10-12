import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Product, ProductCreateParams } from '@/types/api';
import { useCreateProduct, useUpdateProduct } from '@/hooks/use-products';
import { useToast } from '@/components/ui/toast';
import { parseApiError } from '@/lib/utils';

const productSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .regex(/^[A-Z0-9-]+$/i, 'SKU may only contain letters, numbers, and hyphens'),
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().min(1, 'Brand is required'),
  vehicle_fitment: z.string().min(1, 'Vehicle fitment is required'),
  price: z
    .string()
    .min(1, 'Price is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Price must be a positive amount with up to 2 decimal places')
    .refine((val) => parseFloat(val) > 0, 'Price must be greater than 0'),
  description: z.string().optional().default(''),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productToEdit?: Product | null;
  onSuccess?: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  open,
  onOpenChange,
  productToEdit,
  onSuccess,
}) => {
  const toast = useToast();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const isEditing = Boolean(productToEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      category: '',
      brand: '',
      vehicle_fitment: '',
      price: '',
      description: '',
    },
  });

  useEffect(() => {
    if (productToEdit) {
      reset({
        sku: productToEdit.sku,
        name: productToEdit.name,
        category: productToEdit.category,
        brand: productToEdit.brand,
        vehicle_fitment: productToEdit.vehicle_fitment,
        price: productToEdit.price,
        description: productToEdit.description || '',
      });
    } else {
      reset({
        sku: '',
        name: '',
        category: '',
        brand: '',
        vehicle_fitment: '',
        price: '',
        description: '',
      });
    }
  }, [productToEdit, reset]);

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (isEditing && productToEdit) {
        await updateMutation.mutateAsync({
          sku: productToEdit.sku,
          data: {
            name: data.name,
            category: data.category,
            brand: data.brand,
            vehicle_fitment: data.vehicle_fitment,
            price: data.price,
            description: data.description,
          },
        });
        toast.success(`Product ${productToEdit.sku} updated successfully.`);
      } else {
        await createMutation.mutateAsync(data as ProductCreateParams);
        toast.success(`Product ${data.sku} created with stock 0. Manage inventory in Inventory page.`);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Failed to ${isEditing ? 'update' : 'create'} product (${parsed.code})`);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit Product: ${productToEdit?.sku}` : 'Add New Product'}
      description={
        isEditing
          ? 'Update product details and price. SKU is permanent.'
          : 'Create a new catalogue part. Initial available stock will be set to 0 per system contract.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="SKU"
            placeholder="e.g. BRK-2050"
            disabled={isEditing || isPending}
            error={errors.sku?.message}
            required
            {...register('sku')}
          />
          <Input
            label="Price (₹)"
            placeholder="e.g. 1499.50"
            disabled={isPending}
            error={errors.price?.message}
            required
            {...register('price')}
          />
        </div>

        <Input
          label="Product Name"
          placeholder="e.g. Front Brake Disc Rotor"
          disabled={isPending}
          error={errors.name?.message}
          required
          {...register('name')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Brand"
            placeholder="e.g. Brembo / Endurance"
            disabled={isPending}
            error={errors.brand?.message}
            required
            {...register('brand')}
          />
          <Input
            label="Category"
            placeholder="e.g. Brakes"
            disabled={isPending}
            error={errors.category?.message}
            required
            {...register('category')}
          />
          <Input
            label="Vehicle Fitment"
            placeholder="e.g. Bajaj Pulsar 150"
            disabled={isPending}
            error={errors.vehicle_fitment?.message}
            required
            {...register('vehicle_fitment')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            disabled={isPending}
            placeholder="Detailed part description and technical specifications..."
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600">{errors.description.message}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
            {isEditing ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

