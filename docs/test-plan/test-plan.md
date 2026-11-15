# PlaceMate: Software Test Plan (STP)
**Document Standard:** IEEE Std 829-1998  
**Document Version:** 0.1.0 (Sprint 1 Baseline)  
**Author / Role:** QA / Test Engineer & DevOps Engineer  

---

## 1. Test Plan Identifier & Introduction
- **Identifier**: `STP-PLACEMATE-V0.1.0`
- **Purpose**: Defines the testing strategy, test levels, environments, pass/fail criteria, and test execution framework for verifying the PlaceMate platform.

```mermaid
flowchart TD
    subgraph Testing_Levels ["Testing Hierarchy"]
        L1["Unit Testing (Pytest / Vitest)"]
        L2["Integration Testing (API Endpoints & DB)"]
        L3["Security & Access Boundary Testing"]
        L4["End-to-End Workflow Verification"]
    end

    subgraph Automation ["Continuous Verification"]
        CI["GitHub Actions CI Pipeline"]
    end

    L1 --> CI
    L2 --> CI
    L3 --> CI
    L4 --> CI
```

---

## 2. Test Items & Scope
- **In Scope for Sprint 1 / 2**:
  - Authentication & session cookie lifecycle (login, logout, session expiration).
  - Password hashing verification (`scrypt`).
  - Automated eligibility logic (CGPA boundaries, cohort validation).
  - Cross-tenant and recruiter ownership isolation (IDOR checks).
  - Application submission uniqueness constraints.
- **Out of Scope**:
  - Real-device mobile matrix testing (deferred to Sprint 4).
  - High-concurrency load and stress testing.

---

## 3. Test Cases (Initial Test Matrix)

| Test ID | Target Feature | Test Condition | Expected Result | Type |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Student Login | Valid institutional email and correct password. | HTTP 200, signed session cookie set, user profile returned. | Unit / Integration |
| **TC-AUTH-02** | Student Login | Incorrect password (5 consecutive attempts). | HTTP 429 Too Many Requests, account throttled for 15 minutes. | Security |
| **TC-AUTH-03** | Password Hashing | Register new student and inspect raw database row. | Password column contains salted `scrypt` hash, zero plaintext. | Security |
| **TC-ELIG-01** | Eligibility Engine | Student CGPA 7.2 applies to drive requiring 7.5 min. | `is_eligible: false`, detailed error reason returned, Apply blocked. | Unit |
| **TC-ELIG-02** | Eligibility Engine | Student CGPA 8.0 applies to drive requiring 7.5 min. | `is_eligible: true`, Apply enabled. | Unit |
| **TC-APPL-01** | Application Duplicate | Student submits second application to same active drive. | Database rejects duplicate with HTTP 409 Conflict. | Integration |
| **TC-IDOR-01** | Recruiter Access | Recruiter A attempts `GET /api/recruiter/applicants/<id_of_company_B>`. | HTTP 404 Not Found (ownership check enforced). | Security |

---

## 4. Environmental Requirements & CI Integration
- Automated tests run against an isolated ephemeral database (`sau_hub_test` / `placemate_test`).
- Test execution configured to run on every commit via GitHub Actions:
  ```bash
  python -m pytest backend/tests/ -v
  npm test -- --run
  ```


---

## 4. Sprint 2 Test Verification Matrix & Quality Criteria

### 4.1 Unit & Integration Test Coverage Thresholds
| Component / Layer | Minimum Statement Coverage | Target Branch Coverage | Mandatory Assertions |
| :--- | :---: | :---: | :--- |
| **Authentication Primitives** | 95% | 90% | Salted `scrypt` hashing, CSRF header checks, session expiry |
| **Eligibility Verification** | 100% | 100% | Boundary values (e.g. CGPA = 7.50, 7.49), major token parsing |
| **Recruiter Access Boundaries** | 100% | 95% | IDOR prohibition across company IDs |
| **Frontend UI Components** | 80% | 75% | Accessible ARIA attributes, keyboard navigation |

### 4.2 Automated Quality Gates
- **Pytest Exit Code 0**: 100% test pass rate required prior to release staging.
- **Static Analysis**: Flake8 and TypeScript typecheck (`tsc --noEmit`) must report zero critical violations.

---

## 5. Test Execution Hierarchy & Traceability (Sprints 3 & 4)

### 5.1 Test Suite Breakdown
The PlaceMate automated verification architecture spans two decoupled testing harnesses executed continuously via GitHub Actions:

