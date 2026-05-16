import { useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
};

type DialogState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function useConfirm() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  const ConfirmDialog = dialog ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131829] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                dialog.variant === "danger"
                  ? "bg-red-100"
                  : dialog.variant === "warning"
                  ? "bg-amber-100"
                  : "bg-slate-100 dark:bg-white/8"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  dialog.variant === "danger"
                    ? "text-red-600"
                    : dialog.variant === "warning"
                    ? "text-amber-600"
                    : "text-slate-600"
                }`}
              />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {dialog.title ?? "Are you sure?"}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <p className="px-5 pb-5 pt-2 text-sm text-slate-600 dark:text-slate-400">{dialog.message}</p>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-white/8" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <Button variant="outline" className="h-9 rounded-xl px-4" onClick={handleCancel}>
            {dialog.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            className={`h-9 rounded-xl px-4 ${
              dialog.variant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : dialog.variant === "warning"
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-violet-600 text-white hover:bg-violet-700"
            }`}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
