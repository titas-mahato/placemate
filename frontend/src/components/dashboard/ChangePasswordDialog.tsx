import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { FieldError, Spinner } from "./common";

const blank = { current_password: "", new_password: "", confirm: "" };

const ChangePasswordDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.new_password !== f.confirm) { setErrors({ confirm: "Passwords do not match" }); return; }
    setBusy(true);
    setErrors({});
    try {
      await api.auth.changePassword(f.current_password, f.new_password);
      toast({ title: "Password changed", description: "Use your new password next time you sign in." });
      setF(blank);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast({ title: "Could not change password", description: err instanceof ApiError ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const field = (id: keyof typeof blank, label: string, ac: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cp-${id}`}>{label}</Label>
      <Input id={`cp-${id}`} type="password" autoComplete={ac} value={f[id]} aria-invalid={!!errors[id]} onChange={(e) => setF({ ...f, [id]: e.target.value })} required />
      <FieldError id={`cp-${id}`} message={errors[id]} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setF(blank); setErrors({}); } }}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" className="gap-2"><KeyRound className="h-4 w-4" /><span className="hidden md:inline">Change password</span><span className="sr-only md:hidden">Change password</span></Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change password</DialogTitle><DialogDescription>Use at least 8 characters with letters and numbers.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          {field("current_password", "Current password", "current-password")}
          {field("new_password", "New password", "new-password")}
          {field("confirm", "Confirm new password", "new-password")}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Spinner className="mr-2" />}Update password</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default ChangePasswordDialog;
