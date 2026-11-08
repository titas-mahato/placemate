import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarClock, CheckCircle2, GraduationCap, MapPin, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { daysLeft, formatDate, formatSalary } from "@/lib/format";
import type { Opportunity } from "@/lib/types";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Spinner } from "@/components/dashboard/common";

const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="text-primary" aria-hidden>{icon}</span>{children}</div>
);

const OpportunityDialog = ({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const apply = useMutation({
    mutationFn: () => api.student.apply(opp!.type, opp!.id, note || undefined),
    onSuccess: () => {
      toast({ title: "Application submitted", description: `Your application to ${opp!.company} has been saved.` });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["student"] });
      setNote("");
      onClose();
    },
    onError: (e) => toast({ title: "Could not apply", description: e instanceof ApiError ? e.message : "Unexpected error", variant: "destructive" }),
  });

  if (!opp) return null;
  const left = daysLeft(opp.deadline);
  const canApply = opp.is_open && opp.eligible && !opp.applied;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{opp.type}</Badge>
            {opp.applied && opp.application_status && <StatusBadge status={opp.application_status} />}
          </div>
          <DialogTitle className="text-xl">{opp.title}</DialogTitle>
          <DialogDescription>{opp.company}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <Row icon={<Building2 className="h-4 w-4" />}>{opp.company}</Row>
          <Row icon={<MapPin className="h-4 w-4" />}>{opp.location ?? "Location not specified"}</Row>
          <Row icon={<Wallet className="h-4 w-4" />}>{formatSalary(opp)}</Row>
          <Row icon={<CalendarClock className="h-4 w-4" />}>
            {opp.deadline ? <>Apply by {formatDate(opp.deadline)}{left !== null && left >= 0 && <span className="ml-1 font-medium text-amber-700">({left === 0 ? "today" : `${left}d left`})</span>}</> : "No deadline"}
          </Row>
        </div>

        {opp.description && <section><h4 className="mb-1 text-sm font-semibold">About the role</h4><p className="whitespace-pre-line text-sm text-muted-foreground">{opp.description}</p></section>}

        {opp.skills.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold">Skills wanted</h4>
            <div className="flex flex-wrap gap-1.5">{opp.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            {!!opp.skill_matches && <p className="mt-2 text-xs text-emerald-700">You match {opp.skill_matches} of {opp.skills.length} listed skills.</p>}
          </section>
        )}

        <section className="rounded-lg border bg-muted/40 p-3">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><GraduationCap className="h-4 w-4" />Eligibility</h4>
          <ul className="space-y-1 text-sm">
            <li>Minimum CGPA: <strong>{opp.min_gpa ?? "None"}</strong></li>
            <li>Graduation year: <strong>{opp.min_grad_year || opp.max_grad_year ? `${opp.min_grad_year ?? "any"} – ${opp.max_grad_year ?? "any"}` : "Any"}</strong></li>
          </ul>
          {opp.eligible ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />You meet the requirements.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm font-medium text-red-700">{opp.ineligible_reasons?.map((r) => <li key={r} className="flex items-center gap-1.5"><XCircle className="h-4 w-4" />{r}</li>)}</ul>
          )}
        </section>

        {canApply && (
          <div className="space-y-2">
            <Label htmlFor="cover-note">Cover note (optional)</Label>
            <Textarea id="cover-note" value={note} maxLength={1500} onChange={(e) => setNote(e.target.value)} placeholder="Why are you a good fit?" rows={3} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => apply.mutate()} disabled={!canApply || apply.isPending}>
            {apply.isPending && <Spinner className="mr-2" />}
            {opp.applied ? "Already applied" : !opp.is_open ? "Closed" : !opp.eligible ? "Not eligible" : "Apply now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default OpportunityDialog;
