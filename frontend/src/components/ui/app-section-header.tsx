import * as React from "react";
import { cn } from "@/lib/utils";

export function AppSectionEyebrow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function AppPageTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-3xl font-semibold tracking-tight text-slate-900 dark:text-white",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function AppPageDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
      {...props}
    >
      {children}
    </p>
  );
}