import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError, type ListingInput } from "@/lib/api";
import type { Opportunity, OpportunityType } from "@/lib/types";
import { FieldError, Spinner } from "@/components/dashboard/common";

const blank = { type: "Placement" as OpportunityType, title: "", description: "", location: "", salary: "", deadline: "", min_gpa: "", min_grad_year: "", max_grad_year: "", skills: "" };

/** `existing` = edit mode (type is fixed); null = create mode; undefined = closed. */
const ListingDialog = ({ existing, onClose }: { existing: Opportunity | null | undefined; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const open = existing !== undefined;

  useEffect(() => {
    setErrors({});
    if (existing) setF({ type: existing.type, title: existing.title, description: existing.description ?? "", location: existing.location ?? "", salary: existing.salary ?? "", deadline: existing.deadline ?? "",
      min_gpa: existing.min_gpa?.toString() ?? "", min_grad_year: existing.min_grad_year?.toString() ?? "", max_grad_year: existing.max_grad_year?.toString() ?? "", skills: existing.skills.join(", ") });
    else setF(blank);
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const num = (v: string) => (v === "" ? null : Number(v));
      const body: ListingInput = {
        title: f.title, description: f.description, location: f.location, salary: f.salary === "" ? null : f.type === "Placement" ? Number(f.salary) : f.salary,
        deadline: f.deadline || null, min_gpa: num(f.min_gpa), min_grad_year: num(f.min_grad_year), max_grad_year: num(f.max_grad_year),
        skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      return existing ? api.recruiter.update(existing.type, existing.id, body) : api.recruiter.create(f.type, body);
    },
    onSuccess: () => { toast({ title: existing ? "Opportunity updated" : "Opportunity published" }); qc.invalidateQueries({ queryKey: ["recruiter"] }); onClose(); },
    onError: (e) => {
      if (e instanceof ApiError) { setErrors(e.fieldErrors); toast({ title: "Could not save", description: e.message, variant: "destructive" }); }
      else toast({ title: "Could not save", variant: "destructive" });
    },
  });

  const text = (id: keyof typeof blank, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`l-${id}`}>{label}</Label>
      <Input id={`l-${id}`} value={f[id]} aria-invalid={!!errors[id]} onChange={(e) => setF({ ...f, [id]: e.target.value })} {...props} />
      <FieldError id={`l-${id}`} message={errors[id]} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Edit opportunity" : "Post a new opportunity"}</DialogTitle><DialogDescription>Eligibility rules are enforced when students apply.</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {!existing && (
            <div className="space-y-1.5">
              <Label htmlFor="l-type">Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as OpportunityType })}>
                <SelectTrigger id="l-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Placement">Placement (full-time)</SelectItem><SelectItem value="Internship">Internship</SelectItem></SelectContent>
              </Select>
              <FieldError id="l-type" message={errors.type} />
            </div>
          )}
          {text("title", "Title")}
          <div className="space-y-1.5">
            <Label htmlFor="l-description">Description</Label>
            <Textarea id="l-description" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <FieldError id="l-description" message={errors.description} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("location", "Location")}
            {f.type === "Placement" ? text("salary", "Package (LPA)", { type: "number", step: "0.01", min: 0 }) : text("salary", "Stipend", { placeholder: "e.g. 20000/month" })}
            {text("deadline", "Application deadline", { type: "date" })}
            {text("min_gpa", "Minimum CGPA", { type: "number", step: "0.01", min: 0, max: 10 })}
            {text("min_grad_year", "Earliest graduation year", { type: "number" })}
            {text("max_grad_year", "Latest graduation year", { type: "number" })}
          </div>
          {text("skills", "Required skills (comma separated)", { placeholder: "Python, SQL" })}
          <FieldError id="skills" message={errors.skills} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending && <Spinner className="mr-2" />}{existing ? "Save changes" : "Publish"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default ListingDialog;
