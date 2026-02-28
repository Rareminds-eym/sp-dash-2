# Rareminds Platform - Complete Architecture Documentation

## 📋 Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Architecture](#api-architecture)
6. [RBAC Implementation](#rbac-implementation)
7. [User Registration Flows](#user-registration-flows)
8. [Deployment Strategy](#deployment-strategy)
9. [Security Best Practices](#security-best-practices)
10. [Migration Guide](#migration-guide)

---

## 1. System Architecture Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE (PostgreSQL)                │
│                  - Shared Database for Both Apps                 │
│                  - Auth, Storage, Realtime                       │
└─────────────────────────────────────────────────────────────────┘
                    ▲                           ▲
                    │                           │
         ┌──────────┴──────────┐    ┌──────────┴──────────┐
         │  Backend API 1       │    │  Backend API 2       │
         │  (Cloudflare Worker) │    │  (Cloudflare Worker) │
         │  For Admin App       │    │  For Main Platform   │
         └──────────┬──────────┘    └──────────┬──────────┘
                    ▲                           ▲
                    │                           │
         ┌──────────┴──────────┐    ┌──────────┴──────────┐
         │   Next.js Admin     │    │   React.js Main     │
         │  (Cloudflare Pages) │    │  (Cloudflare Pages) │
         │                     │    │                     │
         │  Users:             │    │  Users:             │
         │  - RM Admin         │    │  - Schools          │
         │                     │    │  - Colleges         │
         │                     │    │  - Universities     │
         │                     │    │  - Companies        │
         │                     │    │  - Students         │
         │                     │    │  - Educators        │
         │                     │    │  - Recruiters       │
         └─────────────────────┘    └─────────────────────┘
```

### Key Architectural Decisions

#### 1. **Two Separate Applications**
- **Admin App (Next.js)**: Platform administration only
- **Main Platform App (React.js)**: All other entities
- **Reason**: Clear separation of concerns, better security, independent deployment

#### 2. **Two Separate Backend APIs**
- **Backend API 1**: Handles all admin operations
- **Backend API 2**: Handles all main platform operations
- **Both use**: Cloudflare Workers
- **Reason**: Separation of admin logic, different rate limits, independent scaling

#### 3. **Shared Database**
- **Single Supabase Database**: Both backends connect to the same database
- **Reason**: Single source of truth, no data synchronization issues, simpler data integrity

#### 4. **Cloudflare Infrastructure**
- **Pages**: Both frontend apps
- **Workers**: Both backend APIs
- **Storage**: R2 for file storage
- **Reason**: Cost-effective, edge computing, global CDN, seamless integration

---

## 2. Technology Stack

### Frontend

#### Admin App (Next.js)
```
- Framework: Next.js 14+ (App Router)
- Hosting: Cloudflare Pages
- Language: TypeScript
- Styling: Tailwind CSS
- State Management: React Context / Zustand
- Forms: React Hook Form + Zod
- API Client: Fetch / Axios
- Auth: JWT stored in httpOnly cookies
```

#### Main Platform App (React.js)
```
- Framework: React 18+ with Vite
- Hosting: Cloudflare Pages
- Language: TypeScript
- Styling: Tailwind CSS
- State Management: React Context / Zustand
- Routing: React Router v6
- Forms: React Hook Form + Zod
- API Client: Fetch / Axios
- Auth: JWT stored in httpOnly cookies
```

### Backend

#### Backend API 1 (Admin)
```
- Platform: Cloudflare Workers
- Runtime: Workers Runtime (V8)
- Language: TypeScript
- Framework: Hono.js (lightweight, fast)
- Database Client: @supabase/supabase-js
- Auth: JWT (jose library)
- Validation: Zod
```

#### Backend API 2 (Main Platform)
```
- Platform: Cloudflare Workers
- Runtime: Workers Runtime (V8)
- Language: TypeScript
- Framework: Hono.js
- Database Client: @supabase/supabase-js
- Auth: JWT (jose library)
- Validation: Zod
```

### Database
```
- Database: Supabase (PostgreSQL 15+)
- ORM: Direct SQL queries (for performance)
- Migrations: Supabase CLI
- Backup: Automated daily backups
```

### Storage
```
- File Storage: Cloudflare R2
- Alternative: Supabase Storage
- Use Cases: Profile images, documents, certificates
```

---

## 3. Database Schema

### Core Principles

1. **One Student = One Class**: Students can only be enrolled in ONE class/course at a time
2. **Many-to-Many for Educators**: Educators can teach multiple classes, classes can have multiple educators
3. **Hierarchical Structure**: University → College → Course → Students
4. **Entity Isolation**: Each entity (school/college/university/company) is isolated
5. **Audit Trail**: All changes logged in audit_logs table

### Entity Relationship Diagram

```
┌─────────────┐
│    users    │ (Central user table)
└──────┬──────┘
       │
       ├──────────────────────────────────────────────┐
       │                                              │
┌──────▼──────┐                              ┌───────▼────────┐
│   schools   │                              │   companies    │
└──────┬──────┘                              └───────┬────────┘
       │                                             │
┌──────▼─────────────┐                    ┌─────────▼──────────────┐
│  school_classes    │                    │  company_branches      │
└──────┬─────────────┘                    └─────────┬──────────────┘
       │                                             │
┌──────▼─────────────────┐                ┌─────────▼──────────┐
│ school_educators       │                │    recruiters      │
└────────────────────────┘                └────────────────────┘

┌──────────────────────┐
│    universities      │
└──────────┬───────────┘
           │
┌──────────▼──────────────┐
│  university_colleges    │
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│  university_courses     │
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│ university_lecturers    │
└─────────────────────────┘

┌──────────────────────┐
│ colleges_standalone  │
└──────────┬───────────┘
           │
┌──────────▼──────────┐
│  college_courses    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ college_lecturers   │
└─────────────────────┘

       ALL CONVERGE TO
           ↓
    ┌──────────┐
    │ students │ (Can be from any path)
    └──────────┘
```

### Complete Database Schema (SQL)

```sql
-- ============================================================
-- RAREMINDS PLATFORM - DATABASE SCHEMA
-- Database: PostgreSQL (Supabase)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'platform_admin',
    'school_admin',
    'college_admin',
    'university_admin',
    'college_under_university_admin',
    'company_admin',
    'branch_manager',
    'educator',
    'lecturer',
    'student',
    'recruiter'
);

CREATE TYPE entity_type AS ENUM (
    'school',
    'college_standalone',
    'university',
    'company'
);

CREATE TYPE account_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending'
);

CREATE TYPE approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL,
    entity_type entity_type,
    entity_id UUID,
    account_status account_status DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    profile_image_url TEXT,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_role_entity CHECK (
        (role = 'platform_admin' AND entity_type IS NULL AND entity_id IS NULL) OR
        (role != 'platform_admin' AND entity_type IS NOT NULL)
    )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_entity ON users(entity_type, entity_id);
CREATE INDEX idx_users_supabase_auth_id ON users(supabase_auth_id);

-- ============================================================
-- SCHOOL STRUCTURE
-- ============================================================

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    board VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE school_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    section VARCHAR(10),
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 40,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(school_id, name, academic_year)
);

CREATE TABLE school_educators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experience_years INTEGER,
    date_of_joining DATE,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(school_id, employee_id)
);

CREATE TABLE school_educator_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    educator_id UUID NOT NULL REFERENCES school_educators(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(educator_id, class_id, subject, academic_year)
);

-- ============================================================
-- COLLEGE STANDALONE STRUCTURE
-- ============================================================

CREATE TABLE colleges_standalone (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    affiliation VARCHAR(255),
    accreditation VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE college_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges_standalone(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    year INTEGER,
    semester INTEGER,
    section VARCHAR(10),
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 60,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, name, academic_year)
);

CREATE TABLE college_lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES colleges_standalone(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experience_years INTEGER,
    date_of_joining DATE,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, employee_id)
);

