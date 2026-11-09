import React, { useState } from "react";
import { Briefcase, ClipboardList, LayoutDashboard, UserCog } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import OverviewTab from "./student/OverviewTab";
import OpportunitiesTab from "./student/OpportunitiesTab";
import ApplicationsTab from "./student/ApplicationsTab";
import ProfileTab from "./student/ProfileTab";

const StudentDashboard = () => {
  const [tab, setTab] = useState("overview");
  const trig = (v: string, label: string, icon: React.ReactNode) => (
    <TabsTrigger value={v} className="gap-2">{icon}<span className="hidden sm:inline">{label}</span><span className="sm:hidden sr-only">{label}</span></TabsTrigger>
  );
  return (
    <DashboardLayout title="Student Portal" subtitle="SAU Placement Hub">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          {trig("overview", "Overview", <LayoutDashboard className="h-4 w-4" />)}
          {trig("opportunities", "Opportunities", <Briefcase className="h-4 w-4" />)}
          {trig("applications", "My Applications", <ClipboardList className="h-4 w-4" />)}
          {trig("profile", "Profile", <UserCog className="h-4 w-4" />)}
        </TabsList>
        <TabsContent value="overview"><OverviewTab go={setTab} /></TabsContent>
        <TabsContent value="opportunities"><OpportunitiesTab /></TabsContent>
        <TabsContent value="applications"><ApplicationsTab onBrowse={() => setTab("opportunities")} /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};
export default StudentDashboard;
