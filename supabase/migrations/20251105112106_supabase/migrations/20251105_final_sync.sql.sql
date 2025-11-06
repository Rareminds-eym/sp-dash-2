drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";

create extension if not exists "vector" with schema "public";

create type "public"."account_status" as enum ('pending', 'active', 'suspended', 'deactivated');

create type "public"."approval_status" as enum ('pending', 'approved', 'rejected', 'under_review');

create type "public"."collegeType" as enum ('standalone', 'university_department');

create type "public"."enrollmentStatus" as enum ('active', 'completed', 'withdrawn', 'transferred', 'suspended');

create type "public"."entity_type" as enum ('school', 'college', 'university', 'company');

create type "public"."student_type" as enum ('school', 'college', 'university');

create type "public"."user_role" as enum ('super_admin', 'platform_admin', 'school_admin', 'college_admin', 'university_admin', 'company_admin', 'educator', 'lecturer', 'recruiter', 'student');

create type "public"."verification_status" as enum ('pending', 'verified', 'rejected', 'in_review');

create sequence "public"."applied_jobs_id_seq";

create sequence "public"."export_activities_id_seq";

create sequence "public"."interview_reminders_id_seq";

create sequence "public"."message_reactions_id_seq";

create sequence "public"."messages_id_seq";

create sequence "public"."opportunities_id_seq";

create sequence "public"."pipeline_activities_id_seq";

create sequence "public"."pipeline_candidates_id_seq";

create sequence "public"."saved_jobs_id_seq";

create sequence "public"."search_history_id_seq";

create sequence "public"."shortlist_candidates_id_seq";

-- Drop views that need to be updated or removed
DROP VIEW IF EXISTS pipeline_candidates_detailed;
DROP VIEW IF EXISTS vEntityOverview;
DROP VIEW IF EXISTS vStudentCurrentEnrollment;

-- Create student_applications_with_pipeline view (from remote)
CREATE OR REPLACE VIEW student_applications_with_pipeline AS
SELECT 
    s.id AS student_id,
    s.name AS student_name,
    s.email AS student_email,
    o.id AS opportunity_id,
    o.title AS opportunity_title,
    o.company_name,
    o.requisition_id,
    pc.stage,
    pc.status,
    pc.added_at,
    pc.stage_changed_at,
    pc.next_action,
    pc.next_action_date
FROM students s
LEFT JOIN pipeline_candidates pc ON s.id = pc.student_id
LEFT JOIN opportunities o ON pc.opportunity_id = o.id;

-- Update requisitions_with_pipeline_stats view to match remote structure
CREATE OR REPLACE VIEW requisitions_with_pipeline_stats AS
SELECT 
    r.id,
    r.title,
    r.department,
    r.location,
    r.job_type,
    r.openings,
    r.status,
    r.priority,
    r.description,
    r.requirements,
    r.salary_range,
    r.owner,
    r.hiring_manager,
    r.created_by,
    r.created_date,
    r.target_date,
    r.filled_date,
    r.tags,
    r.created_at,
    r.updated_at,
    count(pc.id) AS total_candidates,
    count(
        CASE
            WHEN pc.stage = 'sourced' THEN 1
            ELSE NULL::integer
        END) AS sourced_count,
    count(
        CASE
            WHEN pc.stage = 'screened' THEN 1
            ELSE NULL::integer
        END) AS screened_count,
    count(
        CASE
            WHEN pc.stage = 'interview_1' THEN 1
            ELSE NULL::integer
        END) AS interview_1_count,
    count(
        CASE
            WHEN pc.stage = 'interview_2' THEN 1
            ELSE NULL::integer
        END) AS interview_2_count,
    count(
        CASE
            WHEN pc.stage = 'offer' THEN 1
            ELSE NULL::integer
        END) AS offer_count,
    count(
        CASE
            WHEN pc.stage = 'hired' THEN 1
            ELSE NULL::integer
        END) AS hired_count
FROM requisitions r
LEFT JOIN pipeline_candidates pc ON r.id_uuid = pc.requisition_id_uuid
GROUP BY 
    r.id, r.title, r.department, r.location, r.job_type, r.openings, 
    r.status, r.priority, r.description, r.requirements, r.salary_range, 
    r.owner, r.hiring_manager, r.created_by, r.created_date, r.target_date, 
    r.filled_date, r.tags, r.created_at, r.updated_at;

-- Update shortlists_with_counts view to match remote structure
CREATE OR REPLACE VIEW shortlists_with_counts AS
SELECT 
    s.id,
    s.name,
    s.description,
    s.created_by,
    s.created_date,
    s.status,
    s.shared,
    s.share_link,
    s.share_expiry,
    s.watermark,
    s.include_pii,
    s.notify_on_access,
    s.tags,
    s.updated_at,
    count(sc.id) AS candidate_count
FROM shortlists s
LEFT JOIN shortlist_candidates sc ON s.id = sc.shortlist_id
GROUP BY 
    s.id, s.name, s.description, s.created_by, s.created_date, 
    s.status, s.shared, s.share_link, s.share_expiry, s.watermark, 
    s.include_pii, s.notify_on_access, s.tags, s.updated_at;


  create table "public"."applied_jobs" (
    "id" integer not null default nextval('public.applied_jobs_id_seq'::regclass),
    "student_id" uuid not null,
    "opportunity_id" integer not null,
    "application_status" text not null default 'applied'::text,
    "applied_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "viewed_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "interview_scheduled_at" timestamp with time zone,
    "notes" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."assignment_attachments" (
    "attachment_id" uuid not null default gen_random_uuid(),
    "assignment_id" uuid not null,
    "file_name" text not null,
    "file_type" text,
    "file_size" integer,
    "file_url" text,
    "uploaded_date" timestamp with time zone not null default now()
      );



  create table "public"."assignments" (
    "assignment_id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "instructions" text,
    "course_name" text not null,
    "course_code" text,
    "educator_id" uuid,
    "educator_name" text,
    "total_points" numeric(7,2) not null default 100,
    "assignment_type" text,
    "skill_outcomes" text[],
    "assign_classes" text,
    "document_pdf" text,
    "due_date" timestamp with time zone not null,
    "available_from" timestamp with time zone,
    "created_date" timestamp with time zone not null default now(),
    "allow_late_submission" boolean not null default true,
    "is_deleted" boolean not null default false,
    "updated_date" timestamp with time zone not null default now()
      );



  create table "public"."audit_logs" (
    "actorId" uuid,
    "action" text not null,
    "target" text,
    "payload" jsonb default '{}'::jsonb,
    "ip" text,
    "createdAt" timestamp with time zone default now(),
    "id" uuid not null default gen_random_uuid(),
    "userId" uuid,
    "ipAddress" inet,
    "userAgent" text,
    "oldValues" jsonb,
    "newValues" jsonb,
    "resourceType" character varying(50),
    "resourceId" uuid,
    "metadata" jsonb default '{}'::jsonb
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."certificates" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "title" character varying(200) not null,
    "issuer" character varying(150),
    "level" character varying(100),
    "credential_id" character varying(150),
    "link" text,
    "issued_on" date,
    "description" text,
    "status" character varying(50),
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."college_courses" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "collegeId" uuid not null,
    "name" character varying(255) not null,
    "program" character varying(100) not null,
    "specialization" character varying(100),
    "year" integer,
    "semester" integer,
    "section" character varying(10),
    "academicYear" character varying(20) not null,
    "maxStudents" integer default 60,
    "currentStudents" integer default 0,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."college_lecturer_course_assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "lecturerId" uuid not null,
    "courseId" uuid not null,
    "subject" character varying(100) not null,
    "academicYear" character varying(20) not null,
    "assignedAt" timestamp with time zone default now(),
    "assignedBy" uuid
      );



  create table "public"."college_lecturers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "userId" uuid not null,
    "collegeId" uuid not null,
    "employeeId" character varying(50),
    "department" character varying(100),
    "specialization" character varying(100),
    "qualification" character varying(255),
    "experienceYears" integer,
    "dateOfJoining" date,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."colleges" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "universityId" uuid,
    "name" character varying(255) not null,
    "code" character varying(50) not null,
    "collegeType" text default 'standalone'::text,
    "deanName" character varying(200),
    "deanEmail" character varying(255),
    "deanPhone" character varying(20),
    "affiliation" character varying(255),
    "accreditation" character varying(100),
    "address" text,
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100) default 'India'::character varying,
    "pincode" character varying(10),
    "phone" character varying(20),
    "email" character varying(255),
    "website" character varying(255),
    "establishedYear" integer,
    "accountStatus" public.account_status default 'pending'::public.account_status,
    "approvalStatus" public.approval_status default 'pending'::public.approval_status,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "totalCourses" integer default 0,
    "totalLecturers" integer default 0,
    "totalStudents" integer default 0,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."companies" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" character varying(255) not null,
    "code" character varying(50) not null,
    "industry" character varying(100),
    "companySize" character varying(50),
    "hqAddress" text,
    "hqCity" character varying(100),
    "hqState" character varying(100),
    "hqCountry" character varying(100) default 'India'::character varying,
    "hqPincode" character varying(10),
    "phone" character varying(20),
    "email" character varying(255),
    "website" character varying(255),
    "establishedYear" integer,
    "contactPersonName" character varying(200),
    "contactPersonDesignation" character varying(100),
    "contactPersonEmail" character varying(255),
    "contactPersonPhone" character varying(20),
    "accountStatus" public.account_status default 'pending'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb,
    "approvalStatus" public.approval_status default 'pending'::public.approval_status,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "totalBranches" integer default 0,
    "totalRecruiters" integer default 0,
    "hqRecruiters" integer default 0,
    "branchRecruiters" integer default 0
      );



  create table "public"."company_branches" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "companyId" uuid not null,
    "name" character varying(255) not null,
    "code" character varying(50) not null,
    "branchType" character varying(50),
    "address" text,
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100) default 'India'::character varying,
    "pincode" character varying(10),
    "phone" character varying(20),
    "email" character varying(255),
    "branchHeadName" character varying(200),
    "branchHeadEmail" character varying(255),
    "branchHeadPhone" character varying(20),
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."conversations" (
    "id" text not null,
    "student_id" uuid not null,
    "recruiter_id" uuid not null,
    "application_id" integer,
    "opportunity_id" integer,
    "subject" text,
    "status" text default 'active'::text,
    "last_message_at" timestamp with time zone,
    "last_message_preview" text,
    "last_message_sender" text,
    "student_unread_count" integer default 0,
    "recruiter_unread_count" integer default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."education" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "level" character varying(50),
    "degree" character varying(100),
    "department" character varying(100),
    "university" character varying(150),
    "year_of_passing" character varying(10),
    "cgpa" character varying(10),
    "status" character varying(50),
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."experience" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "organization" character varying(150),
    "role" character varying(150),
    "start_date" date,
    "end_date" date,
    "duration" character varying(100),
    "verified" boolean default false,
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."export_activities" (
    "id" integer not null default nextval('public.export_activities_id_seq'::regclass),
    "shortlist_id" text not null,
    "export_format" text not null,
    "export_type" text not null,
    "exported_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "exported_by" text,
    "include_pii" boolean default false
      );


alter table "public"."export_activities" enable row level security;


  create table "public"."interview_reminders" (
    "id" integer not null default nextval('public.interview_reminders_id_seq'::regclass),
    "interview_id" text not null,
    "sent_to" text not null,
    "sent_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "reminder_type" text not null,
    "status" text default 'sent'::text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."interview_reminders" enable row level security;


  create table "public"."interviews" (
    "id" text not null,
    "student_id" uuid,
    "candidate_name" text not null,
    "candidate_email" text,
    "candidate_phone" text,
    "job_title" text not null,
    "interviewer" text not null,
    "interviewer_email" text,
    "date" timestamp with time zone not null,
    "duration" integer default 60,
    "status" text default 'scheduled'::text,
    "type" text not null,
    "meeting_type" text,
    "meeting_link" text,
    "meeting_notes" text,
    "reminders_sent" integer default 0,
    "completed_date" timestamp with time zone,
    "scorecard" jsonb,
    "created_by" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."interviews" enable row level security;


  create table "public"."message_reactions" (
    "id" integer not null default nextval('public.message_reactions_id_seq'::regclass),
    "message_id" integer not null,
    "user_id" character varying(255) not null,
    "user_type" character varying(20) not null,
    "emoji" character varying(10) not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP
      );



  create table "public"."messages" (
    "id" integer not null default nextval('public.messages_id_seq'::regclass),
    "conversation_id" text not null,
    "sender_id" text not null,
    "sender_type" text not null,
    "receiver_id" text not null,
    "receiver_type" text not null,
    "message_text" text not null,
    "attachments" jsonb,
    "application_id" integer,
    "opportunity_id" integer,
    "is_read" boolean default false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."metrics_snapshots" (
    "id" text not null default (gen_random_uuid())::text,
    "snapshotDate" date not null default CURRENT_DATE,
    "activeUniversities" integer default 0,
    "registeredStudents" integer default 0,
    "verifiedPassports" integer default 0,
    "aiVerifiedPercent" numeric(5,2) default 0,
    "employabilityIndex" numeric(5,2) default 0,
    "activeRecruiters" integer default 0,
    "createdAt" timestamp with time zone default now(),
    "totalSchools" integer default 0,
    "totalColleges" integer default 0,
    "totalCompanies" integer default 0,
    "metadata" jsonb default '{}'::jsonb
      );


alter table "public"."metrics_snapshots" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "recruiter_id" uuid not null,
    "type" text not null,
    "title" text not null,
    "message" text not null,
    "read" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."offers" (
    "id" uuid not null default gen_random_uuid(),
    "inserted_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "candidate_id" uuid,
    "candidate_name" text not null,
    "job_id" text,
    "job_title" text not null,
    "template" text,
    "ctc_band" text,
    "offered_ctc" text,
    "offer_date" timestamp with time zone default timezone('utc'::text, now()),
    "expiry_date" timestamp with time zone not null,
    "status" text default 'pending'::text,
    "sent_via" text default 'email'::text,
    "benefits" text[],
    "notes" text,
    "response_deadline" timestamp with time zone,
    "acceptance_notes" text,
    "response_date" timestamp with time zone
      );



  create table "public"."opportunities" (
    "id" integer not null default nextval('public.opportunities_id_seq'::regclass),
    "title" text not null,
    "company_name" text not null,
    "company_logo" text,
    "employment_type" text not null,
    "location" text not null,
    "mode" text,
    "stipend_or_salary" text,
    "experience_required" text,
    "skills_required" jsonb,
    "description" text,
    "application_link" text,
    "deadline" timestamp with time zone,
    "is_active" boolean default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "department" text not null,
    "experience_level" text,
    "salary_range_min" integer,
    "salary_range_max" integer,
    "status" text default 'draft'::text,
    "posted_date" timestamp with time zone default timezone('utc'::text, now()),
    "closing_date" timestamp with time zone,
    "requirements" jsonb,
    "responsibilities" jsonb,
    "benefits" jsonb,
    "applications_count" integer default 0,
    "messages_count" integer default 0,
    "views_count" integer default 0,
    "created_by" text,
    "job_title" text not null,
    "recruiter_id" uuid,
    "embedding" public.vector(1536)
      );



  create table "public"."opportunity_interactions" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "opportunity_id" integer not null,
    "action" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."permissions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" character varying(100) not null,
    "resource" character varying(50) not null,
    "action" character varying(50) not null,
    "description" text,
    "createdAt" timestamp with time zone default now()
      );



  create table "public"."pipeline_activities" (
    "id" integer not null default nextval('public.pipeline_activities_id_seq'::regclass),
    "pipeline_candidate_id" integer not null,
    "activity_type" text not null,
    "from_stage" text,
    "to_stage" text,
    "activity_details" jsonb,
    "performed_by" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."pipeline_activities" enable row level security;


  create table "public"."pipeline_candidates" (
    "id" integer not null default nextval('public.pipeline_candidates_id_seq'::regclass),
    "requisition_id" text not null,
    "student_id" uuid not null,
    "candidate_name" text not null,
    "candidate_email" text,
    "candidate_phone" text,
    "stage" text not null default 'sourced'::text,
    "previous_stage" text,
    "stage_changed_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "stage_changed_by" text,
    "status" text default 'active'::text,
    "rejection_reason" text,
    "rejection_date" timestamp with time zone,
    "next_action" text,
    "next_action_date" timestamp with time zone,
    "next_action_notes" text,
    "recruiter_rating" integer,
    "recruiter_notes" text,
    "assigned_to" text,
    "source" text,
    "added_by" text,
    "added_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."pipeline_candidates" enable row level security;


  create table "public"."placements" (
    "id" uuid not null default gen_random_uuid(),
    "studentId" uuid,
    "recruiterId" uuid,
    "jobTitle" text not null,
    "salaryOffered" numeric(10,2),
    "placementStatus" text not null,
    "appliedDate" timestamp with time zone,
    "hiredDate" timestamp with time zone,
    "retentionDate" timestamp with time zone,
    "metadata" jsonb default '{}'::jsonb,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now()
      );


alter table "public"."placements" enable row level security;


  create table "public"."profile_views" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "viewer_type" text not null,
    "viewer_id" uuid,
    "viewed_at" timestamp with time zone default now()
      );


alter table "public"."profile_views" enable row level security;


  create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "title" character varying(200) not null,
    "description" text,
    "status" character varying(50),
    "start_date" date,
    "end_date" date,
    "duration" character varying(100),
    "tech_stack" text[],
    "demo_link" text,
    "github_link" text,
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."recent_updates" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updates" jsonb default '{"updates": []}'::jsonb,
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."recruiter_activities" (
    "id" uuid not null default gen_random_uuid(),
    "recruiterId" uuid,
    "activityType" text not null,
    "targetStudentId" uuid,
    "searchCriteria" jsonb default '{}'::jsonb,
    "metadata" jsonb default '{}'::jsonb,
    "createdAt" timestamp with time zone default now()
      );


alter table "public"."recruiter_activities" enable row level security;


  create table "public"."recruiter_saved_searches" (
    "id" uuid not null default gen_random_uuid(),
    "recruiter_id" text not null,
    "name" text not null,
    "search_criteria" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "last_used" timestamp with time zone,
    "use_count" integer default 0,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."recruiter_saved_searches" enable row level security;


  create table "public"."recruiters" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text,
    "phone" text,
    "state" text,
    "website" text,
    "verificationstatus" text default 'approved'::text,
    "isactive" boolean default true,
    "createdat" timestamp with time zone default now(),
    "updatedat" timestamp with time zone default now(),
    "verificationStatus" public.approval_status default 'pending'::public.approval_status,
    "isActive" boolean default true,
    "userCount" integer default 0,
    "userId" uuid,
    "companyId" uuid,
    "branchId" uuid,
    "employeeId" character varying(50),
    "designation" character varying(100),
    "department" character varying(100),
    "dateOfJoining" date,
    "isHqRecruiter" boolean default false,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."requisitions" (
    "id" text not null,
    "title" text not null,
    "department" text not null,
    "location" text not null,
    "job_type" text default 'Full-time'::text,
    "openings" integer default 1,
    "status" text default 'active'::text,
    "priority" text default 'medium'::text,
    "description" text,
    "requirements" text,
    "salary_range" text,
    "owner" text,
    "hiring_manager" text,
    "created_by" text,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now()),
    "target_date" timestamp with time zone,
    "filled_date" timestamp with time zone,
    "tags" text[],
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."requisitions" enable row level security;


  create table "public"."role_permissions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "role" public.user_role not null,
    "permissionId" uuid not null,
    "createdAt" timestamp with time zone default now()
      );



  create table "public"."saved_jobs" (
    "id" integer not null default nextval('public.saved_jobs_id_seq'::regclass),
    "student_id" uuid not null,
    "opportunity_id" integer not null,
    "saved_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."school_classes" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "schoolId" uuid not null,
    "name" character varying(100) not null,
    "grade" character varying(20) not null,
    "section" character varying(10),
    "academicYear" character varying(20) not null,
    "maxStudents" integer default 40,
    "currentStudents" integer default 0,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."school_educator_class_assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "educatorId" uuid not null,
    "classId" uuid not null,
    "subject" character varying(100) not null,
    "academicYear" character varying(20) not null,
    "isPrimary" boolean default false,
    "assignedAt" timestamp with time zone default now(),
    "assignedBy" uuid
      );



  create table "public"."school_educators" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "userId" uuid not null,
    "schoolId" uuid not null,
    "employeeId" character varying(50),
    "specialization" character varying(100),
    "qualification" character varying(255),
    "experienceYears" integer,
    "dateOfJoining" date,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."schools" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" character varying(255) not null,
    "code" character varying(50) not null,
    "address" text,
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100) default 'India'::character varying,
    "pincode" character varying(10),
    "phone" character varying(20),
    "email" character varying(255),
    "website" character varying(255),
    "establishedYear" integer,
    "accountStatus" public.account_status default 'pending'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb,
    "board" character varying(100),
    "approvalStatus" public.approval_status default 'pending'::public.approval_status,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "totalClasses" integer default 0,
    "totalEducators" integer default 0,
    "totalStudents" integer default 0
      );



  create table "public"."search_history" (
    "id" bigint not null default nextval('public.search_history_id_seq'::regclass),
    "student_id" uuid not null,
    "search_term" text not null,
    "search_count" integer default 1,
    "last_searched_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );



  create table "public"."shortlist_candidates" (
    "id" integer not null default nextval('public.shortlist_candidates_id_seq'::regclass),
    "shortlist_id" text not null,
    "student_id" uuid not null,
    "added_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "added_by" text,
    "notes" text
      );



  create table "public"."shortlists" (
    "id" text not null,
    "name" text not null,
    "description" text,
    "created_by" text,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now()),
    "status" text default 'active'::text,
    "shared" boolean default false,
    "share_link" text,
    "share_expiry" timestamp with time zone,
    "watermark" boolean default false,
    "include_pii" boolean default false,
    "notify_on_access" boolean default false,
    "tags" text[],
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."skill_passports" (
    "studentId" uuid not null,
    "status" text not null,
    "aiVerification" boolean default false,
    "nsqfLevel" integer,
    "skills" jsonb default '[]'::jsonb,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "id" uuid not null default gen_random_uuid(),
    "projects" jsonb default '[]'::jsonb,
    "certificates" jsonb default '[]'::jsonb,
    "assessments" jsonb default '[]'::jsonb,
    "certifications" jsonb default '[]'::jsonb,
    "workExperience" jsonb default '[]'::jsonb,
    "achievements" jsonb default '[]'::jsonb,
    "verifiedBy" uuid,
    "verifiedAt" timestamp with time zone,
    "aiVerified" boolean default false,
    "aiVerificationScore" numeric(5,2)
      );


alter table "public"."skill_passports" enable row level security;


  create table "public"."skill_trends" (
    "id" uuid not null default gen_random_uuid(),
    "skillName" text not null,
    "category" text not null,
    "demandScore" integer default 0,
    "trendDirection" text,
    "weeklyGrowth" numeric(5,2) default 0,
    "monthlyGrowth" numeric(5,2) default 0,
    "snapshotDate" date not null default CURRENT_DATE,
    "createdAt" timestamp with time zone default now()
      );


alter table "public"."skill_trends" enable row level security;


  create table "public"."skills" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "name" character varying(100) not null,
    "type" character varying(20),
    "level" integer,
    "description" text,
    "verified" boolean default false,
    "enabled" boolean default true,
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."studentEnrollments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "studentId" uuid not null,
    "schoolId" uuid,
    "collegeId" uuid,
    "universityId" uuid,
    "schoolClassId" uuid,
    "collegeCourseId" uuid,
    "universityCourseId" uuid,
    "enrollmentNumber" character varying(100),
    "enrollmentDate" date not null,
    "expectedGraduationDate" date,
    "actualGraduationDate" date,
    "enrollmentStatus" public."enrollmentStatus" default 'active'::public."enrollmentStatus",
    "withdrawalDate" date,
    "withdrawalReason" text,
    "transferToEntityId" uuid,
    "transferToClassId" uuid,
    "transferDate" date,
    "transferReason" text,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."student_assignments" (
    "student_assignment_id" uuid not null default gen_random_uuid(),
    "assignment_id" uuid not null,
    "student_id" uuid not null,
    "status" text not null default 'todo'::text,
    "priority" text not null default 'medium'::text,
    "grade_received" numeric(7,2),
    "grade_percentage" numeric(5,2),
    "instructor_feedback" text,
    "feedback_date" timestamp with time zone,
    "graded_by" uuid,
    "graded_date" timestamp with time zone,
    "submission_date" timestamp with time zone,
    "submission_type" text,
    "submission_content" text,
    "submission_url" text,
    "is_late" boolean not null default false,
    "late_penalty" numeric(5,2),
    "assigned_date" timestamp with time zone not null default now(),
    "started_date" timestamp with time zone,
    "completed_date" timestamp with time zone,
    "is_deleted" boolean not null default false,
    "updated_date" timestamp with time zone not null default now()
      );



  create table "public"."students" (
    "id" uuid not null default gen_random_uuid(),
    "universityId" uuid not null,
    "profile" jsonb default '{}'::jsonb,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "email" text not null,
    "name" character varying(150),
    "age" integer,
    "date_of_birth" date,
    "contact_number" character varying(20),
    "alternate_number" character varying(20),
    "district_name" character varying(100),
    "university" character varying(150),
    "branch_field" character varying(150),
    "college_school_name" character varying(150),
    "registration_number" character varying(100),
    "github_link" text,
    "linkedin_link" text,
    "twitter_link" text,
    "facebook_link" text,
    "instagram_link" text,
    "portfolio_link" text,
    "other_social_links" jsonb default '[]'::jsonb,
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now(),
    "embedding" public.vector(1536),
    "studentType" public.student_type,
    "schoolId" uuid,
    "collegeId" uuid,
    "universityCollegeId" uuid,
    "schoolClassId" uuid,
    "collegeCourseId" uuid,
    "universityCourseId" uuid,
    "enrollmentNumber" character varying(100),
    "guardianName" character varying(200),
    "guardianPhone" character varying(20),
    "guardianEmail" character varying(255),
    "guardianRelation" character varying(50),
    "dateOfBirth" date,
    "gender" character varying(20),
    "bloodGroup" character varying(5),
    "enrollmentDate" date,
    "expectedGraduationDate" date,
    "currentCgpa" numeric(4,2),
    "userId" uuid,
    "contactNumber" character varying(20),
    "address" text,
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100) default 'India'::character varying,
    "pincode" character varying(10),
    "resumeUrl" text,
    "profilePicture" text,
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."trainings" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "title" character varying(150) not null,
    "organization" character varying(150),
    "start_date" date,
    "end_date" date,
    "duration" character varying(100),
    "description" text,
    "approval_status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."universities" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text,
    "phone" text,
    "state" text,
    "district" text,
    "website" text,
    "verificationstatus" text default 'approved'::text,
    "isactive" boolean default true,
    "createdAt" timestamp with time zone default now(),
    "updatedat" timestamp with time zone default now(),
    "code" character varying(50) not null,
    "universityType" character varying(50),
    "approvalStatus" public.approval_status default 'pending'::public.approval_status,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "accountStatus" public.account_status default 'pending'::public.account_status,
    "totalColleges" integer default 0,
    "totalCourses" integer default 0,
    "totalLecturers" integer default 0,
    "totalStudents" integer default 0
      );



  create table "public"."university_courses" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "collegeId" uuid not null,
    "name" character varying(255) not null,
    "program" character varying(100) not null,
    "specialization" character varying(100),
    "year" integer,
    "semester" integer,
    "section" character varying(10),
    "academicYear" character varying(20) not null,
    "maxStudents" integer default 60,
    "currentStudents" integer default 0,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."university_lecturer_course_assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "lecturerId" uuid not null,
    "courseId" uuid not null,
    "subject" character varying(100) not null,
    "academicYear" character varying(20) not null,
    "assignedAt" timestamp with time zone default now(),
    "assignedBy" uuid
      );



  create table "public"."university_lecturers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "userId" uuid not null,
    "collegeId" uuid not null,
    "employeeId" character varying(50),
    "department" character varying(100),
    "specialization" character varying(100),
    "qualification" character varying(255),
    "experienceYears" integer,
    "dateOfJoining" date,
    "accountStatus" public.account_status default 'active'::public.account_status,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "metadata" jsonb default '{}'::jsonb
      );



  create table "public"."university_performance" (
    "id" uuid not null default gen_random_uuid(),
    "universityId" uuid not null,
    "enrollmentCount" integer default 0,
    "completionRate" numeric(5,2) default 0,
    "verificationRate" numeric(5,2) default 0,
    "placementRate" numeric(5,2) default 0,
    "avgSalary" numeric(10,2) default 0,
    "performanceScore" numeric(5,2) default 0,
    "rankPosition" integer,
    "snapshotDate" date not null default CURRENT_DATE,
    "createdAt" timestamp with time zone default now()
      );


