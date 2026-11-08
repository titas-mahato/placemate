import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CalendarClock, CheckCircle2, ClipboardList, Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { daysLeft, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { ApplicationStatus } from "@/lib/types";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { ErrorState, ListSkeleton, StatCard } from "@/components/dashboard/common";

const PIPELINE: ApplicationStatus[] = ["Applied", "Under Review", "Shortlisted", "Interview", "Offered"];

const OverviewTab = ({ go }: { go: (tab: string) => void }) => {
  const { user } = useAuth();
  const s = useQuery({ queryKey: ["student", "summary"], queryFn: api.student.summary });
  if (s.isLoading) return <ListSkeleton rows={3} />;
  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const d = s.data!;
  const active = d.application_counts["Applied"] + d.application_counts["Under Review"] + d.application_counts["Shortlisted"] + d.application_counts["Interview"];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground shadow-sm">
        <h2 className="text-2xl font-bold">Welcome back, {user?.role === "student" ? user.first_name : ""}</h2>
        <p className="mt-1 text-sm text-primary-foreground/80">{d.total_applications === 0 ? "You haven't applied anywhere yet. Start by browsing opportunities that match your profile." : `You have ${active} active application${active === 1 ? "" : "s"}.`}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" className="gap-2" onClick={() => go("opportunities")}><Search className="h-4 w-4" />Browse opportunities</Button>
          <Button variant="secondary" className="gap-2 bg-white/15 text-white hover:bg-white/25" onClick={() => go("applications")}><ClipboardList className="h-4 w-4" />My applications</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={d.total_applications} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard label="In progress" value={active} icon={<ClipboardList className="h-5 w-5" />} tone="amber" />
        <StatCard label="Offers" value={d.application_counts["Offered"]} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Profile complete" value={`${d.profile_completeness}%`} icon={<UserCog className="h-5 w-5" />} tone="violet" hint={d.profile_completeness < 100 ? "A fuller profile helps recruiters" : "Nice work"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Application progress</CardTitle><CardDescription>Where your applications stand right now</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {d.total_applications === 0 ? <p className="text-sm text-muted-foreground">Nothing to show yet.</p> : PIPELINE.map((st) => (
              <div key={st} className="flex items-center gap-3">
                <div className="w-28 shrink-0"><StatusBadge status={st} /></div>
                <Progress value={(d.application_counts[st] / d.total_applications) * 100} className="h-2 flex-1" aria-label={`${st} share`} />
                <span className="w-6 text-right text-sm tabular-nums">{d.application_counts[st]}</span>
              </div>
            ))}
            {d.profile_completeness < 100 && <Button variant="link" className="px-0" onClick={() => go("profile")}>Complete your profile →</Button>}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" />Closing in the next 14 days</CardTitle><CardDescription>Opportunities you're eligible for and haven't applied to</CardDescription></CardHeader>
          <CardContent>
            {d.upcoming_deadlines.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming deadlines for you right now.</p> : (
              <ul className="divide-y">
                {d.upcoming_deadlines.map((o) => (
                  <li key={o.opportunity_key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{o.title}</p><p className="truncate text-xs text-muted-foreground">{o.company} · {formatDate(o.deadline)}</p></div>
                    <span className="shrink-0 text-xs font-semibold text-amber-700">{daysLeft(o.deadline) === 0 ? "Today" : `${daysLeft(o.deadline)}d left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default OverviewTab;