CREATE TABLE college_lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES college_lecturers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES college_courses(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(lecturer_id, course_id, subject, academic_year)
);

-- ============================================================
-- UNIVERSITY STRUCTURE
-- ============================================================

CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    university_type VARCHAR(50),
    accreditation VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE university_colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    dean_name VARCHAR(200),
    dean_email VARCHAR(255),
    dean_phone VARCHAR(20),
    established_year INTEGER,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(university_id, code)
);

CREATE TABLE university_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES university_colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    year INTEGER,
    semester INTEGER,
    section VARCHAR(10),
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 60,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, name, academic_year)
);

CREATE TABLE university_lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES university_colleges(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experience_years INTEGER,
    date_of_joining DATE,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, employee_id)
);

CREATE TABLE university_lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES university_lecturers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES university_courses(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(lecturer_id, course_id, subject, academic_year)
);

-- ============================================================
-- STUDENTS TABLE
-- ============================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    student_type VARCHAR(30) NOT NULL,
    
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    college_id UUID REFERENCES colleges_standalone(id) ON DELETE SET NULL,
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    university_college_id UUID REFERENCES university_colleges(id) ON DELETE SET NULL,
    
    school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL,
    college_course_id UUID REFERENCES college_courses(id) ON DELETE SET NULL,
    university_course_id UUID REFERENCES university_courses(id) ON DELETE SET NULL,
    
    enrollment_number VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(5),
    
    guardian_name VARCHAR(200),
    guardian_phone VARCHAR(20),
    guardian_email VARCHAR(255),
    guardian_relation VARCHAR(50),
    
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    
    enrollment_date DATE,
    expected_graduation_date DATE,
    current_cgpa DECIMAL(4,2),
    
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT chk_student_type CHECK (
        student_type IN ('direct', 'school', 'college_standalone', 'university')
    ),
    CONSTRAINT chk_only_one_class CHECK (
        (school_class_id IS NOT NULL AND college_course_id IS NULL AND university_course_id IS NULL) OR
        (school_class_id IS NULL AND college_course_id IS NOT NULL AND university_course_id IS NULL) OR
        (school_class_id IS NULL AND college_course_id IS NULL AND university_course_id IS NOT NULL) OR
        (school_class_id IS NULL AND college_course_id IS NULL AND university_course_id IS NULL AND student_type = 'direct')
    )
);

-- ============================================================
-- COMPANY STRUCTURE
-- ============================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    hq_address TEXT,
    hq_city VARCHAR(100),
    hq_state VARCHAR(100),
    hq_country VARCHAR(100) DEFAULT 'India',
    hq_pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    contact_person_name VARCHAR(200),
    contact_person_designation VARCHAR(100),
    contact_person_email VARCHAR(255),
    contact_person_phone VARCHAR(20),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE company_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    branch_type VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    branch_head_name VARCHAR(200),
    branch_head_email VARCHAR(255),
    branch_head_phone VARCHAR(20),
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(company_id, code)
);

CREATE TABLE recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES company_branches(id) ON DELETE SET NULL,
    employee_id VARCHAR(50),
    designation VARCHAR(100),
    department VARCHAR(100),
    date_of_joining DATE,
    is_hq_recruiter BOOLEAN DEFAULT false,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(company_id, employee_id)
);

-- ============================================================
-- RBAC TABLES
-- ============================================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add more triggers for other tables...

-- ============================================================
-- SEED PERMISSIONS
-- ============================================================

INSERT INTO permissions (name, resource, action, description) VALUES
('platform:manage_all', 'platform', 'manage_all', 'Full platform access'),
('school:create', 'school', 'create', 'Create schools'),
('school:read', 'school', 'read', 'View school details'),
('school:update', 'school', 'update', 'Update school details'),
('school:delete', 'school', 'delete', 'Delete schools'),
('class:create', 'class', 'create', 'Create classes'),
('class:read', 'class', 'read', 'View class details'),
('educator:create', 'educator', 'create', 'Add educators'),
('student:create', 'student', 'create', 'Create student accounts'),
('student:read', 'student', 'read', 'View student details'),
('company:create', 'company', 'create', 'Create companies'),
('recruiter:create', 'recruiter', 'create', 'Add recruiters');

-- Platform Admin gets all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'platform_admin', id FROM permissions;

-- School Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions 
WHERE name IN (
    'school:read', 'school:update',
    'class:create', 'class:read',
    'educator:create', 'student:create', 'student:read'
);
```

---

## 4. Authentication & Authorization

### JWT Token Structure

```typescript
interface JWTPayload {
  sub: string;              // user_id
  email: string;
  role: UserRole;
  entity_type?: EntityType;
  entity_id?: string;
  permissions: string[];
  iat: number;
  exp: number;
}
```

### Authentication Flow

```
1. User enters email/password
   ↓
2. Backend validates with Supabase Auth
   ↓
3. Backend fetches user record from users table
   ↓
4. Backend fetches permissions from role_permissions
   ↓
5. Backend generates JWT with user info + permissions
   ↓
6. Frontend stores JWT in httpOnly cookie
   ↓
7. Every API request includes JWT in Authorization header
   ↓
