# Rareminds Platform - Admin Dashboard

## 1. Project Overview

This project is the admin-facing dashboard for the Rareminds platform, a comprehensive ecosystem for educational institutions and companies. The admin dashboard is a Next.js application built with the App Router, providing a central control panel for platform administrators to manage the entire Rareminds ecosystem.

### 1.1. Purpose and Scope

The primary purposes of the Admin App are:

*   **Entity Management**: Create, register, approve, reject, update, and suspend entities (Schools, Colleges, Universities, and Companies).
*   **User Oversight**: View all users, manage user accounts, and monitor user activity.
*   **Platform Monitoring**: View platform-wide statistics, track entity and user growth, and review audit logs.
*   **Approval Workflows**: Manage the approval process for new entity registrations.
*   **Configuration Management**: Configure global platform settings and manage role-based permissions.

### 1.2. Key Characteristics

*   **Single User Role**: Exclusively for Platform Administrators (RM Admin).
*   **Separate Deployment**: Completely isolated from the main platform application.
*   **Dedicated Backend**: Connects to a dedicated backend API (Admin API).
*   **Shared Database**: Reads/writes from the same Supabase database as the main platform.

### 1.3. Key Technologies

*   **Framework**: Next.js 14+ (App Router)
*   **Language**: JavaScript
*   **Styling**: Tailwind CSS
*   **UI Components**: Shadcn/UI, Radix UI
*   **State Management**: React Context, Zustand
*   **Form Handling**: React Hook Form, Zod
*   **Backend**: Supabase
*   **Deployment**: Cloudflare Pages

## 2. Architecture

The Rareminds platform has a decoupled architecture with two separate front-end applications and two separate back-end APIs, all sharing a single Supabase database.

### 2.1. Architecture Diagram

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
         └─────────────────────┘    └─────────────────────┘
```

### 2.2. Key Architectural Decisions

*   **Two Separate Applications**: The Admin App (this project) and the Main Platform App are separate applications. This provides a clear separation of concerns, better security, and independent deployment.
*   **Two Separate Backend APIs**: Each front-end application has its own dedicated back-end API, built with Cloudflare Workers. This allows for separation of admin logic, different rate limits, and independent scaling.
*   **Shared Database**: A single Supabase database serves as the source of truth for both applications, simplifying data integrity and eliminating the need for data synchronization.

## 3. Authentication & Authorization

### 3.1. Authentication Flow

1.  The user enters their email and password.
2.  The back-end validates the credentials with Supabase Auth.
3.  The back-end fetches the user record from the `users` table and verifies the user has the `platform_admin` role.
4.  The back-end generates a JWT with the user's information and permissions.
5.  The front-end stores the JWT in an httpOnly cookie.

### 3.2. Authorization

*   **Role-Based Access Control (RBAC)**: The platform uses a granular RBAC system. The Platform Admin role has the `platform:manage_all` permission, which grants full access to all resources.
*   **Middleware**: A middleware on the back-end validates the JWT and checks the user's permissions for every API request.

## 4. Core Features & Modules

*   **Dashboard**: Provides an overview of platform statistics, including entity and user counts, recent activity, and system health.
*   **School, College, University, and Company Management**: Allows admins to manage all aspects of the entities on the platform.
*   **User Management**: Provides a centralized directory of all users, with tools for managing user accounts.
*   **Approval Management**: A centralized queue for managing entity registration approvals.
*   **Audit Log**: Tracks all administrative actions for security and compliance.
*   **Settings & Configuration**: Allows admins to manage platform settings, role permissions, and more.
*   **Reports & Analytics**: Provides detailed reports on entity and user data.

## 5. API Architecture

The back-end API for the admin app is built with Cloudflare Workers and the Hono.js framework.

### 5.1. Key Endpoints

*   `POST /api/auth/login`: Authenticates the user and returns a JWT.
*   `GET /api/admin/dashboard`: Retrieves dashboard statistics.
*   `GET /api/admin/schools`: Retrieves a list of all schools.
*   `POST /api/admin/schools`: Creates a new school.
*   `GET /api/admin/users`: Retrieves a list of all users.
*   `GET /api/admin/audit-logs`: Retrieves a list of all audit logs.

## 6. Database Schema

The database schema is designed with a hierarchical structure, with entities like schools, colleges, and universities at the top, and students and educators at the bottom.

### 6.1. Entity Relationship Diagram

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

### 6.2. Core Principles

*   **One Student = One Class**: Students can only be enrolled in one class/course at a time.
*   **Many-to-Many for Educators**: Educators can teach multiple classes, and classes can have multiple educators.
*   **Hierarchical Structure**: The schema follows a hierarchical structure: University → College → Course → Students.
*   **Entity Isolation**: Each entity (school, college, university, company) is isolated.
*   **Audit Trail**: All changes are logged in the `audit_logs` table.

## 7. Building and Running

### 7.1. Development

To run the application in development mode, use the following command:

```bash
npm run dev
```

This will start the development server on `http://localhost:3000`.

### 7.2. Building for Production

To build the application for production, use the following command:

```bash
npm run build
```

This will create an optimized production build in the `.next` directory.

### 7.3. Cloudflare Pages Deployment

To deploy the application to Cloudflare Pages, use the following command:

```bash
npm run cf-build
```

## 8. Development Conventions

### 8.1. Code Style

The project uses the standard Next.js and React coding conventions. The code is written in JavaScript and uses Tailwind CSS for styling.

### 8.2. Testing

There are no explicit testing practices documented in the project. However, the use of `test_output.log` and `test_result.md` files suggests that some form of testing is in place.

### 8.3. Contribution Guidelines

There are no explicit contribution guidelines documented in the project.
