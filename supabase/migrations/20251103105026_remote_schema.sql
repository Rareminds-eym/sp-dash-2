


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM add_recent_update(
    p_student_id,
    p_achievement,
    'achievement'
  );
END;
$$;


ALTER FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") IS 'Manually adds achievement update';



CREATE OR REPLACE FUNCTION "public"."add_jsonb_recent_update"("student_email" "text", "update_title" "text", "update_type" "text" DEFAULT 'system'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."add_jsonb_recent_update"("student_email" "text", "update_title" "text", "update_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_jsonb_recent_update"("student_uuid" "uuid", "update_title" "text", "update_description" "text" DEFAULT NULL::"text", "update_type" "text" DEFAULT 'system'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."add_jsonb_recent_update"("student_uuid" "uuid", "update_title" "text", "update_description" "text", "update_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM add_recent_update(
    p_student_id,
    'New opportunity match: ' || p_opportunity_title || ' at ' || p_company_name,
    'opportunity_match'
  );
END;
$$;


ALTER FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") IS 'Manually adds opportunity match update';



CREATE OR REPLACE FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") IS 'Adds a new update to student recent_updates table (uses student_id only)';



CREATE OR REPLACE FUNCTION "public"."add_recent_update"("student_email" "text", "update_title" "text", "update_description" "text" DEFAULT NULL::"text", "update_type" "text" DEFAULT 'system'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."add_recent_update"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_recent_update_by_email"("student_email" "text", "update_title" "text", "update_description" "text" DEFAULT NULL::"text", "update_type" "text" DEFAULT 'system'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."add_recent_update_by_email"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") IS 'Add a new item to a JSONB array in student profile';



CREATE OR REPLACE FUNCTION "public"."analyze_skills_demand"() RETURNS TABLE("skill" "text", "total_mentions" bigint)
    LANGUAGE "sql" STABLE
    AS $_$

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

$_$;


ALTER FUNCTION "public"."analyze_skills_demand"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_to_job"("p_student_id" "uuid", "p_opportunity_id" integer) RETURNS TABLE("success" boolean, "message" "text", "application_id" integer)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."apply_to_job"("p_student_id" "uuid", "p_opportunity_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_applications_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.opportunities
  SET applications_count = GREATEST(applications_count - 1, 0)
  WHERE id = OLD.opportunity_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_applications_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) IS 'Delete an item from a JSONB array';



CREATE OR REPLACE FUNCTION "public"."get_popular_opportunities"("student_id_param" "uuid", "limit_count" integer) RETURNS TABLE("id" "uuid", "title" "text", "job_title" "text", "company_name" "text", "company_logo" "text", "description" "text", "location" "text", "employment_type" "text", "department" "text", "salary_min" numeric, "salary_max" numeric, "experience_level" "text", "skills_required" "jsonb", "requirements" "jsonb", "responsibilities" "jsonb", "created_at" timestamp with time zone, "view_count" integer, "application_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_popular_opportunities"("student_id_param" "uuid", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") IS 'Get total unread message count for a specific user';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_applications_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.opportunities
  SET applications_count = applications_count + 1
  WHERE id = NEW.opportunity_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_applications_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_search_usage"("search_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE recruiter_saved_searches
  SET 
    use_count = use_count + 1,
    last_used = NOW()
  WHERE id = search_id;
END;
$$;


ALTER FUNCTION "public"."increment_search_usage"("search_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "text", "p_user_id" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_opportunities"("query_embedding" "public"."vector", "student_id_param" "uuid", "dismissed_ids" "uuid"[], "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "title" "text", "job_title" "text", "company_name" "text", "company_logo" "text", "description" "text", "location" "text", "employment_type" "text", "department" "text", "salary_min" numeric, "salary_max" numeric, "experience_level" "text", "skills_required" "jsonb", "requirements" "jsonb", "responsibilities" "jsonb", "created_at" timestamp with time zone, "similarity" double precision, "view_count" integer, "application_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."match_opportunities"("query_embedding" "public"."vector", "student_id_param" "uuid", "dismissed_ids" "uuid"[], "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_students_new_opportunity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_students_new_opportunity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_students_opportunity_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_students_opportunity_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."reset_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_save_job"("p_student_id" "uuid", "p_opportunity_id" integer) RETURNS TABLE("success" boolean, "message" "text", "is_saved" boolean, "saved_job_id" integer)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."toggle_save_job"("p_student_id" "uuid", "p_opportunity_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text" DEFAULT 'anonymous'::"text", "p_viewer_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text", "p_viewer_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text", "p_viewer_id" "uuid") IS 'Tracks profile view and creates update notification every 5 views';



CREATE OR REPLACE FUNCTION "public"."trg_assignments_completion_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        IF NEW.submission_date IS NULL THEN
            NEW.submission_date := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_assignments_completion_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_assignments_grade_pct_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.grade_received IS NOT NULL AND NEW.total_points IS NOT NULL AND NEW.total_points > 0 THEN
        NEW.grade_percentage := ROUND((NEW.grade_received / NEW.total_points) * 100, 2);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_assignments_grade_pct_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_assignments_updated_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_date := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_assignments_updated_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_insert_recent_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_insert_recent_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_student_assignments_grade_pct_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_student_assignments_grade_pct_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_student_assignments_late_check_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_student_assignments_late_check_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_student_assignments_status_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_student_assignments_status_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_student_assignments_updated_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_date := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_student_assignments_updated_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_skills_improvement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_skills_improvement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_training_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_training_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_applied_jobs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_applied_jobs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_conversation_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") IS 'Update an existing item in a JSONB array';



CREATE OR REPLACE FUNCTION "public"."update_saved_jobs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_saved_jobs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_students_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_students_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applied_jobs" (
    "id" integer NOT NULL,
    "student_id" "uuid" NOT NULL,
    "opportunity_id" integer NOT NULL,
    "application_status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "viewed_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "interview_scheduled_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_application_status" CHECK (("application_status" = ANY (ARRAY['applied'::"text", 'viewed'::"text", 'under_review'::"text", 'interview_scheduled'::"text", 'interviewed'::"text", 'offer_received'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."applied_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."applied_jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."applied_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."applied_jobs_id_seq" OWNED BY "public"."applied_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."assignment_attachments" (
    "attachment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "file_url" "text",
    "uploaded_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."assignment_attachments" IS 'File attachments linked to assignment submissions or templates';



CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "assignment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "course_name" "text" NOT NULL,
    "course_code" "text",
    "educator_id" "uuid",
    "educator_name" "text",
    "total_points" numeric(7,2) DEFAULT 100 NOT NULL,
    "assignment_type" "text",
    "skill_outcomes" "text"[],
    "assign_classes" "text",
    "document_pdf" "text",
    "due_date" timestamp with time zone NOT NULL,
    "available_from" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allow_late_submission" boolean DEFAULT true NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['homework'::"text", 'project'::"text", 'quiz'::"text", 'exam'::"text", 'lab'::"text", 'essay'::"text", 'presentation'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."assignments" IS 'Master assignment templates created by instructors for courses';



COMMENT ON COLUMN "public"."assignments"."assignment_id" IS 'Primary key - auto-generated unique identifier';



COMMENT ON COLUMN "public"."assignments"."total_points" IS 'Maximum points possible for this assignment';



COMMENT ON COLUMN "public"."assignments"."skill_outcomes" IS 'Array of skill outcomes/learning objectives for this assignment';



COMMENT ON COLUMN "public"."assignments"."assign_classes" IS 'Classes/sections assigned to this assignment';



COMMENT ON COLUMN "public"."assignments"."document_pdf" IS 'URL or path to PDF document associated with assignment';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "actorId" "uuid",
    "action" "text" NOT NULL,
    "target" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "ip" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "issuer" character varying(150),
    "level" character varying(100),
    "credential_id" character varying(150),
    "link" "text",
    "issued_on" "date",
    "description" "text",
    "status" character varying(50),
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "application_id" integer,
    "opportunity_id" integer,
    "subject" "text",
    "status" "text" DEFAULT 'active'::"text",
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    "last_message_sender" "text",
    "student_unread_count" integer DEFAULT 0,
    "recruiter_unread_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "company_logo" "text",
    "employment_type" "text" NOT NULL,
    "location" "text" NOT NULL,
    "mode" "text",
    "stipend_or_salary" "text",
    "experience_required" "text",
    "skills_required" "jsonb",
    "description" "text",
    "application_link" "text",
    "deadline" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "department" "text" NOT NULL,
    "experience_level" "text",
    "salary_range_min" integer,
    "salary_range_max" integer,
    "status" "text" DEFAULT 'draft'::"text",
    "posted_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "closing_date" timestamp with time zone,
    "requirements" "jsonb",
    "responsibilities" "jsonb",
    "benefits" "jsonb",
    "applications_count" integer DEFAULT 0,
    "messages_count" integer DEFAULT 0,
    "views_count" integer DEFAULT 0,
    "created_by" "text",
    "job_title" "text" NOT NULL,
    "recruiter_id" "uuid",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "state" "text",
    "website" "text",
    "verificationstatus" "text" DEFAULT 'approved'::"text",
    "isactive" boolean DEFAULT true,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "universityId" "uuid" NOT NULL,
    "profile" "jsonb" DEFAULT '{}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL,
    "name" character varying(150),
    "age" integer,
    "date_of_birth" "date",
    "contact_number" character varying(20),
    "alternate_number" character varying(20),
    "district_name" character varying(100),
    "university" character varying(150),
    "branch_field" character varying(150),
    "college_school_name" character varying(150),
    "registration_number" character varying(100),
    "github_link" "text",
    "linkedin_link" "text",
    "twitter_link" "text",
    "facebook_link" "text",
    "instagram_link" "text",
    "portfolio_link" "text",
    "other_social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."conversations_detailed" AS
 SELECT "c"."id",
    "c"."student_id",
    "c"."recruiter_id",
    "c"."application_id",
    "c"."opportunity_id",
    "c"."subject",
    "c"."status",
    "c"."last_message_at",
    "c"."last_message_preview",
    "c"."last_message_sender",
    "c"."student_unread_count",
    "c"."recruiter_unread_count",
    "c"."created_at",
    "c"."updated_at",
    ("s"."profile" ->> 'name'::"text") AS "student_name",
    "s"."email" AS "student_email",
    ("s"."profile" ->> 'university'::"text") AS "student_university",
    ("s"."profile" ->> 'course'::"text") AS "student_course",
    ("s"."profile" ->> 'branch_field'::"text") AS "student_department",
    "r"."name" AS "recruiter_name",
    "r"."email" AS "recruiter_email",
    "r"."phone" AS "recruiter_phone",
    "r"."website" AS "recruiter_website",
    "aj"."application_status",
    "o"."job_title",
    "o"."company_name"
   FROM (((("public"."conversations" "c"
     LEFT JOIN "public"."students" "s" ON (("c"."student_id" = "s"."id")))
     LEFT JOIN "public"."recruiters" "r" ON (("c"."recruiter_id" = "r"."id")))
     LEFT JOIN "public"."applied_jobs" "aj" ON (("c"."application_id" = "aj"."id")))
     LEFT JOIN "public"."opportunities" "o" ON (("c"."opportunity_id" = "o"."id")))
  WHERE ("c"."status" = 'active'::"text");


ALTER VIEW "public"."conversations_detailed" OWNER TO "postgres";


COMMENT ON VIEW "public"."conversations_detailed" IS 'Conversations with full participant and application details';



CREATE TABLE IF NOT EXISTS "public"."education" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "level" character varying(50),
    "degree" character varying(100),
    "department" character varying(100),
    "university" character varying(150),
    "year_of_passing" character varying(10),
    "cgpa" character varying(10),
    "status" character varying(50),
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."education" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "organization" character varying(150),
    "role" character varying(150),
    "start_date" "date",
    "end_date" "date",
    "duration" character varying(100),
    "verified" boolean DEFAULT false,
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."experience" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_activities" (
    "id" integer NOT NULL,
    "shortlist_id" "text" NOT NULL,
    "export_format" "text" NOT NULL,
    "export_type" "text" NOT NULL,
    "exported_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "exported_by" "text",
    "include_pii" boolean DEFAULT false
);


ALTER TABLE "public"."export_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."export_activities" IS 'Audit log for shortlist exports';



CREATE SEQUENCE IF NOT EXISTS "public"."export_activities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."export_activities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."export_activities_id_seq" OWNED BY "public"."export_activities"."id";



CREATE TABLE IF NOT EXISTS "public"."interview_reminders" (
    "id" integer NOT NULL,
    "interview_id" "text" NOT NULL,
    "sent_to" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reminder_type" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."interview_reminders" OWNER TO "postgres";


COMMENT ON TABLE "public"."interview_reminders" IS 'Audit log for interview reminder activities';



CREATE SEQUENCE IF NOT EXISTS "public"."interview_reminders_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."interview_reminders_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."interview_reminders_id_seq" OWNED BY "public"."interview_reminders"."id";



CREATE TABLE IF NOT EXISTS "public"."interviews" (
    "id" "text" NOT NULL,
    "student_id" "uuid",
    "candidate_name" "text" NOT NULL,
    "candidate_email" "text",
    "candidate_phone" "text",
    "job_title" "text" NOT NULL,
    "interviewer" "text" NOT NULL,
    "interviewer_email" "text",
    "date" timestamp with time zone NOT NULL,
    "duration" integer DEFAULT 60,
    "status" "text" DEFAULT 'scheduled'::"text",
    "type" "text" NOT NULL,
    "meeting_type" "text",
    "meeting_link" "text",
    "meeting_notes" "text",
    "reminders_sent" integer DEFAULT 0,
    "completed_date" timestamp with time zone,
    "scorecard" "jsonb",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."interviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."interviews" IS 'Interview scheduling and tracking for candidates';



COMMENT ON COLUMN "public"."interviews"."status" IS 'scheduled: Initial state, confirmed: Candidate confirmed, completed: Interview done, cancelled: Interview cancelled, pending: Waiting for confirmation';



COMMENT ON COLUMN "public"."interviews"."meeting_type" IS 'Type of meeting platform: teams, meet, zoom, phone, in-person';



COMMENT ON COLUMN "public"."interviews"."scorecard" IS 'JSONB object containing interview evaluation: {technical_skills, communication, problem_solving, cultural_fit, overall_rating, notes, recommendation}';



CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "id" integer NOT NULL,
    "message_id" integer NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "user_type" character varying(20) NOT NULL,
    "emoji" character varying(10) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_user_type_check" CHECK ((("user_type")::"text" = ANY (ARRAY[('student'::character varying)::"text", ('recruiter'::character varying)::"text"])))
);


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."message_reactions" IS 'Stores emoji reactions to messages';



CREATE SEQUENCE IF NOT EXISTS "public"."message_reactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."message_reactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."message_reactions_id_seq" OWNED BY "public"."message_reactions"."id";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" integer NOT NULL,
    "conversation_id" "text" NOT NULL,
    "sender_id" "text" NOT NULL,
    "sender_type" "text" NOT NULL,
    "receiver_id" "text" NOT NULL,
    "receiver_type" "text" NOT NULL,
    "message_text" "text" NOT NULL,
    "attachments" "jsonb",
    "application_id" integer,
    "opportunity_id" integer,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "messages_receiver_type_check" CHECK (("receiver_type" = ANY (ARRAY['student'::"text", 'recruiter'::"text"]))),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['student'::"text", 'recruiter'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."messages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."messages_id_seq" OWNED BY "public"."messages"."id";



CREATE TABLE IF NOT EXISTS "public"."metrics_snapshots" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "snapshotDate" "date" DEFAULT CURRENT_DATE NOT NULL,
    "activeUniversities" integer DEFAULT 0,
    "registeredStudents" integer DEFAULT 0,
    "verifiedPassports" integer DEFAULT 0,
    "aiVerifiedPercent" numeric(5,2) DEFAULT 0,
    "employabilityIndex" numeric(5,2) DEFAULT 0,
    "activeRecruiters" integer DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metrics_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "candidate_id" "uuid",
    "candidate_name" "text" NOT NULL,
    "job_id" "text",
    "job_title" "text" NOT NULL,
    "template" "text",
    "ctc_band" "text",
    "offered_ctc" "text",
    "offer_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "expiry_date" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "sent_via" "text" DEFAULT 'email'::"text",
    "benefits" "text"[],
    "notes" "text",
    "response_deadline" timestamp with time zone,
    "acceptance_notes" "text",
    "response_date" timestamp with time zone,
    CONSTRAINT "offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."opportunities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."opportunities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."opportunities_id_seq" OWNED BY "public"."opportunities"."id";



CREATE OR REPLACE VIEW "public"."pending_scorecards" AS
 SELECT "i"."id",
    "i"."student_id",
    "i"."candidate_name",
    "i"."candidate_email",
    "i"."candidate_phone",
    "i"."job_title",
    "i"."interviewer",
    "i"."interviewer_email",
    "i"."date",
    "i"."duration",
    "i"."status",
    "i"."type",
    "i"."meeting_type",
    "i"."meeting_link",
    "i"."meeting_notes",
    "i"."reminders_sent",
    "i"."completed_date",
    "i"."scorecard",
    "i"."created_by",
    "i"."created_at",
    "i"."updated_at",
    ("s"."profile" ->> 'name'::"text") AS "student_name",
    ("s"."profile" ->> 'department'::"text") AS "department"
   FROM ("public"."interviews" "i"
     LEFT JOIN "public"."students" "s" ON (("i"."student_id" = "s"."id")))
  WHERE (("i"."status" = 'completed'::"text") AND (("i"."scorecard" IS NULL) OR (("i"."scorecard" ->> 'overall_rating'::"text") IS NULL)))
  ORDER BY "i"."completed_date" DESC;


ALTER VIEW "public"."pending_scorecards" OWNER TO "postgres";


COMMENT ON VIEW "public"."pending_scorecards" IS 'Completed interviews missing scorecards (student details from profile JSONB).';



CREATE TABLE IF NOT EXISTS "public"."pipeline_activities" (
    "id" integer NOT NULL,
    "pipeline_candidate_id" integer NOT NULL,
    "activity_type" "text" NOT NULL,
    "from_stage" "text",
    "to_stage" "text",
    "activity_details" "jsonb",
    "performed_by" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pipeline_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."pipeline_activities" IS 'Audit log for all pipeline activities and stage changes';



CREATE SEQUENCE IF NOT EXISTS "public"."pipeline_activities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pipeline_activities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pipeline_activities_id_seq" OWNED BY "public"."pipeline_activities"."id";



CREATE TABLE IF NOT EXISTS "public"."pipeline_candidates" (
    "id" integer NOT NULL,
    "requisition_id" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "candidate_name" "text" NOT NULL,
    "candidate_email" "text",
    "candidate_phone" "text",
    "stage" "text" DEFAULT 'sourced'::"text" NOT NULL,
    "previous_stage" "text",
    "stage_changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "stage_changed_by" "text",
    "status" "text" DEFAULT 'active'::"text",
    "rejection_reason" "text",
    "rejection_date" timestamp with time zone,
    "next_action" "text",
    "next_action_date" timestamp with time zone,
    "next_action_notes" "text",
    "recruiter_rating" integer,
    "recruiter_notes" "text",
    "assigned_to" "text",
    "source" "text",
    "added_by" "text",
    "added_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pipeline_candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."pipeline_candidates" IS 'Candidates in recruitment pipeline with stage tracking';



COMMENT ON COLUMN "public"."pipeline_candidates"."stage" IS 'Current stage of candidate in pipeline';



COMMENT ON COLUMN "public"."pipeline_candidates"."next_action" IS 'Next planned recruiter action';



COMMENT ON COLUMN "public"."pipeline_candidates"."source" IS 'How the candidate entered the pipeline';



CREATE TABLE IF NOT EXISTS "public"."requisitions" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "department" "text" NOT NULL,
    "location" "text" NOT NULL,
    "job_type" "text" DEFAULT 'Full-time'::"text",
    "openings" integer DEFAULT 1,
    "status" "text" DEFAULT 'active'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "description" "text",
    "requirements" "text",
    "salary_range" "text",
    "owner" "text",
    "hiring_manager" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "target_date" timestamp with time zone,
    "filled_date" timestamp with time zone,
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."requisitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."requisitions" IS 'Job requisitions/openings for recruitment';



CREATE OR REPLACE VIEW "public"."pipeline_candidates_detailed" AS
 SELECT "pc"."id",
    "pc"."requisition_id",
    "pc"."student_id",
    "pc"."candidate_name",
    "pc"."candidate_email",
    "pc"."candidate_phone",
    "pc"."stage",
    "pc"."previous_stage",
    "pc"."stage_changed_at",
    "pc"."stage_changed_by",
    "pc"."status",
    "pc"."rejection_reason",
    "pc"."rejection_date",
    "pc"."next_action",
    "pc"."next_action_date",
    "pc"."next_action_notes",
    "pc"."recruiter_rating",
    "pc"."recruiter_notes",
    "pc"."assigned_to",
    "pc"."source",
    "pc"."added_by",
    "pc"."added_at",
    "pc"."created_at",
    "pc"."updated_at",
    ("s"."profile" ->> 'name'::"text") AS "student_name",
    ("s"."profile" ->> 'email'::"text") AS "student_email",
    ("s"."profile" ->> 'phone'::"text") AS "student_phone",
    ("s"."profile" ->> 'department'::"text") AS "student_department",
    ("s"."profile" ->> 'university'::"text") AS "student_university",
    ("s"."profile" ->> 'cgpa'::"text") AS "student_cgpa",
    ("s"."profile" ->> 'employability_score'::"text") AS "student_employability_score",
    ("s"."profile" ->> 'verified'::"text") AS "student_verified",
    "r"."title" AS "job_title",
    "r"."location" AS "job_location",
    "r"."status" AS "requisition_status"
   FROM (("public"."pipeline_candidates" "pc"
     LEFT JOIN "public"."students" "s" ON (("pc"."student_id" = "s"."id")))
     LEFT JOIN "public"."requisitions" "r" ON (("pc"."requisition_id" = "r"."id")))
  WHERE ("pc"."status" = 'active'::"text");


ALTER VIEW "public"."pipeline_candidates_detailed" OWNER TO "postgres";


COMMENT ON VIEW "public"."pipeline_candidates_detailed" IS 'Active pipeline candidates joined with student (profile JSONB) and requisition data';



CREATE SEQUENCE IF NOT EXISTS "public"."pipeline_candidates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pipeline_candidates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pipeline_candidates_id_seq" OWNED BY "public"."pipeline_candidates"."id";



CREATE TABLE IF NOT EXISTS "public"."placements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studentId" "uuid",
    "recruiterId" "uuid",
    "jobTitle" "text" NOT NULL,
    "salaryOffered" numeric(10,2),
    "placementStatus" "text" NOT NULL,
    "appliedDate" timestamp with time zone,
    "hiredDate" timestamp with time zone,
    "retentionDate" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "placements_placementStatus_check" CHECK (("placementStatus" = ANY (ARRAY['applied'::"text", 'shortlisted'::"text", 'interviewed'::"text", 'offered'::"text", 'hired'::"text", 'rejected'::"text", 'retained_6m'::"text", 'retained_1y'::"text"])))
);


ALTER TABLE "public"."placements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "viewer_type" "text" NOT NULL,
    "viewer_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_views" IS 'Tracks profile views for analytics and notifications';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "status" character varying(50),
    "start_date" "date",
    "end_date" "date",
    "duration" character varying(100),
    "tech_stack" "text"[],
    "demo_link" "text",
    "github_link" "text",
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recent_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updates" "jsonb" DEFAULT '{"updates": []}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recent_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiterId" "uuid",
    "activityType" "text" NOT NULL,
    "targetStudentId" "uuid",
    "searchCriteria" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recruiter_activities_activityType_check" CHECK (("activityType" = ANY (ARRAY['search'::"text", 'profile_view'::"text", 'contact'::"text", 'shortlist'::"text", 'hire_intent'::"text"])))
);


ALTER TABLE "public"."recruiter_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "search_criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_saved_searches" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."requisitions_with_pipeline_stats" AS
SELECT
    NULL::"text" AS "id",
    NULL::"text" AS "title",
    NULL::"text" AS "department",
    NULL::"text" AS "location",
    NULL::"text" AS "job_type",
    NULL::integer AS "openings",
    NULL::"text" AS "status",
    NULL::"text" AS "priority",
    NULL::"text" AS "description",
    NULL::"text" AS "requirements",
    NULL::"text" AS "salary_range",
    NULL::"text" AS "owner",
    NULL::"text" AS "hiring_manager",
    NULL::"text" AS "created_by",
    NULL::timestamp with time zone AS "created_date",
    NULL::timestamp with time zone AS "target_date",
    NULL::timestamp with time zone AS "filled_date",
    NULL::"text"[] AS "tags",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "total_candidates",
    NULL::bigint AS "sourced_count",
    NULL::bigint AS "screened_count",
    NULL::bigint AS "interview_1_count",
    NULL::bigint AS "interview_2_count",
    NULL::bigint AS "offer_count",
    NULL::bigint AS "hired_count";


ALTER VIEW "public"."requisitions_with_pipeline_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."requisitions_with_pipeline_stats" IS 'Each requisition with stage-wise candidate counts for dashboard summaries';



CREATE TABLE IF NOT EXISTS "public"."saved_jobs" (
    "id" integer NOT NULL,
    "student_id" "uuid" NOT NULL,
    "opportunity_id" integer NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."saved_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."saved_jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."saved_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."saved_jobs_id_seq" OWNED BY "public"."saved_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."shortlist_candidates" (
    "id" integer NOT NULL,
    "shortlist_id" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "added_by" "text",
    "notes" "text"
);


ALTER TABLE "public"."shortlist_candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."shortlist_candidates" IS 'Junction table linking shortlists to students';



CREATE SEQUENCE IF NOT EXISTS "public"."shortlist_candidates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shortlist_candidates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shortlist_candidates_id_seq" OWNED BY "public"."shortlist_candidates"."id";



CREATE TABLE IF NOT EXISTS "public"."shortlists" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "shared" boolean DEFAULT false,
    "share_link" "text",
    "share_expiry" timestamp with time zone,
    "watermark" boolean DEFAULT false,
    "include_pii" boolean DEFAULT false,
    "notify_on_access" boolean DEFAULT false,
    "tags" "text"[],
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."shortlists" OWNER TO "postgres";


COMMENT ON TABLE "public"."shortlists" IS 'Shortlists created by recruiters to organize candidates';



CREATE OR REPLACE VIEW "public"."shortlists_with_counts" AS
SELECT
    NULL::"text" AS "id",
    NULL::"text" AS "name",
    NULL::"text" AS "description",
    NULL::"text" AS "created_by",
    NULL::timestamp with time zone AS "created_date",
    NULL::"text" AS "status",
    NULL::boolean AS "shared",
    NULL::"text" AS "share_link",
    NULL::timestamp with time zone AS "share_expiry",
    NULL::boolean AS "watermark",
    NULL::boolean AS "include_pii",
    NULL::boolean AS "notify_on_access",
    NULL::"text"[] AS "tags",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "candidate_count";


ALTER VIEW "public"."shortlists_with_counts" OWNER TO "postgres";


COMMENT ON VIEW "public"."shortlists_with_counts" IS 'Shortlists with their candidate counts for efficient querying';



CREATE TABLE IF NOT EXISTS "public"."skill_passports" (
    "studentId" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "aiVerification" boolean DEFAULT false,
    "nsqfLevel" integer,
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projects" "jsonb" DEFAULT '[]'::"jsonb",
    "certificates" "jsonb" DEFAULT '[]'::"jsonb",
    "assessments" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "skill_passports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."skill_passports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_trends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "skillName" "text" NOT NULL,
    "category" "text" NOT NULL,
    "demandScore" integer DEFAULT 0,
    "trendDirection" "text",
    "weeklyGrowth" numeric(5,2) DEFAULT 0,
    "monthlyGrowth" numeric(5,2) DEFAULT 0,
    "snapshotDate" "date" DEFAULT CURRENT_DATE NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "skill_trends_trendDirection_check" CHECK (("trendDirection" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."skill_trends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "type" character varying(20),
    "level" integer,
    "description" "text",
    "verified" boolean DEFAULT false,
    "enabled" boolean DEFAULT true,
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "skills_level_check" CHECK ((("level" >= 1) AND ("level" <= 5))),
    CONSTRAINT "skills_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('technical'::character varying)::"text", ('soft'::character varying)::"text"])))
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_assignments" (
    "student_assignment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "grade_received" numeric(7,2),
    "grade_percentage" numeric(5,2),
    "instructor_feedback" "text",
    "feedback_date" timestamp with time zone,
    "graded_by" "uuid",
    "graded_date" timestamp with time zone,
    "submission_date" timestamp with time zone,
    "submission_type" "text",
    "submission_content" "text",
    "submission_url" "text",
    "is_late" boolean DEFAULT false NOT NULL,
    "late_penalty" numeric(5,2),
    "assigned_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_date" timestamp with time zone,
    "completed_date" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_grade_percentage_range" CHECK ((("grade_percentage" IS NULL) OR (("grade_percentage" >= (0)::numeric) AND ("grade_percentage" <= (100)::numeric)))),
    CONSTRAINT "chk_status_dates" CHECK (((("status" <> 'submitted'::"text") OR ("completed_date" IS NOT NULL)) AND (("status" <> 'graded'::"text") OR ("graded_date" IS NOT NULL)))),
    CONSTRAINT "student_assignments_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "student_assignments_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in-progress'::"text", 'submitted'::"text", 'graded'::"text"]))),
    CONSTRAINT "student_assignments_submission_type_check" CHECK (("submission_type" = ANY (ARRAY['file'::"text", 'text'::"text", 'url'::"text", 'code'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."student_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_assignments" IS 'Links students to assignments and tracks their individual progress and submissions';



COMMENT ON COLUMN "public"."student_assignments"."status" IS 'Student status: todo, in-progress, submitted, graded, returned';



COMMENT ON COLUMN "public"."student_assignments"."grade_percentage" IS 'Auto-calculated from grade_received and assignment total_points';



COMMENT ON COLUMN "public"."student_assignments"."is_late" IS 'Auto-calculated by comparing submission_date with assignment due_date';



CREATE TABLE IF NOT EXISTS "public"."trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" character varying(150) NOT NULL,
    "organization" character varying(150),
    "start_date" "date",
    "end_date" "date",
    "duration" character varying(100),
    "description" "text",
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."universities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "state" "text",
    "district" "text",
    "website" "text",
    "verificationstatus" "text" DEFAULT 'approved'::"text",
    "isactive" boolean DEFAULT true,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."universities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."university_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "universityId" "uuid" NOT NULL,
    "enrollmentCount" integer DEFAULT 0,
    "completionRate" numeric(5,2) DEFAULT 0,
    "verificationRate" numeric(5,2) DEFAULT 0,
    "placementRate" numeric(5,2) DEFAULT 0,
    "avgSalary" numeric(10,2) DEFAULT 0,
    "performanceScore" numeric(5,2) DEFAULT 0,
    "rankPosition" integer,
    "snapshotDate" "date" DEFAULT CURRENT_DATE NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."university_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unread_messages_summary" AS
 SELECT "receiver_id",
    "receiver_type",
    "count"(*) AS "unread_count",
    "max"("created_at") AS "latest_unread_at"
   FROM "public"."messages"
  WHERE ("is_read" = false)
  GROUP BY "receiver_id", "receiver_type";


ALTER VIEW "public"."unread_messages_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."upcoming_interviews" AS
 SELECT "i"."id",
    "i"."student_id",
    "i"."candidate_name",
    "i"."candidate_email",
    "i"."candidate_phone",
    "i"."job_title",
    "i"."interviewer",
    "i"."interviewer_email",
    "i"."date",
    "i"."duration",
    "i"."status",
    "i"."type",
    "i"."meeting_type",
    "i"."meeting_link",
    "i"."meeting_notes",
    "i"."reminders_sent",
    "i"."completed_date",
    "i"."scorecard",
    "i"."created_by",
    "i"."created_at",
    "i"."updated_at",
    ("s"."profile" ->> 'name'::"text") AS "student_name",
    ("s"."profile" ->> 'email'::"text") AS "student_email",
    ("s"."profile" ->> 'phone'::"text") AS "student_phone",
    ("s"."profile" ->> 'department'::"text") AS "department",
    ("s"."profile" ->> 'university'::"text") AS "university"
   FROM ("public"."interviews" "i"
     LEFT JOIN "public"."students" "s" ON (("i"."student_id" = "s"."id")))
  WHERE (("i"."date" > "now"()) AND ("i"."status" <> ALL (ARRAY['completed'::"text", 'cancelled'::"text"])))
  ORDER BY "i"."date";


ALTER VIEW "public"."upcoming_interviews" OWNER TO "postgres";


COMMENT ON VIEW "public"."upcoming_interviews" IS 'Upcoming interviews with student details from profile JSONB.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "organizationId" "uuid" DEFAULT "gen_random_uuid"(),
    "isActive" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verifications" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "targetTable" "text" NOT NULL,
    "targetId" "text" NOT NULL,
    "action" "text" NOT NULL,
    "performedBy" "uuid",
    "note" "text",
    "createdAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."verifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."applied_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."applied_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."export_activities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."export_activities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."interview_reminders" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."interview_reminders_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."message_reactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."message_reactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."opportunities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."opportunities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pipeline_activities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pipeline_activities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pipeline_candidates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pipeline_candidates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."saved_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."saved_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shortlist_candidates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shortlist_candidates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."applied_jobs"
    ADD CONSTRAINT "applied_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "assignment_attachments_pkey" PRIMARY KEY ("attachment_id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_student_id_recruiter_id_application_id_key" UNIQUE ("student_id", "recruiter_id", "application_id");



ALTER TABLE ONLY "public"."education"
    ADD CONSTRAINT "education_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experience"
    ADD CONSTRAINT "experience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_activities"
    ADD CONSTRAINT "export_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interview_reminders"
    ADD CONSTRAINT "interview_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metrics_snapshots"
    ADD CONSTRAINT "metrics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_activities"
    ADD CONSTRAINT "pipeline_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_candidates"
    ADD CONSTRAINT "pipeline_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_candidates"
    ADD CONSTRAINT "pipeline_candidates_requisition_id_student_id_key" UNIQUE ("requisition_id", "student_id");



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recent_updates"
    ADD CONSTRAINT "recent_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_activities"
    ADD CONSTRAINT "recruiter_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_saved_searches"
    ADD CONSTRAINT "recruiter_saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiters"
    ADD CONSTRAINT "recruiters_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."recruiters"
    ADD CONSTRAINT "recruiters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requisitions"
    ADD CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_jobs"
    ADD CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shortlist_candidates"
    ADD CONSTRAINT "shortlist_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shortlist_candidates"
    ADD CONSTRAINT "shortlist_candidates_shortlist_id_student_id_key" UNIQUE ("shortlist_id", "student_id");



ALTER TABLE ONLY "public"."shortlists"
    ADD CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_passports"
    ADD CONSTRAINT "skill_passports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_passports"
    ADD CONSTRAINT "skill_passports_studentId_key" UNIQUE ("studentId");



ALTER TABLE ONLY "public"."skill_trends"
    ADD CONSTRAINT "skill_trends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_assignments"
    ADD CONSTRAINT "student_assignments_pkey" PRIMARY KEY ("student_assignment_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_userid_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applied_jobs"
    ADD CONSTRAINT "unique_application" UNIQUE ("student_id", "opportunity_id");



ALTER TABLE ONLY "public"."saved_jobs"
    ADD CONSTRAINT "unique_saved_job" UNIQUE ("student_id", "opportunity_id");



ALTER TABLE ONLY "public"."recent_updates"
    ADD CONSTRAINT "unique_student_id" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "unique_user_reaction" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."universities"
    ADD CONSTRAINT "universities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."university_performance"
    ADD CONSTRAINT "university_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_assignments"
    ADD CONSTRAINT "uq_student_assignment" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verifications"
    ADD CONSTRAINT "verifications_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_applied_jobs_applied_at" ON "public"."applied_jobs" USING "btree" ("applied_at" DESC);



CREATE INDEX "idx_applied_jobs_opportunity_id" ON "public"."applied_jobs" USING "btree" ("opportunity_id");



CREATE INDEX "idx_applied_jobs_status" ON "public"."applied_jobs" USING "btree" ("application_status");



CREATE INDEX "idx_applied_jobs_student_date" ON "public"."applied_jobs" USING "btree" ("student_id", "applied_at" DESC);



CREATE INDEX "idx_applied_jobs_student_id" ON "public"."applied_jobs" USING "btree" ("student_id");



CREATE INDEX "idx_assignments_course" ON "public"."assignments" USING "btree" ("course_name");



CREATE INDEX "idx_assignments_due_date" ON "public"."assignments" USING "btree" ("due_date");



CREATE INDEX "idx_assignments_educator" ON "public"."assignments" USING "btree" ("educator_id");



CREATE INDEX "idx_attachments_assignment" ON "public"."assignment_attachments" USING "btree" ("assignment_id");



CREATE INDEX "idx_audit_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_action_date" ON "public"."audit_logs" USING "btree" ("action", "createdAt" DESC);



CREATE INDEX "idx_audit_actor" ON "public"."audit_logs" USING "btree" ("actorId");



CREATE INDEX "idx_audit_actor_action" ON "public"."audit_logs" USING "btree" ("actorId", "action");



CREATE INDEX "idx_audit_actorid" ON "public"."audit_logs" USING "btree" ("actorId");



CREATE INDEX "idx_audit_created" ON "public"."audit_logs" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_audit_createdat" ON "public"."audit_logs" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_audit_ip_trgm" ON "public"."audit_logs" USING "gin" ("ip" "public"."gin_trgm_ops");



CREATE INDEX "idx_audit_target" ON "public"."audit_logs" USING "btree" ("target");



CREATE INDEX "idx_audit_target_trgm" ON "public"."audit_logs" USING "gin" ("target" "public"."gin_trgm_ops");



CREATE INDEX "idx_certificates_student_id" ON "public"."certificates" USING "btree" ("student_id");



CREATE INDEX "idx_conversations_application_id" ON "public"."conversations" USING "btree" ("application_id");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_opportunity_id" ON "public"."conversations" USING "btree" ("opportunity_id");



CREATE INDEX "idx_conversations_recruiter_id" ON "public"."conversations" USING "btree" ("recruiter_id");



CREATE INDEX "idx_conversations_status" ON "public"."conversations" USING "btree" ("status");



CREATE INDEX "idx_conversations_student_id" ON "public"."conversations" USING "btree" ("student_id");



CREATE INDEX "idx_education_student_id" ON "public"."education" USING "btree" ("student_id");



CREATE INDEX "idx_experience_student_id" ON "public"."experience" USING "btree" ("student_id");



CREATE INDEX "idx_export_activities_shortlist_id" ON "public"."export_activities" USING "btree" ("shortlist_id");



CREATE INDEX "idx_interview_reminders_interview_id" ON "public"."interview_reminders" USING "btree" ("interview_id");



CREATE INDEX "idx_interview_reminders_sent_at" ON "public"."interview_reminders" USING "btree" ("sent_at");



CREATE INDEX "idx_interviews_created_by" ON "public"."interviews" USING "btree" ("created_by");



CREATE INDEX "idx_interviews_date" ON "public"."interviews" USING "btree" ("date");



CREATE INDEX "idx_interviews_status" ON "public"."interviews" USING "btree" ("status");



CREATE INDEX "idx_interviews_student_id" ON "public"."interviews" USING "btree" ("student_id");



CREATE INDEX "idx_message_reactions_message_id" ON "public"."message_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_message_reactions_user_id" ON "public"."message_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_messages_application_id" ON "public"."messages" USING "btree" ("application_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_is_read" ON "public"."messages" USING "btree" ("is_read");



CREATE INDEX "idx_messages_opportunity_id" ON "public"."messages" USING "btree" ("opportunity_id");



CREATE INDEX "idx_messages_receiver_id" ON "public"."messages" USING "btree" ("receiver_id");



CREATE INDEX "idx_messages_receiver_type" ON "public"."messages" USING "btree" ("receiver_type");



CREATE INDEX "idx_messages_receiver_unread" ON "public"."messages" USING "btree" ("receiver_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_messages_sender_type" ON "public"."messages" USING "btree" ("sender_type");



CREATE INDEX "idx_metrics_date" ON "public"."metrics_snapshots" USING "btree" ("snapshotDate" DESC);



CREATE INDEX "idx_metrics_snapshotdate" ON "public"."metrics_snapshots" USING "btree" ("snapshotDate" DESC);



CREATE INDEX "idx_notifications_created" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_recruiter" ON "public"."notifications" USING "btree" ("recruiter_id");



CREATE INDEX "idx_offers_candidate_name_lower" ON "public"."offers" USING "btree" ("lower"("candidate_name"));



CREATE INDEX "idx_offers_expiry_date" ON "public"."offers" USING "btree" ("expiry_date");



CREATE INDEX "idx_offers_inserted_at" ON "public"."offers" USING "btree" ("inserted_at" DESC);



CREATE INDEX "idx_offers_job_title_lower" ON "public"."offers" USING "btree" ("lower"("job_title"));



CREATE INDEX "idx_offers_offer_date" ON "public"."offers" USING "btree" ("offer_date");



CREATE INDEX "idx_offers_sent_via" ON "public"."offers" USING "btree" ("sent_via");



CREATE INDEX "idx_offers_status" ON "public"."offers" USING "btree" ("status");



CREATE INDEX "idx_offers_status_expiry" ON "public"."offers" USING "btree" ("status", "expiry_date");



CREATE INDEX "idx_offers_status_inserted" ON "public"."offers" USING "btree" ("status", "inserted_at" DESC);



CREATE INDEX "idx_offers_template" ON "public"."offers" USING "btree" ("template");



CREATE INDEX "idx_opportunities_active_posted" ON "public"."opportunities" USING "btree" ("is_active", "posted_date" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_opportunities_company_name" ON "public"."opportunities" USING "btree" ("lower"("company_name"));



CREATE INDEX "idx_opportunities_created_at" ON "public"."opportunities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_opportunities_deadline" ON "public"."opportunities" USING "btree" ("deadline", "closing_date");



CREATE INDEX "idx_opportunities_job_title" ON "public"."opportunities" USING "btree" ("lower"("job_title"));



CREATE INDEX "idx_opportunities_posted_date" ON "public"."opportunities" USING "btree" ("posted_date" DESC NULLS LAST);



CREATE INDEX "idx_opportunities_salary" ON "public"."opportunities" USING "btree" ("salary_range_max" DESC, "salary_range_min" DESC);



CREATE INDEX "idx_opportunities_search" ON "public"."opportunities" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((((COALESCE("job_title", ''::"text") || ' '::"text") || COALESCE("title", ''::"text")) || ' '::"text") || COALESCE("company_name", ''::"text")) || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_opportunities_skills_gin" ON "public"."opportunities" USING "gin" ("skills_required");



CREATE INDEX "idx_passports_assessments_gin" ON "public"."skill_passports" USING "gin" ("assessments");



CREATE INDEX "idx_passports_certificates_gin" ON "public"."skill_passports" USING "gin" ("certificates");



CREATE INDEX "idx_passports_createdat" ON "public"."skill_passports" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_passports_nsqflevel" ON "public"."skill_passports" USING "btree" ("nsqfLevel");



CREATE INDEX "idx_passports_projects_gin" ON "public"."skill_passports" USING "gin" ("projects");



CREATE INDEX "idx_passports_status" ON "public"."skill_passports" USING "btree" ("status");



CREATE INDEX "idx_passports_status_nsqf" ON "public"."skill_passports" USING "btree" ("status", "nsqfLevel");



CREATE INDEX "idx_passports_student" ON "public"."skill_passports" USING "btree" ("studentId");



CREATE INDEX "idx_passports_student_status" ON "public"."skill_passports" USING "btree" ("studentId", "status");



CREATE INDEX "idx_passports_studentid" ON "public"."skill_passports" USING "btree" ("studentId");



CREATE INDEX "idx_passports_updatedat" ON "public"."skill_passports" USING "btree" ("updatedAt" DESC);



CREATE INDEX "idx_pipeline_activities_created_at" ON "public"."pipeline_activities" USING "btree" ("created_at");



CREATE INDEX "idx_pipeline_activities_pipeline_candidate_id" ON "public"."pipeline_activities" USING "btree" ("pipeline_candidate_id");



CREATE INDEX "idx_pipeline_candidates_next_action_date" ON "public"."pipeline_candidates" USING "btree" ("next_action_date");



CREATE INDEX "idx_pipeline_candidates_requisition_id" ON "public"."pipeline_candidates" USING "btree" ("requisition_id");



CREATE INDEX "idx_pipeline_candidates_stage" ON "public"."pipeline_candidates" USING "btree" ("stage");



CREATE INDEX "idx_pipeline_candidates_status" ON "public"."pipeline_candidates" USING "btree" ("status");



CREATE INDEX "idx_pipeline_candidates_student_id" ON "public"."pipeline_candidates" USING "btree" ("student_id");



CREATE INDEX "idx_placements_hired_date" ON "public"."placements" USING "btree" ("hiredDate" DESC);



CREATE INDEX "idx_placements_recruiter" ON "public"."placements" USING "btree" ("recruiterId");



CREATE INDEX "idx_placements_status" ON "public"."placements" USING "btree" ("placementStatus");



CREATE INDEX "idx_placements_student" ON "public"."placements" USING "btree" ("studentId");



CREATE INDEX "idx_profile_views_date" ON "public"."profile_views" USING "btree" ("viewed_at");



CREATE INDEX "idx_profile_views_student" ON "public"."profile_views" USING "btree" ("student_id");



CREATE INDEX "idx_projects_student_id" ON "public"."projects" USING "btree" ("student_id");



CREATE INDEX "idx_recent_updates_student" ON "public"."recent_updates" USING "btree" ("student_id");



CREATE INDEX "idx_recent_updates_updated_at" ON "public"."recent_updates" USING "btree" ("updated_at");



CREATE INDEX "idx_recruiter_activities_created" ON "public"."recruiter_activities" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_recruiter_activities_recruiter" ON "public"."recruiter_activities" USING "btree" ("recruiterId");



CREATE INDEX "idx_recruiter_activities_student" ON "public"."recruiter_activities" USING "btree" ("targetStudentId");



CREATE INDEX "idx_recruiter_activities_type" ON "public"."recruiter_activities" USING "btree" ("activityType");



CREATE INDEX "idx_recruiters_createdat" ON "public"."recruiters" USING "btree" ("createdat" DESC);



CREATE INDEX "idx_recruiters_email" ON "public"."recruiters" USING "btree" ("email");



CREATE INDEX "idx_recruiters_isactive" ON "public"."recruiters" USING "btree" ("isactive");



CREATE INDEX "idx_recruiters_name_trgm" ON "public"."recruiters" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_recruiters_state" ON "public"."recruiters" USING "btree" ("state");



CREATE INDEX "idx_recruiters_state_status" ON "public"."recruiters" USING "btree" ("state", "verificationstatus");



CREATE INDEX "idx_recruiters_status_active" ON "public"."recruiters" USING "btree" ("verificationstatus", "isactive");



CREATE INDEX "idx_recruiters_verificationstatus" ON "public"."recruiters" USING "btree" ("verificationstatus");



CREATE INDEX "idx_requisitions_created_by" ON "public"."requisitions" USING "btree" ("created_by");



CREATE INDEX "idx_requisitions_created_date" ON "public"."requisitions" USING "btree" ("created_date");



CREATE INDEX "idx_requisitions_status" ON "public"."requisitions" USING "btree" ("status");



CREATE INDEX "idx_saved_jobs_opportunity_id" ON "public"."saved_jobs" USING "btree" ("opportunity_id");



CREATE INDEX "idx_saved_jobs_saved_at" ON "public"."saved_jobs" USING "btree" ("saved_at" DESC);



CREATE INDEX "idx_saved_jobs_student_date" ON "public"."saved_jobs" USING "btree" ("student_id", "saved_at" DESC);



CREATE INDEX "idx_saved_jobs_student_id" ON "public"."saved_jobs" USING "btree" ("student_id");



CREATE INDEX "idx_saved_searches_created" ON "public"."recruiter_saved_searches" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_saved_searches_last_used" ON "public"."recruiter_saved_searches" USING "btree" ("last_used" DESC NULLS LAST);



CREATE INDEX "idx_saved_searches_recruiter" ON "public"."recruiter_saved_searches" USING "btree" ("recruiter_id");



CREATE INDEX "idx_shortlist_candidates_shortlist_id" ON "public"."shortlist_candidates" USING "btree" ("shortlist_id");



CREATE INDEX "idx_shortlist_candidates_student_id" ON "public"."shortlist_candidates" USING "btree" ("student_id");



CREATE INDEX "idx_shortlists_created_by" ON "public"."shortlists" USING "btree" ("created_by");



CREATE INDEX "idx_shortlists_created_date" ON "public"."shortlists" USING "btree" ("created_date");



CREATE INDEX "idx_skill_trends_category" ON "public"."skill_trends" USING "btree" ("category");



CREATE INDEX "idx_skill_trends_snapshot" ON "public"."skill_trends" USING "btree" ("snapshotDate" DESC);



CREATE INDEX "idx_skills_student_id" ON "public"."skills" USING "btree" ("student_id");



CREATE INDEX "idx_skills_type" ON "public"."skills" USING "btree" ("type");



CREATE INDEX "idx_student_assignments_assignment" ON "public"."student_assignments" USING "btree" ("assignment_id");



CREATE INDEX "idx_student_assignments_status" ON "public"."student_assignments" USING "btree" ("status");



CREATE INDEX "idx_student_assignments_student" ON "public"."student_assignments" USING "btree" ("student_id");



CREATE INDEX "idx_student_assignments_student_status" ON "public"."student_assignments" USING "btree" ("student_id", "status");



CREATE INDEX "idx_student_assignments_submission_date" ON "public"."student_assignments" USING "btree" ("submission_date");



CREATE INDEX "idx_students_createdat" ON "public"."students" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_students_email" ON "public"."students" USING "btree" ("email");



CREATE INDEX "idx_students_email_trgm" ON "public"."students" USING "gin" ("email" "public"."gin_trgm_ops");



CREATE INDEX "idx_students_id" ON "public"."students" USING "btree" ("id");



CREATE INDEX "idx_students_profile_email" ON "public"."students" USING "btree" ((("profile" ->> 'email'::"text")));



CREATE INDEX "idx_students_profile_gin" ON "public"."students" USING "gin" ("profile");



CREATE INDEX "idx_students_profile_name" ON "public"."students" USING "btree" ((("profile" ->> 'name'::"text")));



CREATE INDEX "idx_students_profile_passport_id" ON "public"."students" USING "btree" ((("profile" ->> 'passportId'::"text")));



CREATE INDEX "idx_students_university" ON "public"."students" USING "btree" ("universityId");



CREATE INDEX "idx_students_universityid" ON "public"."students" USING "btree" ("universityId");



CREATE INDEX "idx_students_user" ON "public"."students" USING "btree" ("id");



CREATE INDEX "idx_trainings_student_id" ON "public"."trainings" USING "btree" ("student_id");



CREATE INDEX "idx_universities_createdat" ON "public"."universities" USING "btree" ("createdat" DESC);



CREATE INDEX "idx_universities_district" ON "public"."universities" USING "btree" ("district");



CREATE INDEX "idx_universities_isactive" ON "public"."universities" USING "btree" ("isactive");



CREATE INDEX "idx_universities_name_trgm" ON "public"."universities" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_universities_state" ON "public"."universities" USING "btree" ("state");



CREATE INDEX "idx_universities_verificationstatus" ON "public"."universities" USING "btree" ("verificationstatus");



CREATE INDEX "idx_university_performance_rank" ON "public"."university_performance" USING "btree" ("rankPosition");



CREATE INDEX "idx_university_performance_snapshot" ON "public"."university_performance" USING "btree" ("snapshotDate" DESC);



CREATE INDEX "idx_users_createdat" ON "public"."users" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_email_trgm" ON "public"."users" USING "gin" ("email" "public"."gin_trgm_ops");



CREATE INDEX "idx_users_isactive" ON "public"."users" USING "btree" ("isActive");



CREATE INDEX "idx_users_org" ON "public"."users" USING "btree" ("organizationId");



CREATE INDEX "idx_users_organizationid" ON "public"."users" USING "btree" ("organizationId");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_role_active" ON "public"."users" USING "btree" ("role", "isActive");



CREATE INDEX "idx_verifications_createdat" ON "public"."verifications" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_verifications_performedby" ON "public"."verifications" USING "btree" ("performedBy");



CREATE INDEX "idx_verifications_target" ON "public"."verifications" USING "btree" ("targetTable", "targetId");



CREATE INDEX "idx_verifications_target_date" ON "public"."verifications" USING "btree" ("targetId", "createdAt" DESC);



CREATE INDEX "idx_verifications_targetid" ON "public"."verifications" USING "btree" ("targetId");



CREATE INDEX "opportunities_embedding_idx" ON "public"."opportunities" USING "ivfflat" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "students_embedding_idx" ON "public"."students" USING "ivfflat" ("embedding" "public"."vector_cosine_ops");



CREATE OR REPLACE VIEW "public"."requisitions_with_pipeline_stats" AS
 SELECT "r"."id",
    "r"."title",
    "r"."department",
    "r"."location",
    "r"."job_type",
    "r"."openings",
    "r"."status",
    "r"."priority",
    "r"."description",
    "r"."requirements",
    "r"."salary_range",
    "r"."owner",
    "r"."hiring_manager",
    "r"."created_by",
    "r"."created_date",
    "r"."target_date",
    "r"."filled_date",
    "r"."tags",
    "r"."created_at",
    "r"."updated_at",
    "count"(DISTINCT "pc"."id") AS "total_candidates",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'sourced'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "sourced_count",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'screened'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "screened_count",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'interview_1'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "interview_1_count",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'interview_2'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "interview_2_count",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'offer'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "offer_count",
    "count"(DISTINCT
        CASE
            WHEN ("pc"."stage" = 'hired'::"text") THEN "pc"."id"
            ELSE NULL::integer
        END) AS "hired_count"
   FROM ("public"."requisitions" "r"
     LEFT JOIN "public"."pipeline_candidates" "pc" ON ((("r"."id" = "pc"."requisition_id") AND ("pc"."status" = 'active'::"text"))))
  GROUP BY "r"."id";



CREATE OR REPLACE VIEW "public"."shortlists_with_counts" AS
 SELECT "s"."id",
    "s"."name",
    "s"."description",
    "s"."created_by",
    "s"."created_date",
    "s"."status",
    "s"."shared",
    "s"."share_link",
    "s"."share_expiry",
    "s"."watermark",
    "s"."include_pii",
    "s"."notify_on_access",
    "s"."tags",
    "s"."updated_at",
    COALESCE("count"("sc"."id"), (0)::bigint) AS "candidate_count"
   FROM ("public"."shortlists" "s"
     LEFT JOIN "public"."shortlist_candidates" "sc" ON (("s"."id" = "sc"."shortlist_id")))
  GROUP BY "s"."id";



CREATE OR REPLACE TRIGGER "auto_recent_update_on_profile_change" AFTER UPDATE OF "profile" ON "public"."students" FOR EACH ROW WHEN (("old"."profile" IS DISTINCT FROM "new"."profile")) EXECUTE FUNCTION "public"."trigger_profile_update"();



CREATE OR REPLACE TRIGGER "auto_recent_update_on_skills_change" AFTER UPDATE OF "profile" ON "public"."students" FOR EACH ROW WHEN ((("old"."profile" -> 'technicalSkills'::"text") IS DISTINCT FROM ("new"."profile" -> 'technicalSkills'::"text"))) EXECUTE FUNCTION "public"."trigger_skills_improvement"();



CREATE OR REPLACE TRIGGER "auto_recent_update_on_training_complete" AFTER UPDATE OF "profile" ON "public"."students" FOR EACH ROW WHEN ((("old"."profile" -> 'training'::"text") IS DISTINCT FROM ("new"."profile" -> 'training'::"text"))) EXECUTE FUNCTION "public"."trigger_training_completion"();



CREATE OR REPLACE TRIGGER "set_students_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_students_updated_at"();



CREATE OR REPLACE TRIGGER "trg_assignments_updated" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_assignments_updated_fn"();



CREATE OR REPLACE TRIGGER "trg_student_assignments_grade_pct" BEFORE INSERT OR UPDATE OF "grade_received" ON "public"."student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_student_assignments_grade_pct_fn"();



CREATE OR REPLACE TRIGGER "trg_student_assignments_late_check" BEFORE INSERT OR UPDATE OF "submission_date" ON "public"."student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_student_assignments_late_check_fn"();



CREATE OR REPLACE TRIGGER "trg_student_assignments_status" BEFORE INSERT OR UPDATE OF "status" ON "public"."student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_student_assignments_status_fn"();



CREATE OR REPLACE TRIGGER "trg_student_assignments_updated" BEFORE UPDATE ON "public"."student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_student_assignments_updated_fn"();



CREATE OR REPLACE TRIGGER "trigger_decrement_applications_count" AFTER DELETE ON "public"."applied_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_applications_count"();



CREATE OR REPLACE TRIGGER "trigger_increment_applications_count" AFTER INSERT ON "public"."applied_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."increment_applications_count"();



CREATE OR REPLACE TRIGGER "trigger_new_opportunity_notification" AFTER INSERT ON "public"."opportunities" FOR EACH ROW WHEN (("new"."is_active" IS TRUE)) EXECUTE FUNCTION "public"."notify_students_new_opportunity"();



CREATE OR REPLACE TRIGGER "trigger_opportunity_update_notification" AFTER UPDATE ON "public"."opportunities" FOR EACH ROW WHEN (("old"."is_active" IS DISTINCT FROM "new"."is_active")) EXECUTE FUNCTION "public"."notify_students_opportunity_update"();



CREATE OR REPLACE TRIGGER "trigger_reset_unread_count" AFTER UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."reset_unread_count"();



CREATE OR REPLACE TRIGGER "trigger_update_applied_jobs_timestamp" BEFORE UPDATE ON "public"."applied_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_applied_jobs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_conversation_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_on_message"();



CREATE OR REPLACE TRIGGER "trigger_update_saved_jobs_timestamp" BEFORE UPDATE ON "public"."saved_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_saved_jobs_updated_at"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_interviews_updated_at" BEFORE UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_passports_timestamp" BEFORE UPDATE ON "public"."skill_passports" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_pipeline_candidates_updated_at" BEFORE UPDATE ON "public"."pipeline_candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_placements_timestamp" BEFORE UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_recruiters_updated_at" BEFORE UPDATE ON "public"."recruiters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_requisitions_updated_at" BEFORE UPDATE ON "public"."requisitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_saved_searches_updated_at" BEFORE UPDATE ON "public"."recruiter_saved_searches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shortlists_updated_at" BEFORE UPDATE ON "public"."shortlists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_timestamp" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actorid_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applied_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."education"
    ADD CONSTRAINT "education_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience"
    ADD CONSTRAINT "experience_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."export_activities"
    ADD CONSTRAINT "export_activities_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "public"."shortlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "fk_attachment_assignment" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applied_jobs"
    ADD CONSTRAINT "fk_opportunity" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_jobs"
    ADD CONSTRAINT "fk_saved_jobs_opportunity" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id");



ALTER TABLE ONLY "public"."saved_jobs"
    ADD CONSTRAINT "fk_saved_jobs_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."applied_jobs"
    ADD CONSTRAINT "fk_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_assignments"
    ADD CONSTRAINT "fk_student_assignment_assignment" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_assignments"
    ADD CONSTRAINT "fk_student_assignment_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_reminders"
    ADD CONSTRAINT "interview_reminders_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applied_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recruiter_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id");



ALTER TABLE ONLY "public"."pipeline_activities"
    ADD CONSTRAINT "pipeline_activities_pipeline_candidate_id_fkey" FOREIGN KEY ("pipeline_candidate_id") REFERENCES "public"."pipeline_candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_candidates"
    ADD CONSTRAINT "pipeline_candidates_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_candidates"
    ADD CONSTRAINT "pipeline_candidates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recent_updates"
    ADD CONSTRAINT "recent_updates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_activities"
    ADD CONSTRAINT "recruiter_activities_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shortlist_candidates"
    ADD CONSTRAINT "shortlist_candidates_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "public"."shortlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shortlist_candidates"
    ADD CONSTRAINT "shortlist_candidates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_passports"
    ADD CONSTRAINT "skill_passports_studentid_fkey1" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_universityid_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."universities"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."university_performance"
    ADD CONSTRAINT "university_performance_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."universities"("id");



ALTER TABLE ONLY "public"."verifications"
    ADD CONSTRAINT "verifications_performedby_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Allow public delete" ON "public"."users" FOR DELETE USING (true);



CREATE POLICY "Allow public insert" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."metrics_snapshots" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."placements" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."recruiter_activities" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."skill_passports" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."skill_trends" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."students" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."university_performance" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."verifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read" ON "public"."audit_logs" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."metrics_snapshots" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."placements" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."recruiter_activities" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."skill_passports" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."skill_trends" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."students" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."university_performance" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."verifications" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to recent_updates" ON "public"."recent_updates" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."metrics_snapshots" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."placements" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."skill_passports" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."skill_trends" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."students" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."university_performance" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."users" FOR UPDATE USING (true);



CREATE POLICY "Allow users to insert own recent_updates" ON "public"."recent_updates" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Allow users to update own recent_updates" ON "public"."recent_updates" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Anyone can track profile views" ON "public"."profile_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can create interviews" ON "public"."interviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can create shortlists" ON "public"."shortlists" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can delete interviews" ON "public"."interviews" FOR DELETE USING (true);



CREATE POLICY "Authenticated users can delete shortlists" ON "public"."shortlists" FOR DELETE USING (true);



CREATE POLICY "Authenticated users can log activities" ON "public"."pipeline_activities" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can log export activities" ON "public"."export_activities" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can log reminders" ON "public"."interview_reminders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated users can manage pipeline candidates" ON "public"."pipeline_candidates" USING (true);



CREATE POLICY "Authenticated users can manage requisitions" ON "public"."requisitions" USING (true);



CREATE POLICY "Authenticated users can manage shortlist candidates" ON "public"."shortlist_candidates" USING (true);



CREATE POLICY "Authenticated users can update interviews" ON "public"."interviews" FOR UPDATE USING (true);



CREATE POLICY "Authenticated users can update shortlists" ON "public"."shortlists" FOR UPDATE USING (true);



CREATE POLICY "Authenticated users can view activities" ON "public"."pipeline_activities" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view export activities" ON "public"."export_activities" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view interviews" ON "public"."interviews" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view pipeline candidates" ON "public"."pipeline_candidates" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view reminders" ON "public"."interview_reminders" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view requisitions" ON "public"."requisitions" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view shortlist candidates" ON "public"."shortlist_candidates" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view shortlists" ON "public"."shortlists" FOR SELECT USING (true);



CREATE POLICY "Recruiters can update application status" ON "public"."applied_jobs" FOR UPDATE USING (("opportunity_id" IN ( SELECT "opportunities"."id"
   FROM "public"."opportunities"
  WHERE ("opportunities"."created_by" = ("auth"."uid"())::"text"))));



CREATE POLICY "Recruiters can view applications for their opportunities" ON "public"."applied_jobs" FOR SELECT USING (("opportunity_id" IN ( SELECT "opportunities"."id"
   FROM "public"."opportunities"
  WHERE ("opportunities"."created_by" = ("auth"."uid"())::"text"))));



CREATE POLICY "Students can create own applications" ON "public"."applied_jobs" FOR INSERT WITH CHECK ((("student_id" = "auth"."uid"()) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."id" = "auth"."uid"())))));



CREATE POLICY "Students can delete own applications" ON "public"."applied_jobs" FOR DELETE USING ((("student_id" = "auth"."uid"()) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."id" = "auth"."uid"())))));



CREATE POLICY "Students can insert own profile" ON "public"."students" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Students can update own applications" ON "public"."applied_jobs" FOR UPDATE USING ((("student_id" = "auth"."uid"()) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."id" = "auth"."uid"())))));



CREATE POLICY "Students can view own applications" ON "public"."applied_jobs" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."id" = "auth"."uid"())))));



CREATE POLICY "Students can view own profile views" ON "public"."profile_views" FOR SELECT USING (true);



CREATE POLICY "Users can delete own saved searches" ON "public"."recruiter_saved_searches" FOR DELETE USING (true);



CREATE POLICY "Users can insert own saved searches" ON "public"."recruiter_saved_searches" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update own saved searches" ON "public"."recruiter_saved_searches" FOR UPDATE USING (true);



CREATE POLICY "Users can view own saved searches" ON "public"."recruiter_saved_searches" FOR SELECT USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."export_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interview_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metrics_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requisitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skill_passports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skill_trends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."university_performance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verifications" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_achievement_update"("p_student_id" "uuid", "p_achievement" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_email" "text", "update_title" "text", "update_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_email" "text", "update_title" "text", "update_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_email" "text", "update_title" "text", "update_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_uuid" "uuid", "update_title" "text", "update_description" "text", "update_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_uuid" "uuid", "update_title" "text", "update_description" "text", "update_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_jsonb_recent_update"("student_uuid" "uuid", "update_title" "text", "update_description" "text", "update_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_opportunity_match_update"("p_student_id" "uuid", "p_opportunity_title" "text", "p_company_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_recent_update"("p_student_id" "uuid", "p_message" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_recent_update"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_recent_update"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_recent_update"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_recent_update_by_email"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_recent_update_by_email"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_recent_update_by_email"("student_email" "text", "update_title" "text", "update_description" "text", "update_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_to_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_new_item" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."analyze_skills_demand"() TO "anon";
GRANT ALL ON FUNCTION "public"."analyze_skills_demand"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."analyze_skills_demand"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_to_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_to_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_to_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_applications_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_applications_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_applications_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_from_profile_array"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_popular_opportunities"("student_id_param" "uuid", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_opportunities"("student_id_param" "uuid", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_popular_opportunities"("student_id_param" "uuid", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_unread_count"("user_id" "text", "user_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_applications_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_applications_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_applications_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_search_usage"("search_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_search_usage"("search_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_search_usage"("search_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_opportunities"("query_embedding" "public"."vector", "student_id_param" "uuid", "dismissed_ids" "uuid"[], "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_opportunities"("query_embedding" "public"."vector", "student_id_param" "uuid", "dismissed_ids" "uuid"[], "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_opportunities"("query_embedding" "public"."vector", "student_id_param" "uuid", "dismissed_ids" "uuid"[], "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_students_new_opportunity"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_students_new_opportunity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_students_new_opportunity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_students_opportunity_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_students_opportunity_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_students_opportunity_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_save_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_save_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_save_job"("p_student_id" "uuid", "p_opportunity_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text", "p_viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text", "p_viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_profile_view"("p_student_id" "uuid", "p_viewer_type" "text", "p_viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_assignments_completion_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_assignments_completion_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_assignments_completion_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_assignments_grade_pct_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_assignments_grade_pct_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_assignments_grade_pct_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_assignments_updated_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_assignments_updated_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_assignments_updated_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_insert_recent_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_insert_recent_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_insert_recent_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_student_assignments_grade_pct_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_grade_pct_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_grade_pct_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_student_assignments_late_check_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_late_check_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_late_check_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_student_assignments_status_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_status_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_status_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_student_assignments_updated_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_updated_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_student_assignments_updated_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_profile_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_profile_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_skills_improvement"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_skills_improvement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_skills_improvement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_training_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_training_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_training_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_applied_jobs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_applied_jobs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_applied_jobs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_array_item"("p_student_id" "uuid", "p_array_name" "text", "p_item_id" integer, "p_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_saved_jobs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_saved_jobs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_saved_jobs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_students_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."applied_jobs" TO "anon";
GRANT ALL ON TABLE "public"."applied_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."applied_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."applied_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."applied_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."applied_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_attachments" TO "anon";
GRANT ALL ON TABLE "public"."assignment_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."certificates" TO "anon";
GRANT ALL ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."opportunities" TO "anon";
GRANT ALL ON TABLE "public"."opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."recruiters" TO "anon";
GRANT ALL ON TABLE "public"."recruiters" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiters" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."conversations_detailed" TO "anon";
GRANT ALL ON TABLE "public"."conversations_detailed" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations_detailed" TO "service_role";



GRANT ALL ON TABLE "public"."education" TO "anon";
GRANT ALL ON TABLE "public"."education" TO "authenticated";
GRANT ALL ON TABLE "public"."education" TO "service_role";



GRANT ALL ON TABLE "public"."experience" TO "anon";
GRANT ALL ON TABLE "public"."experience" TO "authenticated";
GRANT ALL ON TABLE "public"."experience" TO "service_role";



GRANT ALL ON TABLE "public"."export_activities" TO "anon";
GRANT ALL ON TABLE "public"."export_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."export_activities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."export_activities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."export_activities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."export_activities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."interview_reminders" TO "anon";
GRANT ALL ON TABLE "public"."interview_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_reminders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."interview_reminders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."interview_reminders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."interview_reminders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."interviews" TO "anon";
GRANT ALL ON TABLE "public"."interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."interviews" TO "service_role";



GRANT ALL ON TABLE "public"."message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."message_reactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."message_reactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."message_reactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."metrics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."metrics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."metrics_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pending_scorecards" TO "anon";
GRANT ALL ON TABLE "public"."pending_scorecards" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_scorecards" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_activities" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_activities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pipeline_activities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pipeline_activities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pipeline_activities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_candidates" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."requisitions" TO "anon";
GRANT ALL ON TABLE "public"."requisitions" TO "authenticated";
GRANT ALL ON TABLE "public"."requisitions" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_candidates_detailed" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_candidates_detailed" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_candidates_detailed" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pipeline_candidates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pipeline_candidates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pipeline_candidates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."placements" TO "anon";
GRANT ALL ON TABLE "public"."placements" TO "authenticated";
GRANT ALL ON TABLE "public"."placements" TO "service_role";



GRANT ALL ON TABLE "public"."profile_views" TO "anon";
GRANT ALL ON TABLE "public"."profile_views" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_views" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."recent_updates" TO "anon";
GRANT ALL ON TABLE "public"."recent_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_updates" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_activities" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_activities" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."requisitions_with_pipeline_stats" TO "anon";
GRANT ALL ON TABLE "public"."requisitions_with_pipeline_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."requisitions_with_pipeline_stats" TO "service_role";



GRANT ALL ON TABLE "public"."saved_jobs" TO "anon";
GRANT ALL ON TABLE "public"."saved_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."saved_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."saved_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."saved_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shortlist_candidates" TO "anon";
GRANT ALL ON TABLE "public"."shortlist_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."shortlist_candidates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shortlist_candidates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shortlist_candidates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shortlist_candidates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shortlists" TO "anon";
GRANT ALL ON TABLE "public"."shortlists" TO "authenticated";
GRANT ALL ON TABLE "public"."shortlists" TO "service_role";



GRANT ALL ON TABLE "public"."shortlists_with_counts" TO "anon";
GRANT ALL ON TABLE "public"."shortlists_with_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."shortlists_with_counts" TO "service_role";



GRANT ALL ON TABLE "public"."skill_passports" TO "anon";
GRANT ALL ON TABLE "public"."skill_passports" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_passports" TO "service_role";



GRANT ALL ON TABLE "public"."skill_trends" TO "anon";
GRANT ALL ON TABLE "public"."skill_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_trends" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."student_assignments" TO "anon";
GRANT ALL ON TABLE "public"."student_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."student_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."trainings" TO "anon";
GRANT ALL ON TABLE "public"."trainings" TO "authenticated";
GRANT ALL ON TABLE "public"."trainings" TO "service_role";



GRANT ALL ON TABLE "public"."universities" TO "anon";
GRANT ALL ON TABLE "public"."universities" TO "authenticated";
GRANT ALL ON TABLE "public"."universities" TO "service_role";



GRANT ALL ON TABLE "public"."university_performance" TO "anon";
GRANT ALL ON TABLE "public"."university_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."university_performance" TO "service_role";



GRANT ALL ON TABLE "public"."unread_messages_summary" TO "anon";
GRANT ALL ON TABLE "public"."unread_messages_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."unread_messages_summary" TO "service_role";



GRANT ALL ON TABLE "public"."upcoming_interviews" TO "anon";
GRANT ALL ON TABLE "public"."upcoming_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."upcoming_interviews" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."verifications" TO "anon";
GRANT ALL ON TABLE "public"."verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."verifications" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create table "public"."opportunity_interactions" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "opportunity_id" integer not null,
    "action" text not null,
    "created_at" timestamp with time zone default now()
      );


CREATE INDEX idx_opportunity_interactions_action ON public.opportunity_interactions USING btree (action);

CREATE INDEX idx_opportunity_interactions_opportunity ON public.opportunity_interactions USING btree (opportunity_id);

CREATE INDEX idx_opportunity_interactions_student ON public.opportunity_interactions USING btree (student_id);

CREATE UNIQUE INDEX opportunity_interactions_pkey ON public.opportunity_interactions USING btree (id);

CREATE UNIQUE INDEX opportunity_interactions_student_id_opportunity_id_action_key ON public.opportunity_interactions USING btree (student_id, opportunity_id, action);

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_pkey" PRIMARY KEY using index "opportunity_interactions_pkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_action_check" CHECK ((action = ANY (ARRAY['view'::text, 'apply'::text, 'dismiss'::text, 'save'::text]))) not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_action_check";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_opportunity_id_fkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_interactions" validate constraint "opportunity_interactions_student_id_fkey";

alter table "public"."opportunity_interactions" add constraint "opportunity_interactions_student_id_opportunity_id_action_key" UNIQUE using index "opportunity_interactions_student_id_opportunity_id_action_key";

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

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


