import * as React from "react";
import { cn } from "@/lib/utils";

export interface AppEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function AppEmptyState({
  icon,
  title,
  description,
  className,
}: AppEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-blue-100 bg-blue-50/60 px-6 py-10 text-center dark:border-blue-500/20 dark:bg-blue-500/10",
        className
      )}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/10">
          {icon}
        </div>
      ) : null}

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </p>

      {description ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}