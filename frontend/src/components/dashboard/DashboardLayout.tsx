import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import sauLogo from "@/assets/sau-logo.png";
import { useAuth } from "@/lib/auth";
import ChangePasswordDialog from "./ChangePasswordDialog";

interface Props { title: string; subtitle?: string; children: React.ReactNode }

const DashboardLayout = ({ title, subtitle, children }: Props) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user ? (user.role === "student" ? user.first_name : user.name) : "";
  const onLogout = async () => { await logout(); navigate("/", { replace: true }); };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={sauLogo} alt="South Asian University" className="h-9 w-auto object-contain" />
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-base font-bold text-primary sm:text-lg">{title}</h1>
              {subtitle && <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">Signed in as <span className="font-medium text-foreground">{name}</span></span>
            <ChangePasswordDialog />
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-2"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Log out</span><span className="sr-only sm:hidden">Log out</span></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
};
export default DashboardLayout;
