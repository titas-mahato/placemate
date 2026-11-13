import type { Opportunity } from "./types";

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Placements store a numeric LPA; internships store a free-text stipend. */
export const formatSalary = (o: Pick<Opportunity, "type" | "salary">) => {
  if (!o.salary) return "Not disclosed";
  if (o.type === "Placement") return `₹${Number(o.salary)} LPA`;
  return /^\d+(\.\d+)?$/.test(o.salary) ? `₹${Number(o.salary).toLocaleString("en-IN")}/month` : o.salary;
};

export const daysLeft = (iso?: string | null) => {
  if (!iso) return null;
  const d = Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  return d;
};

export const fullName = (p: { first_name: string; last_name?: string | null }) => `${p.first_name} ${p.last_name ?? ""}`.trim();
