import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate, fullName } from "@/lib/format";
import { NEXT_STATUSES, type Applicant, type ApplicationStatus } from "@/lib/types";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Spinner } from "@/components/dashboard/common";

const ApplicantDialog = ({ applicant, onClose, resumeUrl, review }: {
  applicant: Applicant | null; onClose: () => void; resumeUrl: (a: Applicant) => string;
  review: (id: number, b: { status?: ApplicationStatus; recruiter_note?: string }) => Promise<unknown>;
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  useEffect(() => setNote(applicant?.recruiter_note ?? ""), [applicant]);

  const m = useMutation({
    mutationFn: (b: { status?: ApplicationStatus; recruiter_note?: string }) => review(applicant!.application_id, b),
    onSuccess: (_d, b) => {
      toast({ title: b.status ? `Moved to ${b.status}` : "Note saved" });
      qc.invalidateQueries({ queryKey: ["recruiter"] }); qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    },
    onError: (e) => toast({ title: "Update failed", description: e instanceof ApiError ? e.message : "Unexpected error", variant: "destructive" }),
  });

  if (!applicant) return null;
  const next = NEXT_STATUSES[applicant.status];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2"><StatusBadge status={applicant.status} /><span className="text-xs text-muted-foreground">Applied {formatDate(applicant.applied_at)}</span></div>
          <DialogTitle className="text-xl">{fullName(applicant)}</DialogTitle>
          <DialogDescription>{applicant.student_id} · applying for {applicant.title} ({applicant.type}) at {applicant.company}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><a className="underline-offset-2 hover:underline" href={`mailto:${applicant.email}`}>{applicant.email}</a></p>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{applicant.phone ?? "No phone provided"}</p>
          <p><span className="text-muted-foreground">Program:</span> {applicant.major ?? "—"}</p>
          <p><span className="text-muted-foreground">CGPA:</span> {applicant.gpa ?? "—"} · <span className="text-muted-foreground">Graduates:</span> {applicant.graduation_year ?? "—"}</p>
        </div>
        {applicant.skills.length > 0 && <div className="flex flex-wrap gap-1.5">{applicant.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>}
        {applicant.bio && <section><h4 className="mb-1 text-sm font-semibold">About</h4><p className="whitespace-pre-line text-sm text-muted-foreground">{applicant.bio}</p></section>}
        {applicant.cover_note && <section><h4 className="mb-1 text-sm font-semibold">Cover note</h4><p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm">{applicant.cover_note}</p></section>}
        {applicant.has_resume ? <Button asChild variant="outline" className="w-fit gap-2"><a href={resumeUrl(applicant)}><Download className="h-4 w-4" />Download resume (PDF)</a></Button> : <p className="text-sm text-muted-foreground">No resume uploaded.</p>}

        <section className="space-y-2 border-t pt-4">
          <Label htmlFor="note">Note shared with the student (optional)</Label>
          <Textarea id="note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            {next.length === 0 ? <span className="text-sm text-muted-foreground">This application is in a final state ({applicant.status}).</span> : <span className="text-sm font-medium">Move to:</span>}
            {next.map((s) => <Button key={s} size="sm" variant={s === "Rejected" ? "destructive" : s === "Offered" ? "default" : "outline"} disabled={m.isPending} onClick={() => m.mutate({ status: s, recruiter_note: note })}>{m.isPending && <Spinner className="mr-2" />}{s}</Button>)}
            <Button size="sm" variant="ghost" className="ml-auto" disabled={m.isPending || note === (applicant.recruiter_note ?? "")} onClick={() => m.mutate({ recruiter_note: note })}>Save note only</Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};
export default ApplicantDialog;
