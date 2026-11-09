-- Reconstructed ORIGINAL (pre-migration) schema, inferred from the original backend/app.py queries.
-- Used only by tests/test_migration.py.
CREATE TABLE students (student_id VARCHAR(20) PRIMARY KEY, first_name VARCHAR(50), last_name VARCHAR(50), email VARCHAR(100) UNIQUE, password VARCHAR(255) NOT NULL, major VARCHAR(100), graduation_year INT, gpa DECIMAL(3,2));
CREATE TABLE admins (admin_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100) UNIQUE, password VARCHAR(255) NOT NULL);
CREATE TABLE companies (company_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150), headquarters_location VARCHAR(150));
CREATE TABLE skills (skill_id INT AUTO_INCREMENT PRIMARY KEY, skill_name VARCHAR(80));
CREATE TABLE internship_listings (internship_id INT AUTO_INCREMENT PRIMARY KEY, company_id INT, title VARCHAR(150), stipend VARCHAR(50), description TEXT, is_active TINYINT(1) DEFAULT 1, FOREIGN KEY (company_id) REFERENCES companies(company_id));
CREATE TABLE placement_listings (placement_id INT AUTO_INCREMENT PRIMARY KEY, company_id INT, title VARCHAR(150), package_lpa DECIMAL(5,2), location VARCHAR(100), description TEXT, is_active TINYINT(1) DEFAULT 1, FOREIGN KEY (company_id) REFERENCES companies(company_id));
CREATE TABLE internship_required_skills (internship_id INT, skill_id INT, PRIMARY KEY (internship_id, skill_id));
CREATE TABLE placement_required_skills (placement_id INT, skill_id INT, PRIMARY KEY (placement_id, skill_id));
INSERT INTO students VALUES ('SAU001','Legacy','Student','legacy@example.test','plain-old-pw','Computer Science',2026,3.40);
INSERT INTO admins (name,email,password) VALUES ('Legacy Admin','legacyadmin@example.test','admin-plain');
INSERT INTO companies (name,headquarters_location) VALUES ('Legacy Co','Delhi');
INSERT INTO skills (skill_name) VALUES ('Java'),('Python');
INSERT INTO placement_listings (company_id,title,package_lpa,location,description) VALUES (1,'Legacy Engineer',8.5,'Delhi','old listing');
INSERT INTO placement_required_skills VALUES (1,1);
