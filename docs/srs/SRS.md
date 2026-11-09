# Software Requirements Specification (SRS)
## For PlaceMate: Next-Gen Training & Placement Management Platform

**Document Standard:** IEEE Std 830-1998  
**Document Version:** 0.1.0 (Sprint 1 Baseline)  
**Status:** In Review / Iterative Baseline  
**Author / Engineering Profile:** Member 2 (Requirements Engineer & System Analyst)  

---

## Table of Contents
1. [Introduction](#1-introduction)
   - 1.1 Purpose
   - 1.2 Document Conventions
   - 1.3 Intended Audience & Reading Suggestions
   - 1.4 Product Scope
   - 1.5 References
2. [Overall Description](#2-overall-description)
   - 2.1 Product Perspective & Multi-Tenancy
   - 2.2 User Classes and Characteristics
   - 2.3 Operating Environment
   - 2.4 Design and Implementation Constraints
   - 2.5 Assumptions and Dependencies
3. [System Features & Functional Requirements](#3-system-features--functional-requirements)
   - 3.1 Module 1: Authentication & Role-Based Access Control (RBAC)
   - 3.2 Module 2: Tenant & Institution Context Management
   - 3.3 Module 3: Student Profile & Résumé Vault
   - 3.4 Module 4: Opportunity Management (Internships & Placements)
   - 3.5 Module 5: Automated Eligibility Verification Engine
   - 3.6 Module 6: Application Pipeline & Lifecycle State Machine
   - 3.7 Module 7: TPO Governance, Moderation & Reporting
4. [External Interface Requirements](#4-external-interface-requirements)
   - 4.1 User Interfaces
   - 4.2 Software Interfaces
   - 4.3 Communications Interfaces
5. [Non-Functional Requirements (FURPS+)](#5-non-functional-requirements-furps)
   - 5.1 Security & Data Protection
   - 5.2 Performance & Scalability
   - 5.3 Reliability & Availability
   - 5.4 Usability & Accessibility
   - 5.5 Maintainability & Portability

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document details the initial baseline functional and non-functional requirements for the **PlaceMate** Training and Placement Management Platform (v0.1.0). It defines the behavioral expectations, operational constraints, system interactions, and architectural requirements for software engineers, testers, and stakeholders during Sprint 1.

### 1.2 Document Conventions
- Requirements are uniquely identified using alphanumeric codes: `FR-XX` for Functional Requirements and `NFR-XX` for Non-Functional Requirements.
- Priority levels follow the MoSCoW method (**Must Have**, **Should Have**, **Could Have**, **Won't Have this release**).
- Standards follow IEEE Std 830-1998 recommendations.

### 1.3 Intended Audience & Reading Suggestions
- **Developers & Architects**: Focus on Section 2 (Product Perspective) and Section 3 (Detailed Functional Requirements) for implementation specifications.
- **QA & Test Engineers**: Use Section 3 and Section 5 to construct test scenarios, validation checks, and acceptance criteria.
- **Product Managers & TPO Administrators**: Review Section 1.4 (Product Scope) and Section 2.2 (User Characteristics) to confirm organizational alignment.

### 1.4 Product Scope
PlaceMate is a secure, cloud-ready multi-tenant software application engineered to replace manual spreadsheets, paper records, and disparate email chains in university training and placement operations. It coordinates three major stakeholder groups—**Students**, **Recruiting Companies**, and the **Institutional Training & Placement Office (TPO)**—within an automated, verified, and audited workflow.

### 1.5 References
- IEEE Std 830-1998: *Recommended Practice for Software Requirements Specifications*.
- RFC 7519: *JSON Web Token (JWT)*.
- OWASP Top 10: *Application Security Standard 2021*.
- South Asian University (SAU) Placement Cell Operational Guidelines.

---

## 2. Overall Description

### 2.1 Product Perspective & Multi-Tenancy
PlaceMate operates as a central Multi-Tenant Software-as-a-Service (SaaS) platform. Under this architecture:
1. Each registered university/college functions as an independent **Tenant** identified by a unique `tenant_id`.
2. Student cohorts, departmental hierarchies, recruiter connections, and application logs are partitioned to enforce cross-tenant confidentiality.
3. South Asian University (SAU) is configured as the baseline flagship institutional tenant (`tenant_id = 'sau'`).

```
[ Public Internet / Browsers ]
             │
             ▼
[ Reverse Proxy / Vite Client (Same-Origin) ]
             │
             ▼
┌────────────────────────────────────────────────────────┐
│ PlaceMate Core API (Flask Application Factory)        │
│ ├── Tenant Context Resolver (Tenant Middleware)        │
│ ├── Authentication & RBAC Guard (@require_role)       │
│ └── Automated Eligibility Engine                       │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
[ Multi-Tenant Relational DB ]   [ Secure Résumé Storage ]
(Tenant Discriminator Enforced)  (Isolated File Vault)
```

### 2.2 User Classes and Characteristics
| User Class | Description | Technical Familiarity | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Student** | Enrolled undergraduate/postgraduate candidates seeking campus placement or internships. | Intermediate | Profile setup, resume upload, browsing eligible drives, applying, and tracking status. |
| **Recruiter** | Corporate HR and talent acquisition partners representing registered hiring companies. | Intermediate to High | Posting drive listings, filtering applicant pools, updating round results, releasing offers. |
| **TPO Administrator** | University Placement Officers and administrative personnel. | Intermediate | Moderating listings, approving recruiter registrations, exporting student records, analyzing metrics. |
| **System Administrator** | Platform engineers maintaining multi-tenant provisioning. | Expert | Onboarding new university tenants, system monitoring, database migrations. |

### 2.3 Operating Environment
- **Client**: Modern web browsers (Google Chrome 110+, Mozilla Firefox 110+, Apple Safari 16+, Microsoft Edge).
- **Server Environment**: Linux / Windows containerized environment running Python 3.10+ and Node.js 20+.
- **Database**: MySQL 8.0+ or PostgreSQL 15+ with utf8mb4 collation and connection pooling.

### 2.4 Design and Implementation Constraints
- **Stateless API Design**: The application server enforces stateless session handling using signed, encrypted `HttpOnly` and `SameSite=Lax` cookies.
- **SQL Parameterization**: Zero dynamic string concatenation in SQL queries to prevent SQL Injection vulnerabilities.
- **File System Isolation**: Student resumes must be validated (MIME type `application/pdf`, size $\le 2\text{ MB}$) and saved outside the publicly accessible web root.

### 2.5 Assumptions and Dependencies
- Students possess valid institutional email addresses belonging to their respective universities.
- Academic performance metrics use a standard 10-point Cumulative Grade Point Average (CGPA) scale.
- Network connectivity is available for real-time application status synchronization.

---

## 3. System Features & Functional Requirements

### 3.1 Module 1: Authentication & Role-Based Access Control (RBAC)
- **FR-01 (Student Self-Registration)**:
  - *Input*: Student ID, First Name, Last Name, Email, Password, Department/Major, Expected Graduation Year, Current CGPA.
  - *Processing*: Validate institutional email domain; enforce password complexity (minimum 8 characters, alphanumeric); hash password using salted `scrypt`; reject duplicate Student IDs and emails.
  - *Output*: HTTP 201 Created on success; field-level validation errors on failure.
  - *Priority*: Must Have.

- **FR-02 (Secure Multi-Role Authentication)**:
  - *Input*: Registered Email, Password, Target Role.
  - *Processing*: Query user record; verify against stored `scrypt` hash with constant-time comparison; issue signed HttpOnly session cookie holding `{user_id, role, tenant_id, csrf_token}`.
  - *Output*: HTTP 200 with user profile context.
  - *Priority*: Must Have.

- **FR-03 (Session Invalidation & Logout)**:
  - *Processing*: Clear session cookies and invalidate authentication tokens on the server.
  - *Priority*: Must Have.

- **FR-04 (Self-Service Password Modification)**:
  - *Input*: Current Password, New Password, Password Confirmation.
  - *Processing*: Verify current password hash; apply rate-limiting (max 5 attempts per 15 minutes); update hash.
  - *Priority*: Should Have.

### 3.2 Module 2: Tenant & Institution Context Management
- **FR-05 (Tenant Scoping)**:
  - *Processing*: Extract tenant identifier from request context (subdomain or HTTP header `X-Tenant-ID`); verify tenant activation; automatically bind database queries to the active `tenant_id`.
  - *Priority*: Must Have.

- **FR-06 (Tenant Configuration)**:
  - *Processing*: Allow TPO administrators to configure supported degree programs, graduation cohorts, and institutional branding colors/logos.
  - *Priority*: Should Have.

### 3.3 Module 3: Student Profile & Résumé Vault
- **FR-07 (Profile Maintenance)**:
  - *Input*: Contact number, portfolio URLs, technical and soft skill tags.
  - *Processing*: Validate input formatting; persist updates to student profile records.
  - *Priority*: Must Have.

- **FR-08 (Secure Résumé Upload & Retrieval)**:
  - *Input*: Résumé file (binary stream).
  - *Processing*: Validate file header magic bytes for PDF format; verify file size $\le 2\text{ MB}$; store file using a cryptographically random UUID filename outside web root; update database path reference.
  - *Output*: Streamed PDF with `Content-Disposition: inline` and strict access verification.
  - *Priority*: Must Have.

### 3.4 Module 4: Opportunity Management (Internships & Placements)
- **FR-09 (Recruiter Drive Creation)**:
  - *Input*: Job Title, Opportunity Type (Placement or Internship), CTC / Stipend, Job Description, Work Location, Minimum CGPA Requirement, Eligible Graduation Years, Application Deadline.
  - *Processing*: Validate date ranges (deadline must be in the future); link listing to recruiter's verified company record; set initial moderation status to `PENDING_TPO_APPROVAL`.
  - *Priority*: Must Have.

- **FR-10 (Listing Modification & Lifecycle Closure)**:
  - *Processing*: Allow listing recruiters to modify role details, mark listing as `CLOSED`, or reopen active listings. Prevent modifications if active deadline has passed.
  - *Priority*: Must Have.

### 3.5 Module 5: Automated Eligibility Verification Engine
- **FR-11 (Dynamic Eligibility Evaluation)**:
  - *Input*: Viewing Student Record (CGPA, Major, Graduation Year), Opportunity Requirements (Min CGPA, Target Majors, Cohort).
  - *Processing*:
    1. Verify Student CGPA $\ge$ Opportunity Min CGPA.
    2. Verify Student Graduation Year $\in$ Opportunity Allowed Cohorts.
    3. Verify Opportunity is in `ACTIVE` state and current timestamp $\le$ Application Deadline.
  - *Output*: Boolean eligibility flag (`is_eligible`) accompanied by human-readable explanation strings for each failed condition.
  - *Priority*: Must Have.

- **FR-12 (Opportunity Search & Multi-Parametric Filtering)**:
  - *Input*: Search query, opportunity type filter, eligibility toggle ("Show only eligible"), required skill filters.
  - *Processing*: Execute indexed multi-table join and apply viewer-specific eligibility criteria; paginate results (default 10 per page).
  - *Priority*: Must Have.

### 3.6 Module 6: Application Pipeline & Lifecycle State Machine
- **FR-13 (Application Submission)**:
  - *Input*: Opportunity ID, Optional Cover Note, Student Profile & Résumé.
  - *Processing*: Enforce single submission rule via database `UNIQUE(student_id, opportunity_id)` constraint; verify student eligibility; create application record in `APPLIED` state.
  - *Output*: HTTP 201 with immutable Application Reference ID.
  - *Priority*: Must Have.

- **FR-14 (Application State Transitions)**:
  - *Processing*: Enforce legal state transitions managed by recruiters/TPO:
    $$\text{APPLIED} \longrightarrow \text{SHORTLISTED} \longrightarrow \text{INTERVIEW\_SCHEDULED} \longrightarrow \text{OFFERED} \lor \text{REJECTED}$$
    Disallow illegal regressions (e.g., transition from `REJECTED` back to `APPLIED` without admin override).
  - *Priority*: Must Have.

- **FR-15 (Student Application History & Withdrawal)**:
  - *Processing*: Provide students with an application audit trail showing timestamps, status updates, and recruiter feedback notes. Allow student to withdraw pending applications before shortlisting.
  - *Priority*: Must Have.

### 3.7 Module 7: TPO Governance, Moderation & Reporting
- **FR-16 (Recruiter & Company Vetting)**:
  - *Processing*: TPO administrators review pending corporate registrations; grant approval or suspension. Recruiters cannot publish drives until approved.
  - *Priority*: Must Have.

- **FR-17 (Student Cohort Data Management & CSV Export)**:
  - *Input*: Department filter, CGPA threshold, placement status filter.
  - *Processing*: Query matching student records; generate RFC 4180-compliant CSV download; sanitize potential CSV injection characters (`=`, `+`, `-`, `@`).
  - *Priority*: Must Have.

- **FR-18 (Real-Time Placement Analytics Dashboard)**:
  - *Processing*: Dynamically aggregate database records to calculate:
    1. Overall placement rate ($\frac{\text{Placed Students}}{\text{Total Registered Students}} \times 100\%$).
    2. Average and Highest CTC / Stipend across departments.
    3. Drive conversion funnel (Applications $\rightarrow$ Shortlists $\rightarrow$ Offers).
  - *Priority*: Must Have.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- **Responsive Layout**: Designed mobile-first using Tailwind CSS, supporting screen resolutions from 360px (mobile) to 4K displays.
- **Component Consistency**: Styled using accessible Radix UI and shadcn UI primitives.
- **State Feedback**: Explicit loading skeletons, empty state illustrations, and toast notifications on all mutations.

### 4.2 Software Interfaces
- **Database Connection**: Parameterized connection pool via MySQL Connector / SQLAlchemy ORM.
- **File System**: Local or object storage for securely uploaded résumé PDF documents.
- **RESTful Endpoints**: Strictly compliant with OpenAPI 3.0 standards, accepting and returning `application/json`.

### 4.3 Communications Interfaces
- Secure HTTP (HTTPS) for all production client-server communications with TLS 1.3.
- All state-modifying requests (`POST`, `PUT`, `DELETE`) must transmit an `X-CSRF-Token` header matching the active session state.

---

## 5. Non-Functional Requirements (FURPS+)

### 5.1 Security & Data Protection
- **NFR-01 (Password Encryption)**: Passwords must be hashed using salted `scrypt` (or Argon2id) with work parameters tuned to prevent GPU-accelerated dictionary attacks.
- **NFR-02 (Horizontal Privilege Separation / IDOR Protection)**: Recruiters can only access candidates who have applied to their company's listings. Direct object reference attempts to other companies' candidates must return HTTP 404/403.
- **NFR-03 (Cross-Site Request Forgery)**: State-changing endpoints require strict cryptographic CSRF tokens stored in memory and verified against signed session cookies.
- **NFR-04 (Brute Force Protection)**: Authentication endpoints must throttle invalid attempts (maximum 5 failed logins per IP/account per 15 minutes).

### 5.2 Performance & Scalability
- **NFR-05 (Response Time)**: 95% of read queries (opportunity feed, student profile, dashboard statistics) must resolve in $< 200\text{ ms}$ under a concurrent load of 250 requests.
- **NFR-06 (Database Optimization)**: Foreign keys, status columns, and search columns (`student_id`, `company_id`, `is_active`, `gpa`) must carry composite b-tree indexes.

### 5.3 Reliability & Availability
- **NFR-07 (Fault Isolation)**: Failures during résumé PDF generation or streaming must not crash the API server process.
- **NFR-08 (Data Integrity)**: Multi-table updates (e.g., student status transition with audit log recording) must execute inside atomic database transactions (`COMMIT`/`ROLLBACK`).

### 5.4 Usability & Accessibility
- **NFR-09 (Accessibility)**: Forms, dialogs, and navigation controls must meet WCAG 2.1 Level AA accessibility guidelines, including screen reader support and keyboard navigable dialogs.
- **NFR-10 (Error Clarity)**: Form validation errors must appear directly adjacent to the relevant input field with specific remediation guidance.

### 5.5 Maintainability & Portability
- **NFR-11 (Environment Portability)**: Zero hard-coded credentials or URLs; 100% configuration managed through environment variables (`.env`).
- **NFR-12 (Continuous Integration)**: Automated test suite executed on every commit/build with zero tolerated regressions.

---

*End of Software Requirements Specification (IEEE Std 830-1998 — Baseline Draft)*

### 5.6 Quantitative FURPS+ Verification Matrix
| Dimension | Metric | Target Specification | Verification Technique |
| :--- | :--- | :--- | :--- |
| **Functionality** | Access Control Matrix | 100% rejection on unauthorized endpoint mutations | Automated Pytest integration tests |
| **Usability** | Accessibility Score | $\ge 95/100$ on Axe-core / WCAG 2.1 AA benchmarks | Automated Lighthouse & client audit |
| **Reliability** | Availability & Fault Tolerance | $> 99.9\%$ uptime during concurrent load | Synthetic keep-alive & health checks |
| **Performance** | API Response Latency (p95) | $< 200\text{ ms}$ under 250 concurrent requests | Locust stress test suite |
| **Supportability** | Test Code Coverage | $\ge 85\%$ statement coverage on business logic | Pytest-cov automated report |

---

## 6. Student Eligibility Rules & Acceptance Criteria

### 6.1 Automated Eligibility Calculation Specification
1. **Academic Standing Cutoff**:
   - Condition: $\text{Student CGPA} \ge \text{Drive Minimum CGPA}$.
   - Evaluation: Evaluated via deterministic decimal comparison in `sau_hub.domain`.
2. **Major / Department Eligibility**:
   - Condition: $\text{Student Major} \in \text{Drive Eligible Departments List}$.
   - Format: Case-insensitive token match supporting multi-department drives.
3. **Cohort / Graduation Year Verification**:
   - Condition: $\text{Student Graduation Year} = \text{Target Cohort Year}$ (Default: 2026).
4. **Active Offer Limitation Policy (One Student - One Dream Offer)**:
   - If a student has accepted an offer with CTC $\ge 12.0\text{ LPA}$, they are locked from applying to lower-tier drives.

### 6.2 Standard Ineligibility Reason Codes
| Error Code | Trigger Condition | Student UI Feedback |
| :--- | :--- | :--- |
| `ERR_GPA_BELOW_CUTOFF` | Student CGPA is lower than minimum job requirement | "Your current CGPA does not meet the minimum cutoff specified for this role." |
| `ERR_MAJOR_INELIGIBLE` | Student degree or branch is not among eligible disciplines | "This recruitment drive is open only to specified departments." |
| `ERR_DEADLINE_PASSED` | Current timestamp is greater than drive application deadline | "The application deadline for this drive has closed." |
| `ERR_ACTIVE_OFFER_LIMIT` | Student already holds an accepted Dream Offer (CTC $\ge 12\text{ LPA}$) | "You have already secured a Dream Tier placement offer." |
| `ERR_RESUME_MISSING` | Student has not uploaded an approved PDF resume | "Please upload and verify your resume before applying." |

### 6.3 Tenant Context Boundary Enforcement
- Eligibility checks must strictly scope student queries using the session-derived `tenant_id`.
- Cross-tenant opportunities or student records are unconditionally filtered at the query layer.

---

## 7. Requirements Traceability Matrix (RTM - Sprint 3 Update: Auth & Recruitment Drives)

### 7.1 Forward & Backward Traceability Table
| Requirement ID | Functional / Quality Requirement | Implementation Module / Component | Verification Artifact / Test Case | Lifecycle Status |
| :--- | :--- | :--- | :--- | :---: |
| **FR-01** | Student Self-Registration with Domain Validation | `backend/sau_hub/routes/auth.py` | `backend/tests/test_auth.py::test_student_register` | **Verified** |
| **FR-02** | Secure Salted Password Hashing (`scrypt`) | `backend/sau_hub/auth.py`, `backend/db/migrate.py` | `backend/tests/test_migration.py` | **Verified** |
| **FR-03** | Role-Based Session Issuance & Invalidation | `backend/sau_hub/session.py` | `backend/tests/test_auth.py::test_login_and_logout` | **Verified** |
| **FR-04** | Brute-Force Rate Limiting on Auth Endpoints | `backend/sau_hub/rate_limit.py` | `backend/tests/test_auth.py::test_rate_limiting` | **Verified** |
| **FR-06** | Student Profile Read & Academic Data Update | `backend/sau_hub/routes/students.py` | `backend/tests/test_students.py::test_profile_update` | **Verified** |
| **FR-08** | Resume PDF Upload Vault & Storage Isolation | `backend/sau_hub/routes/students.py` | `backend/tests/test_students.py::test_resume_upload` | **Verified** |
| **FR-10** | Deterministic Eligibility Engine Evaluation | `backend/sau_hub/domain.py` | `backend/tests/test_schema_constraints.py` | **Verified** |
| **FR-12** | Active Recruitment Drive Feed & Search Filters | `backend/sau_hub/routes/opportunities.py` | `frontend/src/pages/student/OpportunitiesTab.tsx` | **Verified** |
| **FR-14** | One-Click Application Submission & Status Tracking | `frontend/src/pages/student/ApplicationsTab.tsx` | `frontend/src/pages/dashboards.test.tsx` | **Verified** |
| **FR-16** | Recruiter Drive Management & Candidate Status Pipeline | `backend/sau_hub/routes/recruiter.py` | `backend/tests/test_recruiter.py` | *In Progress* |
| **FR-17** | TPO Tenant Moderation & Audit Logging | `backend/sau_hub/routes/admin.py` | `backend/tests/test_admin.py` | *In Progress* |
| **NFR-01** | Sub-200ms Query Latency under Tenant Isolation | `backend/sau_hub/db.py` (Indexed Pools) | `backend/tests/test_schema_constraints.py` | **Verified** |
| **NFR-03** | Zero Plaintext Credential Exposure at Rest | `backend/db/schema.sql` (`password_hash`) | `backend/tests/test_migration.py` | **Verified** |

### 7.2 Sprint 3 Verification Sign-Off
- **Requirements Analyst Sign-Off**: Swarnojjwal Guha (`swarnojjwalguha@gmail.com`)
- **Review Date**: November 9, 2026
- **Sprint Coverage**: 9 of 13 primary functional requirements fully closed with accompanying unit and integration test fixtures.