1. **Backend Integration & Unit Suites (Pytest 8.x)**:
   - `test_auth.py`: Multi-role login, salted scrypt password hashing, session lifecycle, and brute-force throttling (12 test cases).
   - `test_students.py`: Student self-registration, profile updates, and secure PDF résumé upload vault (9 test cases).
   - `test_recruiter.py`: Recruiter drive authoring, status transitions, applicant evaluation, and company isolation (14 test cases).
   - `test_opportunities.py`: Dynamic union queries, eligibility evaluations, and search filtering (11 test cases).
   - `test_admin.py`: TPO recruiter moderation, company vetting, student cohort CSV export, and placement analytics (15 test cases).
   - `test_recruitment_workflow.py`: End-to-end recruitment lifecycle from posting to offer acceptance (8 test cases).
   - `test_schema_constraints.py` & `test_audit.py`: Multi-tenant key constraints, parameterized SQL validation, and RBAC boundary enforcement (8 test cases).
   - `test_migration.py`: Idempotent schema migrations and legacy data upgrade verification (4 test cases).
   - **Total Backend Pytest Cases**: **81 tests**.

2. **Frontend Component & Routing Suites (Vitest 1.x & Testing Library)**:
   - `ProtectedRoute.test.tsx`: Route guard evaluation for unauthenticated and unauthorized role redirection (6 test cases).
   - `api.test.ts`: Centralized API client error handling, HTTP credentials, and JSON parsing (8 test cases).
   - `format.test.ts`: Currency formatting, date transformations, and string normalization utilities (8 test cases).
   - `LoginStudent.test.tsx`: Form validation, submission handling, and error toast triggers (6 test cases).
   - `dashboards.test.tsx`: Component rendering for student, recruiter, and administrator portal interfaces (12 test cases).
   - **Total Frontend Vitest Cases**: **40 tests**.

---

## 6. IEEE Std 829-2008 Final Test Execution Summary Report & Pass Matrix

### 6.1 Test Summary Identifier
- **Report Identifier**: `TSR-PLACEMATE-V1.0.0`
- **Evaluation Standard**: IEEE Std 829-2008 (Standard for Software and System Test Documentation)
- **Execution Date**: November 15, 2026
- **Test Engineer**: Siddhant Choudhary (`siddhantchoudhary268@gmail.com`)
- **Target Release**: PlaceMate Release v1.0.0

### 6.2 Test Results Summary Matrix
| Test Suite Category | Executed Test Cases | Passed | Failed | Blocked | Pass Rate | Automated Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Authentication & RBAC** | 12 | 12 | 0 | 0 | 100.0% | 96.4% |
| **Student Vault & Profile** | 9 | 9 | 0 | 0 | 100.0% | 93.8% |
| **Recruiter Pipeline & Drives** | 14 | 14 | 0 | 0 | 100.0% | 95.1% |
| **Eligibility & Search Engine** | 11 | 11 | 0 | 0 | 100.0% | 100.0% |
| **TPO Moderation & CSV Export** | 15 | 15 | 0 | 0 | 100.0% | 94.2% |
| **End-to-End Workflow (E2E)** | 8 | 8 | 0 | 0 | 100.0% | 91.5% |
| **Tenant Isolation & Security** | 8 | 8 | 0 | 0 | 100.0% | 98.2% |
| **Database Migrations** | 4 | 4 | 0 | 0 | 100.0% | 97.0% |
| **Frontend UI & Guards** | 40 | 40 | 0 | 0 | 100.0% | 88.6% |
| **TOTAL AGGREGATE** | **121** | **121** | **0** | **0** | **100.0%** | **94.7%** |

### 6.3 Defect & Anomaly Resolution Summary
- **CI/CD Lockfile Path Resolution**: Resolved GitHub Actions dependency caching by enforcing working directory context in `.github/workflows/ci.yml`.
- **Schema Column Alignment**: Corrected database field mappings (`title` and `package_lpa`) across `domain.py` and `admin.py` to match normalized DDL constraints.
- **Critical & Blocking Defects Remaining**: **0 (Zero)**.

### 6.4 IEEE Std 829-2008 Formal QA Sign-Off

```
================================================================================
             IEEE STD 829-2008 TEST SUMMARY ACCEPTANCE CERTIFICATE
================================================================================
System Identifier   : PlaceMate Platform (T&P SaaS System)
Version / Build     : Release v1.0.0
Evaluation Date     : November 15, 2026
Lead QA & DevOps    : Siddhant Choudhary (siddhantchoudhary268@gmail.com)
Scrum Master        : Titas Mahato (titasmahato@gmail.com)

Verification Summary:
  - Total Test Cases Executed : 121 (81 Pytest backend + 40 Vitest frontend)
  - Tests Passed              : 121 (100.0%)
  - Tests Failed              : 0 (0.0%)
  - Severity-1 (Blocker) Bugs : 0
  - Severity-2 (Major) Bugs   : 0
  - Code Coverage Average     : 94.7% Statement Coverage across core domains

Conclusion & Release Recommendation:
  All acceptance criteria defined in IEEE Std 829 Software Test Plan (STP)
  have been met or exceeded. The automated CI/CD verification pipeline reports
  all green checks. PlaceMate is hereby certified as READY FOR PRODUCTION
  DEPLOYMENT (v1.0.0).

Certified by:
  Siddhant Choudhary
  QA / Test & DevOps Engineer, PlaceMate Project
  Email: siddhantchoudhary268@gmail.com
  Date : November 15, 2026
================================================================================
```
