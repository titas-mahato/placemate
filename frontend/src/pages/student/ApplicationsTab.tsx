import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/common";

const ApplicationsTab = ({ onBrowse }: { onBrowse: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["student", "applications"], queryFn: api.student.applications });
  const withdraw = useMutation({
    mutationFn: (id: number) => api.student.withdraw(id),
    onSuccess: () => { toast({ title: "Application withdrawn" }); qc.invalidateQueries({ queryKey: ["student"] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); },
    onError: (e) => toast({ title: "Could not withdraw", description: e instanceof ApiError ? e.message : "Unexpected error", variant: "destructive" }),
  });

  if (apps.isLoading) return <ListSkeleton />;
  if (apps.isError) return <ErrorState error={apps.error} onRetry={() => apps.refetch()} />;
  if (!apps.data!.length) return <EmptyState title="No applications yet" description="Applications you submit are saved here so you can track every stage." action={<Button onClick={onBrowse}>Browse opportunities</Button>} />;

  return (
    <div className="space-y-3">
      {apps.data!.map((a) => (
        <Card key={a.application_id} className="shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{a.title}</h3><StatusBadge status={a.status} /></div>
              <p className="text-sm text-muted-foreground">{a.company} · {a.type}{a.location ? ` · ${a.location}` : ""}</p>
              <p className="text-xs text-muted-foreground">Applied {formatDate(a.applied_at)} · Last update {formatDate(a.updated_at)}</p>
              {a.recruiter_note && <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm"><span className="font-medium">Recruiter feedback:</span> {a.recruiter_note}</p>}
            </div>
            {["Applied", "Under Review", "Shortlisted", "Interview"].includes(a.status) && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={withdraw.isPending}>Withdraw</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Withdraw this application?</AlertDialogTitle><AlertDialogDescription>Your application to {a.company} for “{a.title}” will be withdrawn. You will not be able to re-apply.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => withdraw.mutate(a.application_id)}>Withdraw</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
export default ApplicationsTab;
