import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/common";

const TONE: Record<string, string> = { pending: "border-amber-300 text-amber-800 bg-amber-50", approved: "border-emerald-200 text-emerald-700 bg-emerald-50", rejected: "border-red-200 text-red-700 bg-red-50", suspended: "border-slate-300 text-slate-700 bg-slate-100" };

const OrganisationTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const recs = useQuery({ queryKey: ["admin", "recruiters"], queryFn: () => api.admin.recruiters() });
  const cos = useQuery({ queryKey: ["admin", "companies"], queryFn: api.admin.companies });
  const done = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const fail = (e: unknown) => toast({ title: "Update failed", description: e instanceof ApiError ? e.message : undefined, variant: "destructive" });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => api.admin.setRecruiterStatus(id, status), onSuccess: (_d, v) => { toast({ title: `Recruiter ${v.status}` }); done(); }, onError: fail });
  const setCo = useMutation({ mutationFn: ({ id, ok }: { id: number; ok: boolean }) => api.admin.setCompanyApproved(id, ok), onSuccess: done, onError: fail });

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Recruiter accounts</CardTitle><CardDescription>Approving a recruiter also approves their company. Recruiters cannot sign in or post until approved.</CardDescription></CardHeader>
        <CardContent>
          {recs.isLoading ? <ListSkeleton rows={2} /> : recs.isError ? <ErrorState error={recs.error} onRetry={() => recs.refetch()} /> : recs.data!.length === 0 ? <EmptyState title="No recruiters registered" /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Recruiter</TableHead><TableHead>Company</TableHead><TableHead>Registered</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{recs.data!.map((r) => (
                <TableRow key={r.recruiter_id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                  <TableCell>{r.company}</TableCell><TableCell>{formatDate(r.created_at)}</TableCell>
                  <TableCell><Badge variant="outline" className={TONE[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-2">
                    {r.status !== "approved" && <Button size="sm" className="gap-1" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.recruiter_id, status: "approved" })}><Check className="h-3.5 w-3.5" />Approve</Button>}
                    {r.status === "pending" && <Button size="sm" variant="outline" className="gap-1" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.recruiter_id, status: "rejected" })}><X className="h-3.5 w-3.5" />Reject</Button>}
                    {r.status === "approved" && <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.recruiter_id, status: "suspended" })}>Suspend</Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table></div>)}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Companies</CardTitle><CardDescription>Listings of unapproved companies are hidden from students.</CardDescription></CardHeader>
        <CardContent>
          {cos.isLoading ? <ListSkeleton rows={2} /> : cos.isError ? <ErrorState error={cos.error} onRetry={() => cos.refetch()} /> : cos.data!.length === 0 ? <EmptyState title="No companies yet" /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>HQ</TableHead><TableHead>Recruiters</TableHead><TableHead>Listings</TableHead><TableHead>Approved</TableHead></TableRow></TableHeader>
              <TableBody>{cos.data!.map((c) => (
                <TableRow key={c.company_id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.headquarters_location ?? "—"}</TableCell><TableCell>{c.recruiters}</TableCell><TableCell>{c.listings}</TableCell>
                  <TableCell><Switch checked={c.is_approved} aria-label={`${c.is_approved ? "Revoke" : "Approve"} ${c.name}`} disabled={setCo.isPending} onCheckedChange={(ok) => setCo.mutate({ id: c.company_id, ok })} /></TableCell></TableRow>))}</TableBody></Table></div>)}
        </CardContent>
      </Card>
    </div>
  );
};
export default OrganisationTab;
