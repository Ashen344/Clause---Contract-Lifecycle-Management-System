import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLabel(value?: string | null): string {
  return (value || "—")
    .replace(/_/g, " ")
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

// MongoDB stores naive UTC datetimes (no Z). Without Z, JS treats them as local
// time instead of UTC. Normalise here so all timestamps display correctly.
function toUtcDate(value: string): Date {
  const s = value.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(value)
    ? value
    : value + "Z";
  return new Date(s);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = toUtcDate(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    return toUtcDate(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatCurrency(value?: number | null): string {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusBadgeClass(value?: string | null): string {
  switch ((value || "").toLowerCase()) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-amber-100 text-amber-700";
    case "low":
    case "active":
    case "approved":
    case "accepted":
    case "completed":
      return "bg-green-100 text-green-700";
    case "pending":
    case "changes_requested":
    case "paused":
    case "inactive":
      return "bg-amber-100 text-amber-700";
    case "rejected":
    case "declined":
    case "expired":
    case "terminated":
    case "suspended":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "renewed":
      return "bg-blue-100 text-blue-700";
    case "in_progress":
    case "review":
    case "approval":
    case "authoring":
    case "execution":
    case "monitoring":
    case "request":
    case "storage":
    case "renewal":
      return "bg-violet-100 text-violet-700";
    case "draft":
    case "skipped":
    default:
      return "bg-slate-100 text-slate-700";
  }
}