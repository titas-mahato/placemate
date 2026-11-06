import React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Pagination } from "@/lib/types";
import { ApiError } from "@/lib/api";

export const StatCard = ({ label, value, hint, icon, tone = "primary" }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: "primary" | "green" | "amber" | "violet" }) => {
  const tones = { primary: "bg-primary/10 text-primary", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", violet: "bg-violet-100 text-violet-700" };
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])} aria-hidden>{icon}</div>}
      </CardContent>
    </Card>
  );
};

export const EmptyState = ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-12 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Inbox className="h-6 w-6" /></div>
    <h3 className="text-base font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
    <AlertTriangle className="mb-2 h-7 w-7 text-red-600" />
    <p className="font-semibold text-red-800">Something went wrong</p>
    <p className="mt-1 max-w-md text-sm text-red-700">{error instanceof ApiError || error instanceof Error ? error.message : "Unexpected error"}</p>
    {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
  </div>
);

export const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
  </div>
);

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;

export const Pager = ({ p, onPage }: { p?: Pagination; onPage: (n: number) => void }) => {
  if (!p || p.pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between pt-3 text-sm" aria-label="Pagination">
      <span className="text-muted-foreground">Page {p.page} of {p.pages} · {p.total} results</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={p.page >= p.pages} onClick={() => onPage(p.page + 1)}>Next</Button>
      </div>
    </nav>
  );
};

/** Renders one server-side validation message under a form control. */
export const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">{message}</p> : null;

export const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
};