8. Backend validates JWT and checks permissions
   ↓
9. Allow/Deny based on RBAC rules
```

### Role Hierarchy

```
Level 1: platform_admin
    └── Full system access

Level 2: Entity Admins
    ├── school_admin (manages one school)
    ├── college_admin (manages one college)
    ├── university_admin (manages one university)
    └── company_admin (manages one company)

Level 3: Sub-Entity Managers
    ├── college_under_university_admin
    └── branch_manager

Level 4: Instructors
    ├── educator (school teacher)
    └── lecturer (college/university teacher)

Level 5: End Users
    ├── student
    └── recruiter
```

---

## 5. API Architecture

### Backend API 1 - Admin API (Cloudflare Worker)

**Base URL**: `https://admin-api.rareminds.com`

**Endpoints**:

```
Authentication:
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

Platform Management:
GET    /api/admin/dashboard
GET    /api/admin/stats

School Management:
GET    /api/admin/schools
POST   /api/admin/schools
GET    /api/admin/schools/:id
PUT    /api/admin/schools/:id
DELETE /api/admin/schools/:id
POST   /api/admin/schools/:id/approve
POST   /api/admin/schools/:id/reject

College Management:
GET    /api/admin/colleges
POST   /api/admin/colleges
GET    /api/admin/colleges/:id
PUT    /api/admin/colleges/:id
DELETE /api/admin/colleges/:id

University Management:
GET    /api/admin/universities
POST   /api/admin/universities
GET    /api/admin/universities/:id
PUT    /api/admin/universities/:id
DELETE /api/admin/universities/:id

Company Management:
GET    /api/admin/companies
POST   /api/admin/companies
GET    /api/admin/companies/:id
PUT    /api/admin/companies/:id
DELETE /api/admin/companies/:id
POST   /api/admin/companies/:id/approve

User Management:
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
POST   /api/admin/users/:id/suspend
POST   /api/admin/users/:id/activate

Audit Logs:
GET    /api/admin/audit-logs
GET    /api/admin/audit-logs/:id
```

### Backend API 2 - Main Platform API (Cloudflare Worker)

**Base URL**: `https://api.rareminds.com`

**Endpoints**:

```
Authentication:
POST   /api/auth/login
POST   /api/auth/register (for direct students only)
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

School Operations:
GET    /api/schools/me (school admin gets their school)
PUT    /api/schools/me
GET    /api/schools/me/classes
POST   /api/schools/me/classes
GET    /api/schools/me/classes/:id
PUT    /api/schools/me/classes/:id
DELETE /api/schools/me/classes/:id

Educator Operations (School):
GET    /api/schools/me/educators
POST   /api/schools/me/educators (creates user + educator record)
GET    /api/schools/me/educators/:id
PUT    /api/schools/me/educators/:id
DELETE /api/schools/me/educators/:id
POST   /api/schools/me/educators/:id/assign-class

Student Operations (School):
GET    /api/schools/me/students
POST   /api/schools/me/students (creates user + student record)
GET    /api/schools/me/students/:id
PUT    /api/schools/me/students/:id
DELETE /api/schools/me/students/:id
POST   /api/schools/me/students/:id/enroll

College Operations (Standalone):
GET    /api/colleges/me
PUT    /api/colleges/me
GET    /api/colleges/me/courses
POST   /api/colleges/me/courses
GET    /api/colleges/me/lecturers
POST   /api/colleges/me/lecturers (creates user + lecturer record)
GET    /api/colleges/me/students
POST   /api/colleges/me/students (creates user + student record)

University Operations:
GET    /api/universities/me
PUT    /api/universities/me
GET    /api/universities/me/colleges
POST   /api/universities/me/colleges
GET    /api/universities/me/colleges/:id/courses
POST   /api/universities/me/colleges/:id/courses
GET    /api/universities/me/colleges/:id/lecturers
POST   /api/universities/me/colleges/:id/lecturers
GET    /api/universities/me/colleges/:id/students
POST   /api/universities/me/colleges/:id/students

Company Operations:
GET    /api/companies/me
PUT    /api/companies/me
GET    /api/companies/me/branches
POST   /api/companies/me/branches
GET    /api/companies/me/recruiters
POST   /api/companies/me/recruiters (creates user + recruiter record)
GET    /api/companies/me/branches/:id/recruiters
POST   /api/companies/me/branches/:id/recruiters

Student Operations:
GET    /api/students/me (student gets their own data)
PUT    /api/students/me
GET    /api/students/me/class (gets class/course details)
GET    /api/students/me/educators (gets their teachers)

Educator/Lecturer Operations:
GET    /api/educators/me
GET    /api/educators/me/classes
GET    /api/educators/me/classes/:id/students

Recruiter Operations:
GET    /api/recruiters/me
GET    /api/recruiters/students (search/filter students)
POST   /api/recruiters/jobs
GET    /api/recruiters/jobs
```

### API Request/Response Format

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You don't have permission to perform this action"
  }
}
```

---

## 6. RBAC Implementation

### Permission Naming Convention

```
Format: <resource>:<action>

Examples:
- school:create
- school:read
- school:update
- school:delete
- class:create
- student:enroll
- educator:assign
- company:approve
```

### Middleware Implementation (Cloudflare Worker)

```typescript
// auth.middleware.ts
export async function authMiddleware(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing token' }
    }), { status: 401 });
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return payload;
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
    }), { status: 401 });
  }
}

// permission.middleware.ts
export function requirePermission(permission: string) {
  return (user: JWTPayload) => {
    // Platform admin has all permissions
    if (user.permissions.includes('platform:manage_all')) {
      return true;
    }
    
    if (!user.permissions.includes(permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
    
    return true;
  };
}

// entity.middleware.ts
export async function validateEntityAccess(
  user: JWTPayload,
  entityType: string,
  entityId: string,
  supabase: SupabaseClient
) {
  // Platform admin can access all entities
  if (user.role === 'platform_admin') {
    return true;
  }
  
  // Check if user's entity matches
  if (user.entity_type === entityType && user.entity_id === entityId) {
    return true;
  }
  
  // For university structure, check hierarchy
  if (entityType === 'university') {
    const { data: college } = await supabase
      .from('university_colleges')
      .select('university_id')
      .eq('id', user.entity_id)
      .single();
    
    if (college && college.university_id === entityId) {
      return true;
    }
  }
  
  return false;
}
```

### Example Route with RBAC

```typescript
// schools.routes.ts
import { Hono } from 'hono';

const schoolsRouter = new Hono();

// Create class (requires school:create permission)
schoolsRouter.post('/me/classes', async (c) => {
  const user = c.get('user'); // From auth middleware
  
  // Check permission
  if (!user.permissions.includes('class:create')) {
    return c.json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: 'Missing permission: class:create' }
    }, 403);
  }
  
  // Validate entity access
  if (user.entity_type !== 'school') {
    return c.json({
      success: false,
      error: { code: 'INVALID_ENTITY', message: 'Only school admins can create classes' }
    }, 403);
  }
  
  const body = await c.req.json();
  
  // Create class logic
  const { data, error } = await c.env.supabase
    .from('school_classes')
    .insert({
      school_id: user.entity_id,
      name: body.name,
      grade: body.grade,
      section: body.section,
      academic_year: body.academic_year,
      max_students: body.max_students || 40
    })
    .select()
    .single();
  
  if (error) {
    return c.json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message }
    }, 500);
  }
  
  return c.json({
    success: true,
    data,
    message: 'Class created successfully'
  });
});

