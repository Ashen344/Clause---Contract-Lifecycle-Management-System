import * as React from "react";
import { cn } from "@/lib/utils";

type AppButtonVariant = "primary" | "secondary" | "danger";

export interface AppButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
}

const variantClasses: Record<AppButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow hover:opacity-90",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10",
  danger:
    "bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/20",
};

export function AppButton({
  className,
  variant = "secondary",
  type = "button",
  children,
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}