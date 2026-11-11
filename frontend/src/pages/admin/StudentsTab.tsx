import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { fullName } from "@/lib/format";
import { EmptyState, ErrorState, ListSkeleton, Pager, useDebounced } from "@/components/dashboard/common";

const StudentsTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ q: "", major: "all", skill: "all", placed: "all", gpa_min: "", gpa_max: "", year_min: "", year_max: "", sort_by: "student_id", sort_dir: "asc", page: 1 });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...p }));
  const q = useDebounced(f.q);
  const query = {
    q, major: f.major === "all" ? undefined : f.major, skill: f.skill === "all" ? undefined : f.skill, placed: f.placed === "all" ? undefined : f.placed,
    gpa_min: f.gpa_min, gpa_max: f.gpa_max, year_min: f.year_min, year_max: f.year_max, sort_by: f.sort_by, sort_dir: f.sort_dir,
  };
  const filters = useQuery({ queryKey: ["admin", "filters"], queryFn: api.admin.filters });
  const list = useQuery({ queryKey: ["admin", "students", query, f.page], queryFn: () => api.admin.students({ ...query, page: f.page, per_page: 20 }), placeholderData: (p) => p });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.admin.setStudentActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "students"] }),
    onError: (e) => toast({ title: "Update failed", description: e instanceof ApiError ? e.message : undefined, variant: "destructive" }),
  });
  const sortHead = (key: string, label: string) => (
    <TableHead><button className="flex items-center gap-1 font-medium" onClick={() => set({ sort_by: key, sort_dir: f.sort_by === key && f.sort_dir === "asc" ? "desc" : "asc" })} aria-label={`Sort by ${label}`}>
      {label}{f.sort_by === key ? (f.sort_dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</button></TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden /><Input aria-label="Search students" className="pl-9" placeholder="Search name, ID or email" value={f.q} onChange={(e) => set({ q: e.target.value })} /></div>
        <Select value={f.major} onValueChange={(v) => set({ major: v })}><SelectTrigger aria-label="Program"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All programs</SelectItem>{filters.data?.majors.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={f.skill} onValueChange={(v) => set({ skill: v })}><SelectTrigger aria-label="Skill"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any skill</SelectItem>{filters.data?.skills.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={f.placed} onValueChange={(v) => set({ placed: v })}><SelectTrigger aria-label="Placement status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Placed &amp; not placed</SelectItem><SelectItem value="1">Placed (has offer)</SelectItem><SelectItem value="0">Not placed</SelectItem></SelectContent></Select>
        <div className="flex gap-2"><Input aria-label="Minimum CGPA" type="number" step="0.1" placeholder="CGPA ≥" value={f.gpa_min} onChange={(e) => set({ gpa_min: e.target.value })} /><Input aria-label="Maximum CGPA" type="number" step="0.1" placeholder="CGPA ≤" value={f.gpa_max} onChange={(e) => set({ gpa_max: e.target.value })} /></div>
        <div className="flex gap-2"><Input aria-label="Earliest graduation year" type="number" placeholder="Year ≥" value={f.year_min} onChange={(e) => set({ year_min: e.target.value })} /><Input aria-label="Latest graduation year" type="number" placeholder="Year ≤" value={f.year_max} onChange={(e) => set({ year_max: e.target.value })} /></div>
        <Button asChild variant="outline" className="gap-2"><a href={api.admin.exportUrl(query)} download><Download className="h-4 w-4" />Export CSV</a></Button>
      </div>

      {list.isLoading ? <ListSkeleton rows={5} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> :
        list.data!.data.length === 0 ? <EmptyState title="No students match" description="Try loosening the filters." /> : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table>
              <TableHeader><TableRow>{sortHead("student_id", "ID")}{sortHead("first_name", "Name")}{sortHead("major", "Program")}{sortHead("graduation_year", "Year")}{sortHead("gpa", "CGPA")}<TableHead>Skills</TableHead>{sortHead("applications_count", "Apps")}<TableHead>Placement</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.data!.data.map((s) => (
                  <TableRow key={s.student_id} className={s.is_active ? "" : "opacity-60"}>
                    <TableCell className="font-mono text-xs">{s.student_id}</TableCell>
                    <TableCell><div className="font-medium">{fullName(s)}</div><div className="text-xs text-muted-foreground">{s.email}</div></TableCell>
                    <TableCell>{s.major ?? "—"}</TableCell><TableCell>{s.graduation_year ?? "—"}</TableCell><TableCell className="tabular-nums">{s.gpa ?? "—"}</TableCell>
                    <TableCell><div className="flex max-w-[14rem] flex-wrap gap-1">{s.skills.length ? s.skills.map((k) => <Badge key={k} variant="outline" className="text-xs font-normal">{k}</Badge>) : <span className="text-xs text-muted-foreground">—</span>}</div></TableCell>
                    <TableCell className="tabular-nums">{s.applications_count}</TableCell>
                    <TableCell>{s.placed ? <Badge className="bg-emerald-600">Placed</Badge> : <span className="text-xs text-muted-foreground">—</span>}{s.has_resume && <Button asChild variant="ghost" size="icon" className="ml-1 h-7 w-7" aria-label={`Download resume of ${fullName(s)}`}><a href={api.admin.resumeUrl(s.student_id)}><FileText className="h-4 w-4" /></a></Button>}</TableCell>
                    <TableCell><Switch checked={s.is_active} disabled={toggle.isPending} aria-label={`${s.is_active ? "Deactivate" : "Activate"} ${fullName(s)}`} onCheckedChange={(c) => toggle.mutate({ id: s.student_id, active: c })} /></TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>
          </div>)}
      <Pager p={list.data?.pagination} onPage={(page) => setF((x) => ({ ...x, page }))} />
    </div>
  );
};
export default StudentsTab;