export default schoolsRouter;
```

---

## 7. User Registration Flows

### Flow 1: Direct Student Registration

```
1. Student visits main platform app
2. Clicks "Register as Student"
3. Fills form:
   - Email
   - Password
   - First Name
   - Last Name
   - Phone
   - Date of Birth
4. Backend API 2 processes:
   a. Create Supabase auth user
   b. Create record in users table (role: 'student')
   c. Create record in students table (student_type: 'direct')
5. Send verification email
6. Student logs in after verification
```

### Flow 2: School Admin Creates Student

```
1. School Admin logs into main platform
2. Navigates to Students section
3. Clicks "Add Student"
4. Fills form:
   - Email
   - First Name
   - Last Name
   - Phone
   - Date of Birth
   - Guardian Details
   - Select Class (dropdown of school's classes)
5. Backend API 2 processes:
   a. Check permission: 'student:create'
   b. Check entity: user must be school_admin
   c. Create Supabase auth user (with temporary password)
   d. Create record in users table (role: 'student', entity_type: 'school', entity_id: school_id)
   e. Create record in students table (student_type: 'school', school_id, school_class_id)
   f. Update school_classes.current_students counter
6. Send welcome email to student with temporary password
7. Student logs in and changes password
```

### Flow 3: School Admin Creates Educator

```
1. School Admin logs into main platform
2. Navigates to Educators section
3. Clicks "Add Educator"
4. Fills form:
   - Email
   - First Name
   - Last Name
   - Phone
   - Employee ID
   - Specialization
   - Qualification
5. Backend API 2 processes:
   a. Check permission: 'educator:create'
   b. Create Supabase auth user
   c. Create record in users table (role: 'educator', entity_type: 'school', entity_id: school_id)
   d. Create record in school_educators table
6. Send welcome email
```

### Flow 4: School Admin Assigns Educator to Class

```
1. School Admin goes to Educator details page
2. Clicks "Assign to Class"
3. Selects:
   - Class (dropdown)
   - Subject
   - Academic Year
   - Is Primary Teacher? (checkbox)
4. Backend API 2 processes:
   a. Check permission: 'educator:assign'
   b. Create record in school_educator_class_assignments table
5. Educator now sees this class in their dashboard
```

### Flow 5: Company Admin Creates Recruiter

```
1. Company Admin logs into main platform
2. Navigates to Recruiters section
3. Clicks "Add Recruiter"
4. Fills form:
   - Email
   - First Name
   - Last Name
   - Phone
   - Employee ID
   - Designation
   - Location: HQ or Branch (dropdown)
5. Backend API 2 processes:
   a. Check permission: 'recruiter:create'
   b. Create Supabase auth user
   c. Create record in users table (role: 'recruiter', entity_type: 'company', entity_id: company_id)
   d. Create record in recruiters table (with branch_id if branch selected)
6. Send welcome email
```

### Flow 6: RM Admin Creates School/College/University/Company

```
1. RM Admin logs into admin app
2. Navigates to respective section
3. Clicks "Add New Entity"
4. Fills form with entity details
5. Backend API 1 processes:
   a. Check role: 'platform_admin'
   b. Create record in respective table (approval_status: 'pending')
   c. Create admin user for the entity
   d. Create record in users table with appropriate role
6. Send welcome email to entity admin
7. Entity appears in pending approvals list
8. RM Admin approves/rejects from admin dashboard
```

---

## 8. Deployment Strategy

### Cloudflare Setup

#### 1. Admin App (Next.js)

```bash
# wrangler.toml
name = "rareminds-admin"
compatibility_date = "2024-01-01"

[env.production]
route = "admin.rareminds.com/*"

[env.staging]
route = "admin-staging.rareminds.com/*"
```

**Deployment**:
```bash
npm run build
npx wrangler pages deploy .next
```

#### 2. Main Platform App (React + Vite)

```bash
# wrangler.toml
name = "rareminds-platform"
compatibility_date = "2024-01-01"

[env.production]
route = "app.rareminds.com/*"

[env.staging]
route = "app-staging.rareminds.com/*"
```

**Deployment**:
```bash
npm run build
npx wrangler pages deploy dist
```

#### 3. Backend API 1 (Admin API)

```bash
# wrangler.toml
name = "rareminds-admin-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
route = "admin-api.rareminds.com/*"
vars = { ENVIRONMENT = "production" }

[env.production.vars]
SUPABASE_URL = "https://your-project.supabase.co"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[env.staging]
route = "admin-api-staging.rareminds.com/*"
```

**Deployment**:
```bash
npx wrangler deploy --env production
```

#### 4. Backend API 2 (Main Platform API)

```bash
# wrangler.toml
name = "rareminds-platform-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
route = "api.rareminds.com/*"
vars = { ENVIRONMENT = "production" }

[env.production.vars]
SUPABASE_URL = "https://your-project.supabase.co"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

**Deployment**:
```bash
npx wrangler deploy --env production
```

### Environment Variables

**Admin App (.env.production)**:
```
NEXT_PUBLIC_API_URL=https://admin-api.rareminds.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Main Platform App (.env.production)**:
```
VITE_API_URL=https://api.rareminds.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend APIs (Cloudflare Secrets)**:
```bash
# Set secrets
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put SUPABASE_SERVICE_KEY --env production
npx wrangler secret put DATABASE_URL --env production
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy-admin.yml
name: Deploy Admin App

on:
  push:
    branches: [main]
    paths:
      - 'apps/admin/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: cd apps/admin && npm ci
      
      - name: Build
        run: cd apps/admin && npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.ADMIN_API_URL }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy .next --project-name=rareminds-admin
          workingDirectory: apps/admin
```

---

## 9. Security Best Practices

### 1. Authentication Security

```typescript
// JWT Configuration
const JWT_CONFIG = {
  algorithm: 'HS256',
  accessTokenExpiry: '24h',
  refreshTokenExpiry: '7d',
  issuer: 'rareminds.com',
  audience: 'rareminds-api'
};

// Password Requirements
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};

// Rate Limiting
const RATE_LIMITS = {
  login: { requests: 5, window: '15m' },
  api: { requests: 100, window: '1m' },
  registration: { requests: 3, window: '1h' }
};
```

### 2. Database Security

```sql
-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Platform Admin: Full access
CREATE POLICY platform_admin_all ON users FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.supabase_auth_id = auth.uid() 
    AND u.role = 'platform_admin'
  )
);

-- School Admin: Access only their school's data
CREATE POLICY school_admin_access ON school_classes FOR ALL 
USING (
  school_id IN (
    SELECT entity_id::UUID FROM users 
    WHERE supabase_auth_id = auth.uid() 
    AND role = 'school_admin'
    AND entity_type = 'school'
  )
);

-- Students: Access only their own data
CREATE POLICY student_own_data ON students FOR SELECT 
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE supabase_auth_id = auth.uid()
  )
);
```

### 3. API Security Headers

```typescript
// Add security headers to all responses
export function addSecurityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  return response;
}
```

### 4. Input Validation

```typescript
import { z } from 'zod';

// Schema for creating a student
const createStudentSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(2).max(100),
  last_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  date_of_birth: z.string().date(),
  class_id: z.string().uuid(),
  guardian_name: z.string().min(2).max(200),
  guardian_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  guardian_email: z.string().email()
});

// Validate request
const validateRequest = (schema: z.ZodSchema) => {
  return async (c: Context) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validated', validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: error.errors
          }
        }, 400);
      }
      throw error;
    }
  };
};
```

### 5. Audit Logging

```typescript
// Log all sensitive operations
async function logAuditTrail(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  oldValues: any,
  newValues: any,
  request: Request,
  supabase: SupabaseClient
) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: request.headers.get('CF-Connecting-IP'),
    user_agent: request.headers.get('User-Agent')
  });
}

// Usage
await logAuditTrail(
  user.id,
  'UPDATE_STUDENT',
  'students',
  studentId,
  oldData,
  newData,
  request,
  supabase
);
```

---

## 10. Migration Guide

### Step 1: Database Migration

```sql
-- If you have existing schema, create a migration script

-- 1. Backup existing data
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE students_backup AS SELECT * FROM students;

-- 2. Add new columns if needed
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type entity_type;
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 3. Migrate existing data
UPDATE users 
SET entity_type = 'school', 
    entity_id = (SELECT school_id FROM school_educators WHERE user_id = users.id)
WHERE role = 'educator';

-- 4. Add constraints
ALTER TABLE users ADD CONSTRAINT valid_role_entity CHECK (
  (role = 'platform_admin' AND entity_type IS NULL) OR
  (role != 'platform_admin' AND entity_type IS NOT NULL)
);

-- 5. Create indexes
CREATE INDEX idx_users_entity ON users(entity_type, entity_id);

-- 6. Verify data integrity
SELECT role, COUNT(*) FROM users GROUP BY role;
```

### Step 2: Application Migration

```typescript
// Create migration scripts for data transformation

// migrate-students.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateStudents() {
  // Get all students without student_type
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .is('student_type', null);
  
  for (const student of students) {
    let studentType = 'direct';
    
    if (student.school_id) studentType = 'school';
    else if (student.college_id) studentType = 'college_standalone';
    else if (student.university_id) studentType = 'university';
    
    await supabase
      .from('students')
      .update({ student_type: studentType })
      .eq('id', student.id);
    
    console.log(`Migrated student ${student.id} to type ${studentType}`);
  }
}

migrateStudents();
```

### Step 3: Deploy Backend APIs

```bash
# 1. Clone backend template
git clone https://github.com/rareminds/backend-api-template

# 2. Install dependencies
cd backend-api-1-admin
npm install

# 3. Configure wrangler.toml
# Add your configuration

# 4. Test locally
npx wrangler dev

# 5. Deploy to staging
npx wrangler deploy --env staging

# 6. Test staging endpoints
curl https://admin-api-staging.rareminds.com/api/health

# 7. Deploy to production
npx wrangler deploy --env production
```

### Step 4: Update Frontend Apps

```bash
# 1. Update API endpoints in .env files
# Admin App
NEXT_PUBLIC_API_URL=https://admin-api.rareminds.com

# Main Platform App
VITE_API_URL=https://api.rareminds.com

# 2. Update API client
// api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
                     import.meta.env.VITE_API_URL;

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const token = getToken(); // From cookie or localStorage
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return response.json();
  }
};

# 3. Deploy frontend apps
npm run build
npx wrangler pages deploy
```

---

## 11. Project Structure

### Monorepo Structure (Recommended)

```
rareminds-platform/
│
├── apps/
│   ├── admin/                    # Next.js Admin App
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── .env.local
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   ├── platform/                 # React.js Main Platform
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── .env
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── admin-api/                # Backend API 1
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── schools/
│   │   │   │   ├── colleges/
│   │   │   │   └── companies/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── platform-api/             # Backend API 2
│       ├── src/
│       │   ├── index.ts
│       │   ├── middleware/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── schools/
│       │   │   ├── students/
│       │   │   └── companies/
│       │   ├── utils/
│       │   └── types/
│       ├── wrangler.toml
│       └── package.json
│
├── packages/
│   ├── shared-types/             # Shared TypeScript types
│   ├── ui-components/            # Shared React components
│   └── utils/                    # Shared utilities
│
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_rbac.sql
│   │   └── 003_add_audit_logs.sql
│   ├── seeds/
│   │   └── permissions.sql
│   └── schema.sql
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── USER_FLOWS.md
│
├── .github/
│   └── workflows/
│       ├── deploy-admin.yml
│       ├── deploy-platform.yml
│       ├── deploy-admin-api.yml
│       └── deploy-platform-api.yml
│
├── package.json (root)
├── turbo.json
└── README.md
```

---

## 12. Quick Start Guide

### Prerequisites
```bash
- Node.js 20+
- npm or pnpm
- Supabase account
- Cloudflare account
```

### Setup Steps

```bash
# 1. Clone repository
git clone https://github.com/rareminds/platform
cd platform

# 2. Install dependencies
npm install

# 3. Setup Supabase
npx supabase init
npx supabase db push

# 4. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 5. Run database migrations
npx supabase db reset

# 6. Start development servers
npm run dev

# This will start:
# - Admin App: ${ADMIN_APP_URL:-http://localhost:3000}
# - Platform App: ${PLATFORM_APP_URL:-http://localhost:5173}
# - Admin API: ${ADMIN_API_URL:-http://localhost:8787}
# - Platform API: ${PLATFORM_API_URL:-http://localhost:8788}

# 7. Create first admin user
npm run seed:admin
```

---

## 13. API Testing

### Using Postman/Thunder Client

```bash
# 1. Import collection
# Download: docs/api-collection.json

# 2. Set environment variables
{
  "API_URL": process.env.ADMIN_API_URL || "http://localhost:8787",
  "TOKEN": ""
}

# 3. Test login
POST {{API_URL}}/api/auth/login
{
  "email": "admin@rareminds.com",
  "password": "Admin@123"
}

# 4. Copy token from response
# Set TOKEN variable

# 5. Test protected endpoint
GET {{API_URL}}/api/admin/dashboard
Authorization: Bearer {{TOKEN}}
```

---

## 14. Monitoring & Logging

### Cloudflare Analytics

```typescript
// Add analytics to workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const start = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      // Log metrics
      ctx.waitUntil(
        env.ANALYTICS.writeDataPoint({
          blobs: [request.url, request.method],
          doubles: [Date.now() - start],
          indexes: [request.headers.get('CF-Ray') || '']
        })
      );
      
      return response;
    } catch (error) {
      // Log error
      console.error('Request failed:', error);
      throw error;
    }
  }
};
```

### Error Tracking (Sentry)

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  tracesSampleRate: 1.0
});
```

---

## 15. Performance Optimization

### 1. Database Query Optimization

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_students_school_class ON students(school_id, school_class_id) 
WHERE student_type = 'school';

CREATE INDEX idx_students_college_course ON students(college_id, college_course_id) 
WHERE student_type = 'college_standalone';

CREATE INDEX idx_students_university_course ON students(university_id, university_course_id) 
WHERE student_type = 'university';

-- Add indexes for frequently joined tables
CREATE INDEX idx_school_educators_school_user ON school_educators(school_id, user_id);
CREATE INDEX idx_recruiter_company_branch ON recruiters(company_id, branch_id);
```

