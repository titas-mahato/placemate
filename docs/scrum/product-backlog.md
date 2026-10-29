# PlaceMate: Agile Scrum Product Backlog & Sprint Plan
**Document Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Scrum Master & Project Lead  
**Methodology:** Agile / Scrum Process Model (Effort & Complexity Estimation)  

---

## 1. Product Epics Overview
- **EPIC 1: Identity & Access Governance**
- **EPIC 2: Student Career Portfolio & Automated Eligibility**
- **EPIC 3: Corporate Recruiter Drive & Pipeline Management**
- **EPIC 4: TPO Institutional Moderation & Real-Time Analytics**
- **EPIC 5: Quality Assurance, Testing & CI/CD**

---

## 2. Product Backlog (Prioritized User Stories)

| Story ID | Epic | User Story (`As a... I want... So that...`) | Effort Points | Priority | Target Sprint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **US-01** | Identity | *As a student*, I want to self-register with my university email so that I can create my placement account. | 2 | Must | Sprint 1 |
| **US-02** | Identity | *As any user*, I want to log in securely with password hashing so that my account is protected. | 3 | Must | Sprint 1 |
| **US-03** | Identity | *As a user*, I want to change my password securely with rate-limiting so that unauthorized resets are blocked. | 2 | Should | Sprint 1 |
| **US-04** | Portfolio | *As a student*, I want to maintain my academic profile and skills so that recruiters can review my qualifications. | 3 | Must | Sprint 2 |
| **US-05** | Portfolio | *As a student*, I want to upload my PDF resume so that it is securely attached to my job applications. | 3 | Must | Sprint 2 |
| **US-06** | Eligibility | *As a student*, I want the system to automatically calculate my eligibility for each drive so that I only apply to roles I qualify for. | 5 | Must | Sprint 2 |
| **US-07** | Recruiter | *As a recruiter*, I want to submit a company registration request so that the TPO can verify our hiring partnership. | 2 | Must | Sprint 2 |
| **US-08** | Recruiter | *As an approved recruiter*, I want to publish placement and internship drives with cutoffs so that students can apply. | 4 | Must | Sprint 3 |
| **US-09** | Recruiter | *As a recruiter*, I want to inspect candidate applications and move them through round stages so that I can manage our hiring pipeline. | 5 | Must | Sprint 3 |
| **US-10** | Portfolio | *As a student*, I want to track my active applications in real time so that I know my current evaluation status. | 3 | Must | Sprint 3 |
| **US-11** | TPO | *As a TPO officer*, I want to approve or suspend recruiters so that fraudulent companies cannot solicit students. | 2 | Must | Sprint 3 |
| **US-12** | TPO | *As a TPO officer*, I want to filter and export student cohort records to CSV so that I can report data to university leadership. | 3 | Must | Sprint 4 |
| **US-13** | TPO | *As a TPO officer*, I want a live analytics dashboard showing placement conversion rates so that I can track performance. | 5 | Must | Sprint 4 |
| **US-14** | Architecture| *As a platform admin*, I want secure data isolation so that student records remain private. | 4 | Must | Sprint 4 |
| **US-15** | QA/DevOps | *As a DevOps engineer*, I want an automated GitHub Actions CI pipeline so that broken code is caught before merge. | 3 | Must | Sprint 4 |

---

## 3. Sprint Cadence & Allocation Summary (6-Week Lifecycle)

The project is structured across 4 iterative sprints over a 6-week development cycle:

- **Sprint 1 (Week 1 – Inception & Architecture)**: Requirements engineering (SRS), C4 system architecture design, database schema, and core authentication.
- **Sprint 2 (Weeks 2–3 – Profiles & Eligibility Engine)**: Student profile vault, resume upload handling, recruiter registration, and dynamic eligibility evaluation engine.
- **Sprint 3 (Weeks 4–5 – Opportunity Drives & Pipeline)**: Internship/placement drive management, recruiter applicant evaluation pipeline, and TPO company moderation.
- **Sprint 4 (Week 6 – Verification, Analytics & Release)**: Real-time TPO placement analytics, CSV export, automated Pytest test suites, GitHub Actions CI pipeline, and v1.0.0 release.
