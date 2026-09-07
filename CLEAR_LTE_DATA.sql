-- ============================================================================
-- CLEAR ALL LTE CATALOG DATA
-- ============================================================================
-- Run this in your LTE Supabase Studio (http://127.0.0.1:54343)
-- This will delete all existing catalog data so you can upload fresh data
-- ============================================================================

-- Truncate in reverse dependency order to avoid foreign key issues
-- Note: artifact_template_questions and courses tables don't exist yet
TRUNCATE TABLE public.artifact_templates CASCADE;
TRUNCATE TABLE public.artifact_questions CASCADE;
TRUNCATE TABLE public.module_artifacts CASCADE;
TRUNCATE TABLE public.e_content CASCADE;
TRUNCATE TABLE public.modules_content CASCADE;
TRUNCATE TABLE public.modules CASCADE;
TRUNCATE TABLE public.level_skills CASCADE;
TRUNCATE TABLE public.levels CASCADE;
TRUNCATE TABLE public.skills CASCADE;
TRUNCATE TABLE public.role_capability_sequence CASCADE;
TRUNCATE TABLE public.level_scale CASCADE;
TRUNCATE TABLE public.capabilities CASCADE;
TRUNCATE TABLE public.roles CASCADE;

-- Optionally clear upload history (comment out if you want to keep the history)
-- TRUNCATE TABLE public.lte_catalog_uploads CASCADE;

-- Verify tables are empty
SELECT 
  'roles' AS table_name, COUNT(*) AS records FROM public.roles
UNION ALL SELECT 'capabilities', COUNT(*) FROM public.capabilities
UNION ALL SELECT 'level_scale', COUNT(*) FROM public.level_scale
UNION ALL SELECT 'role_capability_sequence', COUNT(*) FROM public.role_capability_sequence
UNION ALL SELECT 'skills', COUNT(*) FROM public.skills
UNION ALL SELECT 'levels', COUNT(*) FROM public.levels
UNION ALL SELECT 'level_skills', COUNT(*) FROM public.level_skills
UNION ALL SELECT 'modules', COUNT(*) FROM public.modules
UNION ALL SELECT 'modules_content', COUNT(*) FROM public.modules_content
UNION ALL SELECT 'e_content', COUNT(*) FROM public.e_content
UNION ALL SELECT 'module_artifacts', COUNT(*) FROM public.module_artifacts
UNION ALL SELECT 'artifact_questions', COUNT(*) FROM public.artifact_questions
UNION ALL SELECT 'artifact_templates', COUNT(*) FROM public.artifact_templates;

-- ============================================================================
-- All tables should now show 0 records
-- Now you can upload your Excel file and it will insert fresh data
-- ============================================================================


-- ============================================================================
-- All tables should now show 0 records
-- Now you can upload your Excel file and it will insert fresh data
-- ============================================================================
