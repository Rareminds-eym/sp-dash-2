# Rareminds Admin App - Implementation Roadmap
## Phase 1 Complete Build (3 Weeks)

**Date:** January 2025  
**Scope:** RBAC + Approvals + University Hierarchy + School Management  
**Team Size:** 2-5 admins  
**Target:** Production-ready features for all entity types

---

## 🎯 Phase 1 Overview

### **Goals:**
1. ✅ Implement complete RBAC with all 11 roles
2. ✅ Build entity approval workflow system
3. ✅ Expand university hierarchy (colleges within universities)
4. ✅ Add complete School Management System
5. ✅ Update all documentation to reflect implementation

### **Timeline:**
- **Week 1:** RBAC + Approval Workflows (Critical Foundation)
- **Week 2:** University Hierarchy + School System Database
- **Week 3:** School Management UI + Testing + Documentation

### **Deliverables:**
- Complete RBAC system with 11 roles
- Approval Center for all entities
- University → Colleges hierarchy
- Full School Management (classes, educators, students)
- Updated documentation
- Database migrations
- Admin user guide

---

## 📅 Week 1: Foundation (RBAC + Approvals)

### **Day 1-2: RBAC System Implementation**

#### **Database Changes:**

```sql
-- 1. Create permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create role_permissions mapping
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 3. Update user roles enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'school_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'college_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'university_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'college_under_university_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'educator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lecturer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'recruiter';

-- 4. Ensure entity fields exist in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
```

#### **Seed Permissions:**

```sql
-- Platform Admin Permissions (Full Access)
INSERT INTO permissions (name, resource, action, description) VALUES
('platform:manage_all', 'platform', 'manage_all', 'Full platform access'),
('platform:view_analytics', 'platform', 'view_analytics', 'View platform analytics'),
('platform:configure_settings', 'platform', 'configure', 'Configure platform settings');

-- School Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('school:create', 'school', 'create', 'Create schools'),
('school:read', 'school', 'read', 'View school details'),
('school:update', 'school', 'update', 'Update school details'),
('school:delete', 'school', 'delete', 'Delete schools'),
('school:approve', 'school', 'approve', 'Approve school registration'),
('school:reject', 'school', 'reject', 'Reject school registration'),
('school:suspend', 'school', 'suspend', 'Suspend school'),
('class:create', 'class', 'create', 'Create classes'),
('class:read', 'class', 'read', 'View class details'),
('class:update', 'class', 'update', 'Update classes'),
('educator:create', 'educator', 'create', 'Add educators'),
('educator:read', 'educator', 'read', 'View educators'),
('educator:assign', 'educator', 'assign', 'Assign educators to classes');

-- University Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('university:create', 'university', 'create', 'Create universities'),
('university:read', 'university', 'read', 'View university details'),
('university:update', 'university', 'update', 'Update universities'),
('university:delete', 'university', 'delete', 'Delete universities'),
('university:approve', 'university', 'approve', 'Approve universities'),
('college:create', 'college', 'create', 'Create colleges within university'),
('college:read', 'college', 'read', 'View college details'),
('lecturer:create', 'lecturer', 'create', 'Add lecturers'),
('lecturer:read', 'lecturer', 'read', 'View lecturers');

-- Student Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('student:create', 'student', 'create', 'Create student accounts'),
('student:read', 'student', 'read', 'View student details'),
('student:update', 'student', 'update', 'Update students'),
('student:enroll', 'student', 'enroll', 'Enroll students');

-- Passport Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('passport:read', 'passport', 'read', 'View passports'),
('passport:verify', 'passport', 'verify', 'Verify passports'),
('passport:reject', 'passport', 'reject', 'Reject passports');

-- Audit & User Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('audit:read_all', 'audit', 'read_all', 'View all audit logs'),
('user:read_all', 'user', 'read_all', 'View all users'),
('user:update_any', 'user', 'update_any', 'Update any user'),
('user:suspend_any', 'user', 'suspend_any', 'Suspend any user');

-- Assign all permissions to platform_admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'platform_admin', id FROM permissions;

-- Assign school-specific permissions to school_admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions 
WHERE name IN (
  'school:read', 'school:update',
  'class:create', 'class:read', 'class:update',
  'educator:create', 'educator:read', 'educator:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll'
);

-- Assign university permissions to university_admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'university_admin', id FROM permissions 
WHERE name IN (
  'university:read', 'university:update',
  'college:create', 'college:read',
  'lecturer:create', 'lecturer:read',
  'student:create', 'student:read', 'student:enroll'
);
```

