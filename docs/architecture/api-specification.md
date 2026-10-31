# PlaceMate: RESTful API Specification (OpenAPI / Swagger 3.0 Standard)
**Document Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Software Architect & Project Lead  
**Format:** OpenAPI 3.0 / REST Specification  

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
- **Description**: Registers a new graduating student in the active university tenant.
- **Request Body (`application/json`)**:
  ```json
  {
    "student_id": "SAU042",
    "first_name": "Aarav",
    "last_name": "Sharma",
    "email": "aarav@sau.ac.in",
    "password": "SecurePassword123!",
    "major": "Computer Science",
    "graduation_year": 2026,
    "gpa": 8.45
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Registration successful. You can now log in.",
    "student_id": "SAU042"
  }
  ```

### `POST /api/auth/login`
- **Description**: Verifies credentials and sets a signed HttpOnly session cookie.
- **Request Body (`application/json`)**:
  ```json
  {
    "email": "aarav@sau.ac.in",
    "password": "SecurePassword123!",
    "role": "student"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "SAU042",
      "name": "Aarav Sharma",
      "email": "aarav@sau.ac.in",
      "role": "student"
    },
    "csrf_token": "a4f89d3e..."
  }
  ```

---

## 2. Opportunities & Drives Endpoints

### `GET /api/opportunities`
- **Description**: Returns paginated active placement drives and internship openings with viewer-specific dynamic eligibility flags.
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `limit` (integer, default: 10)
  - `type` (string, `Internship` | `Placement`)
  - `q` (string, search keyword)
- **Response (`200 OK`)**:
  ```json
  {
    "items": [
      {
        "id": 101,
        "title": "Software Development Engineer",
        "type": "Placement",
        "company": "Google India",
        "salary_or_stipend": 28.5,
        "deadline": "2026-11-15",
        "is_eligible": true,
        "eligibility_reasons": [],
        "required_skills": ["Python", "Algorithms", "React"]
      }
    ],
    "total": 14,
    "page": 1,
    "pages": 2
  }
  ```

---

## 3. Student Applications Endpoints

### `POST /api/students/apply`
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body (`application/json`)**:
  ```json
  {
    "opportunity_id": 101,
    "cover_note": "Excited to apply for the SDE role."
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "application_id": 1042,
    "status": "APPLIED",
    "timestamp": "2026-10-27T10:15:00Z"
  }
  ```

---

## 4. Recruiter Pipeline Management Endpoints

### `PUT /api/recruiter/applications/{id}/status`
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body (`application/json`)**:
  ```json
  {
    "status": "SHORTLISTED",
    "notes": "Shortlisted for Round 1 Technical Assessment on Nov 5."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Candidate status successfully updated to SHORTLISTED."
  }
  ```
