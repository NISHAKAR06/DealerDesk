import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} maxWidth="sm">
      <div className="flex items-start gap-3 mb-5">
        <div
          className={`p-2 rounded-full shrink-0 ${
            variant === 'destructive' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="text-xs text-slate-600 leading-relaxed pt-0.5">
          {description}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          size="sm"
          isLoading={isLoading}
          onClick={() => {
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};

