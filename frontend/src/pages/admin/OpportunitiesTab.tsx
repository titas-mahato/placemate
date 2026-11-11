import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorState, ListSkeleton, Pager, useDebounced } from "@/components/dashboard/common";

const OpportunitiesTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const res = useQuery({ queryKey: ["admin", "opportunities", type, status, dq, page], queryFn: () => api.admin.opportunities({ type: type === "all" ? undefined : type, status: status === "all" ? undefined : status, q: dq, page, per_page: 20 }), placeholderData: (p) => p });
  const toggle = useMutation({
    mutationFn: (o: { type: "Internship" | "Placement"; id: number; active: boolean }) => api.admin.setOpportunityActive(o.type, o.id, o.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e) => toast({ title: "Update failed", description: e instanceof ApiError ? e.message : undefined, variant: "destructive" }),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden /><Input aria-label="Search opportunities" className="pl-9" placeholder="Search title or company" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}><SelectTrigger className="sm:w-44" aria-label="Type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="Internship">Internships</SelectItem><SelectItem value="Placement">Placements</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="sm:w-40" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Open &amp; closed</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed / expired</SelectItem></SelectContent></Select>
      </div>
      {res.isLoading ? <ListSkeleton rows={5} /> : res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} /> : res.data!.data.length === 0 ? <EmptyState title="No opportunities found" /> : (
        <div className="overflow-x-auto rounded-xl border bg-white"><Table>
          <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Company</TableHead><TableHead>Deadline</TableHead><TableHead>Applicants</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Moderate</TableHead></TableRow></TableHeader>
          <TableBody>{res.data!.data.map((o) => (
            <TableRow key={`${o.type}-${o.id}`}>
              <TableCell><div className="font-medium">{o.title}</div><Badge variant="secondary" className="mt-0.5 text-xs">{o.type}</Badge></TableCell>
              <TableCell>{o.company}</TableCell><TableCell>{formatDate(o.deadline)}</TableCell><TableCell className="tabular-nums">{o.applicants}</TableCell>
              <TableCell><Badge variant="outline" className={o.is_active ? "border-emerald-200 text-emerald-700" : "border-slate-300 text-slate-600"}>{o.is_active ? "Active" : "Closed"}</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ type: o.type, id: o.id, active: !o.is_active })}>{o.is_active ? "Close" : "Reopen"}</Button></TableCell>
            </TableRow>))}</TableBody></Table></div>)}
      <Pager p={res.data?.pagination} onPage={setPage} />
    </div>
  );
};
export default OpportunitiesTab;
