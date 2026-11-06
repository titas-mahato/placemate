import React from "react";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/types";

const STYLES: Record<ApplicationStatus, string> = {
  Applied: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Review": "bg-amber-50 text-amber-800 border-amber-200",
  Shortlisted: "bg-violet-50 text-violet-700 border-violet-200",
  Interview: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Offered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
};

export const StatusBadge = ({ status, className }: { status: ApplicationStatus; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STYLES[status], className)}>{status}</span>
);
export default StatusBadge;