alter table "public"."university_performance" enable row level security;


  create table "public"."users" (
    "email" text not null,
    "role" text not null,
    "organizationId" uuid default gen_random_uuid(),
    "isActive" boolean default true,
    "metadata" jsonb default '{}'::jsonb,
    "createdAt" timestamp with time zone default now(),
    "updatedAt" timestamp with time zone default now(),
    "id" uuid not null default gen_random_uuid(),
    "supabaseAuthId" uuid,
    "firstName" character varying(100),
    "lastName" character varying(100),
    "entityType" public.entity_type,
    "entityId" uuid,
    "accountStatus" public.account_status default 'pending'::public.account_status,
    "lastPasswordChange" timestamp with time zone,
    "profileImageUrl" text,
    "createdBy" uuid,
    "lastLogin" timestamp with time zone
      );


alter table "public"."users" enable row level security;


  create table "public"."verifications" (
    "id" text not null default (gen_random_uuid())::text,
    "targetTable" text not null,
    "targetId" text not null,
    "action" text not null,
    "performedBy" uuid,
    "note" text,
    "createdAt" timestamp with time zone default now(),
    "passportId" uuid,
    "userId" uuid,
    "verificationStatus" public.verification_status default 'pending'::public.verification_status,
    "verificationType" character varying(50),
    "verificationNotes" text,
    "verificationData" jsonb default '{}'::jsonb,
    "verifiedBy" uuid,
    "verifiedAt" timestamp with time zone
      );


alter table "public"."verifications" enable row level security;

alter sequence "public"."applied_jobs_id_seq" owned by "public"."applied_jobs"."id";

alter sequence "public"."export_activities_id_seq" owned by "public"."export_activities"."id";

alter sequence "public"."interview_reminders_id_seq" owned by "public"."interview_reminders"."id";

alter sequence "public"."message_reactions_id_seq" owned by "public"."message_reactions"."id";

alter sequence "public"."messages_id_seq" owned by "public"."messages"."id";

alter sequence "public"."opportunities_id_seq" owned by "public"."opportunities"."id";

alter sequence "public"."pipeline_activities_id_seq" owned by "public"."pipeline_activities"."id";

alter sequence "public"."pipeline_candidates_id_seq" owned by "public"."pipeline_candidates"."id";

alter sequence "public"."saved_jobs_id_seq" owned by "public"."saved_jobs"."id";

alter sequence "public"."search_history_id_seq" owned by "public"."search_history"."id";

alter sequence "public"."shortlist_candidates_id_seq" owned by "public"."shortlist_candidates"."id";

CREATE UNIQUE INDEX applied_jobs_pkey ON public.applied_jobs USING btree (id);

CREATE UNIQUE INDEX assignment_attachments_pkey ON public.assignment_attachments USING btree (attachment_id);

CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (assignment_id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX certificates_pkey ON public.certificates USING btree (id);

CREATE UNIQUE INDEX college_courses_college_name_year_unique ON public.college_courses USING btree ("collegeId", name, "academicYear");

CREATE UNIQUE INDEX college_courses_pkey ON public.college_courses USING btree (id);

CREATE UNIQUE INDEX college_lecturer_course_assignments_pkey ON public.college_lecturer_course_assignments USING btree (id);

CREATE UNIQUE INDEX college_lecturer_course_assignments_unique ON public.college_lecturer_course_assignments USING btree ("lecturerId", "courseId", subject, "academicYear");

CREATE UNIQUE INDEX college_lecturers_college_employee_unique ON public.college_lecturers USING btree ("collegeId", "employeeId");

CREATE UNIQUE INDEX college_lecturers_pkey ON public.college_lecturers USING btree (id);

CREATE UNIQUE INDEX "college_lecturers_userId_key" ON public.college_lecturers USING btree ("userId");

CREATE UNIQUE INDEX colleges_code_key ON public.colleges USING btree (code);

CREATE UNIQUE INDEX colleges_pkey ON public.colleges USING btree (id);

CREATE UNIQUE INDEX companies_code_key ON public.companies USING btree (code);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX company_branches_company_code_unique ON public.company_branches USING btree ("companyId", code);

CREATE UNIQUE INDEX company_branches_pkey ON public.company_branches USING btree (id);

CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);

CREATE UNIQUE INDEX conversations_student_id_recruiter_id_application_id_key ON public.conversations USING btree (student_id, recruiter_id, application_id);

CREATE UNIQUE INDEX education_pkey ON public.education USING btree (id);

CREATE UNIQUE INDEX experience_pkey ON public.experience USING btree (id);

CREATE UNIQUE INDEX export_activities_pkey ON public.export_activities USING btree (id);

CREATE INDEX idx_applied_jobs_applied_at ON public.applied_jobs USING btree (applied_at DESC);

CREATE INDEX idx_applied_jobs_opportunity_id ON public.applied_jobs USING btree (opportunity_id);

CREATE INDEX idx_applied_jobs_status ON public.applied_jobs USING btree (application_status);

CREATE INDEX idx_applied_jobs_student_date ON public.applied_jobs USING btree (student_id, applied_at DESC);

CREATE INDEX idx_applied_jobs_student_id ON public.applied_jobs USING btree (student_id);

CREATE INDEX idx_assignments_course ON public.assignments USING btree (course_name);

CREATE INDEX idx_assignments_due_date ON public.assignments USING btree (due_date);

CREATE INDEX idx_assignments_educator ON public.assignments USING btree (educator_id);

CREATE INDEX idx_attachments_assignment ON public.assignment_attachments USING btree (assignment_id);

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_action_date ON public.audit_logs USING btree (action, "createdAt" DESC);

CREATE INDEX idx_audit_actor ON public.audit_logs USING btree ("actorId");

CREATE INDEX idx_audit_actor_action ON public.audit_logs USING btree ("actorId", action);

CREATE INDEX idx_audit_actorid ON public.audit_logs USING btree ("actorId");

CREATE INDEX idx_audit_created ON public.audit_logs USING btree ("createdAt" DESC);

CREATE INDEX idx_audit_createdat ON public.audit_logs USING btree ("createdAt" DESC);

CREATE INDEX idx_audit_ip_trgm ON public.audit_logs USING gin (ip public.gin_trgm_ops);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree ("createdAt");

CREATE INDEX idx_audit_logs_created_desc ON public.audit_logs USING btree ("createdAt" DESC);

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree ("resourceType", "resourceId");

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree ("userId");

CREATE INDEX idx_audit_target ON public.audit_logs USING btree (target);

CREATE INDEX idx_audit_target_trgm ON public.audit_logs USING gin (target public.gin_trgm_ops);

CREATE INDEX idx_certificates_student_id ON public.certificates USING btree (student_id);

CREATE INDEX idx_college_courses_academic_year ON public.college_courses USING btree ("academicYear");

CREATE INDEX idx_college_courses_college ON public.college_courses USING btree ("collegeId");

CREATE INDEX idx_college_lecturers_college ON public.college_lecturers USING btree ("collegeId");

CREATE INDEX idx_college_lecturers_user ON public.college_lecturers USING btree ("userId");

CREATE INDEX idx_colleges_standalone ON public.colleges USING btree ("collegeType") WHERE ("collegeType" = 'standalone'::text);

CREATE INDEX idx_colleges_type ON public.colleges USING btree ("collegeType");

CREATE INDEX idx_colleges_university ON public.colleges USING btree ("universityId");

CREATE INDEX idx_colleges_university_type ON public.colleges USING btree ("universityId", "collegeType") WHERE ("universityId" IS NOT NULL);

CREATE INDEX idx_companies_code ON public.companies USING btree (code);

CREATE INDEX idx_companies_industry ON public.companies USING btree (industry);

CREATE INDEX idx_companies_state ON public.companies USING btree ("hqState");

CREATE INDEX idx_companies_status ON public.companies USING btree ("accountStatus", "approvalStatus");

CREATE INDEX idx_company_branches_company ON public.company_branches USING btree ("companyId");

CREATE INDEX idx_conversations_application_id ON public.conversations USING btree (application_id);

CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at DESC);

CREATE INDEX idx_conversations_opportunity_id ON public.conversations USING btree (opportunity_id);

CREATE INDEX idx_conversations_recruiter_id ON public.conversations USING btree (recruiter_id);

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);

CREATE INDEX idx_conversations_student_id ON public.conversations USING btree (student_id);

CREATE INDEX idx_education_student_id ON public.education USING btree (student_id);

CREATE INDEX idx_educator_assignments_class ON public.school_educator_class_assignments USING btree ("classId");

CREATE INDEX idx_educator_assignments_educator ON public.school_educator_class_assignments USING btree ("educatorId");

CREATE INDEX idx_enrollments_active ON public."studentEnrollments" USING btree ("studentId") WHERE ("enrollmentStatus" = 'active'::public."enrollmentStatus");

CREATE INDEX idx_enrollments_student_status_date ON public."studentEnrollments" USING btree ("studentId", "enrollmentStatus", "enrollmentDate" DESC);

CREATE INDEX idx_experience_student_id ON public.experience USING btree (student_id);

CREATE INDEX idx_export_activities_shortlist_id ON public.export_activities USING btree (shortlist_id);

CREATE INDEX idx_interview_reminders_interview_id ON public.interview_reminders USING btree (interview_id);

CREATE INDEX idx_interview_reminders_sent_at ON public.interview_reminders USING btree (sent_at);

CREATE INDEX idx_interviews_created_by ON public.interviews USING btree (created_by);

CREATE INDEX idx_interviews_date ON public.interviews USING btree (date);

CREATE INDEX idx_interviews_status ON public.interviews USING btree (status);

CREATE INDEX idx_interviews_student_id ON public.interviews USING btree (student_id);

CREATE INDEX idx_lecturer_assignments_course ON public.college_lecturer_course_assignments USING btree ("courseId");

CREATE INDEX idx_lecturer_assignments_lecturer ON public.college_lecturer_course_assignments USING btree ("lecturerId");

CREATE INDEX idx_message_reactions_message_id ON public.message_reactions USING btree (message_id);

CREATE INDEX idx_message_reactions_user_id ON public.message_reactions USING btree (user_id);

CREATE INDEX idx_messages_application_id ON public.messages USING btree (application_id);

CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);

CREATE INDEX idx_messages_is_read ON public.messages USING btree (is_read);

CREATE INDEX idx_messages_opportunity_id ON public.messages USING btree (opportunity_id);

CREATE INDEX idx_messages_receiver_id ON public.messages USING btree (receiver_id);

CREATE INDEX idx_messages_receiver_type ON public.messages USING btree (receiver_type);

CREATE INDEX idx_messages_receiver_unread ON public.messages USING btree (receiver_id, is_read) WHERE (is_read = false);

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);

CREATE INDEX idx_messages_sender_type ON public.messages USING btree (sender_type);

CREATE INDEX idx_metrics_date ON public.metrics_snapshots USING btree ("snapshotDate" DESC);

CREATE INDEX idx_metrics_snapshotdate ON public.metrics_snapshots USING btree ("snapshotDate" DESC);

CREATE INDEX idx_metrics_snapshots_date ON public.metrics_snapshots USING btree ("snapshotDate");

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);

CREATE INDEX idx_notifications_recruiter ON public.notifications USING btree (recruiter_id);

CREATE INDEX idx_offers_candidate_name_lower ON public.offers USING btree (lower(candidate_name));

CREATE INDEX idx_offers_expiry_date ON public.offers USING btree (expiry_date);

CREATE INDEX idx_offers_inserted_at ON public.offers USING btree (inserted_at DESC);

CREATE INDEX idx_offers_job_title_lower ON public.offers USING btree (lower(job_title));

CREATE INDEX idx_offers_offer_date ON public.offers USING btree (offer_date);

CREATE INDEX idx_offers_sent_via ON public.offers USING btree (sent_via);

CREATE INDEX idx_offers_status ON public.offers USING btree (status);

CREATE INDEX idx_offers_status_expiry ON public.offers USING btree (status, expiry_date);

CREATE INDEX idx_offers_status_inserted ON public.offers USING btree (status, inserted_at DESC);

CREATE INDEX idx_offers_template ON public.offers USING btree (template);

CREATE INDEX idx_opportunities_active_posted ON public.opportunities USING btree (is_active, posted_date DESC) WHERE (is_active = true);

CREATE INDEX idx_opportunities_company_name ON public.opportunities USING btree (lower(company_name));

CREATE INDEX idx_opportunities_created_at ON public.opportunities USING btree (created_at DESC);

CREATE INDEX idx_opportunities_deadline ON public.opportunities USING btree (deadline, closing_date);

CREATE INDEX idx_opportunities_job_title ON public.opportunities USING btree (lower(job_title));

CREATE INDEX idx_opportunities_posted_date ON public.opportunities USING btree (posted_date DESC NULLS LAST);

CREATE INDEX idx_opportunities_salary ON public.opportunities USING btree (salary_range_max DESC, salary_range_min DESC);

CREATE INDEX idx_opportunities_search ON public.opportunities USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(job_title, ''::text) || ' '::text) || COALESCE(title, ''::text)) || ' '::text) || COALESCE(company_name, ''::text)) || ' '::text) || COALESCE(description, ''::text))));

CREATE INDEX idx_opportunities_skills_gin ON public.opportunities USING gin (skills_required);

CREATE INDEX idx_opportunity_interactions_action ON public.opportunity_interactions USING btree (action);

CREATE INDEX idx_opportunity_interactions_opportunity ON public.opportunity_interactions USING btree (opportunity_id);

CREATE INDEX idx_opportunity_interactions_student ON public.opportunity_interactions USING btree (student_id);

CREATE INDEX idx_passports_assessments_gin ON public.skill_passports USING gin (assessments);

CREATE INDEX idx_passports_certificates_gin ON public.skill_passports USING gin (certificates);

CREATE INDEX idx_passports_createdat ON public.skill_passports USING btree ("createdAt" DESC);

CREATE INDEX idx_passports_nsqflevel ON public.skill_passports USING btree ("nsqfLevel");

CREATE INDEX idx_passports_projects_gin ON public.skill_passports USING gin (projects);

CREATE INDEX idx_passports_status ON public.skill_passports USING btree (status);

CREATE INDEX idx_passports_status_nsqf ON public.skill_passports USING btree (status, "nsqfLevel");

CREATE INDEX idx_passports_student ON public.skill_passports USING btree ("studentId");

CREATE INDEX idx_passports_student_status ON public.skill_passports USING btree ("studentId", status);

CREATE INDEX idx_passports_studentid ON public.skill_passports USING btree ("studentId");

CREATE INDEX idx_passports_updatedat ON public.skill_passports USING btree ("updatedAt" DESC);

CREATE INDEX idx_permissions_name ON public.permissions USING btree (name);

CREATE INDEX idx_permissions_resource ON public.permissions USING btree (resource);

CREATE INDEX idx_pipeline_activities_created_at ON public.pipeline_activities USING btree (created_at);

CREATE INDEX idx_pipeline_activities_pipeline_candidate_id ON public.pipeline_activities USING btree (pipeline_candidate_id);

CREATE INDEX idx_pipeline_candidates_next_action_date ON public.pipeline_candidates USING btree (next_action_date);

CREATE INDEX idx_pipeline_candidates_requisition_id ON public.pipeline_candidates USING btree (requisition_id);

CREATE INDEX idx_pipeline_candidates_stage ON public.pipeline_candidates USING btree (stage);

CREATE INDEX idx_pipeline_candidates_status ON public.pipeline_candidates USING btree (status);

CREATE INDEX idx_pipeline_candidates_student_id ON public.pipeline_candidates USING btree (student_id);

CREATE INDEX idx_placements_hired_date ON public.placements USING btree ("hiredDate" DESC);

CREATE INDEX idx_placements_recruiter ON public.placements USING btree ("recruiterId");

CREATE INDEX idx_placements_status ON public.placements USING btree ("placementStatus");

CREATE INDEX idx_placements_student ON public.placements USING btree ("studentId");

CREATE INDEX idx_profile_views_date ON public.profile_views USING btree (viewed_at);

CREATE INDEX idx_profile_views_student ON public.profile_views USING btree (student_id);

CREATE INDEX idx_projects_student_id ON public.projects USING btree (student_id);

CREATE INDEX idx_recent_updates_student ON public.recent_updates USING btree (student_id);

CREATE INDEX idx_recent_updates_updated_at ON public.recent_updates USING btree (updated_at);

CREATE INDEX idx_recruiter_activities_created ON public.recruiter_activities USING btree ("createdAt" DESC);

CREATE INDEX idx_recruiter_activities_recruiter ON public.recruiter_activities USING btree ("recruiterId");

CREATE INDEX idx_recruiter_activities_student ON public.recruiter_activities USING btree ("targetStudentId");

CREATE INDEX idx_recruiter_activities_type ON public.recruiter_activities USING btree ("activityType");

CREATE INDEX idx_recruiters_branch ON public.recruiters USING btree ("branchId");

CREATE INDEX idx_recruiters_company ON public.recruiters USING btree ("companyId");

CREATE INDEX idx_recruiters_createdat ON public.recruiters USING btree (createdat DESC);

CREATE INDEX idx_recruiters_email ON public.recruiters USING btree (email);

CREATE INDEX idx_recruiters_email_trgm ON public.recruiters USING gin (email public.gin_trgm_ops);

CREATE INDEX idx_recruiters_isactive ON public.recruiters USING btree (isactive);

CREATE INDEX idx_recruiters_name_trgm ON public.recruiters USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_recruiters_state ON public.recruiters USING btree (state);

CREATE INDEX idx_recruiters_state_status ON public.recruiters USING btree (state, verificationstatus);

CREATE INDEX idx_recruiters_status ON public.recruiters USING btree ("verificationStatus", "isActive");

CREATE INDEX idx_recruiters_status_active ON public.recruiters USING btree (verificationstatus, isactive);

CREATE INDEX idx_recruiters_user ON public.recruiters USING btree ("userId");

CREATE INDEX idx_recruiters_verificationstatus ON public.recruiters USING btree (verificationstatus);

CREATE INDEX idx_requisitions_created_by ON public.requisitions USING btree (created_by);

CREATE INDEX idx_requisitions_created_date ON public.requisitions USING btree (created_date);

CREATE INDEX idx_requisitions_status ON public.requisitions USING btree (status);

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree ("permissionId");

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role);

CREATE INDEX idx_saved_jobs_opportunity_id ON public.saved_jobs USING btree (opportunity_id);

CREATE INDEX idx_saved_jobs_saved_at ON public.saved_jobs USING btree (saved_at DESC);

CREATE INDEX idx_saved_jobs_student_date ON public.saved_jobs USING btree (student_id, saved_at DESC);

CREATE INDEX idx_saved_jobs_student_id ON public.saved_jobs USING btree (student_id);

CREATE INDEX idx_saved_searches_created ON public.recruiter_saved_searches USING btree (created_at DESC);

CREATE INDEX idx_saved_searches_last_used ON public.recruiter_saved_searches USING btree (last_used DESC NULLS LAST);

CREATE INDEX idx_saved_searches_recruiter ON public.recruiter_saved_searches USING btree (recruiter_id);

CREATE INDEX idx_school_classes_academic_year ON public.school_classes USING btree ("academicYear");

CREATE INDEX idx_school_classes_school ON public.school_classes USING btree ("schoolId");

CREATE INDEX idx_school_educators_school ON public.school_educators USING btree ("schoolId");

CREATE INDEX idx_school_educators_user ON public.school_educators USING btree ("userId");

CREATE INDEX idx_schools_code ON public.schools USING btree (code);

CREATE INDEX idx_schools_state ON public.schools USING btree (state);

CREATE INDEX idx_schools_status ON public.schools USING btree ("accountStatus", "approvalStatus");

CREATE INDEX idx_search_history_last_searched ON public.search_history USING btree (last_searched_at DESC);

CREATE INDEX idx_search_history_search_count ON public.search_history USING btree (search_count DESC);

CREATE INDEX idx_search_history_student_id ON public.search_history USING btree (student_id);

CREATE INDEX idx_shortlist_candidates_shortlist_id ON public.shortlist_candidates USING btree (shortlist_id);

CREATE INDEX idx_shortlist_candidates_student_id ON public.shortlist_candidates USING btree (student_id);

CREATE INDEX idx_shortlists_created_by ON public.shortlists USING btree (created_by);

CREATE INDEX idx_shortlists_created_date ON public.shortlists USING btree (created_date);

CREATE INDEX idx_skill_passports_ai_verified ON public.skill_passports USING btree ("aiVerified");

CREATE INDEX idx_skill_passports_created_desc ON public.skill_passports USING btree ("createdAt" DESC);

CREATE INDEX idx_skill_passports_nsqf ON public.skill_passports USING btree ("nsqfLevel");

CREATE INDEX idx_skill_passports_status ON public.skill_passports USING btree (status);

CREATE INDEX idx_skill_passports_student ON public.skill_passports USING btree ("studentId");

CREATE INDEX idx_skill_passports_student_status ON public.skill_passports USING btree ("studentId", status);

CREATE INDEX idx_skill_trends_category ON public.skill_trends USING btree (category);

CREATE INDEX idx_skill_trends_snapshot ON public.skill_trends USING btree ("snapshotDate" DESC);

CREATE INDEX idx_skills_student_id ON public.skills USING btree (student_id);

CREATE INDEX idx_skills_type ON public.skills USING btree (type);

CREATE INDEX idx_student_assignments_assignment ON public.student_assignments USING btree (assignment_id);

CREATE INDEX idx_student_assignments_status ON public.student_assignments USING btree (status);

CREATE INDEX idx_student_assignments_student ON public.student_assignments USING btree (student_id);