#### **Backend Changes:**

**File:** `/app/lib/rbac.js` (NEW)
```javascript
import { supabase } from './supabase'

export async function getUserPermissions(userId) {
  // Fetch user with role
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!user) return []

  // Fetch permissions for role
  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(name)')
    .eq('role', user.role)

  return rolePerms?.map(rp => rp.permissions.name) || []
}

export function hasPermission(userPermissions, requiredPermission) {
  // Platform admin has all permissions
  if (userPermissions.includes('platform:manage_all')) {
    return true
  }
  
  return userPermissions.includes(requiredPermission)
}

export async function requirePermission(userId, permission) {
  const permissions = await getUserPermissions(userId)
  
  if (!hasPermission(permissions, permission)) {
    throw new Error(`Missing permission: ${permission}`)
  }
  
  return true
}
```

#### **API Changes:**

Update `/app/api/auth/login/route.js`:
```javascript
// After successful authentication, fetch permissions
const permissions = await getUserPermissions(user.id)

// Include in JWT payload
const token = await signJWT({
  userId: user.id,
  email: user.email,
  role: user.role,
  entityType: user.entity_type,
  entityId: user.entity_id,
  permissions: permissions
})
```

---

### **Day 3-4: Entity Approval Workflow**

#### **Database Changes:**

```sql
-- 1. Add approval_status to all entity tables
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';

-- 2. Add approval metadata
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add account_status if not exists
ALTER TABLE universities ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_universities_approval ON universities(approval_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_approval ON recruiters(approval_status);

-- 5. Update existing records to 'approved' status
UPDATE universities SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE recruiters SET approval_status = 'approved' WHERE approval_status IS NULL;
```

#### **New API Endpoints:**

**File:** Update `/app/api/[[...path]]/route.js`

```javascript
// POST /api/approve-university
if (method === 'POST' && path === '/approve-university') {
  const { universityId, notes } = await request.json()
  const userId = 'current-user-id' // Get from JWT
  
  await requirePermission(userId, 'university:approve')
  
  const { data, error } = await supabase
    .from('universities')
    .update({
      approval_status: 'approved',
      account_status: 'active',
      approved_by: userId,
      approved_at: new Date().toISOString()
    })
    .eq('id', universityId)
    .select()
    .single()
  
  // Log audit
  await logAudit(userId, 'approve_university', universityId, { notes })
  
  return NextResponse.json({ success: true, data })
}

// POST /api/reject-university
if (method === 'POST' && path === '/reject-university') {
  const { universityId, reason } = await request.json()
  const userId = 'current-user-id'
  
  await requirePermission(userId, 'university:approve')
  
  const { data, error } = await supabase
    .from('universities')
    .update({
      approval_status: 'rejected',
      account_status: 'inactive',
      rejection_reason: reason
    })
    .eq('id', universityId)
    .select()
    .single()
  
  await logAudit(userId, 'reject_university', universityId, { reason })
  
  return NextResponse.json({ success: true, data })
}

// Similar endpoints for recruiters, schools
```

#### **Frontend Changes:**

**New Page:** `/app/app/(dashboard)/approvals/page.js`

