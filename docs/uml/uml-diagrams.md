# PlaceMate: Unified UML Design Models
**Document Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Requirements Engineer & Software Architect  
**Modules Covered:** Use Case, Sequence, Class, Activity, and State Machine Modeling  

---

## 1. Domain Class Diagram (Object-Oriented Design & Patterns)

The following class diagram models the core domain entities, relationships, and design patterns (Repository Pattern, Strategy Pattern, and Factory Pattern):

```mermaid
classDiagram
    class Tenant {
        +String tenant_id
        +String institution_name
        +String domain
        +JSON config
        +Boolean is_active
        +get_branding()
    }

    class User {
        +Integer user_id
        +String email
        +String password_hash
        +String role
        +String tenant_id
        +DateTime created_at
        +verify_password(password)
    }

    class Student {
        +String student_id
        +String first_name
        +String last_name
        +String major
        +Integer graduation_year
        +Decimal gpa
        +String resume_path
        +get_applications()
    }

    class Company {
        +Integer company_id
        +String name
        +String website
        +String location
        +Boolean is_approved
    }

    class Opportunity {
        +Integer opportunity_id
        +String title
        +String type
        +Decimal package_or_stipend
        +Decimal min_gpa
        +Date deadline
        +Boolean is_active
        +evaluate_eligibility(student)
    }

    class Application {
        +Integer application_id
        +String student_id
        +Integer opportunity_id
        +String status
        +String recruiter_notes
        +DateTime applied_at
        +transition_to(new_status)
    }

    Tenant "1" -- "*" User : owns
    User <|-- Student : inherits
    Company "1" -- "*" Opportunity : posts
    Opportunity "1" -- "*" Application : receives
    Student "1" -- "*" Application : submits
    Tenant "1" -- "*" Opportunity : scopes
```

---

## 2. Sequence Diagram: Student Application & Dynamic Eligibility Verification

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Browser as React SPA
    participant API as PlaceMate Flask API
    participant Guard as RBAC & Tenant Guard
    participant Engine as Eligibility Engine
    participant DB as MySQL Database

    Student->>Browser: Selects Opportunity & Clicks "Apply"
    Browser->>API: POST /api/students/apply (OpportunityID, CoverNote)
    API->>Guard: Verify Session & X-Tenant-ID
    Guard-->>API: Authorized (student_id, tenant_id)
    API->>DB: Query Student Academic Records & Drive Criteria
    DB-->>API: Student (GPA=8.2, Major=CS), Drive (MinGPA=7.5)
    API->>Engine: evaluate_eligibility(Student, Drive)
    Engine-->>API: Result: Eligible (true)
    API->>DB: INSERT INTO applications (student_id, opportunity_id, status='APPLIED')
    DB-->>API: Application Created (ID=1042)
    API-->>Browser: HTTP 201 Created (Reference ID, Timestamp)
    Browser-->>Student: Display Success Toast & Application Tracker
```

---

## 3. Sequence Diagram: Recruiter Drive Creation & Moderation

```mermaid
sequenceDiagram
    autonumber
    actor Recruiter
    participant Browser as Recruiter Dashboard
    participant API as PlaceMate API
    participant DB as MySQL Database
    actor TPO as TPO Admin

    Recruiter->>Browser: Submit Drive Details (Role, CTC, Min CGPA, Deadline)
    Browser->>API: POST /api/recruiter/opportunities
    API->>DB: Verify Recruiter Company Approval Status
    DB-->>API: Company Status = APPROVED
    API->>DB: INSERT INTO opportunities (..., is_active=true)
    DB-->>API: Opportunity Record Created
    API-->>Browser: HTTP 201 Created (Drive Published)
    Note over API,TPO: Real-Time Event Notification
    TPO->>API: GET /api/admin/opportunities (Audit Feed)
    API-->>TPO: Display Active Drive in Campus Placement Stream
```

---

## 4. Activity Diagram: Recruitment Drive Lifecycle

```mermaid
flowchart TD
    Start([Recruiter Initiates Drive]) --> CreateListing[Enter Job Specs & Eligibility Cutoffs]
    CreateListing --> SubmitListing[Submit Opportunity]
    SubmitListing --> CheckApproval{Company Vetted by TPO?}
    CheckApproval -- No --> Pending[Status: Pending Approval]
    Pending --> TPOReview[TPO Reviews Company Credentials]
    TPOReview --> ApproveRecruiter[TPO Approves Company]
    ApproveRecruiter --> PublishDrive
    CheckApproval -- Yes --> PublishDrive[Drive Published & Active]
    
    PublishDrive --> StudentBrowsing[Students Browse Feed]
    StudentBrowsing --> CheckEligibility{Meets CGPA & Major?}
    CheckEligibility -- No --> Disabled[Apply Disabled with Reason]
    CheckEligibility -- Yes --> Apply[Student Submits Application]
    
    Apply --> DeadlineCheck{Deadline Reached?}
    DeadlineCheck -- No --> StudentBrowsing
    DeadlineCheck -- Yes --> CloseListing[Listing Closed for Applications]
    CloseListing --> RecruiterReview[Recruiter Evaluates Applicants]
    RecruiterReview --> Shortlist[Shortlist Candidates]
    Shortlist --> Interviews[Conduct Assessment & Interviews]
    Interviews --> FinalDecision{Hiring Decision}
    FinalDecision -- Selected --> Offer[Status: OFFERED]
    FinalDecision -- Rejected --> Reject[Status: REJECTED]
    Offer --> End([Drive Completed])
    Reject --> End
```

---

## 5. State Machine Diagram: Application Lifecycle State Transitions

```mermaid
stateDiagram-v2
    [*] --> APPLIED : Student submits application
    APPLIED --> SHORTLISTED : Recruiter reviews profile & resume
    APPLIED --> REJECTED : Profile does not match recruiter criteria
    APPLIED --> WITHDRAWN : Student self-withdraws before review

    SHORTLISTED --> ASSESSMENT_SCHEDULED : Online coding assessment
    ASSESSMENT_SCHEDULED --> TECHNICAL_INTERVIEW : Passed assessment
    ASSESSMENT_SCHEDULED --> REJECTED : Did not clear assessment

    TECHNICAL_INTERVIEW --> HR_ROUND : Technical clearance
    TECHNICAL_INTERVIEW --> REJECTED : Technical rejection

    HR_ROUND --> OFFERED : Final selection & offer letter release
    HR_ROUND --> REJECTED : Culture / fit rejection

    OFFERED --> ACCEPTED : Student accepts offer
    OFFERED --> DECLINED : Student declines offer

    ACCEPTED --> [*]
    DECLINED --> [*]
    REJECTED --> [*]
    WITHDRAWN --> [*]
```
