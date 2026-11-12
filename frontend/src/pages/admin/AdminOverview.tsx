import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, Briefcase, Building2, GraduationCap, Percent, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ALL_STATUSES } from "@/lib/types";
import { EmptyState, ErrorState, ListSkeleton, StatCard } from "@/components/dashboard/common";

const STATUS_COLORS: Record<string, string> = { Applied: "#3b82f6", "Under Review": "#f59e0b", Shortlisted: "#8b5cf6", Interview: "#6366f1", Offered: "#10b981", Rejected: "#ef4444", Withdrawn: "#94a3b8" };

const ChartCard = ({ title, description, empty, children }: { title: string; description?: string; empty: boolean; children: React.ReactNode }) => (
  <Card className="shadow-sm">
    <CardHeader><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
    <CardContent>{empty ? <p className="py-10 text-center text-sm text-muted-foreground">No data recorded yet.</p> : <div className="h-64" role="img" aria-label={title}>{children}</div>}</CardContent>
  </Card>
);

const AdminOverview = () => {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: api.admin.stats });
  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data!;
  const statusData = ALL_STATUSES.map((name) => ({ name, value: s.applications_by_status[name] })).filter((d) => d.value > 0);
  const pending = (s.recruiters.pending ?? 0) + s.companies_pending;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">All figures are calculated live from the database.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Students" value={s.students_total} icon={<GraduationCap className="h-5 w-5" />} hint={`${s.students_with_applications} have applied`} />
        <StatCard label="Placed" value={s.students_placed} icon={<Award className="h-5 w-5" />} tone="green" hint="≥1 offer" />
        <StatCard label="Placement rate" value={`${s.placement_rate}%`} icon={<Percent className="h-5 w-5" />} tone="violet" />
        <StatCard label="Open listings" value={s.open_internships + s.open_placements} icon={<Briefcase className="h-5 w-5" />} hint={`${s.open_placements} placements · ${s.open_internships} internships`} />
        <StatCard label="Companies" value={s.companies_total} icon={<Building2 className="h-5 w-5" />} hint={s.companies_pending ? `${s.companies_pending} awaiting approval` : "All approved"} tone="amber" />
        <StatCard label="Applications" value={s.applications_total} icon={<Users className="h-5 w-5" />} hint={s.avg_offered_package_lpa !== null ? `Avg offered package ₹${s.avg_offered_package_lpa} LPA` : undefined} />
      </div>
      {pending > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{pending} item{pending === 1 ? "" : "s"} awaiting your approval — see the <strong>Recruiters &amp; Companies</strong> tab.</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Applications by status" empty={statusData.length === 0}>
          <ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{statusData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Applications per month" description="Last 6 months" empty={s.applications_by_month.length === 0}>
          <ResponsiveContainer><LineChart data={s.applications_by_month}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="count" name="Applications" stroke="#3b82f6" strokeWidth={2} dot /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Placement by program" description="Students vs. students with an offer" empty={s.placement_by_major.length === 0}>
          <ResponsiveContainer><BarChart data={s.placement_by_major}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="major" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend /><Bar dataKey="students" name="Students" fill="#94a3b8" radius={[4, 4, 0, 0]} /><Bar dataKey="placed" name="Placed" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Top hiring companies</CardTitle><CardDescription>By number of offers</CardDescription></CardHeader>
          <CardContent>
            {s.top_hiring_companies.length === 0 ? <EmptyState title="No offers yet" description="Companies appear here once students receive offers." /> : (
              <ol className="space-y-3">{s.top_hiring_companies.map((c, i) => (
                <li key={c.company} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span><span className="flex-1 truncate font-medium">{c.company}</span><span className="tabular-nums text-sm text-muted-foreground">{c.offers} offer{c.offers === 1 ? "" : "s"}</span></li>))}</ol>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default AdminOverview;
