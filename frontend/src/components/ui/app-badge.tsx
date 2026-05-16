import * as React from "react";
import { cn } from "@/lib/utils";

type AppBadgeVariant =
  | "slate"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "dark";

const badgeStyles: Record<AppBadgeVariant, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  dark: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
};

export interface AppBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: AppBadgeVariant;
}

export function AppBadge({
  className,
  variant = "slate",
  children,
  ...props
}: AppBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        badgeStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}