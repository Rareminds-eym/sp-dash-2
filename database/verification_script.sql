-- ============================================================
-- DATABASE MIGRATION VERIFICATION SCRIPT
-- Run this after completing both migration steps
-- ============================================================

-- ============================================================
-- SECTION 1: TABLE EXISTENCE CHECK
-- ============================================================

DO $$ 
DECLARE
    v_table_count INTEGER;
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_required_tables TEXT[] := ARRAY[
        'users', 'students', 'skill_passports', 'universities', 'recruiters',
        'audit_logs', 'verifications', 'metrics_snapshots',
        'schools', 'school_classes', 'school_educators', 'school_educator_class_assignments',
        'colleges_standalone', 'college_courses', 'college_lecturers', 'college_lecturer_course_assignments',
        'university_colleges', 'university_courses', 'university_lecturers', 'university_lecturer_course_assignments',
        'colleges', 'companies', 'company_branches', 'permissions', 'role_permissions',
        'student_enrollments'
    ];
    v_table TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'MIGRATION VERIFICATION REPORT';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. TABLE EXISTENCE CHECK';
    RAISE NOTICE '----------------------------';
    
    FOREACH v_table IN ARRAY v_required_tables LOOP
        SELECT COUNT(*) INTO v_table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = v_table;
        
        IF v_table_count = 0 THEN
            v_missing_tables := array_append(v_missing_tables, v_table);
            RAISE NOTICE '   ❌ MISSING: %', v_table;
        ELSE
            RAISE NOTICE '   ✅ EXISTS: %', v_table;
        END IF;
    END LOOP;
    
    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '   ✅ All required tables exist!';
    END IF;
END $$;

-- ============================================================
-- SECTION 2: DATA COUNTS
-- ============================================================

DO $$ 
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '2. DATA COUNTS (Existing Tables)';
    RAISE NOTICE '----------------------------';
    
    SELECT COUNT(*) INTO v_count FROM users;
    RAISE NOTICE '   Users: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM students;
    RAISE NOTICE '   Students: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM skill_passports;
    RAISE NOTICE '   Skill Passports: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM universities;
    RAISE NOTICE '   Universities: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM recruiters;
    RAISE NOTICE '   Recruiters: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM audit_logs;
    RAISE NOTICE '   Audit Logs: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM verifications;
    RAISE NOTICE '   Verifications: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM metrics_snapshots;
    RAISE NOTICE '   Metrics Snapshots: %', v_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '   New Tables:';
    
    SELECT COUNT(*) INTO v_count FROM schools;
    RAISE NOTICE '   Schools: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM colleges;
    RAISE NOTICE '   Colleges (Unified): %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM companies;
    RAISE NOTICE '   Companies: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM permissions;
    RAISE NOTICE '   Permissions: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM role_permissions;
    RAISE NOTICE '   Role Permissions: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM student_enrollments;
    RAISE NOTICE '   Student Enrollments: %', v_count;
END $$;

-- ============================================================
-- SECTION 3: INDEX CHECK
-- ============================================================

DO $$ 
DECLARE
    v_index_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '3. PERFORMANCE INDEXES';
    RAISE NOTICE '----------------------------';
    
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
    
    RAISE NOTICE '   Total Indexes Created: %', v_index_count;
    
    IF v_index_count >= 40 THEN
        RAISE NOTICE '   ✅ Adequate indexes created for performance';
    ELSE
        RAISE WARNING '   ⚠️  Expected at least 40 indexes, found %', v_index_count;
    END IF;
END $$;

-- ============================================================
-- SECTION 4: TRIGGER CHECK
-- ============================================================

DO $$ 
DECLARE
    v_trigger_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '4. TRIGGERS';
    RAISE NOTICE '----------------------------';
    
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name LIKE 'update_%_updated_at';
    
    RAISE NOTICE '   Total Triggers Created: %', v_trigger_count;
    
    IF v_trigger_count >= 15 THEN
        RAISE NOTICE '   ✅ All update triggers created';
    ELSE
        RAISE WARNING '   ⚠️  Expected at least 15 triggers, found %', v_trigger_count;
    END IF;
END $$;

-- ============================================================
-- SECTION 5: FUNCTION CHECK
-- ============================================================

DO $$ 
DECLARE
    v_function_count INTEGER;
    v_required_functions TEXT[] := ARRAY[
        'update_updated_at_column',
        'get_active_enrollment',
        'transfer_student',
        'update_entity_student_counts',
        'validate_one_active_enrollment'
    ];
    v_function TEXT;
    v_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '5. FUNCTIONS';
    RAISE NOTICE '----------------------------';
    
    FOREACH v_function IN ARRAY v_required_functions LOOP
        SELECT EXISTS(
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_name = v_function
        ) INTO v_exists;
        
        IF v_exists THEN
            RAISE NOTICE '   ✅ EXISTS: %', v_function;
        ELSE
            RAISE NOTICE '   ❌ MISSING: %', v_function;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- SECTION 6: VIEW CHECK