```javascript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ApprovalsPage() {
  const [pendingUniversities, setPendingUniversities] = useState([])
  const [pendingRecruiters, setPendingRecruiters] = useState([])
  const [pendingSchools, setPendingSchools] = useState([])

  useEffect(() => {
    fetchPendingEntities()
  }, [])

  const fetchPendingEntities = async () => {
    // Fetch universities with approval_status = 'pending'
    const univRes = await fetch('/api/universities?approval_status=pending')
    const univData = await univRes.json()
    setPendingUniversities(univData.data || [])

    // Similar for recruiters and schools
  }

  const handleApprove = async (entityType, entityId) => {
    const endpoint = `/api/approve-${entityType}`
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [`${entityType}Id`]: entityId })
    })
    fetchPendingEntities() // Refresh
  }

  const handleReject = async (entityType, entityId, reason) => {
    const endpoint = `/api/reject-${entityType}`
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [`${entityType}Id`]: entityId, reason })
    })
    fetchPendingEntities() // Refresh
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Approval Center</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {pendingUniversities.length + pendingRecruiters.length + pendingSchools.length} Pending
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="universities">
        <TabsList>
          <TabsTrigger value="universities">
            Universities ({pendingUniversities.length})
          </TabsTrigger>
          <TabsTrigger value="recruiters">
            Recruiters ({pendingRecruiters.length})
          </TabsTrigger>
          <TabsTrigger value="schools">
            Schools ({pendingSchools.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="universities">
          <div className="grid gap-4">
            {pendingUniversities.map(univ => (
              <Card key={univ.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{univ.name}</h3>
                    <p className="text-sm text-muted-foreground">{univ.email}</p>
                    <p className="text-sm">{univ.state}, {univ.district}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleApprove('university', univ.id)}
                      variant="default"
                    >
                      Approve
                    </Button>
                    <Button 
                      onClick={() => handleReject('university', univ.id, 'Incomplete information')}
                      variant="destructive"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {pendingUniversities.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No pending universities
              </p>
            )}
          </div>
        </TabsContent>

        {/* Similar for recruiters and schools */}
      </Tabs>
    </div>
  )
}
```

---

### **Day 5: University Hierarchy**

#### **Database Changes:**

```sql
-- 1. Create university_colleges table
CREATE TABLE university_colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  dean_name VARCHAR(200),
  dean_email VARCHAR(255),
  dean_phone VARCHAR(20),
  established_year INTEGER,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(university_id, code)
);

-- 2. Add college relationship to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_college_id UUID REFERENCES university_colleges(id);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_univ_colleges_university ON university_colleges(university_id);
CREATE INDEX IF NOT EXISTS idx_students_univ_college ON students(university_college_id);
```

#### **API Endpoints:**

```javascript
// GET /api/universities/:id/colleges
if (method === 'GET' && path.match(/^\/universities\/[^/]+\/colleges$/)) {
  const universityId = path.split('/')[2]
  
  const { data: colleges, error } = await supabase
    .from('university_colleges')
    .select('*')
    .eq('university_id', universityId)
    .order('name')
  
  return NextResponse.json(colleges || [])
}

// POST /api/universities/:id/colleges
if (method === 'POST' && path.match(/^\/universities\/[^/]+\/colleges$/)) {
  const universityId = path.split('/')[2]
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('university_colleges')
    .insert({
      university_id: universityId,
      name: body.name,
      code: body.code,
      dean_name: body.deanName,
      dean_email: body.deanEmail,
      established_year: body.establishedYear
    })
    .select()
    .single()
  
  return NextResponse.json({ success: true, data })
}
```

---

## 📅 Week 2: School Management Database + University Expansion

### **Day 6-7: School Database Schema**

```sql
-- 1. Create schools table
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
  board VARCHAR(100), -- CBSE, State Board, ICSE, etc.
  principal_name VARCHAR(200),
  principal_email VARCHAR(255),
  principal_phone VARCHAR(20),
  account_status VARCHAR(20) DEFAULT 'pending',
  approval_status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 2. Create school_classes table
CREATE TABLE school_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Grade 10-A"
  grade VARCHAR(20) NOT NULL, -- e.g., "10"
  section VARCHAR(10), -- e.g., "A"
  academic_year VARCHAR(20) NOT NULL, -- e.g., "2024-2025"
  max_students INTEGER DEFAULT 40,
  current_students INTEGER DEFAULT 0,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(school_id, name, academic_year)
);

-- 3. Create school_educators table
CREATE TABLE school_educators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  specialization VARCHAR(100),
  qualification VARCHAR(255),
  experience_years INTEGER,
  date_of_joining DATE,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(school_id, employee_id)
);

-- 4. Create educator-class assignments (many-to-many)
CREATE TABLE school_educator_class_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES school_educators(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  is_primary BOOLEAN DEFAULT false, -- Primary teacher for the class
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(educator_id, class_id, subject, academic_year)
);

-- 5. Update students table for school linkage
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_type VARCHAR(30); -- 'school', 'university', 'direct'

-- 6. Add constraint: student can only be in ONE class at a time
ALTER TABLE students ADD CONSTRAINT chk_only_one_class CHECK (
  (school_class_id IS NOT NULL AND university_college_id IS NULL) OR
  (school_class_id IS NULL AND university_college_id IS NOT NULL) OR
  (school_class_id IS NULL AND university_college_id IS NULL)
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schools_approval ON schools(approval_status);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(account_status);
CREATE INDEX IF NOT EXISTS idx_school_classes_school ON school_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_educators_school ON school_educators(school_id);
CREATE INDEX IF NOT EXISTS idx_school_educators_user ON school_educators(user_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_educator ON school_educator_class_assignments(educator_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_class ON school_educator_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_class_id);
```