### 2. Caching Strategy

```typescript
// Use Cloudflare KV for caching
export class CacheService {
  constructor(private kv: KVNamespace) {}
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.kv.get(key, 'json');
    return cached as T;
  }
  
  async set(key: string, value: any, ttl: number = 3600) {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl
    });
  }
  
  async invalidate(key: string) {
    await this.kv.delete(key);
  }
}

// Usage in API
async function getSchoolDetails(schoolId: string, cache: CacheService) {
  const cacheKey = `school:${schoolId}`;
  
  // Try cache first
  let school = await cache.get(cacheKey);
  
  if (!school) {
    // Fetch from database
    const { data } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    
    school = data;
    
    // Cache for 1 hour
    await cache.set(cacheKey, school, 3600);
  }
  
  return school;
}
```

### 3. Batch Operations

```typescript
// Batch student creation
async function createStudentsBatch(students: StudentInput[], schoolId: string) {
  // Create auth users in batch
  const authPromises = students.map(s => 
    supabase.auth.admin.createUser({
      email: s.email,
      password: generateTemporaryPassword(),
      email_confirm: false
    })
  );
  
  const authResults = await Promise.all(authPromises);
  
  // Create user records in batch
  const userRecords = authResults.map((result, i) => ({
    supabase_auth_id: result.data.user?.id,
    email: students[i].email,
    first_name: students[i].first_name,
    last_name: students[i].last_name,
    role: 'student',
    entity_type: 'school',
    entity_id: schoolId
  }));
  
  const { data: users } = await supabase
    .from('users')
    .insert(userRecords)
    .select();
  
  // Create student records in batch
  const studentRecords = users.map((user, i) => ({
    user_id: user.id,
    student_type: 'school',
    school_id: schoolId,
    school_class_id: students[i].class_id,
    enrollment_number: students[i].enrollment_number,
    date_of_birth: students[i].date_of_birth
  }));
  
  await supabase
    .from('students')
    .insert(studentRecords);
  
  return { success: true, count: students.length };
}
```

