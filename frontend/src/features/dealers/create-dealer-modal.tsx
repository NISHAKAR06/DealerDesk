import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DealerCreateParams } from '@/types/api';
import { useCreateDealer } from '@/hooks/use-dealers';
import { useToast } from '@/components/ui/toast';
import { parseApiError } from '@/lib/utils';

const dealerSchema = z.object({
  dealer_code: z
    .string()
    .min(1, 'Dealer code is required')
    .regex(/^[A-Z0-9-]+$/i, 'Dealer code may only contain alphanumeric characters and hyphens'),
  name: z.string().min(2, 'Dealer name must be at least 2 characters'),
  city: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().optional().default(''),
  credit_limit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Credit limit must be a positive number with at most 2 decimals')
    .optional()
    .or(z.literal('')),
});

type DealerFormData = z.infer<typeof dealerSchema>;

interface CreateDealerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateDealerModal: React.FC<CreateDealerModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const toast = useToast();
  const createMutation = useCreateDealer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DealerFormData>({
    resolver: zodResolver(dealerSchema),
    defaultValues: {
      dealer_code: '',
      name: '',
      city: '',
      phone: '',
      email: '',
      gstin: '',
      credit_limit: '100000.00',
    },
  });

  const onSubmit = async (data: DealerFormData) => {
    try {
      const payload: DealerCreateParams = {
        dealer_code: data.dealer_code.trim(),
        name: data.name.trim(),
        city: data.city?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        email: data.email?.trim() || undefined,
        gstin: data.gstin?.trim() || undefined,
        credit_limit: data.credit_limit?.trim() || undefined,
      };

      await createMutation.mutateAsync(payload);
      toast.success(`Dealer ${data.name} (${data.dealer_code}) created successfully.`);
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Failed to Create Dealer (${parsed.code})`);
    }
  };

  const isPending = createMutation.isPending || isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Register New Dealer Account"
      description="Create a dealer entity for spare-parts distribution and credit requisitions."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Dealer Code"
            placeholder="e.g. DLR-028"
            disabled={isPending}
            error={errors.dealer_code?.message}
            required
            {...register('dealer_code')}
          />

          <Input
            label="Credit Limit (₹)"
            placeholder="e.g. 100000.00"
            disabled={isPending}
            error={errors.credit_limit?.message}
            {...register('credit_limit')}
          />
        </div>

        <Input
          label="Dealership / Business Name"
          placeholder="e.g. Speed Superbike Spares"
          disabled={isPending}
          error={errors.name?.message}
          required
          {...register('name')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="City / Location"
            placeholder="e.g. Bengaluru"
            disabled={isPending}
            error={errors.city?.message}
            {...register('city')}
          />

          <Input
            label="Contact Phone"
            placeholder="e.g. 9876543210"
            disabled={isPending}
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Billing Email"
            placeholder="e.g. orders@dealer.in"
            type="email"
            disabled={isPending}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="GSTIN Number"
            placeholder="e.g. 29AABP5506A1Z6"
            disabled={isPending}
            error={errors.gstin?.message}
            {...register('gstin')}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
            Register Dealer
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

