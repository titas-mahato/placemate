import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { ErrorState, FieldError, ListSkeleton, Spinner } from "@/components/dashboard/common";

const ProfileTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["student", "profile"], queryFn: api.student.profile });
  const known = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  const [form, setForm] = useState({ first_name: "", last_name: "", major: "", graduation_year: "", gpa: "", phone: "", bio: "" });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setForm({ first_name: p.first_name, last_name: p.last_name, major: p.major ?? "", graduation_year: p.graduation_year?.toString() ?? "", gpa: p.gpa?.toString() ?? "", phone: p.phone ?? "", bio: p.bio ?? "" });
    setSkills(p.skills);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => api.student.updateProfile({
      ...form, graduation_year: form.graduation_year === "" ? null : Number(form.graduation_year), gpa: form.gpa === "" ? null : Number(form.gpa), skills,
    }),
    onSuccess: () => { setErrors({}); toast({ title: "Profile saved" }); qc.invalidateQueries({ queryKey: ["student"] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); },
    onError: (e) => {
      if (e instanceof ApiError) { setErrors(e.fieldErrors); toast({ title: "Please fix the highlighted fields", description: e.message, variant: "destructive" }); }
      else toast({ title: "Could not save", variant: "destructive" });
    },
  });
  const upload = useMutation({
    mutationFn: (f: File) => api.student.uploadResume(f),
    onSuccess: () => { toast({ title: "Resume uploaded" }); qc.invalidateQueries({ queryKey: ["student"] }); },
    onError: (e) => toast({ title: "Upload failed", description: e instanceof ApiError ? e.message : "Unexpected error", variant: "destructive" }),
  });
  const removeResume = useMutation({
    mutationFn: api.student.deleteResume,
    onSuccess: () => { toast({ title: "Resume removed" }); qc.invalidateQueries({ queryKey: ["student"] }); },
  });

  if (profile.isLoading) return <ListSkeleton rows={3} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  const field = (id: keyof typeof form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={form[id]} aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `${id}-error` : undefined} onChange={(e) => setForm({ ...form, [id]: e.target.value })} {...props} />
      <FieldError id={id} message={errors[id]} />
    </div>
  );
  const addSkill = (raw: string) => {
    const s = raw.trim();
    if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
    setSkillInput("");
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast({ title: "File too large", description: "Resume must be 2 MB or smaller.", variant: "destructive" });
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast({ title: "PDF only", description: "Please upload your resume as a PDF.", variant: "destructive" });
    upload.mutate(f);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader><CardTitle>Your profile</CardTitle><CardDescription>Recruiters see this information when you apply. Student ID ({profile.data!.student_id}) and email ({profile.data!.email}) cannot be changed.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">{field("first_name", "First name")}{field("last_name", "Last name")}</div>
            {field("major", "Program / major")}
            <div className="grid gap-4 sm:grid-cols-3">
              {field("graduation_year", "Graduation year", { type: "number" })}
              {field("gpa", "CGPA", { type: "number", step: "0.01", min: 0, max: 10 })}
              {field("phone", "Phone", { type: "tel" })}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">About you</Label>
              <Textarea id="bio" rows={4} maxLength={1000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              <FieldError id="bio" message={errors.bio} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-input">Skills</Label>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => <Badge key={s} variant="secondary" className="gap-1 pr-1">{s}<button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))} className="rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button></Badge>)}
                {skills.length === 0 && <span className="text-sm text-muted-foreground">No skills added yet — they power your “best match” sorting.</span>}
              </div>
              <div className="flex gap-2">
                <Input id="skill-input" list="skill-suggestions" placeholder="Type a skill and press Enter" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); } }} />
                <datalist id="skill-suggestions">{known.data?.map((s) => <option key={s} value={s} />)}</datalist>
                <Button type="button" variant="outline" onClick={() => addSkill(skillInput)}>Add</Button>
              </div>
              <FieldError id="skills" message={errors.skills} />
            </div>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Spinner className="mr-2" />}Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit shadow-sm">
        <CardHeader><CardTitle>Resume</CardTitle><CardDescription>PDF, up to 2 MB. Shared only with recruiters of roles you apply to and placement staff.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {profile.data!.has_resume ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <FileText className="h-8 w-8 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.data!.resume_name}</p><p className="text-xs text-muted-foreground">Uploaded</p></div>
              <Button asChild variant="ghost" size="icon" aria-label="Download resume"><a href={api.student.resumeUrl}><Download className="h-4 w-4" /></a></Button>
              <Button variant="ghost" size="icon" aria-label="Remove resume" onClick={() => removeResume.mutate()} disabled={removeResume.isPending}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choose resume PDF" onChange={onFile} />
          <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>{upload.isPending ? <Spinner /> : <Upload className="h-4 w-4" />}{profile.data!.has_resume ? "Replace resume" : "Upload resume"}</Button>
        </CardContent>
      </Card>
    </div>
  );
};
export default ProfileTab;