### **Day 8-9: School Management API**

Add to `/app/api/[[...path]]/route.js`:

```javascript
// GET /api/schools - List all schools
if (path === '/schools') {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const approvalStatus = url.searchParams.get('approval_status')
  const accountStatus = url.searchParams.get('account_status')
  const search = url.searchParams.get('search')
  
  let query = supabase.from('schools').select('*', { count: 'exact' })
  
  if (approvalStatus) query = query.eq('approval_status', approvalStatus)
  if (accountStatus) query = query.eq('account_status', accountStatus)
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  
  query = query.order('created_at', { ascending: false })
  query = query.range((page - 1) * limit, page * limit - 1)
  
  const { data, error, count } = await query
  
  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
}

// GET /api/schools/:id - Get school details
if (path.startsWith('/schools/') && path.split('/').length === 3) {
  const schoolId = path.split('/')[2]
  
  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()
  
  if (error || !school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }
  
  // Fetch related data
  const [classesRes, educatorsRes, studentsRes] = await Promise.all([
    supabase.from('school_classes').select('*').eq('school_id', schoolId),
    supabase.from('school_educators').select('*, users(email)').eq('school_id', schoolId),
    supabase.from('students').select('id').eq('school_id', schoolId)
  ])
  
  return NextResponse.json({
    ...school,
    classes: classesRes.data || [],
    educators: educatorsRes.data || [],
    studentCount: studentsRes.data?.length || 0
  })
}

// POST /api/schools - Create school
if (method === 'POST' && path === '/schools') {
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: body.name,
      code: body.code,
      address: body.address,
      city: body.city,
      state: body.state,
      email: body.email,
      phone: body.phone,
      website: body.website,
      board: body.board,
      established_year: body.establishedYear,
      principal_name: body.principalName,
      principal_email: body.principalEmail,
      approval_status: 'pending',
      account_status: 'pending'
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  await logAudit('system', 'create_school', data.id, { name: body.name })
  
  return NextResponse.json({ success: true, data })
}

// GET /api/schools/:id/classes - Get school classes
if (path.match(/^\/schools\/[^/]+\/classes$/)) {
  const schoolId = path.split('/')[2]
  
  const { data: classes, error } = await supabase
    .from('school_classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('grade', { ascending: true })
  
  return NextResponse.json(classes || [])
}

// POST /api/schools/:id/classes - Create class
if (method === 'POST' && path.match(/^\/schools\/[^/]+\/classes$/)) {
  const schoolId = path.split('/')[2]
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('school_classes')
    .insert({
      school_id: schoolId,
      name: body.name,
      grade: body.grade,
      section: body.section,
      academic_year: body.academicYear,
      max_students: body.maxStudents || 40
    })
    .select()
    .single()
  
  return NextResponse.json({ success: true, data })
}

// Similar endpoints for educators, students, assignments...
```

### **Day 10: Testing & Bug Fixes**

- Test RBAC system with different roles
- Test approval workflows
- Test university hierarchy
- Test school management basic CRUD
- Fix any bugs found
- Performance testing

---

## 📅 Week 3: School Management UI + Polish

### **Day 11-12: School Management UI**

**New Page:** `/app/app/(dashboard)/schools/page.js`