### 4. Connection Pooling

```typescript
// Use connection pooling for database
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'x-application-name': 'rareminds-api'
      }
    }
  }
);
```

---

## 16. Testing Strategy

### Unit Tests

```typescript
// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import { JWTService } from '../src/utils/jwt';

describe('JWT Service', () => {
  it('should generate valid JWT token', async () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: 'student',
      entity_type: 'school',
      entity_id: 'school-123'
    };
    
    const permissions = ['student:read'];
    const token = await JWTService.generateAccessToken(user, permissions);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });
  
  it('should verify valid token', async () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: 'student'
    };
    
    const token = await JWTService.generateAccessToken(user, []);
    const decoded = await JWTService.verifyToken(token);
    
    expect(decoded.sub).toBe('123');
    expect(decoded.email).toBe('test@example.com');
  });
  
  it('should reject invalid token', async () => {
    const invalidToken = 'invalid.token.here';
    
    await expect(
      JWTService.verifyToken(invalidToken)
    ).rejects.toThrow('Invalid or expired token');
  });
});
```

### Integration Tests

```typescript
// tests/integration/schools.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

describe('Schools API', () => {
  let adminToken: string;
  let schoolId: string;
  
  beforeAll(async () => {
    // Login as admin
    const loginRes = await fetch(`${process.env.ADMIN_API_URL || 'http://localhost:8787'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rareminds.com',
        password: 'Admin@123'
      })
    });
    
    const loginData = await loginRes.json();
    adminToken = loginData.data.token;
  });
  
  it('should create a school', async () => {
    const res = await fetch(`${process.env.ADMIN_API_URL || 'http://localhost:8787'}/api/admin/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Test School',
        code: 'TEST001',
        city: 'Mumbai',
        email: 'test@school.com'
      })
    });
    
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test School');
    
    schoolId = data.data.id;
  });
  
  it('should get school details', async () => {
    const res = await fetch(`${process.env.ADMIN_API_URL || 'http://localhost:8787'}/api/admin/schools/${schoolId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(schoolId);
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/school-admin.spec.ts
import { test, expect } from '@playwright/test';

test('School admin can create a class', async ({ page }) => {
  // Login
  await page.goto(process.env.PLATFORM_APP_URL || 'http://localhost:5173/login');
  await page.fill('[name="email"]', 'school@test.com');
  await page.fill('[name="password"]', 'Password@123');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  
  // Navigate to classes
  await page.click('text=Classes');
  await page.click('text=Add New Class');
  
  // Fill form
  await page.fill('[name="name"]', 'Grade 10-A');
  await page.fill('[name="grade"]', '10');
  await page.fill('[name="section"]', 'A');
  await page.fill('[name="academic_year"]', '2024-2025');
  await page.fill('[name="max_students"]', '40');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify success
  await expect(page.locator('.success-message')).toContainText('Class created successfully');
});
```

---

## 17. Common Use Cases & Examples

### Use Case 1: School Admin Creates Multiple Students via CSV Upload

**Frontend Flow**:
```typescript
// Upload CSV file
async function uploadStudentsCSV(file: File, classId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('class_id', classId);
  
  const response = await fetch('/api/schools/me/students/bulk-upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
}
```

**Backend Implementation**:
```typescript
// Backend API endpoint
router.post('/schools/me/students/bulk-upload', async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const classId = formData.get('class_id') as string;
  
  // Parse CSV
  const csvText = await file.text();
  const students = parseCSV(csvText);
  
  // Validate class belongs to school
  const { data: classData } = await supabase
    .from('school_classes')
    .select('school_id')
    .eq('id', classId)
    .single();
  
  if (classData.school_id !== user.entity_id) {
    return c.json({ success: false, error: 'Invalid class' }, 403);
  }
  
  // Create students in batch
  const results = await createStudentsBatch(students, user.entity_id);
  
  return c.json({ success: true, data: results });
});
```

### Use Case 2: Student Views Their Class Schedule

**Frontend Component**:
```typescript
// StudentSchedule.tsx
function StudentSchedule() {
  const [schedule, setSchedule] = useState([]);
  
  useEffect(() => {
    fetchSchedule();
  }, []);
  
  async function fetchSchedule() {
    const res = await fetch('/api/students/me/schedule', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    setSchedule(data.data);
  }
  
  return (
    <div className="schedule-container">
      <h2>My Class Schedule</h2>
      {schedule.map(item => (
        <div key={item.id} className="schedule-item">
          <span>{item.subject}</span>
          <span>{item.educator_name}</span>
          <span>{item.time}</span>
        </div>
      ))}
    </div>
  );
}
```

**Backend Implementation**:
```typescript
router.get('/students/me/schedule', async (c) => {
  const user = c.get('user');
  
  // Get student record
  const { data: student } = await supabase
    .from('students')
    .select('school_class_id, college_course_id, university_course_id')
    .eq('user_id', user.sub)
    .single();
  
  let schedule = [];
  
  // Fetch based on student type
  if (student.school_class_id) {
    const { data } = await supabase
      .from('school_educator_class_assignments')
      .select(`
        subject,
        academic_year,
        school_educators (
          users (first_name, last_name)
        )
      `)
      .eq('class_id', student.school_class_id);
    
    schedule = data;
  }
  
  return c.json({ success: true, data: schedule });
});
```

### Use Case 3: Recruiter Searches for Students

**Frontend Component**:
```typescript
// StudentSearch.tsx
function StudentSearch() {
  const [filters, setFilters] = useState({
    university: '',
    course: '',
    cgpa_min: '',
    skills: []
  });
  const [results, setResults] = useState([]);
  
  async function searchStudents() {
    const queryParams = new URLSearchParams(filters);
    const res = await fetch(`/api/recruiters/students?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    setResults(data.data);
  }
  
  return (
    <div className="student-search">
      <div className="filters">
        <input
          placeholder="University"
          value={filters.university}
          onChange={e => setFilters({...filters, university: e.target.value})}
        />
        <input
          placeholder="Course"
          value={filters.course}
          onChange={e => setFilters({...filters, course: e.target.value})}
        />
        <input
          type="number"
          placeholder="Min CGPA"
          value={filters.cgpa_min}
          onChange={e => setFilters({...filters, cgpa_min: e.target.value})}
        />
        <button onClick={searchStudents}>Search</button>
      </div>
      
      <div className="results">
        {results.map(student => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}
```

**Backend Implementation**:
```typescript
router.get('/recruiters/students', async (c) => {
  const user = c.get('user');
  const { university, course, cgpa_min } = c.req.query();
  
  let query = supabase
    .from('v_student_complete')
    .select('*')
    .eq('account_status', 'active');
  
  if (university) {
    query = query.eq('university_name', university);
  }
  
  if (course) {
    query = query.ilike('university_course_name', `%${course}%`);
  }
  
  if (cgpa_min) {
    query = query.gte('current_cgpa', parseFloat(cgpa_min));
  }
  
  const { data, error } = await query;
  
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
  
  // Log search in audit trail
  await logAuditTrail(
    user.sub,
    'SEARCH_STUDENTS',
    'students',
    null,
    null,
    { filters: { university, course, cgpa_min } },
    c.req.raw,
    supabase
  );
  
  return c.json({ success: true, data });
});
```

### Use Case 4: University Admin Views All Colleges and Their Courses

**Frontend Component**:
```typescript
// UniversityDashboard.tsx
function UniversityDashboard() {
  const [colleges, setColleges] = useState([]);
  
  useEffect(() => {
    fetchColleges();
  }, []);
  
  async function fetchColleges() {
    const res = await fetch('/api/universities/me/colleges', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    setColleges(data.data);
  }
  
  return (
    <div className="university-dashboard">
      <h1>University Colleges</h1>
      {colleges.map(college => (
        <div key={college.id} className="college-card">
          <h3>{college.name}</h3>
          <p>Dean: {college.dean_name}</p>
          <p>Total Courses: {college.courses_count}</p>
          <p>Total Students: {college.students_count}</p>
          <button onClick={() => viewCollegeDetails(college.id)}>
            View Details
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Backend Implementation**:
```typescript
router.get('/universities/me/colleges', async (c) => {
  const user = c.get('user');
  
  const { data: colleges } = await supabase
    .from('university_colleges')
    .select(`
      *,
      courses:university_courses(count),
      students:students!university_college_id(count)
    `)
    .eq('university_id', user.entity_id);
  
  // Transform data
  const formatted = colleges.map(college => ({
    ...college,
    courses_count: college.courses[0].count,
    students_count: college.students[0].count
  }));
  
  return c.json({ success: true, data: formatted });
});
```

---

## 18. Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: JWT Token Expired

**Error**: `Invalid or expired token`

**Solution**:
```typescript
// Implement token refresh mechanism
async function refreshToken() {
  const refreshToken = getRefreshToken();
  
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  if (res.ok) {
    const data = await res.json();
    setAccessToken(data.data.access_token);
    return data.data.access_token;
  }
  
  // Refresh failed, redirect to login
  window.location.href = '/login';
}

// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

#### Issue 2: Student Cannot Be Enrolled in Multiple Classes

**Error**: `Constraint violation: chk_only_one_class`

**Solution**: This is by design. Students can only be in ONE class at a time. If you need to change a student's class:

```typescript
// Move student to different class
async function changeStudentClass(studentId: string, newClassId: string) {
  const { data, error } = await supabase
    .from('students')
    .update({
      school_class_id: newClassId,
      college_course_id: null,
      university_course_id: null
    })
    .eq('user_id', studentId);
  
  if (error) {
    console.error('Failed to change class:', error);
    return;
  }
  
  // Triggers will automatically update student counts
}
```

#### Issue 3: Permission Denied Error

**Error**: `Missing permission: class:create`

**Solution**: Check user's role and permissions in database:

```sql
-- Check user's role
SELECT role FROM users WHERE id = 'user-id';

-- Check role's permissions
SELECT p.name 
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role = 'school_admin';

-- If permission is missing, add it
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions WHERE name = 'class:create';
```

#### Issue 4: Database Connection Issues

**Error**: `Failed to connect to database`

**Solution**:
```typescript
// Check Supabase credentials
const supabase = createClient(
  process.env.SUPABASE_URL!, // Ensure these are set
  process.env.SUPABASE_SERVICE_KEY!
);

// Test connection
async function testConnection() {
  const { data, error } = await supabase
    .from('users')
    .select('count')
    .limit(1);
  
  if (error) {
    console.error('Database connection failed:', error);
    return false;
  }
  
  console.log('Database connected successfully');
  return true;
}
```

#### Issue 5: CORS Errors

**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution**:
```typescript
// Add CORS middleware to Cloudflare Worker
function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env) {
    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request.headers.get('Origin') || '*')
      });
    }
    
    const response = await handleRequest(request, env);
    
    // Add CORS headers to response
    const origin = request.headers.get('Origin') || '*';
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }
};
```

---

## 19. Best Practices Checklist

### Development
- [ ] Use TypeScript for type safety
- [ ] Implement proper error handling
- [ ] Add input validation with Zod
- [ ] Write unit tests for critical functions
- [ ] Use environment variables for configuration
- [ ] Follow consistent naming conventions
- [ ] Document all API endpoints
- [ ] Use meaningful commit messages

### Security
- [ ] Never commit secrets to repository
- [ ] Use httpOnly cookies for JWT storage
- [ ] Implement rate limiting
- [ ] Enable RLS on all Supabase tables
- [ ] Sanitize all user inputs
- [ ] Use prepared statements for SQL queries
- [ ] Log all sensitive operations
- [ ] Implement CSRF protection

### Database
- [ ] Create indexes for frequently queried columns
- [ ] Use database constraints for data integrity
- [ ] Regular database backups
- [ ] Monitor query performance
- [ ] Use transactions for related operations
- [ ] Implement soft deletes where appropriate
- [ ] Use triggers for automatic updates
- [ ] Normalize data appropriately

### Performance
- [ ] Implement caching strategy
- [ ] Use batch operations where possible
- [ ] Minimize database queries
- [ ] Optimize images and assets
- [ ] Use CDN for static assets
- [ ] Implement lazy loading
- [ ] Monitor API response times
- [ ] Use connection pooling

### Deployment
- [ ] Test in staging before production
- [ ] Use CI/CD for automated deployments
- [ ] Implement blue-green deployment
- [ ] Monitor application health
- [ ] Set up error tracking
- [ ] Configure automated backups
- [ ] Document rollback procedures
- [ ] Test disaster recovery plan

---

## 20. Support and Resources

### Documentation
- **API Documentation**: `/docs/api.md`
- **Database Schema**: `/docs/database.md`
- **User Flows**: `/docs/user-flows.md`
- **Deployment Guide**: `/docs/deployment.md`

### External Resources
- **Supabase Docs**: https://supabase.com/docs
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **Hono.js**: https://hono.dev/
- **Next.js**: https://nextjs.org/docs
- **React**: https://react.dev/

### Getting Help
- **GitHub Issues**: Report bugs and feature requests
- **Discord Community**: Join for real-time support
- **Email**: support@rareminds.com

---

## 21. Changelog

### Version 1.0.0 (2025-10-31)
- ✅ Initial architecture design
- ✅ Complete database schema
- ✅ JWT authentication implementation
- ✅ RBAC system with permissions
- ✅ User registration flows documented
- ✅ API endpoints documented
- ✅ Deployment strategy defined
- ✅ Security best practices included

### Upcoming Features
- 📅 Job posting system for recruiters
- 📅 Student profile visibility controls
- 📅 Real-time notifications
- 📅 Analytics dashboard
- 📅 Mobile applications
- 📅 Advanced search filters
- 📅 Document verification system
- 📅 Payment integration

---

## 22. Conclusion

This document provides a comprehensive overview of the Rareminds Platform architecture. The system is designed with:

1. **Separation of Concerns**: Admin and Main Platform as separate applications
2. **Shared Database**: Single source of truth for all data
3. **Strong Security**: JWT authentication, RBAC, RLS policies
4. **Scalability**: Cloudflare edge computing, caching strategies
5. **Flexibility**: Support for multiple entity types and hierarchies
6. **Data Integrity**: Database constraints, triggers, and validations

### Key Architectural Decisions

1. **Two Separate Apps**: Clear separation between admin and user operations
2. **Two Backend APIs**: Independent scaling and security boundaries
3. **Shared Database**: Simplified data management and consistency
4. **Cloudflare Infrastructure**: Global edge network, cost-effective
5. **One Student = One Class**: Enforced at database level for data integrity

### Next Steps

1. **Review existing schema** and create migration plan
2. **Set up development environment** with all services
3. **Implement authentication** flow end-to-end
4. **Build core features** (user management, class management)
5. **Test thoroughly** before production deployment
6. **Deploy to staging** for user acceptance testing
7. **Launch production** with monitoring and support

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Maintained By**: Rareminds Platform Team  
**License**: Proprietary

---

*This document should be saved as `ARCHITECTURE.md` in your project root and kept updated as the system evolves.*