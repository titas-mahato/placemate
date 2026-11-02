# PlaceMate: Software Estimation & Risk Management (RMMM)
**Document Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Project Lead & QA/DevOps Engineer  
**Standard:** COCOMO II Model & IEEE Std 1540 (Risk Management)  

---

## 1. COCOMO II Software Cost & Effort Estimation

Using the Post-Architecture COCOMO II estimation model for the PlaceMate software application:

### Sizing (Estimated Source Lines of Code - SLOC)
- Backend (Flask API, Models, Routes, Domain, Migrations): ~4,200 SLOC
- Frontend (React, TypeScript, Components, Dashboards): ~5,800 SLOC
- Test Suites & CI Scripts: ~1,800 SLOC
- **Total Estimated Size (KSLOC)**: $11.8\text{ KSLOC}$

### Effort Equation
$$\text{Effort} = A \times (\text{Size})^E \times \prod \text{EM}$$
Where:
- Nominal constant $A = 2.94$
- Scaling exponent $E = 1.05$ (Semi-detached project characteristics)
- Effort Multipliers ($\prod \text{EM} \approx 1.08$) accounting for high security (SECU) and automated testing (TOOL).

$$\text{Effort} \approx 2.94 \times (11.8)^{1.05} \times 1.08 \approx 42.4\text{ Person-Months (Industry Equivalent)}$$

### Academic Compressed Schedule (5-Engineer Team)
- Team Capacity: 5 Full-Time Equivalent (FTE) student engineers.
- Nominal Duration: 6 Weeks (Academic Semester Sprint Cadence across 4 iterative sprints).

---

## 2. Risk Mitigation, Monitoring, and Management (RMMM) Plan

| Risk ID | Risk Description | Category | Prob. | Impact | Risk Score | Mitigation & Management Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | Student PII data leakage across institutions or recruiters (IDOR). | Security | Low | High | Medium | Enforce strict session-derived ownership queries and write automated regression tests (`test_ownership`). |
| **R-02** | Complex database schema migration fails and corrupts legacy records. | Data Integrity | Med | High | High | Implement non-destructive, idempotent migration scripts (`migrate.py`) that preserve all legacy records and test against shadow schemas. |
| **R-03** | Server crashes during large PDF resume uploads. | Availability | Low | Med | Low | Strict 2 MB upload cap, stream-based file writing, and off-root file storage. |
| **R-04** | Scope creep delays project delivery within semester evaluation deadline. | Project Mgmt | Med | High | High | Strict MoSCoW prioritization in Scrum backlog; MVP delivery focused on core 15 user stories. |
| **R-05** | Teammate commit conflicts or inconsistent local environments. | DevOps | Low | Med | Low | Containerized Docker setup, automated GitHub Actions CI, and separate feature-branch ownership. |
