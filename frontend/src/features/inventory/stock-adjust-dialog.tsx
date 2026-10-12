import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Product } from '@/types/api';
import { useAdjustInventory } from '@/hooks/use-inventory';
import { useToast } from '@/components/ui/toast';
import { parseApiError } from '@/lib/utils';
import { AlertCircle, Info } from 'lucide-react';

interface StockAdjustDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const StockAdjustDialog: React.FC<StockAdjustDialogProps> = ({
  product,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const toast = useToast();
  const adjustMutation = useAdjustInventory();

  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setQuantity(String(product.stock));
      setReason('');
      setStep('form');
      setValidationError(null);
    }
  }, [product, open]);

  if (!product) return null;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 0 || String(parsedQty) !== quantity.trim()) {
      setValidationError('Quantity must be an integer greater than or equal to 0.');
      return;
    }
    if (!reason.trim()) {
      setValidationError('A reason is strictly required for auditing inventory adjustments.');
      return;
    }
    setValidationError(null);
    setStep('confirm');
  };

  const handleConfirmSubmit = async () => {
    const parsedQty = parseInt(quantity, 10);
    try {
      await adjustMutation.mutateAsync({
        sku: product.sku,
        data: {
          quantity: parsedQty,
          reason: reason.trim(),
        },
      });
      toast.success(
        `Available stock for ${product.sku} adjusted to ${parsedQty} units.`,
        'Inventory Corrected'
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Stock adjustment failed (${parsed.code})`);
      setStep('form');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={step === 'form' ? `Adjust Inventory Stock: ${product.sku}` : 'Confirm Stock Override'}
      description={
        step === 'form'
          ? 'Correct the available physical warehouse stock for this catalogue item.'
          : 'Please review the audit reason and target stock count before applying.'
      }
      maxWidth="md"
    >
      {step === 'form' ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4">
          {/* Important Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-0.5">Absolute Count Overwrite:</strong>
              This operation <em>replaces</em> the available stock to exactly the specified count. It does not add to the existing quantity.
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs space-y-1">
            <div className="font-semibold text-slate-800">{product.name}</div>
            <div className="text-slate-500">
              Current Available Quantity:{' '}
              <strong className="text-slate-900 font-mono text-sm">{product.stock}</strong> units
            </div>
          </div>

          <Input
            label="New Available Quantity"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 25"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setValidationError(null);
            }}
            required
            helperText="Must be an integer ≥ 0"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Adjustment Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. physical stock count correction, damaged goods write-off"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setValidationError(null);
              }}
              required
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {validationError && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Review Adjustment
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">SKU Code:</span>
              <span className="font-mono font-semibold text-slate-800">{product.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Stock:</span>
              <span className="font-mono text-slate-700">{product.stock}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-2 text-indigo-700">
              <span>New Available Stock:</span>
              <span className="font-mono text-sm">{quantity} units</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500">Audit Reason:</span>
              <span className="text-slate-900 italic">&ldquo;{reason}&rdquo;</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={adjustMutation.isPending}
              onClick={() => setStep('form')}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={adjustMutation.isPending}
              onClick={handleConfirmSubmit}
            >
              Confirm &amp; Overwrite Stock
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};