```javascript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, School } from 'lucide-react'
import Link from 'next/link'

export default function SchoolsPage() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    approvalStatus: 'all',
    accountStatus: 'all'
  })

  useEffect(() => {
    fetchSchools()
  }, [filters, search])

  const fetchSchools = async () => {
    setLoading(true)
    const params = new URLSearchParams({
      ...(filters.approvalStatus !== 'all' && { approval_status: filters.approvalStatus }),
      ...(filters.accountStatus !== 'all' && { account_status: filters.accountStatus }),
      ...(search && { search })
    })
    
    const res = await fetch(`/api/schools?${params}`)
    const data = await res.json()
    setSchools(data.data || [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <School className="h-8 w-8" />
            School Management
          </h1>
          <p className="text-muted-foreground">
            Manage K-12 schools, classes, and educators
          </p>
        </div>
        <Link href="/schools/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add School
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <Input
            placeholder="Search schools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={filters.approvalStatus}
            onChange={(e) => setFilters({...filters, approvalStatus: e.target.value})}
            className="border rounded px-3"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Schools List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schools.map(school => (
          <Link key={school.id} href={`/schools/${school.id}`}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{school.name}</h3>
                  <Badge variant={
                    school.approval_status === 'approved' ? 'default' :
                    school.approval_status === 'pending' ? 'secondary' :
                    'destructive'
                  }>
                    {school.approval_status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>📚 Board: {school.board}</p>
                  <p>📍 {school.city}, {school.state}</p>
                  <p>📧 {school.email}</p>
                  <p>👨‍🎓 Principal: {school.principal_name}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {loading && <p className="text-center">Loading...</p>}
      {!loading && schools.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No schools found. Add your first school!
        </p>
      )}
    </div>
  )
}
```

**School Details Page:** `/app/app/(dashboard)/schools/[id]/page.js`

- Show school information
- Tabs for: Classes, Educators, Students
- Actions: Edit, Suspend, Delete

**Class Management:** `/app/app/(dashboard)/schools/[id]/classes/page.js`

- List classes (Grade 1-A, Grade 2-B, etc.)
- Add new class
- Assign educators
- View enrolled students

### **Day 13-14: Documentation & Polish**

1. Update ARCHITECTURE.md with implemented features
2. Update rareminds-admin-doc.md
3. Create ADMIN_USER_GUIDE.md for team
4. Add inline code comments
5. Polish UI/UX
6. Add loading states
7. Add error handling
8. Performance optimization

### **Day 15: Final Testing & Deployment**

1. Complete end-to-end testing
2. Security audit
3. Performance testing
4. Deploy to production
5. Monitor for issues
6. Team training session

---

## 📦 Deliverables Checklist

### **Week 1 Deliverables:**
- [ ] RBAC system with 11 roles implemented
- [ ] Permissions table with all permissions
- [ ] Role-permissions mapping complete
- [ ] Permission checking middleware
- [ ] Approval Center page functional
- [ ] Approve/Reject APIs for universities & recruiters
- [ ] University colleges table and API
- [ ] Basic UI for approvals

### **Week 2 Deliverables:**
- [ ] Schools database schema complete
- [ ] School classes table
- [ ] School educators table
- [ ] Educator-class assignments table
- [ ] Students linked to schools
- [ ] School management APIs (CRUD)
- [ ] Classes API endpoints
- [ ] Educators API endpoints
- [ ] All database indexes created

### **Week 3 Deliverables:**
- [ ] School Management UI complete
- [ ] School details page
- [ ] Class management UI
- [ ] Educator assignment UI
- [ ] Updated navigation with Schools link
- [ ] ARCHITECTURE.md updated
- [ ] rareminds-admin-doc.md updated
- [ ] ADMIN_USER_GUIDE.md created
- [ ] All features tested
- [ ] Production deployment

---

## 🚀 Quick Start Commands

```bash
# Install dependencies (if needed)
yarn install

# Run database migrations
# (Copy SQL from this document and run in Supabase SQL Editor)

# Start development server
yarn dev

# Run tests
yarn test

# Build for production
yarn build

# Deploy
# (Follow deployment guide)
```

---

## 📞 Support & Questions

**During Implementation:**
- Daily standup at 9 AM
- Slack channel: #rareminds-dev
- Documentation: /app/docs/

**After Completion:**
- Admin user guide: ADMIN_USER_GUIDE.md
- API documentation: API_REFERENCE.md
- Troubleshooting: TROUBLESHOOTING.md

---

**Document Status:** Ready for Implementation  
**Timeline:** 3 Weeks (15 working days)  
**Next Step:** Begin Day 1 - RBAC Database Setup
