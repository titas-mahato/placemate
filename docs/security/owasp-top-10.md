# PlaceMate: OWASP Top 10 Compliance & Mitigation Matrix
**Document Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Backend & Application Security Engineer  
**Standard:** OWASP Top 10 (2021) Web Application Security Risks  

---

## 1. Compliance Matrix

| OWASP Vulnerability Category | Risk in Placement Context | PlaceMate Architectural Mitigation | Evidence & Verification |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control (IDOR)** | A recruiter requests `/api/applicants/42` belonging to a rival company's job drive. | Route handlers join candidate applications on `company_id` matching the authenticated recruiter's session. Unauthorized queries return HTTP 404. | Tested in `tests/test_recruiter.py::test_ownership_other_company`. |
| **A02: Cryptographic Failures** | Passwords stolen if database is compromised. | Plaintext passwords completely eliminated. All passwords hashed using salted `scrypt` via Werkzeug security primitives. | Tested in `tests/test_auth.py::test_password_hashing`. |
| **A03: Injection (SQLi)** | Attacker inputs `' OR '1'='1` in student search or login. | 100% of database interactions execute via parameterized queries using pooled MySQL connections. Dynamic SQL concatenation strictly banned. | Tested in `tests/test_schema_constraints.py`. |
| **A04: Insecure Design** | Unlimited login attempts enable password brute-forcing. | Memory-backed rate limiters enforce a maximum of 5 failed attempts per IP/account per 15-minute window. | Tested in `tests/test_auth.py::test_login_rate_limiting`. |
| **A05: Security Misconfiguration** | Debug mode leaks stack traces; default database passwords exposed. | Application factory enforces environment-based configuration (`APP_ENV=production` requires random `SECRET_KEY`). Custom JSON error handlers never leak internal tracebacks. | Implemented in `placemate/errors.py`. |
| **A07: Identification Failures** | Session hijacking via cross-site scripting (XSS). | Sessions stored in `HttpOnly`, `SameSite=Lax`, and `Secure` cookies inaccessible to JavaScript. CSRF token header required on all mutations. | Implemented in `placemate/security.py`. |
| **A08: Software & Data Integrity** | Attacker uploads malicious `.php` / `.exe` disguised as a resume. | Strict validation: magic bytes checked for `%PDF-`, size capped at 2 MB, stored outside the web root with UUID v4 filenames. | Tested in `tests/test_students.py::test_resume_upload`. |

---

## 2. Automated Vulnerability Auditing
- Dependency scanning via `pip-audit` in GitHub Actions CI pipeline.
- Continuous regression testing against privilege escalation attempts.