CREATE INDEX idx_student_assignments_student_status ON public.student_assignments USING btree (student_id, status);

CREATE INDEX idx_student_assignments_submission_date ON public.student_assignments USING btree (submission_date);

CREATE INDEX idx_student_enrollments_college_course ON public."studentEnrollments" USING btree ("collegeCourseId");

CREATE INDEX idx_student_enrollments_dates ON public."studentEnrollments" USING btree ("enrollmentDate", "expectedGraduationDate");

CREATE INDEX idx_student_enrollments_school_class ON public."studentEnrollments" USING btree ("schoolClassId");

CREATE INDEX idx_student_enrollments_status ON public."studentEnrollments" USING btree ("enrollmentStatus");

CREATE INDEX idx_student_enrollments_student ON public."studentEnrollments" USING btree ("studentId");

CREATE INDEX idx_student_enrollments_university_course ON public."studentEnrollments" USING btree ("universityCourseId");

CREATE INDEX idx_students_college ON public.students USING btree ("collegeId");

CREATE INDEX idx_students_college_course ON public.students USING btree ("collegeCourseId");

CREATE INDEX idx_students_created_desc ON public.students USING btree ("createdAt" DESC);

CREATE INDEX idx_students_createdat ON public.students USING btree ("createdAt" DESC);

CREATE INDEX idx_students_email ON public.students USING btree (email);

CREATE INDEX idx_students_email_trgm ON public.students USING gin (email public.gin_trgm_ops);

CREATE INDEX idx_students_enrollment ON public.students USING btree ("enrollmentNumber");

CREATE INDEX idx_students_id ON public.students USING btree (id);

CREATE INDEX idx_students_name_trgm ON public.students USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_students_profile_email ON public.students USING btree (((profile ->> 'email'::text)));

CREATE INDEX idx_students_profile_gin ON public.students USING gin (profile);

CREATE INDEX idx_students_profile_name ON public.students USING btree (((profile ->> 'name'::text)));

CREATE INDEX idx_students_profile_passport_id ON public.students USING btree (((profile ->> 'passportId'::text)));

CREATE INDEX idx_students_school ON public.students USING btree ("schoolId");

CREATE INDEX idx_students_school_class ON public.students USING btree ("schoolClassId");

CREATE INDEX idx_students_type ON public.students USING btree ("studentType");

CREATE INDEX idx_students_university ON public.students USING btree ("universityId");

CREATE INDEX idx_students_university_college ON public.students USING btree ("universityCollegeId");

CREATE INDEX idx_students_university_course ON public.students USING btree ("universityCourseId");

CREATE INDEX idx_students_universityid ON public.students USING btree ("universityId");

CREATE INDEX idx_students_user ON public.students USING btree (id);

CREATE INDEX idx_trainings_student_id ON public.trainings USING btree (student_id);

CREATE INDEX idx_universities_code ON public.universities USING btree (code);

CREATE INDEX idx_universities_createdat ON public.universities USING btree ("createdAt" DESC);

CREATE INDEX idx_universities_district ON public.universities USING btree (district);

CREATE INDEX idx_universities_isactive ON public.universities USING btree (isactive);

CREATE INDEX idx_universities_name_trgm ON public.universities USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_universities_state ON public.universities USING btree (state);

CREATE INDEX idx_universities_status ON public.universities USING btree ("accountStatus", "approvalStatus");

CREATE INDEX idx_universities_verificationstatus ON public.universities USING btree (verificationstatus);

CREATE INDEX idx_university_courses_academic_year ON public.university_courses USING btree ("academicYear");

CREATE INDEX idx_university_courses_college ON public.university_courses USING btree ("collegeId");

CREATE INDEX idx_university_lecturer_assignments_course ON public.university_lecturer_course_assignments USING btree ("courseId");

CREATE INDEX idx_university_lecturer_assignments_lecturer ON public.university_lecturer_course_assignments USING btree ("lecturerId");

CREATE INDEX idx_university_lecturers_college ON public.university_lecturers USING btree ("collegeId");

CREATE INDEX idx_university_lecturers_user ON public.university_lecturers USING btree ("userId");

CREATE INDEX idx_university_performance_rank ON public.university_performance USING btree ("rankPosition");

CREATE INDEX idx_university_performance_snapshot ON public.university_performance USING btree ("snapshotDate" DESC);

CREATE INDEX idx_users_account_status ON public.users USING btree ("accountStatus");

CREATE INDEX idx_users_createdat ON public.users USING btree ("createdAt" DESC);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE INDEX idx_users_email_trgm ON public.users USING gin (email public.gin_trgm_ops);

CREATE INDEX idx_users_entity ON public.users USING btree ("entityType", "entityId");

CREATE INDEX idx_users_isactive ON public.users USING btree ("isActive");

CREATE INDEX idx_users_org ON public.users USING btree ("organizationId");

CREATE INDEX idx_users_organizationid ON public.users USING btree ("organizationId");

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE INDEX idx_users_role_active ON public.users USING btree (role, "isActive");

CREATE INDEX idx_users_supabase_auth_id ON public.users USING btree ("supabaseAuthId");

CREATE INDEX idx_verifications_createdat ON public.verifications USING btree ("createdAt" DESC);

CREATE INDEX idx_verifications_passport ON public.verifications USING btree ("passportId");

CREATE INDEX idx_verifications_performedby ON public.verifications USING btree ("performedBy");

CREATE INDEX idx_verifications_status ON public.verifications USING btree ("verificationStatus");

CREATE INDEX idx_verifications_target ON public.verifications USING btree ("targetTable", "targetId");

CREATE INDEX idx_verifications_target_date ON public.verifications USING btree ("targetId", "createdAt" DESC);

CREATE INDEX idx_verifications_targetid ON public.verifications USING btree ("targetId");

CREATE INDEX idx_verifications_user ON public.verifications USING btree ("userId");

CREATE UNIQUE INDEX interview_reminders_pkey ON public.interview_reminders USING btree (id);

CREATE UNIQUE INDEX interviews_pkey ON public.interviews USING btree (id);

CREATE UNIQUE INDEX message_reactions_pkey ON public.message_reactions USING btree (id);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

CREATE UNIQUE INDEX metrics_snapshots_pkey ON public.metrics_snapshots USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX offers_pkey ON public.offers USING btree (id);

CREATE INDEX opportunities_embedding_idx ON public.opportunities USING ivfflat (embedding public.vector_cosine_ops);

CREATE UNIQUE INDEX opportunities_pkey ON public.opportunities USING btree (id);

CREATE UNIQUE INDEX opportunity_interactions_pkey ON public.opportunity_interactions USING btree (id);

CREATE UNIQUE INDEX opportunity_interactions_student_id_opportunity_id_action_key ON public.opportunity_interactions USING btree (student_id, opportunity_id, action);

CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name);

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

CREATE UNIQUE INDEX pipeline_activities_pkey ON public.pipeline_activities USING btree (id);

CREATE UNIQUE INDEX pipeline_candidates_pkey ON public.pipeline_candidates USING btree (id);

CREATE UNIQUE INDEX pipeline_candidates_requisition_id_student_id_key ON public.pipeline_candidates USING btree (requisition_id, student_id);

CREATE UNIQUE INDEX placements_pkey ON public.placements USING btree (id);

CREATE UNIQUE INDEX profile_views_pkey ON public.profile_views USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX recent_updates_pkey ON public.recent_updates USING btree (id);

CREATE UNIQUE INDEX recruiter_activities_pkey ON public.recruiter_activities USING btree (id);

CREATE UNIQUE INDEX recruiter_saved_searches_pkey ON public.recruiter_saved_searches USING btree (id);

CREATE UNIQUE INDEX recruiters_email_key ON public.recruiters USING btree (email);

CREATE UNIQUE INDEX recruiters_pkey ON public.recruiters USING btree (id);

CREATE UNIQUE INDEX requisitions_pkey ON public.requisitions USING btree (id);

CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (id);

CREATE UNIQUE INDEX role_permissions_role_permission_unique ON public.role_permissions USING btree (role, "permissionId");

CREATE UNIQUE INDEX saved_jobs_pkey ON public.saved_jobs USING btree (id);

CREATE UNIQUE INDEX school_classes_pkey ON public.school_classes USING btree (id);

CREATE UNIQUE INDEX school_classes_school_name_year_unique ON public.school_classes USING btree ("schoolId", name, "academicYear");

CREATE UNIQUE INDEX school_educator_class_assignments_pkey ON public.school_educator_class_assignments USING btree (id);

CREATE UNIQUE INDEX school_educator_class_assignments_unique ON public.school_educator_class_assignments USING btree ("educatorId", "classId", subject, "academicYear");

CREATE UNIQUE INDEX school_educators_pkey ON public.school_educators USING btree (id);

CREATE UNIQUE INDEX school_educators_school_employee_unique ON public.school_educators USING btree ("schoolId", "employeeId");

CREATE UNIQUE INDEX "school_educators_userId_key" ON public.school_educators USING btree ("userId");

CREATE UNIQUE INDEX schools_code_key ON public.schools USING btree (code);

CREATE UNIQUE INDEX schools_pkey ON public.schools USING btree (id);

CREATE UNIQUE INDEX search_history_pkey ON public.search_history USING btree (id);

CREATE UNIQUE INDEX search_history_student_id_search_term_key ON public.search_history USING btree (student_id, search_term);

CREATE UNIQUE INDEX shortlist_candidates_pkey ON public.shortlist_candidates USING btree (id);

CREATE UNIQUE INDEX shortlist_candidates_shortlist_id_student_id_key ON public.shortlist_candidates USING btree (shortlist_id, student_id);

CREATE UNIQUE INDEX shortlists_pkey ON public.shortlists USING btree (id);

CREATE UNIQUE INDEX skill_passports_pkey ON public.skill_passports USING btree (id);

CREATE UNIQUE INDEX "skill_passports_studentId_key" ON public.skill_passports USING btree ("studentId");

CREATE UNIQUE INDEX skill_trends_pkey ON public.skill_trends USING btree (id);

CREATE UNIQUE INDEX skills_pkey ON public.skills USING btree (id);

CREATE UNIQUE INDEX "studentEnrollments_pkey" ON public."studentEnrollments" USING btree (id);

CREATE UNIQUE INDEX student_assignments_pkey ON public.student_assignments USING btree (student_assignment_id);

CREATE UNIQUE INDEX students_email_key ON public.students USING btree (email);

CREATE INDEX students_embedding_idx ON public.students USING ivfflat (embedding public.vector_cosine_ops);

CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);

CREATE UNIQUE INDEX students_userid_key ON public.students USING btree (id);

CREATE UNIQUE INDEX trainings_pkey ON public.trainings USING btree (id);

CREATE UNIQUE INDEX unique_application ON public.applied_jobs USING btree (student_id, opportunity_id);

CREATE UNIQUE INDEX unique_saved_job ON public.saved_jobs USING btree (student_id, opportunity_id);

CREATE UNIQUE INDEX unique_student_id ON public.recent_updates USING btree (student_id);

CREATE UNIQUE INDEX unique_user_reaction ON public.message_reactions USING btree (message_id, user_id, emoji);

CREATE UNIQUE INDEX universities_code_key ON public.universities USING btree (code);

CREATE UNIQUE INDEX universities_pkey ON public.universities USING btree (id);

CREATE UNIQUE INDEX university_courses_college_name_year_unique ON public.university_courses USING btree ("collegeId", name, "academicYear");

CREATE UNIQUE INDEX university_courses_pkey ON public.university_courses USING btree (id);

CREATE UNIQUE INDEX university_lecturer_course_assignments_pkey ON public.university_lecturer_course_assignments USING btree (id);

CREATE UNIQUE INDEX university_lecturer_course_assignments_unique ON public.university_lecturer_course_assignments USING btree ("lecturerId", "courseId", subject, "academicYear");

CREATE UNIQUE INDEX university_lecturers_college_employee_unique ON public.university_lecturers USING btree ("collegeId", "employeeId");

CREATE UNIQUE INDEX university_lecturers_pkey ON public.university_lecturers USING btree (id);

CREATE UNIQUE INDEX "university_lecturers_userId_key" ON public.university_lecturers USING btree ("userId");

CREATE UNIQUE INDEX university_performance_pkey ON public.university_performance USING btree (id);

