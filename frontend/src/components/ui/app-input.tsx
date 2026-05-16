import * as React from "react";
import { cn } from "@/lib/utils";

export interface AppInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-500/50 dark:focus:ring-indigo-500/10",
          className
        )}
        {...props}
      />
    );
  }
);

AppInput.displayName = "AppInput";