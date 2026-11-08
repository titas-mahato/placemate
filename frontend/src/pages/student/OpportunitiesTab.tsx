import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, MapPin, Search, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { daysLeft, formatDate, formatSalary } from "@/lib/format";
import type { Opportunity } from "@/lib/types";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { EmptyState, ErrorState, ListSkeleton, Pager, useDebounced } from "@/components/dashboard/common";
import OpportunityDialog from "./OpportunityDialog";

const OpportunityCard = ({ o, onOpen }: { o: Opportunity; onOpen: () => void }) => {
  const left = daysLeft(o.deadline);
  return (
    <Card className="cursor-pointer shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <button type="button" onClick={onOpen} className="w-full p-5 text-left focus:outline-none" aria-label={`View ${o.title} at ${o.company}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant={o.type === "Placement" ? "default" : "secondary"}>{o.type}</Badge>
              {o.applied && o.application_status && <StatusBadge status={o.application_status} />}
              {!o.applied && o.eligible === false && <Badge variant="outline" className="border-red-200 text-red-700">Not eligible</Badge>}
              {!!o.skill_matches && !o.applied && <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700"><Sparkles className="h-3 w-3" />{o.skill_matches} skill match{o.skill_matches > 1 ? "es" : ""}</Badge>}
            </div>
            <h3 className="truncate text-lg font-semibold">{o.title}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{o.company}</p>
          </div>
          <div className="shrink-0 text-right text-sm font-semibold text-primary">{formatSalary(o)}</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location ?? "—"}</span>
          <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{o.deadline ? `Apply by ${formatDate(o.deadline)}` : "Open deadline"}{left !== null && left >= 0 && left <= 7 && <b className="text-amber-700">· {left}d left</b>}</span>
          <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />{o.min_gpa ? `CGPA ≥ ${o.min_gpa}` : "No CGPA cutoff"}</span>
        </div>
        {o.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{o.skills.slice(0, 5).map((s) => <Badge key={s} variant="outline" className="text-xs font-normal">{s}</Badge>)}</div>}
      </button>
    </Card>
  );
};

const OpportunitiesTab = () => {
  const [f, setF] = useState({ q: "", type: "all", location: "", skill: "all", sort: "newest", eligible: false, hideApplied: false, page: 1 });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, page: 1, ...patch }));
  const q = useDebounced(f.q);
  const location = useDebounced(f.location);
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const skills = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  const list = useQuery({
    queryKey: ["opportunities", q, location, f.type, f.skill, f.sort, f.eligible, f.hideApplied, f.page],
    queryFn: () => api.opportunities.list({
      q, location, page: f.page, per_page: 10, sort: f.sort,
      type: f.type === "all" ? undefined : f.type, skill: f.skill === "all" ? undefined : f.skill,
      eligible: f.eligible ? 1 : undefined, hide_applied: f.hideApplied ? 1 : undefined,
    }),
    placeholderData: (prev) => prev,
  });
  // keep the open dialog in sync after a mutation refreshes the list
  const current = selected && list.data?.data.find((o) => o.opportunity_key === selected.opportunity_key) || selected;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input aria-label="Search opportunities" className="pl-9" placeholder="Search by role, company or keyword" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          <Input aria-label="Filter by location" placeholder="Location" value={f.location} onChange={(e) => set({ location: e.target.value })} />
          <Select value={f.sort} onValueChange={(v) => set({ sort: v })}>
            <SelectTrigger aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="deadline">Closing soon</SelectItem><SelectItem value="match">Best skill match</SelectItem></SelectContent>
          </Select>
          <Select value={f.type} onValueChange={(v) => set({ type: v })}>
            <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Internships &amp; placements</SelectItem><SelectItem value="Internship">Internships</SelectItem><SelectItem value="Placement">Placements</SelectItem></SelectContent>
          </Select>
          <Select value={f.skill} onValueChange={(v) => set({ skill: v })}>
            <SelectTrigger aria-label="Skill"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Any skill</SelectItem>{skills.data?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-2"><Checkbox id="elig" checked={f.eligible} onCheckedChange={(c) => set({ eligible: c === true })} /><Label htmlFor="elig">Only ones I'm eligible for</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="hide" checked={f.hideApplied} onCheckedChange={(c) => set({ hideApplied: c === true })} /><Label htmlFor="hide">Hide already applied</Label></div>
        </CardContent>
      </Card>

      {list.isLoading ? <ListSkeleton /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> :
        list.data!.data.length === 0 ? <EmptyState title="No opportunities match" description="Try clearing a filter or searching for something broader." /> : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">{list.data!.pagination.total} opportunit{list.data!.pagination.total === 1 ? "y" : "ies"} found</p>
            <div className="grid gap-4 lg:grid-cols-2">{list.data!.data.map((o) => <OpportunityCard key={o.opportunity_key} o={o} onOpen={() => setSelected(o)} />)}</div>
            <Pager p={list.data!.pagination} onPage={(page) => setF((p) => ({ ...p, page }))} />
          </>
        )}
      <OpportunityDialog opp={current} onClose={() => setSelected(null)} />
    </div>
  );
};
export default OpportunitiesTab;