CREATE UNIQUE INDEX uq_student_assignment ON public.student_assignments USING btree (assignment_id, student_id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX "users_supabaseAuthId_key" ON public.users USING btree ("supabaseAuthId");

CREATE UNIQUE INDEX verifications_pkey ON public.verifications USING btree (id);

alter table "public"."applied_jobs" add constraint "applied_jobs_pkey" PRIMARY KEY using index "applied_jobs_pkey";

alter table "public"."assignment_attachments" add constraint "assignment_attachments_pkey" PRIMARY KEY using index "assignment_attachments_pkey";

alter table "public"."assignments" add constraint "assignments_pkey" PRIMARY KEY using index "assignments_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."certificates" add constraint "certificates_pkey" PRIMARY KEY using index "certificates_pkey";

alter table "public"."college_courses" add constraint "college_courses_pkey" PRIMARY KEY using index "college_courses_pkey";

alter table "public"."college_lecturer_course_assignments" add constraint "college_lecturer_course_assignments_pkey" PRIMARY KEY using index "college_lecturer_course_assignments_pkey";

alter table "public"."college_lecturers" add constraint "college_lecturers_pkey" PRIMARY KEY using index "college_lecturers_pkey";

alter table "public"."colleges" add constraint "colleges_pkey" PRIMARY KEY using index "colleges_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."company_branches" add constraint "company_branches_pkey" PRIMARY KEY using index "company_branches_pkey";

alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY using index "conversations_pkey";

alter table "public"."education" add constraint "education_pkey" PRIMARY KEY using index "education_pkey";

alter table "public"."experience" add constraint "experience_pkey" PRIMARY KEY using index "experience_pkey";

alter table "public"."export_activities" add constraint "export_activities_pkey" PRIMARY KEY using index "export_activities_pkey";

alter table "public"."interview_reminders" add constraint "interview_reminders_pkey" PRIMARY KEY using index "interview_reminders_pkey";

alter table "public"."interviews" add constraint "interviews_pkey" PRIMARY KEY using index "interviews_pkey";

alter table "public"."message_reactions" add constraint "message_reactions_pkey" PRIMARY KEY using index "message_reactions_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."metrics_snapshots" add constraint "metrics_snapshots_pkey" PRIMARY KEY using index "metrics_snapshots_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."offers" add constraint "offers_pkey" PRIMARY KEY using index "offers_pkey";

alter table "public"."opportunities" add constraint "opportunities_pkey" PRIMARY KEY using index "opportunities_pkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_pkey" PRIMARY KEY using index "opportunity_interactions_pkey";

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."pipeline_activities" add constraint "pipeline_activities_pkey" PRIMARY KEY using index "pipeline_activities_pkey";

alter table "public"."pipeline_candidates" add constraint "pipeline_candidates_pkey" PRIMARY KEY using index "pipeline_candidates_pkey";

alter table "public"."placements" add constraint "placements_pkey" PRIMARY KEY using index "placements_pkey";

alter table "public"."profile_views" add constraint "profile_views_pkey" PRIMARY KEY using index "profile_views_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."recent_updates" add constraint "recent_updates_pkey" PRIMARY KEY using index "recent_updates_pkey";

alter table "public"."recruiter_activities" add constraint "recruiter_activities_pkey" PRIMARY KEY using index "recruiter_activities_pkey";

alter table "public"."recruiter_saved_searches" add constraint "recruiter_saved_searches_pkey" PRIMARY KEY using index "recruiter_saved_searches_pkey";

alter table "public"."recruiters" add constraint "recruiters_pkey" PRIMARY KEY using index "recruiters_pkey";

alter table "public"."requisitions" add constraint "requisitions_pkey" PRIMARY KEY using index "requisitions_pkey";

alter table "public"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "public"."saved_jobs" add constraint "saved_jobs_pkey" PRIMARY KEY using index "saved_jobs_pkey";

alter table "public"."school_classes" add constraint "school_classes_pkey" PRIMARY KEY using index "school_classes_pkey";

alter table "public"."school_educator_class_assignments" add constraint "school_educator_class_assignments_pkey" PRIMARY KEY using index "school_educator_class_assignments_pkey";

alter table "public"."school_educators" add constraint "school_educators_pkey" PRIMARY KEY using index "school_educators_pkey";

alter table "public"."schools" add constraint "schools_pkey" PRIMARY KEY using index "schools_pkey";

alter table "public"."search_history" add constraint "search_history_pkey" PRIMARY KEY using index "search_history_pkey";

alter table "public"."shortlist_candidates" add constraint "shortlist_candidates_pkey" PRIMARY KEY using index "shortlist_candidates_pkey";

alter table "public"."shortlists" add constraint "shortlists_pkey" PRIMARY KEY using index "shortlists_pkey";

alter table "public"."skill_passports" add constraint "skill_passports_pkey" PRIMARY KEY using index "skill_passports_pkey";

alter table "public"."skill_trends" add constraint "skill_trends_pkey" PRIMARY KEY using index "skill_trends_pkey";

alter table "public"."skills" add constraint "skills_pkey" PRIMARY KEY using index "skills_pkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_pkey" PRIMARY KEY using index "studentEnrollments_pkey";

alter table "public"."student_assignments" add constraint "student_assignments_pkey" PRIMARY KEY using index "student_assignments_pkey";

alter table "public"."students" add constraint "students_pkey" PRIMARY KEY using index "students_pkey";

alter table "public"."trainings" add constraint "trainings_pkey" PRIMARY KEY using index "trainings_pkey";

alter table "public"."universities" add constraint "universities_pkey" PRIMARY KEY using index "universities_pkey";

alter table "public"."university_courses" add constraint "university_courses_pkey" PRIMARY KEY using index "university_courses_pkey";

alter table "public"."university_lecturer_course_assignments" add constraint "university_lecturer_course_assignments_pkey" PRIMARY KEY using index "university_lecturer_course_assignments_pkey";

alter table "public"."university_lecturers" add constraint "university_lecturers_pkey" PRIMARY KEY using index "university_lecturers_pkey";

alter table "public"."university_performance" add constraint "university_performance_pkey" PRIMARY KEY using index "university_performance_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."verifications" add constraint "verifications_pkey" PRIMARY KEY using index "verifications_pkey";

alter table "public"."applied_jobs" add constraint "check_application_status" CHECK ((application_status = ANY (ARRAY['applied'::text, 'viewed'::text, 'under_review'::text, 'interview_scheduled'::text, 'interviewed'::text, 'offer_received'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text]))) not valid;

alter table "public"."applied_jobs" validate constraint "check_application_status";

alter table "public"."applied_jobs" add constraint "fk_opportunity" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE not valid;

alter table "public"."applied_jobs" validate constraint "fk_opportunity";

alter table "public"."applied_jobs" add constraint "fk_student" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."applied_jobs" validate constraint "fk_student";

alter table "public"."applied_jobs" add constraint "unique_application" UNIQUE using index "unique_application";

alter table "public"."assignment_attachments" add constraint "fk_attachment_assignment" FOREIGN KEY (assignment_id) REFERENCES public.assignments(assignment_id) ON DELETE CASCADE not valid;

alter table "public"."assignment_attachments" validate constraint "fk_attachment_assignment";

alter table "public"."assignments" add constraint "assignments_assignment_type_check" CHECK ((assignment_type = ANY (ARRAY['homework'::text, 'project'::text, 'quiz'::text, 'exam'::text, 'lab'::text, 'essay'::text, 'presentation'::text, 'other'::text]))) not valid;

alter table "public"."assignments" validate constraint "assignments_assignment_type_check";

alter table "public"."audit_logs" add constraint "audit_logs_actorid_fkey" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_actorid_fkey";

alter table "public"."audit_logs" add constraint "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_userId_fkey";

alter table "public"."certificates" add constraint "certificates_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."certificates" validate constraint "certificates_student_id_fkey";

alter table "public"."college_courses" add constraint "college_courses_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public.colleges(id) ON DELETE CASCADE not valid;

alter table "public"."college_courses" validate constraint "college_courses_collegeId_fkey";

alter table "public"."college_courses" add constraint "college_courses_college_name_year_unique" UNIQUE using index "college_courses_college_name_year_unique";

alter table "public"."college_lecturer_course_assignments" add constraint "college_lecturer_course_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public.users(id) not valid;

alter table "public"."college_lecturer_course_assignments" validate constraint "college_lecturer_course_assignments_assignedBy_fkey";

alter table "public"."college_lecturer_course_assignments" add constraint "college_lecturer_course_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public.college_courses(id) ON DELETE CASCADE not valid;

alter table "public"."college_lecturer_course_assignments" validate constraint "college_lecturer_course_assignments_courseId_fkey";

alter table "public"."college_lecturer_course_assignments" add constraint "college_lecturer_course_assignments_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES public.college_lecturers(id) ON DELETE CASCADE not valid;

alter table "public"."college_lecturer_course_assignments" validate constraint "college_lecturer_course_assignments_lecturerId_fkey";

alter table "public"."college_lecturer_course_assignments" add constraint "college_lecturer_course_assignments_unique" UNIQUE using index "college_lecturer_course_assignments_unique";

alter table "public"."college_lecturers" add constraint "college_lecturers_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public.colleges(id) ON DELETE CASCADE not valid;

alter table "public"."college_lecturers" validate constraint "college_lecturers_collegeId_fkey";

alter table "public"."college_lecturers" add constraint "college_lecturers_college_employee_unique" UNIQUE using index "college_lecturers_college_employee_unique";

alter table "public"."college_lecturers" add constraint "college_lecturers_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."college_lecturers" validate constraint "college_lecturers_userId_fkey";

alter table "public"."college_lecturers" add constraint "college_lecturers_userId_key" UNIQUE using index "college_lecturers_userId_key";

alter table "public"."colleges" add constraint "colleges_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES public.users(id) not valid;

alter table "public"."colleges" validate constraint "colleges_approvedBy_fkey";

alter table "public"."colleges" add constraint "colleges_code_key" UNIQUE using index "colleges_code_key";

alter table "public"."colleges" add constraint "colleges_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES public.universities(id) ON DELETE SET NULL not valid;

alter table "public"."colleges" validate constraint "colleges_universityId_fkey";

alter table "public"."companies" add constraint "companies_code_key" UNIQUE using index "companies_code_key";

alter table "public"."company_branches" add constraint "company_branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_branches" validate constraint "company_branches_companyId_fkey";

alter table "public"."company_branches" add constraint "company_branches_company_code_unique" UNIQUE using index "company_branches_company_code_unique";

alter table "public"."conversations" add constraint "conversations_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applied_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."conversations" validate constraint "conversations_application_id_fkey";

alter table "public"."conversations" add constraint "conversations_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL not valid;

alter table "public"."conversations" validate constraint "conversations_opportunity_id_fkey";

alter table "public"."conversations" add constraint "conversations_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.recruiters(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_recruiter_id_fkey";

alter table "public"."conversations" add constraint "conversations_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_student_id_fkey";

alter table "public"."conversations" add constraint "conversations_student_id_recruiter_id_application_id_key" UNIQUE using index "conversations_student_id_recruiter_id_application_id_key";

alter table "public"."education" add constraint "education_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."education" validate constraint "education_student_id_fkey";

alter table "public"."experience" add constraint "experience_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."experience" validate constraint "experience_student_id_fkey";

alter table "public"."export_activities" add constraint "export_activities_shortlist_id_fkey" FOREIGN KEY (shortlist_id) REFERENCES public.shortlists(id) ON DELETE CASCADE not valid;

alter table "public"."export_activities" validate constraint "export_activities_shortlist_id_fkey";

alter table "public"."interview_reminders" add constraint "interview_reminders_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE not valid;

alter table "public"."interview_reminders" validate constraint "interview_reminders_interview_id_fkey";

alter table "public"."interviews" add constraint "interviews_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_student_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_user_type_check" CHECK (((user_type)::text = ANY (ARRAY[('student'::character varying)::text, ('recruiter'::character varying)::text]))) not valid;

alter table "public"."message_reactions" validate constraint "message_reactions_user_type_check";

alter table "public"."message_reactions" add constraint "unique_user_reaction" UNIQUE using index "unique_user_reaction";

alter table "public"."messages" add constraint "messages_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applied_jobs(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_application_id_fkey";

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_conversation_id_fkey";

alter table "public"."messages" add constraint "messages_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_opportunity_id_fkey";

alter table "public"."messages" add constraint "messages_receiver_type_check" CHECK ((receiver_type = ANY (ARRAY['student'::text, 'recruiter'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_receiver_type_check";

alter table "public"."messages" add constraint "messages_sender_type_check" CHECK ((sender_type = ANY (ARRAY['student'::text, 'recruiter'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_sender_type_check";

alter table "public"."notifications" add constraint "notifications_recruiter_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.recruiters(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_recruiter_fkey";

alter table "public"."offers" add constraint "offers_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'withdrawn'::text]))) not valid;

alter table "public"."offers" validate constraint "offers_status_check";

alter table "public"."opportunities" add constraint "opportunities_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.recruiters(id) not valid;

alter table "public"."opportunities" validate constraint "opportunities_recruiter_id_fkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_action_check" CHECK ((action = ANY (ARRAY['view'::text, 'apply'::text, 'dismiss'::text, 'save'::text]))) not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_action_check";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_opportunity_id_fkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_student_id_fkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_student_id_opportunity_id_action_key" UNIQUE using index "opportunity_interactions_student_id_opportunity_id_action_key";

alter table "public"."permissions" add constraint "permissions_name_key" UNIQUE using index "permissions_name_key";

alter table "public"."pipeline_activities" add constraint "pipeline_activities_pipeline_candidate_id_fkey" FOREIGN KEY (pipeline_candidate_id) REFERENCES public.pipeline_candidates(id) ON DELETE CASCADE not valid;

alter table "public"."pipeline_activities" validate constraint "pipeline_activities_pipeline_candidate_id_fkey";

alter table "public"."pipeline_candidates" add constraint "pipeline_candidates_requisition_id_fkey" FOREIGN KEY (requisition_id) REFERENCES public.requisitions(id) ON DELETE CASCADE not valid;

alter table "public"."pipeline_candidates" validate constraint "pipeline_candidates_requisition_id_fkey";

alter table "public"."pipeline_candidates" add constraint "pipeline_candidates_requisition_id_student_id_key" UNIQUE using index "pipeline_candidates_requisition_id_student_id_key";

alter table "public"."pipeline_candidates" add constraint "pipeline_candidates_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."pipeline_candidates" validate constraint "pipeline_candidates_student_id_fkey";

alter table "public"."placements" add constraint "placements_placementStatus_check" CHECK (("placementStatus" = ANY (ARRAY['applied'::text, 'shortlisted'::text, 'interviewed'::text, 'offered'::text, 'hired'::text, 'rejected'::text, 'retained_6m'::text, 'retained_1y'::text]))) not valid;

alter table "public"."placements" validate constraint "placements_placementStatus_check";

alter table "public"."placements" add constraint "placements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."placements" validate constraint "placements_studentId_fkey";

alter table "public"."profile_views" add constraint "profile_views_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."profile_views" validate constraint "profile_views_student_id_fkey";

alter table "public"."projects" add constraint "projects_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."projects" validate constraint "projects_student_id_fkey";

alter table "public"."recent_updates" add constraint "recent_updates_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."recent_updates" validate constraint "recent_updates_student_id_fkey";

alter table "public"."recent_updates" add constraint "unique_student_id" UNIQUE using index "unique_student_id";

alter table "public"."recruiter_activities" add constraint "recruiter_activities_activityType_check" CHECK (("activityType" = ANY (ARRAY['search'::text, 'profile_view'::text, 'contact'::text, 'shortlist'::text, 'hire_intent'::text]))) not valid;

alter table "public"."recruiter_activities" validate constraint "recruiter_activities_activityType_check";

alter table "public"."recruiter_activities" add constraint "recruiter_activities_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."recruiter_activities" validate constraint "recruiter_activities_targetStudentId_fkey";

alter table "public"."recruiters" add constraint "recruiters_email_key" UNIQUE using index "recruiters_email_key";

alter table "public"."role_permissions" add constraint "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permissionId_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_role_permission_unique" UNIQUE using index "role_permissions_role_permission_unique";

alter table "public"."saved_jobs" add constraint "fk_saved_jobs_opportunity" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) not valid;

alter table "public"."saved_jobs" validate constraint "fk_saved_jobs_opportunity";

alter table "public"."saved_jobs" add constraint "fk_saved_jobs_student" FOREIGN KEY (student_id) REFERENCES public.students(id) not valid;

alter table "public"."saved_jobs" validate constraint "fk_saved_jobs_student";

alter table "public"."saved_jobs" add constraint "unique_saved_job" UNIQUE using index "unique_saved_job";

alter table "public"."school_classes" add constraint "school_classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."school_classes" validate constraint "school_classes_schoolId_fkey";

alter table "public"."school_classes" add constraint "school_classes_school_name_year_unique" UNIQUE using index "school_classes_school_name_year_unique";

alter table "public"."school_educator_class_assignments" add constraint "school_educator_class_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public.users(id) not valid;

alter table "public"."school_educator_class_assignments" validate constraint "school_educator_class_assignments_assignedBy_fkey";

alter table "public"."school_educator_class_assignments" add constraint "school_educator_class_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.school_classes(id) ON DELETE CASCADE not valid;

alter table "public"."school_educator_class_assignments" validate constraint "school_educator_class_assignments_classId_fkey";

alter table "public"."school_educator_class_assignments" add constraint "school_educator_class_assignments_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES public.school_educators(id) ON DELETE CASCADE not valid;

alter table "public"."school_educator_class_assignments" validate constraint "school_educator_class_assignments_educatorId_fkey";

alter table "public"."school_educator_class_assignments" add constraint "school_educator_class_assignments_unique" UNIQUE using index "school_educator_class_assignments_unique";

alter table "public"."school_educators" add constraint "school_educators_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."school_educators" validate constraint "school_educators_schoolId_fkey";

alter table "public"."school_educators" add constraint "school_educators_school_employee_unique" UNIQUE using index "school_educators_school_employee_unique";

alter table "public"."school_educators" add constraint "school_educators_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."school_educators" validate constraint "school_educators_userId_fkey";

alter table "public"."school_educators" add constraint "school_educators_userId_key" UNIQUE using index "school_educators_userId_key";

alter table "public"."schools" add constraint "schools_approved_by_fkey" FOREIGN KEY ("approvedBy") REFERENCES public.users(id) not valid;

alter table "public"."schools" validate constraint "schools_approved_by_fkey";

alter table "public"."schools" add constraint "schools_code_key" UNIQUE using index "schools_code_key";

alter table "public"."search_history" add constraint "search_history_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."search_history" validate constraint "search_history_student_id_fkey";

alter table "public"."search_history" add constraint "search_history_student_id_search_term_key" UNIQUE using index "search_history_student_id_search_term_key";

alter table "public"."shortlist_candidates" add constraint "shortlist_candidates_shortlist_id_fkey" FOREIGN KEY (shortlist_id) REFERENCES public.shortlists(id) ON DELETE CASCADE not valid;

alter table "public"."shortlist_candidates" validate constraint "shortlist_candidates_shortlist_id_fkey";

alter table "public"."shortlist_candidates" add constraint "shortlist_candidates_shortlist_id_student_id_key" UNIQUE using index "shortlist_candidates_shortlist_id_student_id_key";

alter table "public"."shortlist_candidates" add constraint "shortlist_candidates_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."shortlist_candidates" validate constraint "shortlist_candidates_student_id_fkey";

alter table "public"."skill_passports" add constraint "skill_passports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'suspended'::text]))) not valid;

alter table "public"."skill_passports" validate constraint "skill_passports_status_check";

alter table "public"."skill_passports" add constraint "skill_passports_studentId_key" UNIQUE using index "skill_passports_studentId_key";

alter table "public"."skill_passports" add constraint "skill_passports_studentid_fkey1" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."skill_passports" validate constraint "skill_passports_studentid_fkey1";

alter table "public"."skill_trends" add constraint "skill_trends_trendDirection_check" CHECK (("trendDirection" = ANY (ARRAY['rising'::text, 'stable'::text, 'declining'::text]))) not valid;

alter table "public"."skill_trends" validate constraint "skill_trends_trendDirection_check";

alter table "public"."skills" add constraint "skills_level_check" CHECK (((level >= 1) AND (level <= 5))) not valid;

alter table "public"."skills" validate constraint "skills_level_check";

alter table "public"."skills" add constraint "skills_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."skills" validate constraint "skills_student_id_fkey";

alter table "public"."skills" add constraint "skills_type_check" CHECK (((type)::text = ANY (ARRAY[('technical'::character varying)::text, ('soft'::character varying)::text]))) not valid;

alter table "public"."skills" validate constraint "skills_type_check";

alter table "public"."studentEnrollments" add constraint "chk_enrollment_entity_match" CHECK (((("schoolClassId" IS NOT NULL) AND ("schoolId" IS NOT NULL)) OR (("collegeCourseId" IS NOT NULL) AND ("collegeId" IS NOT NULL)) OR (("universityCourseId" IS NOT NULL) AND ("universityId" IS NOT NULL)))) not valid;

alter table "public"."studentEnrollments" validate constraint "chk_enrollment_entity_match";

alter table "public"."studentEnrollments" add constraint "chk_enrollment_one_class" CHECK (((("schoolClassId" IS NOT NULL) AND ("collegeCourseId" IS NULL) AND ("universityCourseId" IS NULL)) OR (("schoolClassId" IS NULL) AND ("collegeCourseId" IS NOT NULL) AND ("universityCourseId" IS NULL)) OR (("schoolClassId" IS NULL) AND ("collegeCourseId" IS NULL) AND ("universityCourseId" IS NOT NULL)))) not valid;

alter table "public"."studentEnrollments" validate constraint "chk_enrollment_one_class";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_collegeCourseId_fkey" FOREIGN KEY ("collegeCourseId") REFERENCES public.college_courses(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_collegeCourseId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES public.colleges(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_collegeId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES public.school_classes(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_schoolClassId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_schoolId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_studentId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_universityCourseId_fkey" FOREIGN KEY ("universityCourseId") REFERENCES public.university_courses(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_universityCourseId_fkey";

alter table "public"."studentEnrollments" add constraint "studentEnrollments_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES public.universities(id) ON DELETE SET NULL not valid;

alter table "public"."studentEnrollments" validate constraint "studentEnrollments_universityId_fkey";

alter table "public"."student_assignments" add constraint "chk_grade_percentage_range" CHECK (((grade_percentage IS NULL) OR ((grade_percentage >= (0)::numeric) AND (grade_percentage <= (100)::numeric)))) not valid;

alter table "public"."student_assignments" validate constraint "chk_grade_percentage_range";

alter table "public"."student_assignments" add constraint "chk_status_dates" CHECK ((((status <> 'submitted'::text) OR (completed_date IS NOT NULL)) AND ((status <> 'graded'::text) OR (graded_date IS NOT NULL)))) not valid;

alter table "public"."student_assignments" validate constraint "chk_status_dates";

alter table "public"."student_assignments" add constraint "fk_student_assignment_assignment" FOREIGN KEY (assignment_id) REFERENCES public.assignments(assignment_id) ON DELETE CASCADE not valid;

alter table "public"."student_assignments" validate constraint "fk_student_assignment_assignment";

alter table "public"."student_assignments" add constraint "fk_student_assignment_student" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."student_assignments" validate constraint "fk_student_assignment_student";

alter table "public"."student_assignments" add constraint "student_assignments_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."student_assignments" validate constraint "student_assignments_priority_check";

alter table "public"."student_assignments" add constraint "student_assignments_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'in-progress'::text, 'submitted'::text, 'graded'::text]))) not valid;

alter table "public"."student_assignments" validate constraint "student_assignments_status_check";

alter table "public"."student_assignments" add constraint "student_assignments_submission_type_check" CHECK ((submission_type = ANY (ARRAY['file'::text, 'text'::text, 'url'::text, 'code'::text, 'other'::text]))) not valid;

alter table "public"."student_assignments" validate constraint "student_assignments_submission_type_check";

alter table "public"."student_assignments" add constraint "uq_student_assignment" UNIQUE using index "uq_student_assignment";

alter table "public"."students" add constraint "students_email_key" UNIQUE using index "students_email_key";

alter table "public"."students" add constraint "students_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."students" validate constraint "students_id_fkey";

alter table "public"."students" add constraint "students_universityid_fkey" FOREIGN KEY ("universityId") REFERENCES public.universities(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."students" validate constraint "students_universityid_fkey";

alter table "public"."students" add constraint "students_userid_key" UNIQUE using index "students_userid_key";

alter table "public"."trainings" add constraint "trainings_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."trainings" validate constraint "trainings_student_id_fkey";

alter table "public"."universities" add constraint "universities_code_key" UNIQUE using index "universities_code_key";

alter table "public"."university_courses" add constraint "university_courses_college_name_year_unique" UNIQUE using index "university_courses_college_name_year_unique";

alter table "public"."university_lecturer_course_assignments" add constraint "university_lecturer_course_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public.users(id) not valid;

alter table "public"."university_lecturer_course_assignments" validate constraint "university_lecturer_course_assignments_assignedBy_fkey";

alter table "public"."university_lecturer_course_assignments" add constraint "university_lecturer_course_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public.university_courses(id) ON DELETE CASCADE not valid;

alter table "public"."university_lecturer_course_assignments" validate constraint "university_lecturer_course_assignments_courseId_fkey";

alter table "public"."university_lecturer_course_assignments" add constraint "university_lecturer_course_assignments_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES public.university_lecturers(id) ON DELETE CASCADE not valid;

alter table "public"."university_lecturer_course_assignments" validate constraint "university_lecturer_course_assignments_lecturerId_fkey";

alter table "public"."university_lecturer_course_assignments" add constraint "university_lecturer_course_assignments_unique" UNIQUE using index "university_lecturer_course_assignments_unique";

alter table "public"."university_lecturers" add constraint "university_lecturers_college_employee_unique" UNIQUE using index "university_lecturers_college_employee_unique";

alter table "public"."university_lecturers" add constraint "university_lecturers_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."university_lecturers" validate constraint "university_lecturers_userId_fkey";

alter table "public"."university_lecturers" add constraint "university_lecturers_userId_key" UNIQUE using index "university_lecturers_userId_key";

alter table "public"."university_performance" add constraint "university_performance_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES public.universities(id) not valid;

alter table "public"."university_performance" validate constraint "university_performance_universityId_fkey";

alter table "public"."users" add constraint "fk_users_created_by" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."users" validate constraint "fk_users_created_by";

alter table "public"."users" add constraint "users_created_by_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) not valid;

alter table "public"."users" validate constraint "users_created_by_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_role_check" CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))) not valid;

alter table "public"."users" validate constraint "users_role_check";

alter table "public"."users" add constraint "users_supabaseAuthId_key" UNIQUE using index "users_supabaseAuthId_key";

alter table "public"."verifications" add constraint "verifications_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES public.skill_passports(id) ON DELETE CASCADE not valid;

alter table "public"."verifications" validate constraint "verifications_passportId_fkey";

alter table "public"."verifications" add constraint "verifications_performedby_fkey" FOREIGN KEY ("performedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."verifications" validate constraint "verifications_performedby_fkey";

alter table "public"."verifications" add constraint "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."verifications" validate constraint "verifications_userId_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_achievement_update(p_student_id uuid, p_achievement text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM add_recent_update(
    p_student_id,
    p_achievement,
    'achievement'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_column_if_not_exists(p_table_name text, p_column_name text, p_column_definition text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = p_column_name
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', 
            p_table_name, p_column_name, p_column_definition);
        RAISE NOTICE 'Added column %.%', p_table_name, p_column_name;
    ELSE
        RAISE NOTICE 'Column %.% already exists, skipping', p_table_name, p_column_name;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_constraint_if_not_exists(p_table_name text, p_constraint_name text, p_constraint_definition text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = p_table_name 
        AND constraint_name = p_constraint_name
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', 
            p_table_name, p_constraint_name, p_constraint_definition);
        RAISE NOTICE 'Added constraint % to %', p_constraint_name, p_table_name;
    ELSE
        RAISE NOTICE 'Constraint % already exists on %, skipping', p_constraint_name, p_table_name;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_jsonb_recent_update(student_email text, update_title text, update_type text DEFAULT 'system'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  student_uuid UUID;
  update_json JSONB;
BEGIN
  -- 1️⃣ Get the student_id dynamically
  SELECT id INTO student_uuid
  FROM public.students
  WHERE profile->>'email' = student_email;

  IF student_uuid IS NULL THEN
    RAISE EXCEPTION 'No student found with email: %', student_email;
  END IF;

  -- 2️⃣ Create new update object
  update_json := jsonb_build_object(
    'title', update_title,
    'type', update_type,
    'created_at', NOW()
  );

  -- 3️⃣ Insert or update JSONB array
  INSERT INTO public.recent_updates (student_id, updates)
  VALUES (student_uuid, jsonb_build_object('updates', jsonb_build_array(update_json)))
  ON CONFLICT (student_id)
  DO UPDATE
  SET updates = jsonb_set(
    recent_updates.updates,
    '{updates}',
    (recent_updates.updates->'updates') || jsonb_build_array(update_json)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_jsonb_recent_update(student_uuid uuid, update_title text, update_description text DEFAULT NULL::text, update_type text DEFAULT 'system'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  update_json JSONB;
BEGIN
  -- Build JSON for the new update
  update_json := jsonb_build_object(
    'title', update_title,
    'description', update_description,
    'type', update_type,
    'created_at', now()
  );

  -- Insert or update dynamically
  INSERT INTO public.recent_updates (student_id, updates)
  VALUES (
    student_uuid,
    jsonb_build_object('updates', jsonb_build_array(update_json))
  )
  ON CONFLICT (student_id)
  DO UPDATE
  SET updates = jsonb_set(
    COALESCE(recent_updates.updates, '{"updates":[]}'::jsonb),
    '{updates}',
    (COALESCE(recent_updates.updates->'updates', '[]'::jsonb) || jsonb_build_array(update_json))
  ),
  created_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_opportunity_match_update(p_student_id uuid, p_opportunity_title text, p_company_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM add_recent_update(
    p_student_id,
    'New opportunity match: ' || p_opportunity_title || ' at ' || p_company_name,
    'opportunity_match'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_recent_update(p_student_id uuid, p_message text, p_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_new_update jsonb;
  v_current_updates jsonb;
  v_updates_array jsonb;
BEGIN
  v_new_update := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'message', p_message,
    'timestamp', 'Just now',
    'type', p_type,
    'created_at', now()
  );

  SELECT updates INTO v_current_updates
  FROM public.recent_updates
  WHERE student_id = p_student_id;

  IF v_current_updates IS NULL THEN
    v_updates_array := jsonb_build_array();
  ELSIF v_current_updates ? 'updates' THEN
    v_updates_array := v_current_updates->'updates';
  ELSE
    v_updates_array := jsonb_build_array();
  END IF;

  v_updates_array := jsonb_build_array(v_new_update) || v_updates_array;

  IF jsonb_array_length(v_updates_array) > 20 THEN
    v_updates_array := v_updates_array #> ARRAY['0:19'];
  END IF;

  INSERT INTO public.recent_updates (student_id, updates, updated_at)
  VALUES (
    p_student_id,
    jsonb_build_object('updates', v_updates_array),
    now()
  )
  ON CONFLICT (student_id) 
  DO UPDATE SET
    updates = jsonb_build_object('updates', v_updates_array),
    updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_recent_update(student_email text, update_title text, update_description text DEFAULT NULL::text, update_type text DEFAULT 'system'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    student_uuid UUID;
BEGIN
    -- 1️⃣ Get student_id dynamically using email inside JSONB "profile"
    SELECT id INTO student_uuid
    FROM public.students
    WHERE profile->>'email' = student_email;

    -- 2️⃣ Handle missing student
    IF student_uuid IS NULL THEN
        RAISE EXCEPTION '❌ No student found with email: %', student_email;
    END IF;

    -- 3️⃣ Insert recent update
    INSERT INTO public.recent_updates (student_id, title, description, type)
    VALUES (student_uuid, update_title, update_description, update_type);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_recent_update_by_email(student_email text, update_title text, update_description text DEFAULT NULL::text, update_type text DEFAULT 'system'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  student_uuid UUID;
  update_json JSONB;
BEGIN
  -- Find student_id from students.profile->>'email'
  SELECT id INTO student_uuid
  FROM public.students
  WHERE profile->>'email' = student_email
  LIMIT 1;

  -- If no student found, exit
  IF student_uuid IS NULL THEN
    RAISE NOTICE 'No student found with email: %', student_email;
    RETURN;
  END IF;

  -- Build the update JSON object
  update_json := jsonb_build_object(
    'title', update_title,
    'description', update_description,
    'type', update_type,
    'created_at', now()
  );

  -- Insert or update dynamically (upsert)
  INSERT INTO public.recent_updates (student_id, updates)
  VALUES (
    student_uuid,
    jsonb_build_object('updates', jsonb_build_array(update_json))
  )
  ON CONFLICT (student_id)
  DO UPDATE
  SET updates = jsonb_set(
        COALESCE(recent_updates.updates, '{"updates":[]}'::jsonb),
        '{updates}',
        (COALESCE(recent_updates.updates->'updates', '[]'::jsonb) || jsonb_build_array(update_json))
      ),
      created_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_to_profile_array(p_student_id uuid, p_array_name text, p_new_item jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_profile JSONB;
  v_array JSONB;
  v_new_id INTEGER;
BEGIN
  -- Get current profile
  SELECT profile INTO v_profile
  FROM students
  WHERE id = p_student_id;
  
  -- Get current array or initialize empty
  v_array := COALESCE(v_profile -> p_array_name, '[]'::jsonb);
  
  -- Generate new ID
  v_new_id := COALESCE(
    (SELECT MAX((elem->>'id')::int) FROM jsonb_array_elements(v_array) elem),
    0
  ) + 1;
  
  -- Add id to new item
  p_new_item := jsonb_set(p_new_item, '{id}', to_jsonb(v_new_id));
  
  -- Append to array
  v_array := v_array || p_new_item;
  
  -- Update profile
  v_profile := jsonb_set(v_profile, ARRAY[p_array_name], v_array);
  
  -- Save and return
  UPDATE students SET profile = v_profile WHERE id = p_student_id;
  
  RETURN v_profile;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.analyze_skills_demand()
 RETURNS TABLE(skill text, total_mentions bigint)
 LANGUAGE sql
 STABLE
AS $function$

/* 1. exhaustive keyword list */
WITH wanted(skill) AS (
  VALUES
    ('html'),('css'),('sass'),('scss'),('tailwind'),('bootstrap'),
    ('javascript'),('js'),('typescript'),('ts'),
    ('react'),('reactjs'),('react.js'),('nextjs'),('next.js'),('gatsby'),
    ('angular'),('vue'),('vuejs'),('vue.js'),('svelte'),
    ('nodejs'),('node'),('express'),('nest'),
    ('python'),('swift'),
    ('django'),('flask'),('fastapi'),
    ('c'),('c++'),('csharp'),('c#'),('.net'),
    ('java'),('spring'),('kotlin'),('scala'),
    ('php'),('laravel'),('symfony'),
    ('ruby'),('rails'),('go'),('golang'),
    ('rust'),('dart'),('flutter'),
    ('sql'),('mysql'),('postgresql'),('sqlite'),
    ('mongodb'),('redis'),('elasticsearch'),
    ('docker'),('kubernetes'),('k8s'),
    ('aws'),('azure'),('gcp'),('googlecloud'),
    ('github'),('gitlab'),('bitbucket'),('git'),
    ('jenkins'),('githubactions'),('gitlabci'),('circleci'),('cicd'),('ci/cd'),
    ('rest'),('restful'),('graphql'),('grpc'),
    ('jest'),('mocha'),('jasmine'),('cypress'),('selenium'),
    ('webpack'),('vite'),('parcel'),('babel'),('eslint'),('prettier'),
    ('npm'),('yarn'),('pnpm'),
    ('microservices'),('serverless'),('lambda'),
    ('oauth'),('jwt'),('auth'),
    ('figma'),('sketch'),('adobe'),
    ('framer'),('framer motion'),('framermotion'),
    ('responsive'),('mobilefirst'),('crossbrowser'),
    ('agile'),('scrum'),('kanban')
),

/* 2. explode responsibilities -> one text row per array element */
raw_lines AS (
  SELECT  
    o.id,
    lower(regexp_replace(jsonb_array_elements_text(o.requirements), '[^\w+#/]',' ','g')) AS line
  FROM opportunities o
  WHERE o.requirements IS NOT NULL
),

/* 3. count occurrences per line */
per_line AS (
  SELECT 
    w.skill,
    r.id,
    /* use simple regex for short keywords that may terminate a line */
    CASE
      WHEN w.skill IN ('python','swift','c','go','c#') THEN
        CASE 
          WHEN r.line ~* ('(^|[^a-z0-9+#])'||regexp_replace(w.skill,'([\\.+*?^$()|[\]{}])','\\\1','g')||'($|[^a-z0-9+#])')
          THEN 1 
          ELSE 0 
        END
      ELSE  -- keep word-boundary for the rest
        CASE 
          WHEN r.line ~* ('\m'||regexp_replace(w.skill,'([\\.+*?^$()|[\]{}])','\\\1','g')||'\M')
          THEN 1 
          ELSE 0 
        END
    END AS hit
  FROM wanted w
  CROSS JOIN raw_lines r
)

/* 4. final tally */
SELECT 
  per_line.skill::TEXT,
  sum(per_line.hit) AS total_mentions
FROM per_line
WHERE per_line.hit = 1
GROUP BY per_line.skill
ORDER BY total_mentions DESC
LIMIT 5;

$function$
;

CREATE OR REPLACE FUNCTION public.apply_to_job(p_student_id uuid, p_opportunity_id integer)
 RETURNS TABLE(success boolean, message text, application_id integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_application_id INTEGER;
  v_already_applied BOOLEAN;
  v_opportunity_active BOOLEAN;
BEGIN
  -- Check if opportunity exists and is active
  SELECT is_active INTO v_opportunity_active
  FROM public.opportunities
  WHERE id = p_opportunity_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Opportunity not found', NULL::INTEGER;
    RETURN;
  END IF;
  
  IF NOT v_opportunity_active THEN
    RETURN QUERY SELECT FALSE, 'This opportunity is no longer active', NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Check if already applied
  SELECT EXISTS (
    SELECT 1 
    FROM public.applied_jobs 
    WHERE student_id = p_student_id 
      AND opportunity_id = p_opportunity_id
  ) INTO v_already_applied;
  
  IF v_already_applied THEN
    RETURN QUERY SELECT FALSE, 'You have already applied to this job', NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Insert application
  INSERT INTO public.applied_jobs (
    student_id,
    opportunity_id
  )
  VALUES (
    p_student_id,
    p_opportunity_id
  )
  RETURNING id INTO v_application_id;
  
  RETURN QUERY SELECT TRUE, 'Application submitted successfully', v_application_id;
END;
$function$
;

create or replace view "public"."conversations_detailed" as  SELECT c.id,
    c.student_id,
    c.recruiter_id,
    c.application_id,
    c.opportunity_id,
    c.subject,
    c.status,
    c.last_message_at,
    c.last_message_preview,
    c.last_message_sender,
    c.student_unread_count,
    c.recruiter_unread_count,
    c.created_at,
    c.updated_at,
    (s.profile ->> 'name'::text) AS student_name,
    s.email AS student_email,
    (s.profile ->> 'university'::text) AS student_university,
    (s.profile ->> 'course'::text) AS student_course,
    (s.profile ->> 'branch_field'::text) AS student_department,
    r.name AS recruiter_name,
    r.email AS recruiter_email,
    r.phone AS recruiter_phone,
    r.website AS recruiter_website,
    aj.application_status,
    o.job_title,
    o.company_name
   FROM ((((public.conversations c
     LEFT JOIN public.students s ON ((c.student_id = s.id)))
     LEFT JOIN public.recruiters r ON ((c.recruiter_id = r.id)))
     LEFT JOIN public.applied_jobs aj ON ((c.application_id = aj.id)))
     LEFT JOIN public.opportunities o ON ((c.opportunity_id = o.id)))
  WHERE (c.status = 'active'::text);


CREATE OR REPLACE FUNCTION public.create_index_if_not_exists(p_index_name text, p_table_name text, p_definition text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = p_index_name
    ) THEN
        EXECUTE format('CREATE INDEX %I ON %I %s', 
            p_index_name, p_table_name, p_definition);
        RAISE NOTICE 'Created index %', p_index_name;
    ELSE
        RAISE NOTICE 'Index % already exists, skipping', p_index_name;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_applications_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.opportunities
  SET applications_count = GREATEST(applications_count - 1, 0)
  WHERE id = OLD.opportunity_id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_from_profile_array(p_student_id uuid, p_array_name text, p_item_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_profile JSONB;
  v_array JSONB;
  v_new_array JSONB := '[]'::jsonb;
  v_item JSONB;
BEGIN
  -- Get current profile
  SELECT profile INTO v_profile
  FROM students
  WHERE id = p_student_id;
  
  -- Get array
  v_array := v_profile -> p_array_name;
  
  -- Filter out matching item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_array)
  LOOP
    IF (v_item->>'id')::int != p_item_id THEN
      v_new_array := v_new_array || v_item;
    END IF;
  END LOOP;
  
  -- Update profile
  v_profile := jsonb_set(v_profile, ARRAY[p_array_name], v_new_array);
  
  -- Save and return
  UPDATE students SET profile = v_profile WHERE id = p_student_id;
  
  RETURN v_profile;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."getActiveEnrollment"("p_studentId" uuid)
 RETURNS TABLE("enrollmentId" uuid, "entityType" text, "entityName" text, "className" text, "enrollmentDate" date, "expectedGraduationDate" date)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        se."id" as "enrollmentId",
        CASE 
            WHEN se."schoolId" IS NOT NULL THEN 'school'
            WHEN se."collegeId" IS NOT NULL THEN 'college'
            WHEN se."universityId" IS NOT NULL THEN 'university'
        END as "entityType",
        COALESCE(s."name", c."name", u."name") as "entityName",
        COALESCE(sc."name", cc."name", uc."name") as "className",
        se."enrollmentDate",
        se."expectedGraduationDate"
    FROM "studentEnrollments" se
    LEFT JOIN "schools" s ON se."schoolId" = s."id"
    LEFT JOIN "colleges" c ON se."collegeId" = c."id"
    LEFT JOIN "universities" u ON se."universityId" = u."id"
    LEFT JOIN "school_classes" sc ON se."schoolClassId" = sc."id"
    LEFT JOIN "college_courses" cc ON se."collegeCourseId" = cc."id"
    LEFT JOIN "university_courses" uc ON se."universityCourseId" = uc."id"
    WHERE se."studentId" = "p_studentId"
    AND se."enrollmentStatus" = 'active'
    ORDER BY se."enrollmentDate" DESC
    LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_popular_opportunities(student_id_param uuid, limit_count integer)
 RETURNS TABLE(id uuid, title text, job_title text, company_name text, company_logo text, description text, location text, employment_type text, department text, salary_min numeric, salary_max numeric, experience_level text, skills_required jsonb, requirements jsonb, responsibilities jsonb, created_at timestamp with time zone, view_count integer, application_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.title,
    o.job_title,
    o.company_name,
    o.company_logo,
    o.description,
    o.location,
    o.employment_type,
    o.department,
    o.salary_range_min,
    o.salary_range_max,
    o.experience_level,
    o.skills_required,
    o.requirements,
    o.responsibilities,
    o.created_at,
    o.views_count,
    o.applications_count
  FROM opportunities o
  WHERE o.is_active = true
    AND o.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM opportunity_interactions oi
      WHERE oi.student_id = student_id_param
        AND oi.opportunity_id = o.id
        AND oi.action IN ('apply', 'dismiss')
    )
  ORDER BY 
    o.views_count DESC NULLS LAST,
    o.applications_count DESC NULLS LAST,
    o.created_at DESC
  LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_unread_count(user_id text, user_type text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM messages
  WHERE receiver_id = user_id
    AND receiver_type = user_type
    AND is_read = false;
  
  RETURN COALESCE(unread_count, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.students (user_id, email, profile)
  VALUES (
    NEW.id,
    NEW.email,
    jsonb_build_object(
      'name', COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      'email', NEW.email,
      'createdAt', now()
    )
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- If student already exists, just return NEW
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_applications_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.opportunities
  SET applications_count = applications_count + 1
  WHERE id = NEW.opportunity_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_search_usage(search_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE recruiter_saved_searches
  SET 
    use_count = use_count + 1,
    last_used = NOW()
  WHERE id = search_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(p_conversation_id text, p_user_id text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE messages
  SET 
    is_read = true,
    read_at = NOW(),
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND receiver_id = p_user_id
    AND is_read = false;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_opportunities(query_embedding public.vector, student_id_param uuid, dismissed_ids uuid[], match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, title text, job_title text, company_name text, company_logo text, description text, location text, employment_type text, department text, salary_min numeric, salary_max numeric, experience_level text, skills_required jsonb, requirements jsonb, responsibilities jsonb, created_at timestamp with time zone, similarity double precision, view_count integer, application_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.title,
    o.job_title,
    o.company_name,
    o.company_logo,
    o.description,
    o.location,
    o.employment_type,
    o.department,
    o.salary_range_min,
    o.salary_range_max,
    o.experience_level,
    o.skills_required,
    o.requirements,
    o.responsibilities,
    o.created_at,
    (1 - (o.embedding <=> query_embedding))::FLOAT,
    o.views_count,
    o.applications_count
  FROM opportunities o
  WHERE o.embedding IS NOT NULL
    AND o.is_active = true
    AND o.status = 'published'
    AND NOT (o.id = ANY(dismissed_ids))
    AND (1 - (o.embedding <=> query_embedding)) >= match_threshold
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_students_new_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_student_record RECORD;
  v_opportunity_title text;
  v_company_name text;
  v_employment_type text;
  v_message text;
BEGIN
  -- Get opportunity details from NEW record
  v_opportunity_title := COALESCE(NEW.title, 'Untitled Opportunity');
  v_company_name := COALESCE(NEW.company_name, 'Company');
  v_employment_type := COALESCE(NEW.employment_type, 'Position');

  -- Build notification message
  v_message := 'New ' || v_employment_type || ' opportunity: ' || v_opportunity_title || ' at ' || v_company_name;

  -- Loop through all students and add a recent update for each
  FOR v_student_record IN 
    SELECT id FROM public.students WHERE id IS NOT NULL
  LOOP
    -- Add recent update for this student
    PERFORM add_recent_update(
      v_student_record.id,
      v_message,
      'new_opportunity'
    );
  END LOOP;

  -- Log the notification
  RAISE NOTICE 'Notified all students about new opportunity: %', v_opportunity_title;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error notifying students about opportunity: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_students_opportunity_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_student_record RECORD;
  v_opportunity_title text;
  v_company_name text;
  v_message text;
BEGIN
  -- Only notify if opportunity status changed from inactive to active
  IF (OLD.is_active IS FALSE OR OLD.is_active IS NULL) AND NEW.is_active IS TRUE THEN
    v_opportunity_title := COALESCE(NEW.title, 'Opportunity');
    v_company_name := COALESCE(NEW.company_name, 'Company');
    v_message := 'Opportunity reopened: ' || v_opportunity_title || ' at ' || v_company_name;

    -- Loop through all students
    FOR v_student_record IN 
      SELECT id FROM public.students WHERE id IS NOT NULL
    LOOP
      PERFORM add_recent_update(
        v_student_record.id,
        v_message,
        'opportunity_update'
      );
    END LOOP;

    RAISE NOTICE 'Notified all students about reopened opportunity: %', v_opportunity_title;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error notifying students about opportunity update: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

create or replace view "public"."pending_scorecards" as  SELECT i.id,
    i.student_id,
    i.candidate_name,
    i.candidate_email,
    i.candidate_phone,
    i.job_title,
    i.interviewer,
    i.interviewer_email,
    i.date,
    i.duration,
    i.status,
    i.type,
    i.meeting_type,
    i.meeting_link,
    i.meeting_notes,
    i.reminders_sent,
    i.completed_date,
    i.scorecard,
    i.created_by,
    i.created_at,
    i.updated_at,
    (s.profile ->> 'name'::text) AS student_name,
    (s.profile ->> 'department'::text) AS department
   FROM (public.interviews i
     LEFT JOIN public.students s ON ((i.student_id = s.id)))
  WHERE ((i.status = 'completed'::text) AND ((i.scorecard IS NULL) OR ((i.scorecard ->> 'overall_rating'::text) IS NULL)))
  ORDER BY i.completed_date DESC;


create or replace view "public"."pipeline_candidates_detailed" as  SELECT pc.id,
    pc.requisition_id,
    pc.student_id,
    pc.candidate_name,
    pc.candidate_email,
    pc.candidate_phone,
    pc.stage,
    pc.previous_stage,
    pc.stage_changed_at,
    pc.stage_changed_by,
    pc.status,
    pc.rejection_reason,
    pc.rejection_date,
    pc.next_action,
    pc.next_action_date,
    pc.next_action_notes,
    pc.recruiter_rating,
    pc.recruiter_notes,
    pc.assigned_to,
    pc.source,
    pc.added_by,
    pc.added_at,
    pc.created_at,
    pc.updated_at,
    (s.profile ->> 'name'::text) AS student_name,
    (s.profile ->> 'email'::text) AS student_email,
    (s.profile ->> 'phone'::text) AS student_phone,
    (s.profile ->> 'department'::text) AS student_department,
    (s.profile ->> 'university'::text) AS student_university,
    (s.profile ->> 'cgpa'::text) AS student_cgpa,
    (s.profile ->> 'employability_score'::text) AS student_employability_score,
    (s.profile ->> 'verified'::text) AS student_verified,
    r.title AS job_title,
    r.location AS job_location,
    r.status AS requisition_status
   FROM ((public.pipeline_candidates pc
     LEFT JOIN public.students s ON ((pc.student_id = s.id)))
     LEFT JOIN public.requisitions r ON ((pc.requisition_id = r.id)))
  WHERE (pc.status = 'active'::text);


create or replace view "public"."requisitions_with_pipeline_stats" as  SELECT r.id,
    r.title,
    r.department,
    r.location,
    r.job_type,
    r.openings,
    r.status,
    r.priority,
    r.description,
    r.requirements,
    r.salary_range,
    r.owner,
    r.hiring_manager,
    r.created_by,
    r.created_date,
    r.target_date,
    r.filled_date,
    r.tags,
    r.created_at,
    r.updated_at,
    count(DISTINCT pc.id) AS total_candidates,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'sourced'::text) THEN pc.id
            ELSE NULL::integer
        END) AS sourced_count,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'screened'::text) THEN pc.id
            ELSE NULL::integer
        END) AS screened_count,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'interview_1'::text) THEN pc.id
            ELSE NULL::integer
        END) AS interview_1_count,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'interview_2'::text) THEN pc.id
            ELSE NULL::integer
        END) AS interview_2_count,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'offer'::text) THEN pc.id
            ELSE NULL::integer
        END) AS offer_count,
    count(DISTINCT
        CASE
            WHEN (pc.stage = 'hired'::text) THEN pc.id
            ELSE NULL::integer
        END) AS hired_count
   FROM (public.requisitions r
     LEFT JOIN public.pipeline_candidates pc ON (((r.id = pc.requisition_id) AND (pc.status = 'active'::text))))
  GROUP BY r.id;


CREATE OR REPLACE FUNCTION public.reset_unread_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only proceed if message is being marked as read (false → true)
  IF NEW.is_read = true AND OLD.is_read = false THEN
    UPDATE conversations
    SET 
      student_unread_count = CASE 
        WHEN NEW.receiver_type = 'student' AND student_unread_count > 0 
        THEN student_unread_count - 1 
        ELSE student_unread_count 
      END,
      recruiter_unread_count = CASE 
        WHEN NEW.receiver_type = 'recruiter' AND recruiter_unread_count > 0 
        THEN recruiter_unread_count - 1 
        ELSE recruiter_unread_count 
      END,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$function$
;

create or replace view "public"."shortlists_with_counts" as  SELECT s.id,
    s.name,
    s.description,
    s.created_by,
    s.created_date,
    s.status,
    s.shared,
    s.share_link,
    s.share_expiry,
    s.watermark,
    s.include_pii,
    s.notify_on_access,
    s.tags,
    s.updated_at,
    COALESCE(count(sc.id), (0)::bigint) AS candidate_count
   FROM (public.shortlists s
     LEFT JOIN public.shortlist_candidates sc ON ((s.id = sc.shortlist_id)))
  GROUP BY s.id;


CREATE OR REPLACE FUNCTION public.toggle_save_job(p_student_id uuid, p_opportunity_id integer)
 RETURNS TABLE(success boolean, message text, is_saved boolean, saved_job_id integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_saved_job_id INTEGER;
  v_is_saved BOOLEAN;
BEGIN
  -- Check if already saved
  SELECT id INTO v_saved_job_id
  FROM public.saved_jobs
  WHERE student_id = p_student_id 
    AND opportunity_id = p_opportunity_id;
  
  IF FOUND THEN
    -- Already saved, so unsave it
    DELETE FROM public.saved_jobs
    WHERE id = v_saved_job_id;
    
    RETURN QUERY SELECT TRUE, 'Job unsaved successfully', FALSE, NULL::INTEGER;
  ELSE
    -- Not saved, so save it
    INSERT INTO public.saved_jobs (
      student_id,
      opportunity_id
    )
    VALUES (
      p_student_id,
      p_opportunity_id
    )
    RETURNING id INTO v_saved_job_id;
    
    RETURN QUERY SELECT TRUE, 'Job saved successfully', TRUE, v_saved_job_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_profile_view(p_student_id uuid, p_viewer_type text DEFAULT 'anonymous'::text, p_viewer_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_recent_views int;
BEGIN
  -- Insert the view
  INSERT INTO public.profile_views (student_id, viewer_type, viewer_id)
  VALUES (p_student_id, p_viewer_type, p_viewer_id);

  -- Count views in the last 7 days
  SELECT COUNT(*) INTO v_recent_views
  FROM public.profile_views
  WHERE student_id = p_student_id
  AND viewed_at >= now() - interval '7 days';

  -- Add update every 5 views
  IF v_recent_views % 5 = 0 THEN
    PERFORM add_recent_update(
      p_student_id,
      'Your profile has been viewed ' || v_recent_views::text || ' times this week',
      'profile_view'
    );
    RAISE LOG 'Profile view milestone for student %: % views', p_student_id, v_recent_views;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."transferStudent"("p_studentId" uuid, "p_newEntityType" text, "p_newEntityId" uuid, "p_newClassId" uuid, "p_transferReason" text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_oldEnrollmentId UUID;
    v_newEnrollmentId UUID;
BEGIN
    -- Mark current enrollment as transferred
    UPDATE "studentEnrollments"
    SET "enrollmentStatus" = 'transferred',
        "transferDate" = CURRENT_DATE,
        "transferReason" = "p_transferReason",
        "transferToEntityId" = "p_newEntityId",
        "transferToClassId" = "p_newClassId",
        "updatedAt" = NOW()
    WHERE "studentId" = "p_studentId"
    AND "enrollmentStatus" = 'active'
    RETURNING "id" INTO v_oldEnrollmentId;
    
    -- Create new enrollment
    INSERT INTO "studentEnrollments" (
        "studentId", "schoolId", "collegeId",
        "universityId", "schoolClassId", "collegeCourseId", 
        "universityCourseId", "enrollmentDate", "enrollmentStatus"
    )
    VALUES (
        "p_studentId",
        CASE WHEN "p_newEntityType" = 'school' THEN "p_newEntityId" ELSE NULL END,
        CASE WHEN "p_newEntityType" = 'college' THEN "p_newEntityId" ELSE NULL END,
        CASE WHEN "p_newEntityType" = 'university' THEN "p_newEntityId" ELSE NULL END,
        CASE WHEN "p_newEntityType" = 'school' THEN "p_newClassId" ELSE NULL END,
        CASE WHEN "p_newEntityType" = 'college' THEN "p_newClassId" ELSE NULL END,
        CASE WHEN "p_newEntityType" = 'university' THEN "p_newClassId" ELSE NULL END,
        CURRENT_DATE,
        'active'
    )
    RETURNING "id" INTO v_newEnrollmentId;
    
    RETURN v_newEnrollmentId;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_assignments_completion_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        IF NEW.submission_date IS NULL THEN
            NEW.submission_date := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_assignments_grade_pct_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.grade_received IS NOT NULL AND NEW.total_points IS NOT NULL AND NEW.total_points > 0 THEN
        NEW.grade_percentage := ROUND((NEW.grade_received / NEW.total_points) * 100, 2);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_assignments_updated_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_date := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_insert_recent_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only insert when training is marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.recent_updates (student_id, title, description, type)
    VALUES (
      NEW.student_id,
      CONCAT('You completed ', NEW.course, '.'),
      NEW.description,
      'achievement'
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_student_assignments_grade_pct_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_points numeric(7,2);
BEGIN
    -- Get total points from the assignment
    SELECT total_points INTO v_total_points
    FROM assignments
    WHERE assignment_id = NEW.assignment_id;
    
    IF NEW.grade_received IS NOT NULL AND v_total_points IS NOT NULL AND v_total_points > 0 THEN
        NEW.grade_percentage := ROUND((NEW.grade_received / v_total_points) * 100, 2);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_student_assignments_late_check_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_due_date timestamptz;
BEGIN
    -- Only check if submission_date is being set
    IF NEW.submission_date IS NOT NULL THEN
        -- Get due date from assignment
        SELECT a.due_date INTO v_due_date
        FROM assignments a
        WHERE a.assignment_id = NEW.assignment_id;
        
        -- Mark as late if submitted after due date
        IF NEW.submission_date > v_due_date THEN
            NEW.is_late := true;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_student_assignments_status_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Set started_date when status changes to in-progress
    IF NEW.status = 'in-progress' AND (OLD.status IS NULL OR OLD.status = 'todo') THEN
        IF NEW.started_date IS NULL THEN
            NEW.started_date := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    -- Set completed_date when status changes to submitted
    IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
        IF NEW.completed_date IS NULL THEN
            NEW.completed_date := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_student_assignments_updated_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_date := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_changes text;
BEGIN
  v_changes := '';
  
  IF OLD.profile->>'name' != NEW.profile->>'name' THEN
    v_changes := 'Profile information updated';
  ELSIF OLD.profile->'education' != NEW.profile->'education' THEN
    v_changes := 'Education details updated';
  ELSIF OLD.profile->'experience' != NEW.profile->'experience' THEN
    v_changes := 'Experience information updated';
  ELSIF OLD.profile->'technicalSkills' != NEW.profile->'technicalSkills' THEN
    v_changes := 'Technical skills updated';
  ELSIF OLD.profile->'softSkills' != NEW.profile->'softSkills' THEN
    v_changes := 'Soft skills updated';
  ELSE
    v_changes := 'Profile updated';
  END IF;

  PERFORM add_recent_update(
    NEW.id,
    v_changes,
    'profile_update'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_skills_improvement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_old_tech_skills jsonb;
  v_new_tech_skills jsonb;
  v_skill_count_old int;
  v_skill_count_new int;
BEGIN
  v_old_tech_skills := OLD.profile->'technicalSkills';
  v_new_tech_skills := NEW.profile->'technicalSkills';

  v_skill_count_old := COALESCE(jsonb_array_length(v_old_tech_skills), 0);
  v_skill_count_new := COALESCE(jsonb_array_length(v_new_tech_skills), 0);

  IF v_skill_count_new > v_skill_count_old THEN
    PERFORM add_recent_update(
      NEW.id,
      'You added ' || (v_skill_count_new - v_skill_count_old)::text || ' new skill(s)',
      'skill_improvement'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_training_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_old_training jsonb;
  v_new_training jsonb;
  v_training_item jsonb;
  v_course_name text;
BEGIN
  v_old_training := OLD.profile->'training';
  v_new_training := NEW.profile->'training';

  IF v_old_training IS NOT NULL AND v_new_training IS NOT NULL THEN
    FOR v_training_item IN SELECT * FROM jsonb_array_elements(v_new_training)
    LOOP
      v_course_name := v_training_item->>'course';
      
      IF v_training_item->>'status' = 'completed' THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_old_training) old_item
          WHERE old_item->>'id' = v_training_item->>'id'
          AND old_item->>'status' = 'completed'
        ) THEN
          PERFORM add_recent_update(
            NEW.id,
            'You completed ' || v_course_name || ' course',
            'course_completion'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;

create or replace view "public"."unread_messages_summary" as  SELECT receiver_id,
    receiver_type,
    count(*) AS unread_count,
    max(created_at) AS latest_unread_at
   FROM public.messages
  WHERE (is_read = false)
  GROUP BY receiver_id, receiver_type;


create or replace view "public"."upcoming_interviews" as  SELECT i.id,
    i.student_id,
    i.candidate_name,
    i.candidate_email,
    i.candidate_phone,
    i.job_title,
    i.interviewer,
    i.interviewer_email,
    i.date,
    i.duration,
    i.status,
    i.type,
    i.meeting_type,
    i.meeting_link,
    i.meeting_notes,
    i.reminders_sent,
    i.completed_date,
    i.scorecard,
    i.created_by,
    i.created_at,
    i.updated_at,
    (s.profile ->> 'name'::text) AS student_name,
    (s.profile ->> 'email'::text) AS student_email,
    (s.profile ->> 'phone'::text) AS student_phone,
    (s.profile ->> 'department'::text) AS department,
    (s.profile ->> 'university'::text) AS university
   FROM (public.interviews i
     LEFT JOIN public.students s ON ((i.student_id = s.id)))
  WHERE ((i.date > now()) AND (i.status <> ALL (ARRAY['completed'::text, 'cancelled'::text])))
  ORDER BY i.date;


CREATE OR REPLACE FUNCTION public."updateEntityStudentCounts"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update school counts
    IF NEW."schoolId" IS NOT NULL THEN
        UPDATE "schools" SET "totalStudents" = (
            SELECT COUNT(DISTINCT "studentId") FROM "studentEnrollments" 
            WHERE "schoolId" = NEW."schoolId" AND "enrollmentStatus" = 'active'
        )
        WHERE "id" = NEW."schoolId";
    END IF;
    
    -- Update college counts
    IF NEW."collegeId" IS NOT NULL THEN
        UPDATE "colleges" SET "totalStudents" = (
            SELECT COUNT(DISTINCT "studentId") FROM "studentEnrollments" 
            WHERE "collegeId" = NEW."collegeId" AND "enrollmentStatus" = 'active'
        )
        WHERE "id" = NEW."collegeId";
    END IF;
    
    -- Update university counts
    IF NEW."universityId" IS NOT NULL THEN
        UPDATE "universities" SET "totalStudents" = (
            SELECT COUNT(DISTINCT "studentId") FROM "studentEnrollments" 
            WHERE "universityId" = NEW."universityId" AND "enrollmentStatus" = 'active'
        )
        WHERE "id" = NEW."universityId";
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_applied_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.message_text, 100),
    last_message_sender = NEW.sender_type,
    
    -- Increment unread count for receiver
    student_unread_count = CASE 
      WHEN NEW.receiver_type = 'student' THEN student_unread_count + 1 
      ELSE student_unread_count 
    END,
    recruiter_unread_count = CASE 
      WHEN NEW.receiver_type = 'recruiter' THEN recruiter_unread_count + 1 
      ELSE recruiter_unread_count 
    END,
    
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_profile_array_item(p_student_id uuid, p_array_name text, p_item_id integer, p_updates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_profile JSONB;
  v_array JSONB;
  v_new_array JSONB := '[]'::jsonb;
  v_item JSONB;
BEGIN
  -- Get current profile
  SELECT profile INTO v_profile
  FROM students
  WHERE id = p_student_id;
  
  -- Get array
  v_array := v_profile -> p_array_name;
  
  -- Update matching item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_array)
  LOOP
    IF (v_item->>'id')::int = p_item_id THEN
      v_item := v_item || p_updates;
    END IF;
    v_new_array := v_new_array || v_item;
  END LOOP;
  
  -- Update profile
  v_profile := jsonb_set(v_profile, ARRAY[p_array_name], v_new_array);
  
  -- Save and return
  UPDATE students SET profile = v_profile WHERE id = p_student_id;
  
  RETURN v_profile;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_saved_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_students_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$function$
;

create or replace view "public"."vEntityOverview" as  SELECT 'school'::text AS "entityType",
    s.id AS "entityId",
    s.name AS "entityName",
    s.code,
    s.state,
    s."accountStatus",
    s."approvalStatus",
    s."totalStudents",
    s."totalClasses" AS "totalClassesCourses",
    s."totalEducators" AS "totalStaff",
    s."createdAt"
   FROM public.schools s
UNION ALL
 SELECT 'college'::text AS "entityType",
    c.id AS "entityId",
    c.name AS "entityName",
    c.code,
    c.state,
    c."accountStatus",
    c."approvalStatus",
    c."totalStudents",
    c."totalCourses" AS "totalClassesCourses",
    c."totalLecturers" AS "totalStaff",
    c."createdAt"
   FROM public.colleges c
UNION ALL
 SELECT 'university'::text AS "entityType",
    u.id AS "entityId",
    u.name AS "entityName",
    u.code,
    u.state,
    u."accountStatus",
    u."approvalStatus",
    u."totalStudents",
    u."totalCourses" AS "totalClassesCourses",
    u."totalLecturers" AS "totalStaff",
    u."createdAt"
   FROM public.universities u
UNION ALL
 SELECT 'company'::text AS "entityType",
    co.id AS "entityId",
    co.name AS "entityName",
    co.code,
    co."hqState" AS state,
    co."accountStatus",
    co."approvalStatus",
    0 AS "totalStudents",
    co."totalBranches" AS "totalClassesCourses",
    co."totalRecruiters" AS "totalStaff",
    co."createdAt"
   FROM public.companies co;


create or replace view "public"."vStudentCurrentEnrollment" as  SELECT s.id AS "studentId",
    s.name AS "studentName",
    s.email AS "studentEmail",
    se."enrollmentNumber",
        CASE
            WHEN (se."schoolId" IS NOT NULL) THEN 'school'::text
            WHEN (se."collegeId" IS NOT NULL) THEN 'college'::text
            WHEN (se."universityId" IS NOT NULL) THEN 'university'::text
            ELSE NULL::text
        END AS "entityType",
    COALESCE(sch.id, col.id, uni.id) AS "entityId",
    COALESCE(sch.name, col.name, (uni.name)::character varying) AS "entityName",
    COALESCE(sc.name, cc.name, uc.name) AS "className",
    se."enrollmentDate",
    se."expectedGraduationDate",
    se."enrollmentStatus"
   FROM (((((((public.students s
     LEFT JOIN public."studentEnrollments" se ON (((s.id = se."studentId") AND (se."enrollmentStatus" = 'active'::public."enrollmentStatus"))))
     LEFT JOIN public.schools sch ON ((se."schoolId" = sch.id)))
     LEFT JOIN public.colleges col ON ((se."collegeId" = col.id)))
     LEFT JOIN public.universities uni ON ((se."universityId" = uni.id)))
     LEFT JOIN public.school_classes sc ON ((se."schoolClassId" = sc.id)))
     LEFT JOIN public.college_courses cc ON ((se."collegeCourseId" = cc.id)))
     LEFT JOIN public.university_courses uc ON ((se."universityCourseId" = uc.id)));


CREATE OR REPLACE FUNCTION public."validateOneActiveEnrollment"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_activeCount INTEGER;
BEGIN
    IF NEW."enrollmentStatus" = 'active' THEN
        SELECT COUNT(*) INTO v_activeCount
        FROM "studentEnrollments"
        WHERE "studentId" = NEW."studentId"
        AND "enrollmentStatus" = 'active'
        AND "id" != COALESCE(NEW."id", '00000000-0000-0000-0000-000000000000'::UUID);
        
        IF v_activeCount > 0 THEN
            RAISE EXCEPTION 'Student can only have one active enrollment at a time';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."applied_jobs" to "anon";

grant insert on table "public"."applied_jobs" to "anon";

grant references on table "public"."applied_jobs" to "anon";

grant select on table "public"."applied_jobs" to "anon";

grant trigger on table "public"."applied_jobs" to "anon";

grant truncate on table "public"."applied_jobs" to "anon";

grant update on table "public"."applied_jobs" to "anon";

grant delete on table "public"."applied_jobs" to "authenticated";

grant insert on table "public"."applied_jobs" to "authenticated";

grant references on table "public"."applied_jobs" to "authenticated";

grant select on table "public"."applied_jobs" to "authenticated";

grant trigger on table "public"."applied_jobs" to "authenticated";

grant truncate on table "public"."applied_jobs" to "authenticated";

grant update on table "public"."applied_jobs" to "authenticated";

grant delete on table "public"."applied_jobs" to "service_role";

grant insert on table "public"."applied_jobs" to "service_role";

grant references on table "public"."applied_jobs" to "service_role";

grant select on table "public"."applied_jobs" to "service_role";

grant trigger on table "public"."applied_jobs" to "service_role";

grant truncate on table "public"."applied_jobs" to "service_role";

grant update on table "public"."applied_jobs" to "service_role";

grant delete on table "public"."assignment_attachments" to "anon";

grant insert on table "public"."assignment_attachments" to "anon";

grant references on table "public"."assignment_attachments" to "anon";

grant select on table "public"."assignment_attachments" to "anon";

grant trigger on table "public"."assignment_attachments" to "anon";

grant truncate on table "public"."assignment_attachments" to "anon";

grant update on table "public"."assignment_attachments" to "anon";

grant delete on table "public"."assignment_attachments" to "authenticated";

grant insert on table "public"."assignment_attachments" to "authenticated";

grant references on table "public"."assignment_attachments" to "authenticated";

grant select on table "public"."assignment_attachments" to "authenticated";

grant trigger on table "public"."assignment_attachments" to "authenticated";

grant truncate on table "public"."assignment_attachments" to "authenticated";

grant update on table "public"."assignment_attachments" to "authenticated";

grant delete on table "public"."assignment_attachments" to "service_role";

grant insert on table "public"."assignment_attachments" to "service_role";

grant references on table "public"."assignment_attachments" to "service_role";

grant select on table "public"."assignment_attachments" to "service_role";

grant trigger on table "public"."assignment_attachments" to "service_role";

grant truncate on table "public"."assignment_attachments" to "service_role";

grant update on table "public"."assignment_attachments" to "service_role";

grant delete on table "public"."assignments" to "anon";

grant insert on table "public"."assignments" to "anon";

grant references on table "public"."assignments" to "anon";

grant select on table "public"."assignments" to "anon";

grant trigger on table "public"."assignments" to "anon";

grant truncate on table "public"."assignments" to "anon";

grant update on table "public"."assignments" to "anon";

grant delete on table "public"."assignments" to "authenticated";

grant insert on table "public"."assignments" to "authenticated";

grant references on table "public"."assignments" to "authenticated";

grant select on table "public"."assignments" to "authenticated";

grant trigger on table "public"."assignments" to "authenticated";

grant truncate on table "public"."assignments" to "authenticated";

grant update on table "public"."assignments" to "authenticated";

grant delete on table "public"."assignments" to "service_role";

grant insert on table "public"."assignments" to "service_role";

grant references on table "public"."assignments" to "service_role";

grant select on table "public"."assignments" to "service_role";

grant trigger on table "public"."assignments" to "service_role";

grant truncate on table "public"."assignments" to "service_role";

grant update on table "public"."assignments" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."certificates" to "anon";

grant insert on table "public"."certificates" to "anon";

grant references on table "public"."certificates" to "anon";

grant select on table "public"."certificates" to "anon";

grant trigger on table "public"."certificates" to "anon";

grant truncate on table "public"."certificates" to "anon";

grant update on table "public"."certificates" to "anon";

grant delete on table "public"."certificates" to "authenticated";

grant insert on table "public"."certificates" to "authenticated";

grant references on table "public"."certificates" to "authenticated";

grant select on table "public"."certificates" to "authenticated";

grant trigger on table "public"."certificates" to "authenticated";

grant truncate on table "public"."certificates" to "authenticated";

grant update on table "public"."certificates" to "authenticated";

grant delete on table "public"."certificates" to "service_role";

grant insert on table "public"."certificates" to "service_role";

grant references on table "public"."certificates" to "service_role";

grant select on table "public"."certificates" to "service_role";

grant trigger on table "public"."certificates" to "service_role";

grant truncate on table "public"."certificates" to "service_role";

grant update on table "public"."certificates" to "service_role";

grant delete on table "public"."college_courses" to "anon";

grant insert on table "public"."college_courses" to "anon";

grant references on table "public"."college_courses" to "anon";

grant select on table "public"."college_courses" to "anon";

grant trigger on table "public"."college_courses" to "anon";

grant truncate on table "public"."college_courses" to "anon";

grant update on table "public"."college_courses" to "anon";

grant delete on table "public"."college_courses" to "authenticated";

grant insert on table "public"."college_courses" to "authenticated";

grant references on table "public"."college_courses" to "authenticated";

grant select on table "public"."college_courses" to "authenticated";

grant trigger on table "public"."college_courses" to "authenticated";

grant truncate on table "public"."college_courses" to "authenticated";

grant update on table "public"."college_courses" to "authenticated";

grant delete on table "public"."college_courses" to "service_role";

grant insert on table "public"."college_courses" to "service_role";

grant references on table "public"."college_courses" to "service_role";

grant select on table "public"."college_courses" to "service_role";

grant trigger on table "public"."college_courses" to "service_role";

grant truncate on table "public"."college_courses" to "service_role";

grant update on table "public"."college_courses" to "service_role";

grant delete on table "public"."college_lecturer_course_assignments" to "anon";

grant insert on table "public"."college_lecturer_course_assignments" to "anon";

grant references on table "public"."college_lecturer_course_assignments" to "anon";

grant select on table "public"."college_lecturer_course_assignments" to "anon";

grant trigger on table "public"."college_lecturer_course_assignments" to "anon";

grant truncate on table "public"."college_lecturer_course_assignments" to "anon";

grant update on table "public"."college_lecturer_course_assignments" to "anon";

grant delete on table "public"."college_lecturer_course_assignments" to "authenticated";

grant insert on table "public"."college_lecturer_course_assignments" to "authenticated";

grant references on table "public"."college_lecturer_course_assignments" to "authenticated";

grant select on table "public"."college_lecturer_course_assignments" to "authenticated";

grant trigger on table "public"."college_lecturer_course_assignments" to "authenticated";

grant truncate on table "public"."college_lecturer_course_assignments" to "authenticated";

grant update on table "public"."college_lecturer_course_assignments" to "authenticated";

grant delete on table "public"."college_lecturer_course_assignments" to "service_role";

grant insert on table "public"."college_lecturer_course_assignments" to "service_role";

grant references on table "public"."college_lecturer_course_assignments" to "service_role";

grant select on table "public"."college_lecturer_course_assignments" to "service_role";

grant trigger on table "public"."college_lecturer_course_assignments" to "service_role";

grant truncate on table "public"."college_lecturer_course_assignments" to "service_role";

grant update on table "public"."college_lecturer_course_assignments" to "service_role";

grant delete on table "public"."college_lecturers" to "anon";

grant insert on table "public"."college_lecturers" to "anon";

grant references on table "public"."college_lecturers" to "anon";

grant select on table "public"."college_lecturers" to "anon";

grant trigger on table "public"."college_lecturers" to "anon";

grant truncate on table "public"."college_lecturers" to "anon";

grant update on table "public"."college_lecturers" to "anon";

grant delete on table "public"."college_lecturers" to "authenticated";

grant insert on table "public"."college_lecturers" to "authenticated";

grant references on table "public"."college_lecturers" to "authenticated";

grant select on table "public"."college_lecturers" to "authenticated";

grant trigger on table "public"."college_lecturers" to "authenticated";

grant truncate on table "public"."college_lecturers" to "authenticated";

grant update on table "public"."college_lecturers" to "authenticated";

grant delete on table "public"."college_lecturers" to "service_role";

grant insert on table "public"."college_lecturers" to "service_role";

grant references on table "public"."college_lecturers" to "service_role";

grant select on table "public"."college_lecturers" to "service_role";

grant trigger on table "public"."college_lecturers" to "service_role";

grant truncate on table "public"."college_lecturers" to "service_role";

grant update on table "public"."college_lecturers" to "service_role";

grant delete on table "public"."colleges" to "anon";

grant insert on table "public"."colleges" to "anon";

grant references on table "public"."colleges" to "anon";

grant select on table "public"."colleges" to "anon";

grant trigger on table "public"."colleges" to "anon";

grant truncate on table "public"."colleges" to "anon";

grant update on table "public"."colleges" to "anon";

grant delete on table "public"."colleges" to "authenticated";

grant insert on table "public"."colleges" to "authenticated";

grant references on table "public"."colleges" to "authenticated";

grant select on table "public"."colleges" to "authenticated";

grant trigger on table "public"."colleges" to "authenticated";

grant truncate on table "public"."colleges" to "authenticated";

grant update on table "public"."colleges" to "authenticated";

grant delete on table "public"."colleges" to "service_role";

grant insert on table "public"."colleges" to "service_role";

grant references on table "public"."colleges" to "service_role";

grant select on table "public"."colleges" to "service_role";

grant trigger on table "public"."colleges" to "service_role";

grant truncate on table "public"."colleges" to "service_role";

grant update on table "public"."colleges" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."company_branches" to "anon";

grant insert on table "public"."company_branches" to "anon";

grant references on table "public"."company_branches" to "anon";

grant select on table "public"."company_branches" to "anon";

grant trigger on table "public"."company_branches" to "anon";

grant truncate on table "public"."company_branches" to "anon";

grant update on table "public"."company_branches" to "anon";

grant delete on table "public"."company_branches" to "authenticated";

grant insert on table "public"."company_branches" to "authenticated";

grant references on table "public"."company_branches" to "authenticated";

grant select on table "public"."company_branches" to "authenticated";

grant trigger on table "public"."company_branches" to "authenticated";

grant truncate on table "public"."company_branches" to "authenticated";

grant update on table "public"."company_branches" to "authenticated";

grant delete on table "public"."company_branches" to "service_role";

grant insert on table "public"."company_branches" to "service_role";

grant references on table "public"."company_branches" to "service_role";

grant select on table "public"."company_branches" to "service_role";

grant trigger on table "public"."company_branches" to "service_role";

grant truncate on table "public"."company_branches" to "service_role";

grant update on table "public"."company_branches" to "service_role";

grant delete on table "public"."conversations" to "anon";

grant insert on table "public"."conversations" to "anon";

grant references on table "public"."conversations" to "anon";

grant select on table "public"."conversations" to "anon";

grant trigger on table "public"."conversations" to "anon";

grant truncate on table "public"."conversations" to "anon";

grant update on table "public"."conversations" to "anon";

grant delete on table "public"."conversations" to "authenticated";

grant insert on table "public"."conversations" to "authenticated";

grant references on table "public"."conversations" to "authenticated";

grant select on table "public"."conversations" to "authenticated";

grant trigger on table "public"."conversations" to "authenticated";

grant truncate on table "public"."conversations" to "authenticated";

grant update on table "public"."conversations" to "authenticated";

grant delete on table "public"."conversations" to "service_role";

grant insert on table "public"."conversations" to "service_role";

grant references on table "public"."conversations" to "service_role";

grant select on table "public"."conversations" to "service_role";

grant trigger on table "public"."conversations" to "service_role";

grant truncate on table "public"."conversations" to "service_role";

grant update on table "public"."conversations" to "service_role";

grant delete on table "public"."education" to "anon";

grant insert on table "public"."education" to "anon";

grant references on table "public"."education" to "anon";

grant select on table "public"."education" to "anon";

grant trigger on table "public"."education" to "anon";

grant truncate on table "public"."education" to "anon";

grant update on table "public"."education" to "anon";

grant delete on table "public"."education" to "authenticated";

grant insert on table "public"."education" to "authenticated";

grant references on table "public"."education" to "authenticated";

grant select on table "public"."education" to "authenticated";

grant trigger on table "public"."education" to "authenticated";

grant truncate on table "public"."education" to "authenticated";

grant update on table "public"."education" to "authenticated";

grant delete on table "public"."education" to "service_role";

grant insert on table "public"."education" to "service_role";

grant references on table "public"."education" to "service_role";

grant select on table "public"."education" to "service_role";

grant trigger on table "public"."education" to "service_role";

grant truncate on table "public"."education" to "service_role";

grant update on table "public"."education" to "service_role";

grant delete on table "public"."experience" to "anon";

grant insert on table "public"."experience" to "anon";

grant references on table "public"."experience" to "anon";

grant select on table "public"."experience" to "anon";

grant trigger on table "public"."experience" to "anon";

grant truncate on table "public"."experience" to "anon";

grant update on table "public"."experience" to "anon";

grant delete on table "public"."experience" to "authenticated";

grant insert on table "public"."experience" to "authenticated";

grant references on table "public"."experience" to "authenticated";

grant select on table "public"."experience" to "authenticated";

grant trigger on table "public"."experience" to "authenticated";

grant truncate on table "public"."experience" to "authenticated";

grant update on table "public"."experience" to "authenticated";

grant delete on table "public"."experience" to "service_role";

grant insert on table "public"."experience" to "service_role";

grant references on table "public"."experience" to "service_role";

grant select on table "public"."experience" to "service_role";

grant trigger on table "public"."experience" to "service_role";

grant truncate on table "public"."experience" to "service_role";

grant update on table "public"."experience" to "service_role";

grant delete on table "public"."export_activities" to "anon";

grant insert on table "public"."export_activities" to "anon";

grant references on table "public"."export_activities" to "anon";

grant select on table "public"."export_activities" to "anon";

grant trigger on table "public"."export_activities" to "anon";

grant truncate on table "public"."export_activities" to "anon";

grant update on table "public"."export_activities" to "anon";

grant delete on table "public"."export_activities" to "authenticated";

grant insert on table "public"."export_activities" to "authenticated";

grant references on table "public"."export_activities" to "authenticated";

grant select on table "public"."export_activities" to "authenticated";

grant trigger on table "public"."export_activities" to "authenticated";

grant truncate on table "public"."export_activities" to "authenticated";

grant update on table "public"."export_activities" to "authenticated";

grant delete on table "public"."export_activities" to "service_role";

grant insert on table "public"."export_activities" to "service_role";

grant references on table "public"."export_activities" to "service_role";

grant select on table "public"."export_activities" to "service_role";

grant trigger on table "public"."export_activities" to "service_role";

grant truncate on table "public"."export_activities" to "service_role";

grant update on table "public"."export_activities" to "service_role";

grant delete on table "public"."interview_reminders" to "anon";

grant insert on table "public"."interview_reminders" to "anon";

grant references on table "public"."interview_reminders" to "anon";

grant select on table "public"."interview_reminders" to "anon";

grant trigger on table "public"."interview_reminders" to "anon";

grant truncate on table "public"."interview_reminders" to "anon";

grant update on table "public"."interview_reminders" to "anon";

grant delete on table "public"."interview_reminders" to "authenticated";

grant insert on table "public"."interview_reminders" to "authenticated";

grant references on table "public"."interview_reminders" to "authenticated";

grant select on table "public"."interview_reminders" to "authenticated";

grant trigger on table "public"."interview_reminders" to "authenticated";

grant truncate on table "public"."interview_reminders" to "authenticated";

grant update on table "public"."interview_reminders" to "authenticated";

grant delete on table "public"."interview_reminders" to "service_role";

grant insert on table "public"."interview_reminders" to "service_role";

grant references on table "public"."interview_reminders" to "service_role";

grant select on table "public"."interview_reminders" to "service_role";

grant trigger on table "public"."interview_reminders" to "service_role";

grant truncate on table "public"."interview_reminders" to "service_role";

grant update on table "public"."interview_reminders" to "service_role";

grant delete on table "public"."interviews" to "anon";

grant insert on table "public"."interviews" to "anon";

grant references on table "public"."interviews" to "anon";

grant select on table "public"."interviews" to "anon";

grant trigger on table "public"."interviews" to "anon";

grant truncate on table "public"."interviews" to "anon";

grant update on table "public"."interviews" to "anon";

grant delete on table "public"."interviews" to "authenticated";

grant insert on table "public"."interviews" to "authenticated";

grant references on table "public"."interviews" to "authenticated";

grant select on table "public"."interviews" to "authenticated";

grant trigger on table "public"."interviews" to "authenticated";

grant truncate on table "public"."interviews" to "authenticated";

grant update on table "public"."interviews" to "authenticated";

grant delete on table "public"."interviews" to "service_role";

grant insert on table "public"."interviews" to "service_role";

grant references on table "public"."interviews" to "service_role";

grant select on table "public"."interviews" to "service_role";

grant trigger on table "public"."interviews" to "service_role";

grant truncate on table "public"."interviews" to "service_role";

grant update on table "public"."interviews" to "service_role";

grant delete on table "public"."message_reactions" to "anon";

grant insert on table "public"."message_reactions" to "anon";

grant references on table "public"."message_reactions" to "anon";

grant select on table "public"."message_reactions" to "anon";

grant trigger on table "public"."message_reactions" to "anon";

grant truncate on table "public"."message_reactions" to "anon";

grant update on table "public"."message_reactions" to "anon";

grant delete on table "public"."message_reactions" to "authenticated";

grant insert on table "public"."message_reactions" to "authenticated";

grant references on table "public"."message_reactions" to "authenticated";

grant select on table "public"."message_reactions" to "authenticated";

grant trigger on table "public"."message_reactions" to "authenticated";

grant truncate on table "public"."message_reactions" to "authenticated";

grant update on table "public"."message_reactions" to "authenticated";

grant delete on table "public"."message_reactions" to "service_role";

grant insert on table "public"."message_reactions" to "service_role";

grant references on table "public"."message_reactions" to "service_role";

grant select on table "public"."message_reactions" to "service_role";

grant trigger on table "public"."message_reactions" to "service_role";

grant truncate on table "public"."message_reactions" to "service_role";

grant update on table "public"."message_reactions" to "service_role";

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant references on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant trigger on table "public"."messages" to "anon";

grant truncate on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant references on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant trigger on table "public"."messages" to "authenticated";

grant truncate on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant references on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant trigger on table "public"."messages" to "service_role";

grant truncate on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";

grant delete on table "public"."metrics_snapshots" to "anon";

grant insert on table "public"."metrics_snapshots" to "anon";

grant references on table "public"."metrics_snapshots" to "anon";

grant select on table "public"."metrics_snapshots" to "anon";

grant trigger on table "public"."metrics_snapshots" to "anon";

grant truncate on table "public"."metrics_snapshots" to "anon";

grant update on table "public"."metrics_snapshots" to "anon";

grant delete on table "public"."metrics_snapshots" to "authenticated";

grant insert on table "public"."metrics_snapshots" to "authenticated";

grant references on table "public"."metrics_snapshots" to "authenticated";

grant select on table "public"."metrics_snapshots" to "authenticated";

grant trigger on table "public"."metrics_snapshots" to "authenticated";

grant truncate on table "public"."metrics_snapshots" to "authenticated";

grant update on table "public"."metrics_snapshots" to "authenticated";

grant delete on table "public"."metrics_snapshots" to "service_role";

grant insert on table "public"."metrics_snapshots" to "service_role";

grant references on table "public"."metrics_snapshots" to "service_role";

grant select on table "public"."metrics_snapshots" to "service_role";

grant trigger on table "public"."metrics_snapshots" to "service_role";

grant truncate on table "public"."metrics_snapshots" to "service_role";

grant update on table "public"."metrics_snapshots" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."offers" to "anon";

grant insert on table "public"."offers" to "anon";

grant references on table "public"."offers" to "anon";

grant select on table "public"."offers" to "anon";

grant trigger on table "public"."offers" to "anon";

grant truncate on table "public"."offers" to "anon";

grant update on table "public"."offers" to "anon";

grant delete on table "public"."offers" to "authenticated";

grant insert on table "public"."offers" to "authenticated";

grant references on table "public"."offers" to "authenticated";

grant select on table "public"."offers" to "authenticated";

grant trigger on table "public"."offers" to "authenticated";

grant truncate on table "public"."offers" to "authenticated";

grant update on table "public"."offers" to "authenticated";

grant delete on table "public"."offers" to "service_role";

grant insert on table "public"."offers" to "service_role";

grant references on table "public"."offers" to "service_role";

grant select on table "public"."offers" to "service_role";

grant trigger on table "public"."offers" to "service_role";

grant truncate on table "public"."offers" to "service_role";

grant update on table "public"."offers" to "service_role";

grant delete on table "public"."opportunities" to "anon";

grant insert on table "public"."opportunities" to "anon";

grant references on table "public"."opportunities" to "anon";

grant select on table "public"."opportunities" to "anon";

grant trigger on table "public"."opportunities" to "anon";

grant truncate on table "public"."opportunities" to "anon";

grant update on table "public"."opportunities" to "anon";

grant delete on table "public"."opportunities" to "authenticated";

grant insert on table "public"."opportunities" to "authenticated";

grant references on table "public"."opportunities" to "authenticated";

grant select on table "public"."opportunities" to "authenticated";

grant trigger on table "public"."opportunities" to "authenticated";

grant truncate on table "public"."opportunities" to "authenticated";

grant update on table "public"."opportunities" to "authenticated";

grant delete on table "public"."opportunities" to "service_role";

grant insert on table "public"."opportunities" to "service_role";

grant references on table "public"."opportunities" to "service_role";

grant select on table "public"."opportunities" to "service_role";

grant trigger on table "public"."opportunities" to "service_role";

grant truncate on table "public"."opportunities" to "service_role";

grant update on table "public"."opportunities" to "service_role";

grant delete on table "public"."opportunity_interactions" to "anon";

grant insert on table "public"."opportunity_interactions" to "anon";

grant references on table "public"."opportunity_interactions" to "anon";

grant select on table "public"."opportunity_interactions" to "anon";

grant trigger on table "public"."opportunity_interactions" to "anon";

grant truncate on table "public"."opportunity_interactions" to "anon";

grant update on table "public"."opportunity_interactions" to "anon";

grant delete on table "public"."opportunity_interactions" to "authenticated";

grant insert on table "public"."opportunity_interactions" to "authenticated";

grant references on table "public"."opportunity_interactions" to "authenticated";

grant select on table "public"."opportunity_interactions" to "authenticated";

grant trigger on table "public"."opportunity_interactions" to "authenticated";

grant truncate on table "public"."opportunity_interactions" to "authenticated";

grant update on table "public"."opportunity_interactions" to "authenticated";

grant delete on table "public"."opportunity_interactions" to "service_role";

grant insert on table "public"."opportunity_interactions" to "service_role";

grant references on table "public"."opportunity_interactions" to "service_role";

grant select on table "public"."opportunity_interactions" to "service_role";

grant trigger on table "public"."opportunity_interactions" to "service_role";

grant truncate on table "public"."opportunity_interactions" to "service_role";

grant update on table "public"."opportunity_interactions" to "service_role";

grant delete on table "public"."permissions" to "anon";

grant insert on table "public"."permissions" to "anon";

grant references on table "public"."permissions" to "anon";

grant select on table "public"."permissions" to "anon";

grant trigger on table "public"."permissions" to "anon";

grant truncate on table "public"."permissions" to "anon";

grant update on table "public"."permissions" to "anon";

grant delete on table "public"."permissions" to "authenticated";

grant insert on table "public"."permissions" to "authenticated";

grant references on table "public"."permissions" to "authenticated";

grant select on table "public"."permissions" to "authenticated";

grant trigger on table "public"."permissions" to "authenticated";

grant truncate on table "public"."permissions" to "authenticated";

grant update on table "public"."permissions" to "authenticated";

grant delete on table "public"."permissions" to "service_role";

grant insert on table "public"."permissions" to "service_role";

grant references on table "public"."permissions" to "service_role";

grant select on table "public"."permissions" to "service_role";

grant trigger on table "public"."permissions" to "service_role";

grant truncate on table "public"."permissions" to "service_role";

grant update on table "public"."permissions" to "service_role";

grant delete on table "public"."pipeline_activities" to "anon";

grant insert on table "public"."pipeline_activities" to "anon";

grant references on table "public"."pipeline_activities" to "anon";

grant select on table "public"."pipeline_activities" to "anon";

grant trigger on table "public"."pipeline_activities" to "anon";

grant truncate on table "public"."pipeline_activities" to "anon";

grant update on table "public"."pipeline_activities" to "anon";

grant delete on table "public"."pipeline_activities" to "authenticated";

grant insert on table "public"."pipeline_activities" to "authenticated";

grant references on table "public"."pipeline_activities" to "authenticated";

grant select on table "public"."pipeline_activities" to "authenticated";

grant trigger on table "public"."pipeline_activities" to "authenticated";

grant truncate on table "public"."pipeline_activities" to "authenticated";

grant update on table "public"."pipeline_activities" to "authenticated";

grant delete on table "public"."pipeline_activities" to "service_role";

grant insert on table "public"."pipeline_activities" to "service_role";

grant references on table "public"."pipeline_activities" to "service_role";

grant select on table "public"."pipeline_activities" to "service_role";

grant trigger on table "public"."pipeline_activities" to "service_role";

grant truncate on table "public"."pipeline_activities" to "service_role";

grant update on table "public"."pipeline_activities" to "service_role";

grant delete on table "public"."pipeline_candidates" to "anon";

grant insert on table "public"."pipeline_candidates" to "anon";

grant references on table "public"."pipeline_candidates" to "anon";

grant select on table "public"."pipeline_candidates" to "anon";

grant trigger on table "public"."pipeline_candidates" to "anon";

grant truncate on table "public"."pipeline_candidates" to "anon";

grant update on table "public"."pipeline_candidates" to "anon";

grant delete on table "public"."pipeline_candidates" to "authenticated";

grant insert on table "public"."pipeline_candidates" to "authenticated";

grant references on table "public"."pipeline_candidates" to "authenticated";

grant select on table "public"."pipeline_candidates" to "authenticated";

grant trigger on table "public"."pipeline_candidates" to "authenticated";

grant truncate on table "public"."pipeline_candidates" to "authenticated";

grant update on table "public"."pipeline_candidates" to "authenticated";

grant delete on table "public"."pipeline_candidates" to "service_role";

grant insert on table "public"."pipeline_candidates" to "service_role";

grant references on table "public"."pipeline_candidates" to "service_role";

grant select on table "public"."pipeline_candidates" to "service_role";

grant trigger on table "public"."pipeline_candidates" to "service_role";

grant truncate on table "public"."pipeline_candidates" to "service_role";

grant update on table "public"."pipeline_candidates" to "service_role";

grant delete on table "public"."placements" to "anon";

grant insert on table "public"."placements" to "anon";

grant references on table "public"."placements" to "anon";

grant select on table "public"."placements" to "anon";

grant trigger on table "public"."placements" to "anon";

grant truncate on table "public"."placements" to "anon";

grant update on table "public"."placements" to "anon";

grant delete on table "public"."placements" to "authenticated";

grant insert on table "public"."placements" to "authenticated";

grant references on table "public"."placements" to "authenticated";

grant select on table "public"."placements" to "authenticated";

grant trigger on table "public"."placements" to "authenticated";

grant truncate on table "public"."placements" to "authenticated";

grant update on table "public"."placements" to "authenticated";

grant delete on table "public"."placements" to "service_role";

grant insert on table "public"."placements" to "service_role";

grant references on table "public"."placements" to "service_role";

grant select on table "public"."placements" to "service_role";

grant trigger on table "public"."placements" to "service_role";

grant truncate on table "public"."placements" to "service_role";

grant update on table "public"."placements" to "service_role";

grant delete on table "public"."profile_views" to "anon";

grant insert on table "public"."profile_views" to "anon";

grant references on table "public"."profile_views" to "anon";

grant select on table "public"."profile_views" to "anon";

grant trigger on table "public"."profile_views" to "anon";

grant truncate on table "public"."profile_views" to "anon";

grant update on table "public"."profile_views" to "anon";

grant delete on table "public"."profile_views" to "authenticated";

grant insert on table "public"."profile_views" to "authenticated";

grant references on table "public"."profile_views" to "authenticated";

grant select on table "public"."profile_views" to "authenticated";

grant trigger on table "public"."profile_views" to "authenticated";

grant truncate on table "public"."profile_views" to "authenticated";

grant update on table "public"."profile_views" to "authenticated";

grant delete on table "public"."profile_views" to "service_role";

grant insert on table "public"."profile_views" to "service_role";

grant references on table "public"."profile_views" to "service_role";

grant select on table "public"."profile_views" to "service_role";

grant trigger on table "public"."profile_views" to "service_role";

grant truncate on table "public"."profile_views" to "service_role";

grant update on table "public"."profile_views" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."recent_updates" to "anon";

grant insert on table "public"."recent_updates" to "anon";

grant references on table "public"."recent_updates" to "anon";

grant select on table "public"."recent_updates" to "anon";

grant trigger on table "public"."recent_updates" to "anon";

grant truncate on table "public"."recent_updates" to "anon";

grant update on table "public"."recent_updates" to "anon";

grant delete on table "public"."recent_updates" to "authenticated";

grant insert on table "public"."recent_updates" to "authenticated";

grant references on table "public"."recent_updates" to "authenticated";

grant select on table "public"."recent_updates" to "authenticated";

grant trigger on table "public"."recent_updates" to "authenticated";

grant truncate on table "public"."recent_updates" to "authenticated";

grant update on table "public"."recent_updates" to "authenticated";

grant delete on table "public"."recent_updates" to "service_role";

grant insert on table "public"."recent_updates" to "service_role";

grant references on table "public"."recent_updates" to "service_role";

grant select on table "public"."recent_updates" to "service_role";

grant trigger on table "public"."recent_updates" to "service_role";

grant truncate on table "public"."recent_updates" to "service_role";

grant update on table "public"."recent_updates" to "service_role";

grant delete on table "public"."recruiter_activities" to "anon";

grant insert on table "public"."recruiter_activities" to "anon";

grant references on table "public"."recruiter_activities" to "anon";

grant select on table "public"."recruiter_activities" to "anon";

grant trigger on table "public"."recruiter_activities" to "anon";

grant truncate on table "public"."recruiter_activities" to "anon";

grant update on table "public"."recruiter_activities" to "anon";

grant delete on table "public"."recruiter_activities" to "authenticated";

grant insert on table "public"."recruiter_activities" to "authenticated";

grant references on table "public"."recruiter_activities" to "authenticated";

grant select on table "public"."recruiter_activities" to "authenticated";

grant trigger on table "public"."recruiter_activities" to "authenticated";

grant truncate on table "public"."recruiter_activities" to "authenticated";

grant update on table "public"."recruiter_activities" to "authenticated";

grant delete on table "public"."recruiter_activities" to "service_role";

grant insert on table "public"."recruiter_activities" to "service_role";

grant references on table "public"."recruiter_activities" to "service_role";

grant select on table "public"."recruiter_activities" to "service_role";

grant trigger on table "public"."recruiter_activities" to "service_role";

grant truncate on table "public"."recruiter_activities" to "service_role";

grant update on table "public"."recruiter_activities" to "service_role";

grant delete on table "public"."recruiter_saved_searches" to "anon";

grant insert on table "public"."recruiter_saved_searches" to "anon";

grant references on table "public"."recruiter_saved_searches" to "anon";

grant select on table "public"."recruiter_saved_searches" to "anon";

grant trigger on table "public"."recruiter_saved_searches" to "anon";

grant truncate on table "public"."recruiter_saved_searches" to "anon";

grant update on table "public"."recruiter_saved_searches" to "anon";

grant delete on table "public"."recruiter_saved_searches" to "authenticated";

grant insert on table "public"."recruiter_saved_searches" to "authenticated";

grant references on table "public"."recruiter_saved_searches" to "authenticated";

grant select on table "public"."recruiter_saved_searches" to "authenticated";

grant trigger on table "public"."recruiter_saved_searches" to "authenticated";

grant truncate on table "public"."recruiter_saved_searches" to "authenticated";

grant update on table "public"."recruiter_saved_searches" to "authenticated";

grant delete on table "public"."recruiter_saved_searches" to "service_role";

grant insert on table "public"."recruiter_saved_searches" to "service_role";

grant references on table "public"."recruiter_saved_searches" to "service_role";

grant select on table "public"."recruiter_saved_searches" to "service_role";

grant trigger on table "public"."recruiter_saved_searches" to "service_role";

grant truncate on table "public"."recruiter_saved_searches" to "service_role";

grant update on table "public"."recruiter_saved_searches" to "service_role";

grant delete on table "public"."recruiters" to "anon";

grant insert on table "public"."recruiters" to "anon";

grant references on table "public"."recruiters" to "anon";

grant select on table "public"."recruiters" to "anon";

grant trigger on table "public"."recruiters" to "anon";

grant truncate on table "public"."recruiters" to "anon";

grant update on table "public"."recruiters" to "anon";

grant delete on table "public"."recruiters" to "authenticated";

grant insert on table "public"."recruiters" to "authenticated";

grant references on table "public"."recruiters" to "authenticated";

grant select on table "public"."recruiters" to "authenticated";

grant trigger on table "public"."recruiters" to "authenticated";

grant truncate on table "public"."recruiters" to "authenticated";

grant update on table "public"."recruiters" to "authenticated";

grant delete on table "public"."recruiters" to "service_role";

grant insert on table "public"."recruiters" to "service_role";

grant references on table "public"."recruiters" to "service_role";

grant select on table "public"."recruiters" to "service_role";

grant trigger on table "public"."recruiters" to "service_role";

grant truncate on table "public"."recruiters" to "service_role";

grant update on table "public"."recruiters" to "service_role";

grant delete on table "public"."requisitions" to "anon";

grant insert on table "public"."requisitions" to "anon";

grant references on table "public"."requisitions" to "anon";

grant select on table "public"."requisitions" to "anon";

grant trigger on table "public"."requisitions" to "anon";

grant truncate on table "public"."requisitions" to "anon";

grant update on table "public"."requisitions" to "anon";

grant delete on table "public"."requisitions" to "authenticated";

grant insert on table "public"."requisitions" to "authenticated";

grant references on table "public"."requisitions" to "authenticated";

grant select on table "public"."requisitions" to "authenticated";

grant trigger on table "public"."requisitions" to "authenticated";

grant truncate on table "public"."requisitions" to "authenticated";

grant update on table "public"."requisitions" to "authenticated";

grant delete on table "public"."requisitions" to "service_role";

grant insert on table "public"."requisitions" to "service_role";

grant references on table "public"."requisitions" to "service_role";

grant select on table "public"."requisitions" to "service_role";

grant trigger on table "public"."requisitions" to "service_role";

grant truncate on table "public"."requisitions" to "service_role";

grant update on table "public"."requisitions" to "service_role";

grant delete on table "public"."role_permissions" to "anon";

grant insert on table "public"."role_permissions" to "anon";

grant references on table "public"."role_permissions" to "anon";

grant select on table "public"."role_permissions" to "anon";

grant trigger on table "public"."role_permissions" to "anon";

grant truncate on table "public"."role_permissions" to "anon";

grant update on table "public"."role_permissions" to "anon";

grant delete on table "public"."role_permissions" to "authenticated";

grant insert on table "public"."role_permissions" to "authenticated";

grant references on table "public"."role_permissions" to "authenticated";

grant select on table "public"."role_permissions" to "authenticated";

grant trigger on table "public"."role_permissions" to "authenticated";

grant truncate on table "public"."role_permissions" to "authenticated";

grant update on table "public"."role_permissions" to "authenticated";

grant delete on table "public"."role_permissions" to "service_role";

grant insert on table "public"."role_permissions" to "service_role";

grant references on table "public"."role_permissions" to "service_role";

grant select on table "public"."role_permissions" to "service_role";

grant trigger on table "public"."role_permissions" to "service_role";

grant truncate on table "public"."role_permissions" to "service_role";

grant update on table "public"."role_permissions" to "service_role";

grant delete on table "public"."saved_jobs" to "anon";

grant insert on table "public"."saved_jobs" to "anon";

grant references on table "public"."saved_jobs" to "anon";

grant select on table "public"."saved_jobs" to "anon";

grant trigger on table "public"."saved_jobs" to "anon";

grant truncate on table "public"."saved_jobs" to "anon";

grant update on table "public"."saved_jobs" to "anon";

grant delete on table "public"."saved_jobs" to "authenticated";

grant insert on table "public"."saved_jobs" to "authenticated";

grant references on table "public"."saved_jobs" to "authenticated";

grant select on table "public"."saved_jobs" to "authenticated";

grant trigger on table "public"."saved_jobs" to "authenticated";

grant truncate on table "public"."saved_jobs" to "authenticated";

grant update on table "public"."saved_jobs" to "authenticated";

grant delete on table "public"."saved_jobs" to "service_role";

grant insert on table "public"."saved_jobs" to "service_role";

grant references on table "public"."saved_jobs" to "service_role";

grant select on table "public"."saved_jobs" to "service_role";

grant trigger on table "public"."saved_jobs" to "service_role";

grant truncate on table "public"."saved_jobs" to "service_role";

grant update on table "public"."saved_jobs" to "service_role";

grant delete on table "public"."school_classes" to "anon";

grant insert on table "public"."school_classes" to "anon";

grant references on table "public"."school_classes" to "anon";

grant select on table "public"."school_classes" to "anon";

grant trigger on table "public"."school_classes" to "anon";

grant truncate on table "public"."school_classes" to "anon";

grant update on table "public"."school_classes" to "anon";

grant delete on table "public"."school_classes" to "authenticated";

grant insert on table "public"."school_classes" to "authenticated";

grant references on table "public"."school_classes" to "authenticated";

grant select on table "public"."school_classes" to "authenticated";

grant trigger on table "public"."school_classes" to "authenticated";

grant truncate on table "public"."school_classes" to "authenticated";

grant update on table "public"."school_classes" to "authenticated";

grant delete on table "public"."school_classes" to "service_role";

grant insert on table "public"."school_classes" to "service_role";

grant references on table "public"."school_classes" to "service_role";

grant select on table "public"."school_classes" to "service_role";

grant trigger on table "public"."school_classes" to "service_role";

grant truncate on table "public"."school_classes" to "service_role";

grant update on table "public"."school_classes" to "service_role";

grant delete on table "public"."school_educator_class_assignments" to "anon";

grant insert on table "public"."school_educator_class_assignments" to "anon";

grant references on table "public"."school_educator_class_assignments" to "anon";

grant select on table "public"."school_educator_class_assignments" to "anon";

grant trigger on table "public"."school_educator_class_assignments" to "anon";

grant truncate on table "public"."school_educator_class_assignments" to "anon";

grant update on table "public"."school_educator_class_assignments" to "anon";

grant delete on table "public"."school_educator_class_assignments" to "authenticated";

grant insert on table "public"."school_educator_class_assignments" to "authenticated";

grant references on table "public"."school_educator_class_assignments" to "authenticated";

grant select on table "public"."school_educator_class_assignments" to "authenticated";

grant trigger on table "public"."school_educator_class_assignments" to "authenticated";

grant truncate on table "public"."school_educator_class_assignments" to "authenticated";

grant update on table "public"."school_educator_class_assignments" to "authenticated";

grant delete on table "public"."school_educator_class_assignments" to "service_role";

grant insert on table "public"."school_educator_class_assignments" to "service_role";

grant references on table "public"."school_educator_class_assignments" to "service_role";

grant select on table "public"."school_educator_class_assignments" to "service_role";

grant trigger on table "public"."school_educator_class_assignments" to "service_role";

grant truncate on table "public"."school_educator_class_assignments" to "service_role";

grant update on table "public"."school_educator_class_assignments" to "service_role";

grant delete on table "public"."school_educators" to "anon";

grant insert on table "public"."school_educators" to "anon";

grant references on table "public"."school_educators" to "anon";

grant select on table "public"."school_educators" to "anon";

grant trigger on table "public"."school_educators" to "anon";

grant truncate on table "public"."school_educators" to "anon";

grant update on table "public"."school_educators" to "anon";

grant delete on table "public"."school_educators" to "authenticated";

grant insert on table "public"."school_educators" to "authenticated";

grant references on table "public"."school_educators" to "authenticated";

grant select on table "public"."school_educators" to "authenticated";

grant trigger on table "public"."school_educators" to "authenticated";

grant truncate on table "public"."school_educators" to "authenticated";

grant update on table "public"."school_educators" to "authenticated";

grant delete on table "public"."school_educators" to "service_role";

grant insert on table "public"."school_educators" to "service_role";

grant references on table "public"."school_educators" to "service_role";

grant select on table "public"."school_educators" to "service_role";

grant trigger on table "public"."school_educators" to "service_role";

grant truncate on table "public"."school_educators" to "service_role";

grant update on table "public"."school_educators" to "service_role";

grant delete on table "public"."schools" to "anon";

grant insert on table "public"."schools" to "anon";

grant references on table "public"."schools" to "anon";

grant select on table "public"."schools" to "anon";

grant trigger on table "public"."schools" to "anon";

grant truncate on table "public"."schools" to "anon";

grant update on table "public"."schools" to "anon";

grant delete on table "public"."schools" to "authenticated";

grant insert on table "public"."schools" to "authenticated";

grant references on table "public"."schools" to "authenticated";

grant select on table "public"."schools" to "authenticated";

grant trigger on table "public"."schools" to "authenticated";

grant truncate on table "public"."schools" to "authenticated";

grant update on table "public"."schools" to "authenticated";

grant delete on table "public"."schools" to "service_role";

grant insert on table "public"."schools" to "service_role";

grant references on table "public"."schools" to "service_role";

grant select on table "public"."schools" to "service_role";

grant trigger on table "public"."schools" to "service_role";

grant truncate on table "public"."schools" to "service_role";

grant update on table "public"."schools" to "service_role";

grant delete on table "public"."search_history" to "anon";

grant insert on table "public"."search_history" to "anon";

grant references on table "public"."search_history" to "anon";

grant select on table "public"."search_history" to "anon";

grant trigger on table "public"."search_history" to "anon";

grant truncate on table "public"."search_history" to "anon";

grant update on table "public"."search_history" to "anon";

grant delete on table "public"."search_history" to "authenticated";

grant insert on table "public"."search_history" to "authenticated";

grant references on table "public"."search_history" to "authenticated";

grant select on table "public"."search_history" to "authenticated";

grant trigger on table "public"."search_history" to "authenticated";

grant truncate on table "public"."search_history" to "authenticated";

grant update on table "public"."search_history" to "authenticated";

grant delete on table "public"."search_history" to "service_role";

grant insert on table "public"."search_history" to "service_role";

grant references on table "public"."search_history" to "service_role";

grant select on table "public"."search_history" to "service_role";

grant trigger on table "public"."search_history" to "service_role";

grant truncate on table "public"."search_history" to "service_role";

grant update on table "public"."search_history" to "service_role";

grant delete on table "public"."shortlist_candidates" to "anon";

grant insert on table "public"."shortlist_candidates" to "anon";

grant references on table "public"."shortlist_candidates" to "anon";

grant select on table "public"."shortlist_candidates" to "anon";

grant trigger on table "public"."shortlist_candidates" to "anon";

grant truncate on table "public"."shortlist_candidates" to "anon";

grant update on table "public"."shortlist_candidates" to "anon";

grant delete on table "public"."shortlist_candidates" to "authenticated";

grant insert on table "public"."shortlist_candidates" to "authenticated";

grant references on table "public"."shortlist_candidates" to "authenticated";

grant select on table "public"."shortlist_candidates" to "authenticated";

grant trigger on table "public"."shortlist_candidates" to "authenticated";

grant truncate on table "public"."shortlist_candidates" to "authenticated";

grant update on table "public"."shortlist_candidates" to "authenticated";

grant delete on table "public"."shortlist_candidates" to "service_role";

grant insert on table "public"."shortlist_candidates" to "service_role";

grant references on table "public"."shortlist_candidates" to "service_role";

grant select on table "public"."shortlist_candidates" to "service_role";

grant trigger on table "public"."shortlist_candidates" to "service_role";

grant truncate on table "public"."shortlist_candidates" to "service_role";

grant update on table "public"."shortlist_candidates" to "service_role";

grant delete on table "public"."shortlists" to "anon";

grant insert on table "public"."shortlists" to "anon";

grant references on table "public"."shortlists" to "anon";

grant select on table "public"."shortlists" to "anon";

grant trigger on table "public"."shortlists" to "anon";

grant truncate on table "public"."shortlists" to "anon";

grant update on table "public"."shortlists" to "anon";

grant delete on table "public"."shortlists" to "authenticated";

grant insert on table "public"."shortlists" to "authenticated";

grant references on table "public"."shortlists" to "authenticated";

grant select on table "public"."shortlists" to "authenticated";

grant trigger on table "public"."shortlists" to "authenticated";

grant truncate on table "public"."shortlists" to "authenticated";

grant update on table "public"."shortlists" to "authenticated";

grant delete on table "public"."shortlists" to "service_role";

grant insert on table "public"."shortlists" to "service_role";

grant references on table "public"."shortlists" to "service_role";

grant select on table "public"."shortlists" to "service_role";

grant trigger on table "public"."shortlists" to "service_role";

grant truncate on table "public"."shortlists" to "service_role";

grant update on table "public"."shortlists" to "service_role";

grant delete on table "public"."skill_passports" to "anon";

grant insert on table "public"."skill_passports" to "anon";

grant references on table "public"."skill_passports" to "anon";

grant select on table "public"."skill_passports" to "anon";

grant trigger on table "public"."skill_passports" to "anon";

grant truncate on table "public"."skill_passports" to "anon";

grant update on table "public"."skill_passports" to "anon";

grant delete on table "public"."skill_passports" to "authenticated";

grant insert on table "public"."skill_passports" to "authenticated";

grant references on table "public"."skill_passports" to "authenticated";

grant select on table "public"."skill_passports" to "authenticated";

grant trigger on table "public"."skill_passports" to "authenticated";

grant truncate on table "public"."skill_passports" to "authenticated";

grant update on table "public"."skill_passports" to "authenticated";

grant delete on table "public"."skill_passports" to "service_role";

grant insert on table "public"."skill_passports" to "service_role";

grant references on table "public"."skill_passports" to "service_role";

grant select on table "public"."skill_passports" to "service_role";

grant trigger on table "public"."skill_passports" to "service_role";

grant truncate on table "public"."skill_passports" to "service_role";

grant update on table "public"."skill_passports" to "service_role";

grant delete on table "public"."skill_trends" to "anon";

grant insert on table "public"."skill_trends" to "anon";

grant references on table "public"."skill_trends" to "anon";

grant select on table "public"."skill_trends" to "anon";

grant trigger on table "public"."skill_trends" to "anon";

grant truncate on table "public"."skill_trends" to "anon";

grant update on table "public"."skill_trends" to "anon";

grant delete on table "public"."skill_trends" to "authenticated";

grant insert on table "public"."skill_trends" to "authenticated";

grant references on table "public"."skill_trends" to "authenticated";

grant select on table "public"."skill_trends" to "authenticated";

grant trigger on table "public"."skill_trends" to "authenticated";

grant truncate on table "public"."skill_trends" to "authenticated";

grant update on table "public"."skill_trends" to "authenticated";

grant delete on table "public"."skill_trends" to "service_role";

grant insert on table "public"."skill_trends" to "service_role";

grant references on table "public"."skill_trends" to "service_role";

grant select on table "public"."skill_trends" to "service_role";

grant trigger on table "public"."skill_trends" to "service_role";

grant truncate on table "public"."skill_trends" to "service_role";

grant update on table "public"."skill_trends" to "service_role";

grant delete on table "public"."skills" to "anon";

grant insert on table "public"."skills" to "anon";

grant references on table "public"."skills" to "anon";

grant select on table "public"."skills" to "anon";

grant trigger on table "public"."skills" to "anon";

grant truncate on table "public"."skills" to "anon";

grant update on table "public"."skills" to "anon";

grant delete on table "public"."skills" to "authenticated";

grant insert on table "public"."skills" to "authenticated";

grant references on table "public"."skills" to "authenticated";

grant select on table "public"."skills" to "authenticated";

grant trigger on table "public"."skills" to "authenticated";

grant truncate on table "public"."skills" to "authenticated";

grant update on table "public"."skills" to "authenticated";

grant delete on table "public"."skills" to "service_role";

grant insert on table "public"."skills" to "service_role";

grant references on table "public"."skills" to "service_role";

grant select on table "public"."skills" to "service_role";

grant trigger on table "public"."skills" to "service_role";

grant truncate on table "public"."skills" to "service_role";

grant update on table "public"."skills" to "service_role";

grant delete on table "public"."studentEnrollments" to "anon";

grant insert on table "public"."studentEnrollments" to "anon";

grant references on table "public"."studentEnrollments" to "anon";

grant select on table "public"."studentEnrollments" to "anon";

grant trigger on table "public"."studentEnrollments" to "anon";

grant truncate on table "public"."studentEnrollments" to "anon";

grant update on table "public"."studentEnrollments" to "anon";

grant delete on table "public"."studentEnrollments" to "authenticated";

grant insert on table "public"."studentEnrollments" to "authenticated";

grant references on table "public"."studentEnrollments" to "authenticated";

grant select on table "public"."studentEnrollments" to "authenticated";

grant trigger on table "public"."studentEnrollments" to "authenticated";

grant truncate on table "public"."studentEnrollments" to "authenticated";

grant update on table "public"."studentEnrollments" to "authenticated";

grant delete on table "public"."studentEnrollments" to "service_role";

grant insert on table "public"."studentEnrollments" to "service_role";

grant references on table "public"."studentEnrollments" to "service_role";

grant select on table "public"."studentEnrollments" to "service_role";

grant trigger on table "public"."studentEnrollments" to "service_role";

grant truncate on table "public"."studentEnrollments" to "service_role";

grant update on table "public"."studentEnrollments" to "service_role";

grant delete on table "public"."student_assignments" to "anon";

grant insert on table "public"."student_assignments" to "anon";

grant references on table "public"."student_assignments" to "anon";

grant select on table "public"."student_assignments" to "anon";

grant trigger on table "public"."student_assignments" to "anon";

grant truncate on table "public"."student_assignments" to "anon";

grant update on table "public"."student_assignments" to "anon";

grant delete on table "public"."student_assignments" to "authenticated";

grant insert on table "public"."student_assignments" to "authenticated";

grant references on table "public"."student_assignments" to "authenticated";

grant select on table "public"."student_assignments" to "authenticated";

grant trigger on table "public"."student_assignments" to "authenticated";

grant truncate on table "public"."student_assignments" to "authenticated";

grant update on table "public"."student_assignments" to "authenticated";

grant delete on table "public"."student_assignments" to "service_role";

grant insert on table "public"."student_assignments" to "service_role";

grant references on table "public"."student_assignments" to "service_role";

grant select on table "public"."student_assignments" to "service_role";

grant trigger on table "public"."student_assignments" to "service_role";

grant truncate on table "public"."student_assignments" to "service_role";

grant update on table "public"."student_assignments" to "service_role";

grant delete on table "public"."students" to "anon";

grant insert on table "public"."students" to "anon";

grant references on table "public"."students" to "anon";

grant select on table "public"."students" to "anon";

grant trigger on table "public"."students" to "anon";

grant truncate on table "public"."students" to "anon";

grant update on table "public"."students" to "anon";

grant delete on table "public"."students" to "authenticated";

grant insert on table "public"."students" to "authenticated";

grant references on table "public"."students" to "authenticated";

grant select on table "public"."students" to "authenticated";

grant trigger on table "public"."students" to "authenticated";

grant truncate on table "public"."students" to "authenticated";

grant update on table "public"."students" to "authenticated";

grant delete on table "public"."students" to "service_role";

grant insert on table "public"."students" to "service_role";

grant references on table "public"."students" to "service_role";

grant select on table "public"."students" to "service_role";

grant trigger on table "public"."students" to "service_role";

grant truncate on table "public"."students" to "service_role";

grant update on table "public"."students" to "service_role";

grant delete on table "public"."trainings" to "anon";

grant insert on table "public"."trainings" to "anon";

grant references on table "public"."trainings" to "anon";

grant select on table "public"."trainings" to "anon";

grant trigger on table "public"."trainings" to "anon";

grant truncate on table "public"."trainings" to "anon";

grant update on table "public"."trainings" to "anon";

grant delete on table "public"."trainings" to "authenticated";

grant insert on table "public"."trainings" to "authenticated";

grant references on table "public"."trainings" to "authenticated";

grant select on table "public"."trainings" to "authenticated";

grant trigger on table "public"."trainings" to "authenticated";

grant truncate on table "public"."trainings" to "authenticated";

grant update on table "public"."trainings" to "authenticated";

grant delete on table "public"."trainings" to "service_role";

grant insert on table "public"."trainings" to "service_role";

grant references on table "public"."trainings" to "service_role";

grant select on table "public"."trainings" to "service_role";

grant trigger on table "public"."trainings" to "service_role";

grant truncate on table "public"."trainings" to "service_role";

grant update on table "public"."trainings" to "service_role";

grant delete on table "public"."universities" to "anon";

grant insert on table "public"."universities" to "anon";

grant references on table "public"."universities" to "anon";

grant select on table "public"."universities" to "anon";

grant trigger on table "public"."universities" to "anon";

grant truncate on table "public"."universities" to "anon";

grant update on table "public"."universities" to "anon";

grant delete on table "public"."universities" to "authenticated";

grant insert on table "public"."universities" to "authenticated";

grant references on table "public"."universities" to "authenticated";

grant select on table "public"."universities" to "authenticated";

grant trigger on table "public"."universities" to "authenticated";

grant truncate on table "public"."universities" to "authenticated";

grant update on table "public"."universities" to "authenticated";

grant delete on table "public"."universities" to "service_role";

grant insert on table "public"."universities" to "service_role";

grant references on table "public"."universities" to "service_role";

grant select on table "public"."universities" to "service_role";

grant trigger on table "public"."universities" to "service_role";

grant truncate on table "public"."universities" to "service_role";

grant update on table "public"."universities" to "service_role";

grant delete on table "public"."university_courses" to "anon";

grant insert on table "public"."university_courses" to "anon";

grant references on table "public"."university_courses" to "anon";

grant select on table "public"."university_courses" to "anon";

grant trigger on table "public"."university_courses" to "anon";

grant truncate on table "public"."university_courses" to "anon";

grant update on table "public"."university_courses" to "anon";

grant delete on table "public"."university_courses" to "authenticated";

grant insert on table "public"."university_courses" to "authenticated";

grant references on table "public"."university_courses" to "authenticated";

grant select on table "public"."university_courses" to "authenticated";

grant trigger on table "public"."university_courses" to "authenticated";

grant truncate on table "public"."university_courses" to "authenticated";

grant update on table "public"."university_courses" to "authenticated";

grant delete on table "public"."university_courses" to "service_role";

grant insert on table "public"."university_courses" to "service_role";

grant references on table "public"."university_courses" to "service_role";

grant select on table "public"."university_courses" to "service_role";

grant trigger on table "public"."university_courses" to "service_role";

grant truncate on table "public"."university_courses" to "service_role";

grant update on table "public"."university_courses" to "service_role";

grant delete on table "public"."university_lecturer_course_assignments" to "anon";

grant insert on table "public"."university_lecturer_course_assignments" to "anon";

grant references on table "public"."university_lecturer_course_assignments" to "anon";

grant select on table "public"."university_lecturer_course_assignments" to "anon";

grant trigger on table "public"."university_lecturer_course_assignments" to "anon";

grant truncate on table "public"."university_lecturer_course_assignments" to "anon";

grant update on table "public"."university_lecturer_course_assignments" to "anon";

grant delete on table "public"."university_lecturer_course_assignments" to "authenticated";

grant insert on table "public"."university_lecturer_course_assignments" to "authenticated";

grant references on table "public"."university_lecturer_course_assignments" to "authenticated";

grant select on table "public"."university_lecturer_course_assignments" to "authenticated";

grant trigger on table "public"."university_lecturer_course_assignments" to "authenticated";

grant truncate on table "public"."university_lecturer_course_assignments" to "authenticated";

grant update on table "public"."university_lecturer_course_assignments" to "authenticated";

grant delete on table "public"."university_lecturer_course_assignments" to "service_role";

grant insert on table "public"."university_lecturer_course_assignments" to "service_role";

grant references on table "public"."university_lecturer_course_assignments" to "service_role";

grant select on table "public"."university_lecturer_course_assignments" to "service_role";

grant trigger on table "public"."university_lecturer_course_assignments" to "service_role";

grant truncate on table "public"."university_lecturer_course_assignments" to "service_role";

grant update on table "public"."university_lecturer_course_assignments" to "service_role";

grant delete on table "public"."university_lecturers" to "anon";

grant insert on table "public"."university_lecturers" to "anon";

grant references on table "public"."university_lecturers" to "anon";

grant select on table "public"."university_lecturers" to "anon";

grant trigger on table "public"."university_lecturers" to "anon";

grant truncate on table "public"."university_lecturers" to "anon";

grant update on table "public"."university_lecturers" to "anon";

grant delete on table "public"."university_lecturers" to "authenticated";

grant insert on table "public"."university_lecturers" to "authenticated";

grant references on table "public"."university_lecturers" to "authenticated";

grant select on table "public"."university_lecturers" to "authenticated";

grant trigger on table "public"."university_lecturers" to "authenticated";

grant truncate on table "public"."university_lecturers" to "authenticated";

grant update on table "public"."university_lecturers" to "authenticated";

grant delete on table "public"."university_lecturers" to "service_role";

grant insert on table "public"."university_lecturers" to "service_role";

grant references on table "public"."university_lecturers" to "service_role";

grant select on table "public"."university_lecturers" to "service_role";

grant trigger on table "public"."university_lecturers" to "service_role";

grant truncate on table "public"."university_lecturers" to "service_role";

grant update on table "public"."university_lecturers" to "service_role";

grant delete on table "public"."university_performance" to "anon";

grant insert on table "public"."university_performance" to "anon";

grant references on table "public"."university_performance" to "anon";

grant select on table "public"."university_performance" to "anon";

grant trigger on table "public"."university_performance" to "anon";

grant truncate on table "public"."university_performance" to "anon";

grant update on table "public"."university_performance" to "anon";

grant delete on table "public"."university_performance" to "authenticated";

grant insert on table "public"."university_performance" to "authenticated";

grant references on table "public"."university_performance" to "authenticated";

grant select on table "public"."university_performance" to "authenticated";

grant trigger on table "public"."university_performance" to "authenticated";

grant truncate on table "public"."university_performance" to "authenticated";

grant update on table "public"."university_performance" to "authenticated";

grant delete on table "public"."university_performance" to "service_role";

grant insert on table "public"."university_performance" to "service_role";

grant references on table "public"."university_performance" to "service_role";

grant select on table "public"."university_performance" to "service_role";

grant trigger on table "public"."university_performance" to "service_role";

grant truncate on table "public"."university_performance" to "service_role";

grant update on table "public"."university_performance" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."verifications" to "anon";

grant insert on table "public"."verifications" to "anon";

grant references on table "public"."verifications" to "anon";

grant select on table "public"."verifications" to "anon";

grant trigger on table "public"."verifications" to "anon";

grant truncate on table "public"."verifications" to "anon";

grant update on table "public"."verifications" to "anon";

grant delete on table "public"."verifications" to "authenticated";

grant insert on table "public"."verifications" to "authenticated";

grant references on table "public"."verifications" to "authenticated";

grant select on table "public"."verifications" to "authenticated";

grant trigger on table "public"."verifications" to "authenticated";

grant truncate on table "public"."verifications" to "authenticated";

grant update on table "public"."verifications" to "authenticated";

grant delete on table "public"."verifications" to "service_role";

grant insert on table "public"."verifications" to "service_role";

grant references on table "public"."verifications" to "service_role";

grant select on table "public"."verifications" to "service_role";

grant trigger on table "public"."verifications" to "service_role";

grant truncate on table "public"."verifications" to "service_role";

grant update on table "public"."verifications" to "service_role";


  create policy "Recruiters can update application status"
  on "public"."applied_jobs"
  as permissive
  for update
  to public
using ((opportunity_id IN ( SELECT opportunities.id
   FROM public.opportunities
  WHERE (opportunities.created_by = (auth.uid())::text))));



  create policy "Recruiters can view applications for their opportunities"
  on "public"."applied_jobs"
  as permissive
  for select
  to public
using ((opportunity_id IN ( SELECT opportunities.id
   FROM public.opportunities
  WHERE (opportunities.created_by = (auth.uid())::text))));



  create policy "Students can create own applications"
  on "public"."applied_jobs"
  as permissive
  for insert
  to public
with check (((student_id = auth.uid()) OR (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.id = auth.uid())))));



  create policy "Students can delete own applications"
  on "public"."applied_jobs"
  as permissive
  for delete
  to public
using (((student_id = auth.uid()) OR (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.id = auth.uid())))));



  create policy "Students can update own applications"
  on "public"."applied_jobs"
  as permissive
  for update
  to public
using (((student_id = auth.uid()) OR (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.id = auth.uid())))));



  create policy "Students can view own applications"
  on "public"."applied_jobs"
  as permissive
  for select
  to public
using (((student_id = auth.uid()) OR (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.id = auth.uid())))));



  create policy "Allow public insert"
  on "public"."audit_logs"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can log export activities"
  on "public"."export_activities"
  as permissive
  for insert
  to public
with check (true);



  create policy "Authenticated users can view export activities"
  on "public"."export_activities"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can log reminders"
  on "public"."interview_reminders"
  as permissive
  for insert
  to public
with check (true);



  create policy "Authenticated users can view reminders"
  on "public"."interview_reminders"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can create interviews"
  on "public"."interviews"
  as permissive
  for insert
  to public
with check (true);



  create policy "Authenticated users can delete interviews"
  on "public"."interviews"
  as permissive
  for delete
  to public
using (true);



  create policy "Authenticated users can update interviews"
  on "public"."interviews"
  as permissive
  for update
  to public
using (true);



  create policy "Authenticated users can view interviews"
  on "public"."interviews"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public insert"
  on "public"."metrics_snapshots"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."metrics_snapshots"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."metrics_snapshots"
  as permissive
  for update
  to public
using (true);



  create policy "Authenticated users can log activities"
  on "public"."pipeline_activities"
  as permissive
  for insert
  to public
with check (true);



  create policy "Authenticated users can view activities"
  on "public"."pipeline_activities"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can manage pipeline candidates"
  on "public"."pipeline_candidates"
  as permissive
  for all
  to public
using (true);



  create policy "Authenticated users can view pipeline candidates"
  on "public"."pipeline_candidates"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public insert"
  on "public"."placements"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."placements"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."placements"
  as permissive
  for update
  to public
using (true);



  create policy "Anyone can track profile views"
  on "public"."profile_views"
  as permissive
  for insert
  to public
with check (true);



  create policy "Students can view own profile views"
  on "public"."profile_views"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public read access to recent_updates"
  on "public"."recent_updates"
  as permissive
  for select
  to public
using (true);



  create policy "Allow users to insert own recent_updates"
  on "public"."recent_updates"
  as permissive
  for insert
  to public
with check ((auth.uid() = student_id));



  create policy "Allow users to update own recent_updates"
  on "public"."recent_updates"
  as permissive
  for update
  to public
using ((auth.uid() = student_id));



  create policy "Allow public insert"
  on "public"."recruiter_activities"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."recruiter_activities"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete own saved searches"
  on "public"."recruiter_saved_searches"
  as permissive
  for delete
  to public
using (true);



  create policy "Users can insert own saved searches"
  on "public"."recruiter_saved_searches"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update own saved searches"
  on "public"."recruiter_saved_searches"
  as permissive
  for update
  to public
using (true);



  create policy "Users can view own saved searches"
  on "public"."recruiter_saved_searches"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can manage requisitions"
  on "public"."requisitions"
  as permissive
  for all
  to public
using (true);



  create policy "Authenticated users can view requisitions"
  on "public"."requisitions"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can manage shortlist candidates"
  on "public"."shortlist_candidates"
  as permissive
  for all
  to public
using (true);



  create policy "Authenticated users can view shortlist candidates"
  on "public"."shortlist_candidates"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can create shortlists"
  on "public"."shortlists"
  as permissive
  for insert
  to public
with check (true);



  create policy "Authenticated users can delete shortlists"
  on "public"."shortlists"
  as permissive
  for delete
  to public
using (true);



  create policy "Authenticated users can update shortlists"
  on "public"."shortlists"
  as permissive
  for update
  to public
using (true);



  create policy "Authenticated users can view shortlists"
  on "public"."shortlists"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public insert"
  on "public"."skill_passports"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."skill_passports"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."skill_passports"
  as permissive
  for update
  to public
using (true);



  create policy "Allow public insert"
  on "public"."skill_trends"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."skill_trends"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."skill_trends"
  as permissive
  for update
  to public
using (true);



  create policy "Allow public insert"
  on "public"."students"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."students"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."students"
  as permissive
  for update
  to public
using (true);



  create policy "Students can insert own profile"
  on "public"."students"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Allow public insert"
  on "public"."university_performance"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."university_performance"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."university_performance"
  as permissive
  for update
  to public
using (true);



  create policy "Allow public delete"
  on "public"."users"
  as permissive
  for delete
  to public
using (true);



  create policy "Allow public insert"
  on "public"."users"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."users"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update"
  on "public"."users"
  as permissive
  for update
  to public
using (true);



  create policy "Allow public insert"
  on "public"."verifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public read"
  on "public"."verifications"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER trigger_decrement_applications_count AFTER DELETE ON public.applied_jobs FOR EACH ROW EXECUTE FUNCTION public.decrement_applications_count();

CREATE TRIGGER trigger_increment_applications_count AFTER INSERT ON public.applied_jobs FOR EACH ROW EXECUTE FUNCTION public.increment_applications_count();

CREATE TRIGGER trigger_update_applied_jobs_timestamp BEFORE UPDATE ON public.applied_jobs FOR EACH ROW EXECUTE FUNCTION public.update_applied_jobs_updated_at();

CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.trg_assignments_updated_fn();

CREATE TRIGGER update_college_courses_updated_at BEFORE UPDATE ON public.college_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_college_lecturers_updated_at BEFORE UPDATE ON public.college_lecturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON public.colleges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_branches_updated_at BEFORE UPDATE ON public.company_branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_reset_unread_count AFTER UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.reset_unread_count();

CREATE TRIGGER trigger_update_conversation_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

CREATE TRIGGER update_metrics_snapshots_updated_at BEFORE UPDATE ON public.metrics_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_new_opportunity_notification AFTER INSERT ON public.opportunities FOR EACH ROW WHEN ((new.is_active IS TRUE)) EXECUTE FUNCTION public.notify_students_new_opportunity();

CREATE TRIGGER trigger_opportunity_update_notification AFTER UPDATE ON public.opportunities FOR EACH ROW WHEN ((old.is_active IS DISTINCT FROM new.is_active)) EXECUTE FUNCTION public.notify_students_opportunity_update();

CREATE TRIGGER update_pipeline_candidates_updated_at BEFORE UPDATE ON public.pipeline_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_placements_timestamp BEFORE UPDATE ON public.placements FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON public.recruiter_saved_searches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recruiters_updated_at BEFORE UPDATE ON public.recruiters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requisitions_updated_at BEFORE UPDATE ON public.requisitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_saved_jobs_timestamp BEFORE UPDATE ON public.saved_jobs FOR EACH ROW EXECUTE FUNCTION public.update_saved_jobs_updated_at();

CREATE TRIGGER update_school_classes_updated_at BEFORE UPDATE ON public.school_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_educators_updated_at BEFORE UPDATE ON public.school_educators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shortlists_updated_at BEFORE UPDATE ON public.shortlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_passports_timestamp BEFORE UPDATE ON public.skill_passports FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_skill_passports_updated_at BEFORE UPDATE ON public.skill_passports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER check_one_active_enrollment BEFORE INSERT OR UPDATE ON public."studentEnrollments" FOR EACH ROW EXECUTE FUNCTION public."validateOneActiveEnrollment"();

CREATE TRIGGER update_entity_counts_on_enrollment AFTER INSERT OR UPDATE ON public."studentEnrollments" FOR EACH ROW EXECUTE FUNCTION public."updateEntityStudentCounts"();

CREATE TRIGGER update_student_enrollments_updated_at BEFORE UPDATE ON public."studentEnrollments" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_student_assignments_grade_pct BEFORE INSERT OR UPDATE OF grade_received ON public.student_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_student_assignments_grade_pct_fn();

CREATE TRIGGER trg_student_assignments_late_check BEFORE INSERT OR UPDATE OF submission_date ON public.student_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_student_assignments_late_check_fn();

CREATE TRIGGER trg_student_assignments_status BEFORE INSERT OR UPDATE OF status ON public.student_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_student_assignments_status_fn();

CREATE TRIGGER trg_student_assignments_updated BEFORE UPDATE ON public.student_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_student_assignments_updated_fn();

CREATE TRIGGER auto_recent_update_on_profile_change AFTER UPDATE OF profile ON public.students FOR EACH ROW WHEN ((old.profile IS DISTINCT FROM new.profile)) EXECUTE FUNCTION public.trigger_profile_update();

CREATE TRIGGER auto_recent_update_on_skills_change AFTER UPDATE OF profile ON public.students FOR EACH ROW WHEN (((old.profile -> 'technicalSkills'::text) IS DISTINCT FROM (new.profile -> 'technicalSkills'::text))) EXECUTE FUNCTION public.trigger_skills_improvement();

CREATE TRIGGER auto_recent_update_on_training_complete AFTER UPDATE OF profile ON public.students FOR EACH ROW WHEN (((old.profile -> 'training'::text) IS DISTINCT FROM (new.profile -> 'training'::text))) EXECUTE FUNCTION public.trigger_training_completion();

CREATE TRIGGER set_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_students_updated_at();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_courses_updated_at BEFORE UPDATE ON public.university_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_lecturers_updated_at BEFORE UPDATE ON public.university_lecturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