-- ============================================================

DO $$ 
DECLARE
    v_required_views TEXT[] := ARRAY[
        'v_entity_overview',
        'v_student_current_enrollment'
    ];
    v_view TEXT;
    v_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '6. VIEWS';
    RAISE NOTICE '----------------------------';
    
    FOREACH v_view IN ARRAY v_required_views LOOP
        SELECT EXISTS(
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = v_view
        ) INTO v_exists;
        
        IF v_exists THEN
            RAISE NOTICE '   ✅ EXISTS: %', v_view;
        ELSE
            RAISE NOTICE '   ❌ MISSING: %', v_view;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- SECTION 7: ENUM CHECK
-- ============================================================

DO $$ 
DECLARE
    v_enum_count INTEGER;
    v_required_enums TEXT[] := ARRAY[
        'user_role',
        'entity_type',
        'account_status',
        'approval_status',
        'student_type',
        'verification_status',
        'enrollment_status',
        'college_type'
    ];
    v_enum TEXT;
    v_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '7. ENUMS';
    RAISE NOTICE '----------------------------';
    
    FOREACH v_enum IN ARRAY v_required_enums LOOP
        SELECT EXISTS(
            SELECT 1 FROM pg_type
            WHERE typname = v_enum AND typtype = 'e'
        ) INTO v_exists;
        
        IF v_exists THEN
            RAISE NOTICE '   ✅ EXISTS: %', v_enum;
        ELSE
            RAISE NOTICE '   ❌ MISSING: %', v_enum;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- SECTION 8: CONSTRAINT CHECK
-- ============================================================

DO $$ 
DECLARE
    v_constraint_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '8. CONSTRAINTS';
    RAISE NOTICE '----------------------------';
    
    -- Check foreign keys
    SELECT COUNT(*) INTO v_constraint_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY';
    
    RAISE NOTICE '   Foreign Keys: %', v_constraint_count;
    
    -- Check unique constraints
    SELECT COUNT(*) INTO v_constraint_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type = 'UNIQUE';
    
    RAISE NOTICE '   Unique Constraints: %', v_constraint_count;
    
    -- Check check constraints
    SELECT COUNT(*) INTO v_constraint_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type = 'CHECK';
    
    RAISE NOTICE '   Check Constraints: %', v_constraint_count;
    
    RAISE NOTICE '   ✅ All constraint types verified';
END $$;

-- ============================================================
-- SECTION 9: NEW COLUMNS CHECK (Sample Tables)
-- ============================================================

DO $$ 
DECLARE
    v_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '9. NEW COLUMNS CHECK';
    RAISE NOTICE '----------------------------';
    
    -- Check users table
    RAISE NOTICE '   Users table:';
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabase_auth_id') INTO v_exists;
    RAISE NOTICE '      supabase_auth_id: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') INTO v_exists;
    RAISE NOTICE '      first_name: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entity_type') INTO v_exists;
    RAISE NOTICE '      entity_type: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    -- Check students table
    RAISE NOTICE '   Students table:';
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='student_type') INTO v_exists;
    RAISE NOTICE '      student_type: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_name') INTO v_exists;
    RAISE NOTICE '      guardian_name: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    -- Check skill_passports table
    RAISE NOTICE '   Skill Passports table:';
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqf_level') INTO v_exists;
    RAISE NOTICE '      nsqf_level: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='ai_verified') INTO v_exists;
    RAISE NOTICE '      ai_verified: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    -- Check universities table
    RAISE NOTICE '   Universities table:';
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approval_status') INTO v_exists;
    RAISE NOTICE '      approval_status: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_colleges') INTO v_exists;
    RAISE NOTICE '      total_colleges: %', CASE WHEN v_exists THEN '✅' ELSE '❌' END;
END $$;

-- ============================================================
-- SECTION 10: FINAL SUMMARY
-- ============================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICATION COMPLETE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Review the output above for any ❌ marks';
    RAISE NOTICE '2. If all checks pass (✅), your migration is successful';
    RAISE NOTICE '3. Test your application to ensure all features work';
    RAISE NOTICE '4. Run POST /api/update-metrics to refresh dashboard data';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
END $$;

-- ============================================================
-- DETAILED TABLE LIST (for reference)
-- ============================================================

SELECT 
    'TABLE' as object_type,
    table_name as name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
