
-- SAU Placement Hub — target schema (MySQL 8 / MariaDB 10.5+).
-- Creates missing tables without dropping existing tables or rows.
-- Existing tables are upgraded by db/migrate.py.

CREATE TABLE IF NOT EXISTS students (
    student_id      VARCHAR(20)  NOT NULL PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL DEFAULT '',
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NULL,
    major           VARCHAR(100) NULL,
    graduation_year INT          NULL,
    gpa             DECIMAL(3,2) NULL,
    phone           VARCHAR(20)  NULL,
    bio             TEXT         NULL,
    resume_path     VARCHAR(255) NULL,
    resume_name     VARCHAR(255) NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admins (
    admin_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
    company_id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    headquarters_location VARCHAR(150) NULL,
    website               VARCHAR(200) NULL,
    description           TEXT         NULL,
    is_approved           TINYINT(1)   NOT NULL DEFAULT 0,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recruiters (
    recruiter_id  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_id    INT          NOT NULL,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status        ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recruiter_company
        FOREIGN KEY (company_id) REFERENCES companies(company_id),
    KEY idx_recruiter_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
    skill_id   INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(80) NOT NULL,
    UNIQUE KEY uq_skill_name (skill_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS internship_listings (
    internship_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_id    INT          NOT NULL,
    recruiter_id  INT          NULL,
    title         VARCHAR(150) NOT NULL,
    stipend       VARCHAR(50)  NULL,
    description   TEXT         NULL,
    location      VARCHAR(100) NULL,
    deadline      DATE         NULL,
    min_gpa       DECIMAL(3,2) NULL,
    min_grad_year INT          NULL,
    max_grad_year INT          NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_company
        FOREIGN KEY (company_id) REFERENCES companies(company_id),
    CONSTRAINT fk_int_recruiter
        FOREIGN KEY (recruiter_id) REFERENCES recruiters(recruiter_id) ON DELETE SET NULL,
    KEY idx_int_company (company_id),
    KEY idx_int_active_deadline (is_active, deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS placement_listings (
    placement_id  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_id    INT          NOT NULL,
    recruiter_id  INT          NULL,
    title         VARCHAR(150) NOT NULL,
    package_lpa   DECIMAL(5,2) NULL,
    location      VARCHAR(100) NULL,
    description   TEXT         NULL,
    deadline      DATE         NULL,
    min_gpa       DECIMAL(3,2) NULL,
    min_grad_year INT          NULL,
    max_grad_year INT          NULL,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pl_company
        FOREIGN KEY (company_id) REFERENCES companies(company_id),
    CONSTRAINT fk_pl_recruiter
        FOREIGN KEY (recruiter_id) REFERENCES recruiters(recruiter_id) ON DELETE SET NULL,
    KEY idx_pl_company (company_id),
    KEY idx_pl_active_deadline (is_active, deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS internship_required_skills (
    internship_id INT NOT NULL,
    skill_id      INT NOT NULL,
    PRIMARY KEY (internship_id, skill_id),
    CONSTRAINT fk_irs_int
        FOREIGN KEY (internship_id) REFERENCES internship_listings(internship_id) ON DELETE CASCADE,
    CONSTRAINT fk_irs_skill
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS placement_required_skills (
    placement_id INT NOT NULL,
    skill_id     INT NOT NULL,
    PRIMARY KEY (placement_id, skill_id),
    CONSTRAINT fk_prs_pl
        FOREIGN KEY (placement_id) REFERENCES placement_listings(placement_id) ON DELETE CASCADE,
    CONSTRAINT fk_prs_skill
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_skills (
    student_id VARCHAR(20) NOT NULL,
    skill_id   INT         NOT NULL,
    PRIMARY KEY (student_id, skill_id),
    CONSTRAINT fk_ss_student
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ss_skill
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per student per opportunity.
-- Exactly one of internship_id or placement_id must be set.
CREATE TABLE IF NOT EXISTS applications (
    application_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id     VARCHAR(20)  NOT NULL,
    internship_id  INT          NULL,
    placement_id   INT          NULL,
    status         ENUM('Applied','Under Review','Shortlisted','Interview','Offered','Rejected','Withdrawn') NOT NULL DEFAULT 'Applied',
    cover_note     TEXT         NULL,
    recruiter_note TEXT         NULL,
    applied_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_student
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_app_internship
        FOREIGN KEY (internship_id) REFERENCES internship_listings(internship_id) ON DELETE CASCADE,
    CONSTRAINT fk_app_placement
        FOREIGN KEY (placement_id) REFERENCES placement_listings(placement_id) ON DELETE CASCADE,
    CONSTRAINT chk_app_one_target
        CHECK ((internship_id IS NULL) <> (placement_id IS NULL)),
    UNIQUE KEY uq_student_internship (student_id, internship_id),
    UNIQUE KEY uq_student_placement (student_id, placement_id),
    KEY idx_app_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
