import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Briefcase, Building2, ClipboardList, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { api } from "@/lib/api";
import AdminOverview from "./admin/AdminOverview";
import StudentsTab from "./admin/StudentsTab";
import OrganisationTab from "./admin/OrganisationTab";
import OpportunitiesTab from "./admin/OpportunitiesTab";
import ApplicantsTable from "./recruiter/ApplicantsTable";

const AdminDashboard = () => {
  const [tab, setTab] = useState("overview");
  const pending = useQuery({ queryKey: ["admin", "recruiters", "pending-count"], queryFn: () => api.admin.recruiters("pending"), refetchInterval: 60_000 });
  const n = pending.data?.length ?? 0;
  return (
    <DashboardLayout title="Placement Administration" subtitle="South Asian University · SAU Placement Hub">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid h-auto w-full max-w-4xl grid-cols-5">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Overview</span><span className="sr-only sm:hidden">Overview</span></TabsTrigger>
          <TabsTrigger value="students" className="gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Students</span><span className="sr-only sm:hidden">Students</span></TabsTrigger>
          <TabsTrigger value="orgs" className="gap-2"><Building2 className="h-4 w-4" /><span className="hidden sm:inline">Recruiters &amp; Companies</span><span className="sr-only sm:hidden">Recruiters and companies</span>{n > 0 && <span aria-label={`${n} pending`} className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{n}</span>}</TabsTrigger>
          <TabsTrigger value="opps" className="gap-2"><Briefcase className="h-4 w-4" /><span className="hidden sm:inline">Opportunities</span><span className="sr-only sm:hidden">Opportunities</span></TabsTrigger>
          <TabsTrigger value="apps" className="gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Applications</span><span className="sr-only sm:hidden">Applications</span></TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="students"><StudentsTab /></TabsContent>
        <TabsContent value="orgs"><OrganisationTab /></TabsContent>
        <TabsContent value="opps"><OpportunitiesTab /></TabsContent>
        <TabsContent value="apps"><ApplicantsTable keyPrefix="admin" showCompany fetcher={api.admin.applications} resumeUrl={(a) => api.admin.resumeUrl(a.student_id)} review={api.admin.review} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};
export default AdminDashboard;
