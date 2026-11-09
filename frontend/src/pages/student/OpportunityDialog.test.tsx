import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import type { Opportunity } from "@/lib/types";
import OpportunityDialog from "./OpportunityDialog";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { student: { apply: vi.fn() } } };
});
import { api, ApiError } from "@/lib/api";
const apply = api.student.apply as unknown as ReturnType<typeof vi.fn>;

const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  type: "Placement", id: 7, opportunity_key: "Placement-7", company_id: 1, company: "Acme", title: "Graduate Engineer", description: "Build", location: "Delhi", salary: "10.00",
  deadline: "2099-01-01", min_gpa: 7, min_grad_year: null, max_grad_year: null, is_active: true, is_open: true, skills: ["Python"], created_at: "2026-01-01",
  eligible: true, ineligible_reasons: [], applied: false, application_status: null, application_id: null, skill_matches: 1, ...over,
});

beforeEach(() => apply.mockReset());

describe("OpportunityDialog", () => {
  it("lets an eligible student apply and reports success only after the server accepts", async () => {
    let resolve!: (v: unknown) => void;
    apply.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const onClose = vi.fn();
    renderWithProviders(<OpportunityDialog opp={opp()} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/cover note/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /apply now/i }));

    expect(apply).toHaveBeenCalledWith("Placement", 7, "Hello");
    expect(screen.queryByText("Application submitted")).not.toBeInTheDocument(); // not yet: the server hasn't answered
    expect(onClose).not.toHaveBeenCalled();

    resolve({ application_id: 1 });
    expect(await screen.findByText("Application submitted")).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the server's reason and shows no success message when applying fails", async () => {
    apply.mockRejectedValueOnce(new ApiError("You have already applied to this opportunity", 409));
    const onClose = vi.fn();
    renderWithProviders(<OpportunityDialog opp={opp()} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /apply now/i }));
    expect(await screen.findByText("You have already applied to this opportunity")).toBeInTheDocument();
    expect(screen.queryByText("Application submitted")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables applying and explains why when the student is not eligible", () => {
    renderWithProviders(<OpportunityDialog opp={opp({ eligible: false, ineligible_reasons: ["Minimum CGPA of 7 required"] })} onClose={vi.fn()} />);
    expect(screen.getByText("Minimum CGPA of 7 required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not eligible/i })).toBeDisabled();
    expect(screen.queryByLabelText(/cover note/i)).not.toBeInTheDocument();
  });

  it("shows the current status instead of an apply button when already applied", () => {
    renderWithProviders(<OpportunityDialog opp={opp({ applied: true, application_status: "Shortlisted" })} onClose={vi.fn()} />);
    expect(screen.getByText("Shortlisted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /already applied/i })).toBeDisabled();
  });

  it("disables applying for closed opportunities", () => {
    renderWithProviders(<OpportunityDialog opp={opp({ is_open: false, is_active: false })} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^closed$/i })).toBeDisabled();
  });
});
