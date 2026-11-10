import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, fullName } from "@/lib/format";
import { ALL_STATUSES, type Applicant, type ApplicationStatus } from "@/lib/types";
import type { Page } from "@/lib/api";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { EmptyState, ErrorState, ListSkeleton, Pager, useDebounced } from "@/components/dashboard/common";
import ApplicantDialog from "./ApplicantDialog";

/** Shared by the recruiter (own company only) and admin (everything) — the server decides what each may see. */
const ApplicantsTable = ({ keyPrefix, fetcher, resumeUrl, review, showCompany = false }: {
  keyPrefix: string; fetcher: (q: Record<string, string | number | undefined>) => Promise<Page<Applicant>>;
  resumeUrl: (a: Applicant) => string; review: (id: number, b: { status?: ApplicationStatus; recruiter_note?: string }) => Promise<unknown>; showCompany?: boolean;
}) => {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Applicant | null>(null);
  const dq = useDebounced(q);
  const res = useQuery({
    queryKey: [keyPrefix, "applications", status, type, dq, page],
    queryFn: () => fetcher({ status: status === "all" ? undefined : status, type: type === "all" ? undefined : type, q: dq || undefined, page, per_page: 15 }),
    placeholderData: (p) => p,
  });
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden /><Input aria-label="Search applicants" className="pl-9" placeholder="Search by name, student ID or role" value={q} onChange={(e) => reset(() => setQ(e.target.value))} /></div>
        <Select value={status} onValueChange={(v) => reset(() => setStatus(v))}><SelectTrigger className="sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={type} onValueChange={(v) => reset(() => setType(v))}><SelectTrigger className="sm:w-40" aria-label="Type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="Internship">Internships</SelectItem><SelectItem value="Placement">Placements</SelectItem></SelectContent></Select>
      </div>
      {res.isLoading ? <ListSkeleton rows={5} /> : res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} /> :
        res.data!.data.length === 0 ? <EmptyState title="No applications found" description="Applications appear here as soon as students apply." /> : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table>
              <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Role</TableHead>{showCompany && <TableHead>Company</TableHead>}<TableHead>CGPA</TableHead><TableHead>Applied</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {res.data!.data.map((a) => (
                  <TableRow key={a.application_id} className="cursor-pointer" tabIndex={0} onClick={() => setSel(a)} onKeyDown={(e) => e.key === "Enter" && setSel(a)}>
                    <TableCell><div className="font-medium">{fullName(a)}</div><div className="text-xs text-muted-foreground">{a.student_id} · {a.major ?? "—"}</div></TableCell>
                    <TableCell><div>{a.title}</div><div className="text-xs text-muted-foreground">{a.type}</div></TableCell>
                    {showCompany && <TableCell>{a.company}</TableCell>}
                    <TableCell className="tabular-nums">{a.gpa ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(a.applied_at)}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      <Pager p={res.data?.pagination} onPage={setPage} />
      <ApplicantDialog applicant={sel} onClose={() => setSel(null)} resumeUrl={resumeUrl} review={review} />
    </div>
  );
};
export default ApplicantsTable;
