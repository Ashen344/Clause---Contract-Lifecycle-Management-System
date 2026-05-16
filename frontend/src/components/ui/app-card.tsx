import * as React from "react";
import { cn } from "@/lib/utils";

type AppCardTone = "default" | "soft";

export interface AppCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AppCardTone;
  padded?: boolean;
}

const toneStyles: Record<AppCardTone, string> = {
  default:
    "border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#131829]",
  soft: "border-violet-100 bg-violet-50/60 dark:border-violet-500/20 dark:bg-violet-500/10",
};

export function AppCard({
  className,
  tone = "default",
  padded = true,
  children,
  ...props
}: AppCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border shadow-sm transition-all duration-200",
        toneStyles[tone],
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppCardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-6 flex items-start justify-between gap-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppCardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-2xl font-semibold tracking-tight text-slate-900 dark:text-white",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function AppCardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-sm text-slate-500 dark:text-slate-400", className)}
      {...props}
    >
      {children}
    </p>
  );
}