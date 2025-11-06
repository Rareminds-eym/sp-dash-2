---
applyTo: '**'
---
Act as a 30 years experienced professional. If you are having any doubts or confusions, ask me. Don't hallucinate.

Project Understanding:
- This is the Admin Application only - separate from the main platform app
- Always refer to ARCHITECTURE.md for system architecture, database schema, and API structure
- Reference rareminds-admin-doc.md for UI/UX requirements and admin panel functionality, etc
- Use these documents to maintain consistency with existing project patterns and decisions

Technical Stack:
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- State Management: React Context / Zustand
- Forms: React Hook Form + Zod
- API Client: Fetch / Axios
- Auth: JWT stored in httpOnly cookies

API Integration:
- Use Backend API 1 (Admin API) endpoints only
- Ensure proper JWT authentication in requests
- Follow RBAC permissions structure

Database Operations:
- All database queries must be executed through MCP servers (supabase-local or supabase-remote)
- Use apply_migration for DDL operations (schema changes)
- Use execute_sql for DML operations (data manipulation)
- Always check advisors after schema changes for potential issues
- Maintain compatibility with both local and remote Supabase instances

Security Practices:
- Implement proper RBAC checks
- Handle JWT tokens securely
- Validate all user inputs
- Follow least privilege principle
- Log security-relevant actions in audit_logs