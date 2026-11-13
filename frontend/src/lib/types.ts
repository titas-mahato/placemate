export type Role = "student" | "recruiter" | "admin";
export type OpportunityType = "Internship" | "Placement";
export type ApplicationStatus = "Applied" | "Under Review" | "Shortlisted" | "Interview" | "Offered" | "Rejected" | "Withdrawn";

export const ALL_STATUSES: ApplicationStatus[] = ["Applied", "Under Review", "Shortlisted", "Interview", "Offered", "Rejected", "Withdrawn"];

/** Mirrors the backend state machine; used only to decide which buttons to offer. The server enforces it. */
export const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  Applied: ["Under Review", "Shortlisted", "Rejected"],
  "Under Review": ["Shortlisted", "Interview", "Rejected"],
  Shortlisted: ["Interview", "Offered", "Rejected"],
  Interview: ["Offered", "Rejected"],
  Offered: [], Rejected: [], Withdrawn: [],
};

export interface StudentUser { role: "student"; student_id: string; first_name: string; last_name: string; email: string; major: string | null; graduation_year: number | null; gpa: number | null }
export interface RecruiterUser { role: "recruiter"; recruiter_id: number; name: string; email: string; company_id: number; company_name: string }
export interface AdminUser { role: "admin"; admin_id: number; name: string; email: string }
export type User = StudentUser | RecruiterUser | AdminUser;

export interface Pagination { page: number; per_page: number; total: number; pages: number }

export interface Opportunity {
  type: OpportunityType; id: number; opportunity_key: string; company_id: number; company: string; title: string;
  description: string | null; location: string | null; /** Placement: package in LPA (e.g. "12.50"); Internship: free-text stipend */ salary: string | null;
  deadline: string | null; min_gpa: number | null; min_grad_year: number | null; max_grad_year: number | null;
  is_active: boolean | number; is_open: boolean; skills: string[]; created_at: string;
  // present for student viewers
  eligible?: boolean; ineligible_reasons?: string[]; applied?: boolean; application_status?: ApplicationStatus | null; application_id?: number | null; skill_matches?: number;
  // recruiter listing view
  applicant_count?: number;
}

export interface Application {
  application_id: number; status: ApplicationStatus; cover_note: string | null; recruiter_note: string | null; applied_at: string; updated_at: string;
  type: OpportunityType; opportunity_id: number; title: string; company: string; location: string | null; deadline: string | null;
}

export interface Applicant extends Omit<Application, "location" | "deadline"> {
  company_id: number; student_id: string; first_name: string; last_name: string; email: string; major: string | null; gpa: number | null;
  graduation_year: number | null; phone: string | null; bio: string | null; has_resume: boolean; skills: string[];
}

export interface Profile {
  student_id: string; first_name: string; last_name: string; email: string; major: string | null; graduation_year: number | null;
  gpa: number | null; phone: string | null; bio: string | null; skills: string[]; resume_name: string | null; has_resume: boolean;
}

export type StatusCounts = Record<ApplicationStatus, number>;

export interface StudentSummary { application_counts: StatusCounts; total_applications: number; upcoming_deadlines: Opportunity[]; profile_completeness: number }
export interface RecruiterSummary { total_listings: number; active_listings: number; application_counts: StatusCounts; total_applications: number; recent_applications: Applicant[] }

export interface AdminStats {
  students_total: number; students_placed: number; placement_rate: number; students_with_applications: number; avg_offered_package_lpa: number | null;
  recruiters: Record<string, number>; companies_total: number; companies_pending: number; open_internships: number; open_placements: number;
  applications_total: number; applications_by_status: StatusCounts; applications_by_month: { month: string; count: number }[];
  placement_by_major: { major: string; students: number; placed: number }[]; top_hiring_companies: { company: string; offers: number }[];
}
export interface AdminStudent { student_id: string; first_name: string; last_name: string; email: string; major: string | null; graduation_year: number | null; gpa: number | null; is_active: boolean; has_resume: boolean; applications_count: number; placed: boolean; skills: string[] }
export interface AdminRecruiter { recruiter_id: number; name: string; email: string; status: "pending" | "approved" | "rejected" | "suspended"; created_at: string; company_id: number; company: string; company_approved: boolean }
export interface AdminCompany { company_id: number; name: string; headquarters_location: string | null; website: string | null; is_approved: boolean; recruiters: number; listings: number }
export interface AdminOpportunity { type: OpportunityType; id: number; title: string; company: string; location: string | null; deadline: string | null; is_active: boolean; created_at: string; applicants: number }
