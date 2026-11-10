import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Building2, CalendarClock, ClipboardList, LayoutDashboard, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatSalary, fullName } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Applicant, Opportunity } from "@/lib/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { EmptyState, ErrorState, FieldError, ListSkeleton, Spinner, StatCard } from "@/components/dashboard/common";
import ListingDialog from "./recruiter/ListingDialog";
import ApplicantsTable from "./recruiter/ApplicantsTable";
import ApplicantDialog from "./recruiter/ApplicantDialog";

const Overview = ({ go }: { go: (t: string) => void }) => {
  const s = useQuery({ queryKey: ["recruiter", "summary"], queryFn: api.recruiter.summary });
  const [sel, setSel] = useState<Applicant | null>(null);
  if (s.isLoading) return <ListSkeleton rows={3} />;
  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const d = s.data!;
  const c = d.application_counts;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active listings" value={d.active_listings} hint={`${d.total_listings} total`} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard label="Applications" value={d.total_applications} icon={<ClipboardList className="h-5 w-5" />} tone="violet" />
        <StatCard label="Awaiting review" value={c["Applied"]} hint="Status: Applied" icon={<Users className="h-5 w-5" />} tone="amber" />
        <StatCard label="Offers made" value={c["Offered"]} icon={<CalendarClock className="h-5 w-5" />} tone="green" />
      </div>
      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Recent applications</CardTitle><CardDescription>Latest candidates across all your listings</CardDescription></div><Button variant="outline" size="sm" onClick={() => go("applicants")}>View all</Button></CardHeader>
        <CardContent>
          {d.recent_applications.length === 0 ? <p className="text-sm text-muted-foreground">No applications yet. Post an opportunity and students will start applying.</p> : (
            <ul className="divide-y">{d.recent_applications.map((a) => (
              <li key={a.application_id}><button className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/50" onClick={() => setSel(a)}>
                <div className="min-w-0"><p className="truncate font-medium">{fullName(a)}</p><p className="truncate text-xs text-muted-foreground">{a.title} · {formatDate(a.applied_at)}</p></div><StatusBadge status={a.status} />
              </button></li>))}</ul>)}
        </CardContent>
      </Card>
      <ApplicantDialog applicant={sel} onClose={() => setSel(null)} resumeUrl={(a) => api.recruiter.resumeUrl(a.application_id)} review={api.recruiter.review} />
    </div>
  );
};

const Listings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Opportunity | null | undefined>(undefined);
  const list = useQuery({ queryKey: ["recruiter", "opportunities"], queryFn: api.recruiter.opportunities });
  const toggle = useMutation({
    mutationFn: (o: Opportunity) => api.recruiter.setOpen(o.type, o.id, !o.is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruiter"] }),
    onError: (e) => toast({ title: "Update failed", description: e instanceof ApiError ? e.message : "Unexpected error", variant: "destructive" }),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button className="gap-2" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Post opportunity</Button></div>
      {list.isLoading ? <ListSkeleton /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> :
        list.data!.length === 0 ? <EmptyState title="No listings yet" description="Post your first internship or placement to start receiving applications." action={<Button onClick={() => setEditing(null)}>Post opportunity</Button>} /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {list.data!.map((o) => (
              <Card key={o.opportunity_key ?? `${o.type}-${o.id}`} className="shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="mb-1 flex gap-2"><Badge variant={o.type === "Placement" ? "default" : "secondary"}>{o.type}</Badge><Badge variant="outline" className={o.is_open ? "border-emerald-200 text-emerald-700" : "border-slate-300 text-slate-600"}>{o.is_open ? "Open" : o.is_active ? "Deadline passed" : "Closed"}</Badge></div><h3 className="truncate text-lg font-semibold">{o.title}</h3></div>
                    <div className="text-right"><p className="text-2xl font-bold tabular-nums">{o.applicant_count ?? 0}</p><p className="text-xs text-muted-foreground">applicants</p></div>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatSalary(o)} · {o.location ?? "—"} · {o.deadline ? `Deadline ${formatDate(o.deadline)}` : "No deadline"}</p>
                  <div className="flex gap-2"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(o)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                    <Button size="sm" variant={o.is_active ? "outline" : "default"} disabled={toggle.isPending} onClick={() => toggle.mutate(o)}>{o.is_active ? "Close" : "Reopen"}</Button></div>
                </CardContent>
              </Card>))}
          </div>)}
      <ListingDialog existing={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
};

const CompanyTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const co = useQuery({ queryKey: ["recruiter", "company"], queryFn: api.recruiter.company });
  const [f, setF] = useState({ headquarters_location: "", website: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (co.data) setF({ headquarters_location: co.data.headquarters_location ?? "", website: co.data.website ?? "", description: co.data.description ?? "" }); }, [co.data]);
  const save = useMutation({
    mutationFn: () => api.recruiter.updateCompany(f),
    onSuccess: () => { setErrors({}); toast({ title: "Company profile saved" }); qc.invalidateQueries({ queryKey: ["recruiter", "company"] }); },
    onError: (e) => { if (e instanceof ApiError) setErrors(e.fieldErrors); toast({ title: "Could not save", description: e instanceof ApiError ? e.message : undefined, variant: "destructive" }); },
  });
  if (co.isLoading) return <ListSkeleton rows={2} />;
  if (co.isError) return <ErrorState error={co.error} onRetry={() => co.refetch()} />;
  return (
    <Card className="max-w-2xl shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{co.data!.name}</CardTitle><CardDescription>Visible to students on your listings. The company name can only be changed by the placement office.</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="hq">Headquarters</Label><Input id="hq" value={f.headquarters_location} onChange={(e) => setF({ ...f, headquarters_location: e.target.value })} /><FieldError id="hq" message={errors.headquarters_location} /></div>
          <div className="space-y-1.5"><Label htmlFor="web">Website</Label><Input id="web" placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /><FieldError id="web" message={errors.website} /></div>
          <div className="space-y-1.5"><Label htmlFor="desc">About the company</Label><Textarea id="desc" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /><FieldError id="desc" message={errors.description} /></div>
          <Button type="submit" disabled={save.isPending}>{save.isPending && <Spinner className="mr-2" />}Save</Button>
        </form>
      </CardContent>
    </Card>
  );
};

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  return (
    <DashboardLayout title="Recruiter Portal" subtitle={user?.role === "recruiter" ? user.company_name : undefined}>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Overview</span><span className="sr-only sm:hidden">Overview</span></TabsTrigger>
          <TabsTrigger value="listings" className="gap-2"><Briefcase className="h-4 w-4" /><span className="hidden sm:inline">Listings</span><span className="sr-only sm:hidden">Listings</span></TabsTrigger>
          <TabsTrigger value="applicants" className="gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Applicants</span><span className="sr-only sm:hidden">Applicants</span></TabsTrigger>
          <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" /><span className="hidden sm:inline">Company</span><span className="sr-only sm:hidden">Company</span></TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview go={setTab} /></TabsContent>
        <TabsContent value="listings"><Listings /></TabsContent>
        <TabsContent value="applicants"><ApplicantsTable keyPrefix="recruiter" fetcher={api.recruiter.applications} resumeUrl={(a) => api.recruiter.resumeUrl(a.application_id)} review={api.recruiter.review} /></TabsContent>
        <TabsContent value="company"><CompanyTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};
export default RecruiterDashboard;
