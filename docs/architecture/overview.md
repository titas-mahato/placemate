# PlaceMate: Architectural Design Document (ADD)
**Document Standard:** C4 Model & Layered Architecture Specification  
**Version:** 1.0.0 (Sprint 1 Baseline)  
**Author / Engineering Role:** Software Architect & Project Lead  

---

## 1. System Context (C4 Level 1)

PlaceMate sits at the center of institutional campus recruitment, orchestrating real-time interactions across university departments, corporate employers, and graduating students:

```mermaid
flowchart TD
    subgraph External_Users ["Stakeholders & Actors"]
        Student["Graduating Student\n(Browses drives, uploads resume, tracks pipeline)"]
        Recruiter["Corporate Recruiter\n(Publishes roles, reviews applicants, issues offers)"]
        TPO["TPO Placement Officer\n(Moderates companies, analyzes conversion metrics)"]
        Admin["Platform Super Admin\n(Provisions new college tenants)"]
    end

    subgraph PlaceMate_System ["PlaceMate Multi-Tenant Platform"]
        Core["PlaceMate Core Enterprise Platform\n(Multi-tenant recruitment operating system)"]
    end

    subgraph External_Services ["External Integrations"]
        Storage["Cloud Storage\n(Encrypted Resume Vault)"]
        Mail["SMTP Email Gateway\n(Interview & Offer Notifications)"]
    end

    Student -->|HTTPS / REST| Core
    Recruiter -->|HTTPS / REST| Core
    TPO -->|HTTPS / REST| Core
    Admin -->|HTTPS / REST| Core
    Core --> Storage
    Core --> Mail
```

---

## 2. Container Architecture (C4 Level 2)

```mermaid
flowchart LR
    subgraph Client_Tier ["Client Tier (Browser)"]
        SPA["Single Page Application\nReact 18 + TypeScript + Vite\nTailwind CSS / shadcn/ui"]
    end

    subgraph Gateway_Tier ["Reverse Proxy / Gateway"]
        Nginx["Vite Dev Proxy / Nginx\nRoutes /api to Flask backend\nEnforces same-origin cookies"]
    end

    subgraph App_Tier ["Application Tier"]
        Flask["PlaceMate REST API\nPython 3.10+ / Flask 3\nModular Blueprints & Application Factory"]
        TenantEngine["Tenant Context Resolver\nResolves tenant_id from header/subdomain"]
        Security["AppSec Engine\nscrypt hashing, CSRF tokens, rate limiters"]
    end

    subgraph Data_Tier ["Data Tier"]
        DB[("MySQL 8.0+ Database\nParameterized queries\nTenant discriminator column")]
        Files[("Secure File Storage\nEncrypted PDF resumes outside web root")]
    end

    SPA -->|JSON / HTTPS| Nginx
    Nginx --> Flask
    Flask --> TenantEngine
    Flask --> Security
    Flask -->|Connection Pool| DB
    Flask -->|File Stream| Files
```

---

## 3. Multi-Tenancy Strategy: Shared Database with Tenant Discriminator

PlaceMate utilizes a **Shared Database with Column-Level Tenant Discrimination**:
- Every primary table (`users`, `students`, `companies`, `opportunities`, `applications`) includes a `tenant_id VARCHAR(64)` column.
- Middleware extracts the tenant from the `X-Tenant-ID` header (or subdomain) and binds it to Flask's request context (`g.tenant_id`).
- All queries automatically include `WHERE tenant_id = :tenant_id`, guaranteeing cross-tenant data isolation.
- South Asian University (SAU) is onboarded as `tenant_id = 'sau'` (Default launch tenant).
