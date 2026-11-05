/**
 * Single place that talks to the Flask API.
 *  - Auth is a server-issued HttpOnly session cookie; the browser never stores credentials or roles.
 *  - The CSRF token lives in memory only (it is re-fetched from /auth/me after a page reload).
 *  - Errors are normalised into ApiError so every screen can show server validation messages.
 */
import type {
  AdminCompany, AdminOpportunity, AdminRecruiter, AdminStats, AdminStudent, Applicant, Application, ApplicationStatus,
  Opportunity, OpportunityType, Pagination, Profile, RecruiterSummary, Role, StudentSummary, User,
} from "./types";

const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
  }
  /** Field-level validation messages (field -> message). */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.errors).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
}

let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => { csrfToken = t; };

type Query = Record<string, string | number | boolean | undefined | null>;
const qs = (q?: Query) => {
  const p = new URLSearchParams();
  Object.entries(q ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  if (csrfToken && method !== "GET") headers["X-CSRF-Token"] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}${qs(query)}`, { method, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  let data: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || (data && data.success === false)) {
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status, data?.errors ?? {});
  }
  return data as T;
}
const get = <T>(p: string, q?: Query) => request<T>("GET", p, undefined, q);
const send = <T>(m: string, p: string, b?: unknown) => request<T>(m, p, b);

export interface Page<T> { data: T[]; pagination: Pagination }
export type ListingInput = {
  title: string; description?: string; location?: string; salary?: string | number | null; deadline?: string | null;
  min_gpa?: number | null; min_grad_year?: number | null; max_grad_year?: number | null; skills?: string[];
};

export const api = {
  auth: {
    async login(role: Role, email: string, password: string) {
      const r = await send<{ user: User; csrf_token: string }>("POST", "/auth/login", { role, email, password });
      setCsrfToken(r.csrf_token);
      return r.user;
    },
    async me() {
      const r = await get<{ user: User; csrf_token: string }>("/auth/me");
      setCsrfToken(r.csrf_token);
      return r.user;
    },
    async logout() { try { await send("POST", "/auth/logout"); } finally { setCsrfToken(null); } },
    changePassword: (current_password: string, new_password: string) => send<{ message: string }>("POST", "/auth/change-password", { current_password, new_password }),
    registerStudent: (b: Record<string, unknown>) => send<{ message: string }>("POST", "/student/register", b),
    registerRecruiter: (b: Record<string, unknown>) => send<{ message: string }>("POST", "/recruiter/register", b),
  },
  skills: () => get<{ skills: string[] }>("/skills").then((r) => r.skills),
  opportunities: {
    list: (q: Query) => get<Page<Opportunity>>("/opportunities", q),
    get: (type: OpportunityType, id: number) => get<{ opportunity: Opportunity }>(`/opportunities/${type}/${id}`).then((r) => r.opportunity),
  },
  student: {
    profile: () => get<{ profile: Profile }>("/student/profile").then((r) => r.profile),
    updateProfile: (b: Record<string, unknown>) => send<{ profile: Profile }>("PUT", "/student/profile", b).then((r) => r.profile),
    summary: () => get<StudentSummary & { success: boolean }>("/student/summary"),
    applications: () => get<{ applications: Application[] }>("/student/applications").then((r) => r.applications),
    apply: (opportunity_type: OpportunityType, opportunity_id: number, cover_note?: string) =>
      send<{ application_id: number }>("POST", "/student/applications", { opportunity_type, opportunity_id, cover_note }),
    withdraw: (id: number) => send("POST", `/student/applications/${id}/withdraw`),
    uploadResume: (file: File) => { const f = new FormData(); f.append("resume", file); return request("POST", "/student/resume", f); },
    deleteResume: () => send("DELETE", "/student/resume"),
    resumeUrl: `${BASE}/api/student/resume`,
  },
  recruiter: {
    summary: () => get<RecruiterSummary & { success: boolean }>("/recruiter/summary"),
    company: () => get<{ company: { name: string; headquarters_location: string | null; website: string | null; description: string | null; is_approved: number } }>("/recruiter/company").then((r) => r.company),
    updateCompany: (b: Record<string, unknown>) => send("PUT", "/recruiter/company", b),
    opportunities: () => get<{ data: Opportunity[] }>("/recruiter/opportunities").then((r) => r.data),
    create: (type: OpportunityType, b: ListingInput) => send<{ opportunity: Opportunity }>("POST", "/recruiter/opportunities", { type, ...b }),
    update: (type: OpportunityType, id: number, b: ListingInput) => send("PUT", `/recruiter/opportunities/${type}/${id}`, b),
    setOpen: (type: OpportunityType, id: number, is_active: boolean) => send("PATCH", `/recruiter/opportunities/${type}/${id}`, { is_active }),
    applications: (q: Query) => get<Page<Applicant>>("/recruiter/applications", q),
    review: (id: number, b: { status?: ApplicationStatus; recruiter_note?: string }) => send("PATCH", `/recruiter/applications/${id}`, b),
    resumeUrl: (appId: number) => `${BASE}/api/recruiter/applications/${appId}/resume`,
  },
  admin: {
    stats: () => get<AdminStats & { success: boolean }>("/admin/stats"),
    filters: () => get<{ majors: string[]; skills: string[] }>("/admin/filters"),
    students: (q: Query) => get<Page<AdminStudent>>("/admin/students", q),
    exportUrl: (q: Query) => `${BASE}/api/admin/students/export.csv${qs(q)}`,
    setStudentActive: (id: string, is_active: boolean) => send("PATCH", `/admin/students/${encodeURIComponent(id)}`, { is_active }),
    resumeUrl: (id: string) => `${BASE}/api/admin/students/${encodeURIComponent(id)}/resume`,
    recruiters: (status?: string) => get<{ data: AdminRecruiter[] }>("/admin/recruiters", { status }).then((r) => r.data),
    setRecruiterStatus: (id: number, status: string) => send("PATCH", `/admin/recruiters/${id}`, { status }),
    companies: () => get<{ data: AdminCompany[] }>("/admin/companies").then((r) => r.data),
    setCompanyApproved: (id: number, is_approved: boolean) => send("PATCH", `/admin/companies/${id}`, { is_approved }),
    opportunities: (q: Query) => get<Page<AdminOpportunity>>("/admin/opportunities", q),
    setOpportunityActive: (type: OpportunityType, id: number, is_active: boolean) => send("PATCH", `/admin/opportunities/${type}/${id}`, { is_active }),
    applications: (q: Query) => get<Page<Applicant>>("/admin/applications", q),
    review: (id: number, b: { status?: ApplicationStatus; recruiter_note?: string }) => send("PATCH", `/admin/applications/${id}`, b),
  },
};
