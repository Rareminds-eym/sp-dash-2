-- Integration tests for publish_lte_catalog_snapshot v2.1.
-- Run against a disposable/local LTE database after applying migrations:
--   psql "$LTE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f tests/sql/publish_lte_catalog_snapshot_v2_1.test.sql
--
-- Every data change is rolled back. The test requires at least one auth.users row
-- because lte_catalog_uploads.created_by has a foreign-key constraint.

BEGIN;

DO $test$
DECLARE
  v_user_id UUID;
  v_upload_id UUID;
  v_upload_id_2 UUID;
  v_hash TEXT;
  v_result JSONB;
  v_function_config TEXT[];
  v_function_definition TEXT;
  v_failed BOOLEAN;
  v_duration NUMERIC;
  v_start_time TIMESTAMPTZ;
  v_elapsed INTERVAL;
BEGIN
  RAISE NOTICE '=== Starting publish_lte_catalog_snapshot v2.1 Integration Tests ===';
  
  -- Prerequisite: Get test user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Test prerequisite failed: auth.users must contain one fixture user';
  END IF;
  RAISE NOTICE 'Using test user: %', v_user_id;

  -- Test 1: Verify function configuration (statement_timeout, lock_timeout, FOR UPDATE)
  RAISE NOTICE '';
  RAISE NOTICE 'Test 1: Verify function has required configuration';
  
  SELECT p.proconfig, pg_get_functiondef(p.oid)
  INTO v_function_config, v_function_definition
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'publish_lte_catalog_snapshot'
    AND pg_get_function_identity_arguments(p.oid) = 'p_upload_id uuid, p_published_by uuid, p_expected_snapshot_hash text';

  IF v_function_config IS NULL THEN
    RAISE EXCEPTION 'publish_lte_catalog_snapshot(UUID, UUID, TEXT) was not found';
  END IF;
  
  IF NOT ('statement_timeout=60s' = ANY(v_function_config)) THEN
    RAISE EXCEPTION 'Expected statement_timeout=60s, got %', v_function_config;
  END IF;
  RAISE NOTICE '✓ statement_timeout=60s configured';
  
  IF NOT ('lock_timeout=10s' = ANY(v_function_config)) THEN
    RAISE EXCEPTION 'Expected lock_timeout=10s, got %', v_function_config;
  END IF;
  RAISE NOTICE '✓ lock_timeout=10s configured';
  
  IF position('FOR UPDATE' IN upper(v_function_definition)) = 0 THEN
    RAISE EXCEPTION 'RPC must lock the upload row with FOR UPDATE';
  END IF;
  RAISE NOTICE '✓ FOR UPDATE lock present in function';

  -- Test 2: Successful publish with timing capture
  RAISE NOTICE '';
  RAISE NOTICE 'Test 2: Successful publish with timing metrics';
  
  v_hash := encode(
    extensions.digest(
      convert_to(public.lte_canonical_jsonb_text('{"tables":{}}'::JSONB), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.lte_catalog_uploads (
    source_type, source_name, source_file_hash, snapshot_hash,
    normalized_snapshot, reviewed_snapshot, reviewed_snapshot_hash,
    final_snapshot, final_snapshot_hash, validation_result,
    status, asset_status, created_by
  ) VALUES (
    'xlsx', 'rpc-v2.1-integration-test.xlsx', repeat('0', 64), v_hash,
    '{"tables":{}}', '{"tables":{}}', v_hash,
    '{"tables":{}}', v_hash, '{"valid":true}',
    'publishing', 'none', v_user_id
  ) RETURNING id INTO v_upload_id;

  v_start_time := clock_timestamp();
  v_result := public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  v_elapsed := clock_timestamp() - v_start_time;
  
  IF v_result->>'status' <> 'published' THEN
    RAISE EXCEPTION 'Expected published result, got %', v_result;
  END IF;
  RAISE NOTICE '✓ Publish succeeded with status=published';
  
  -- Verify durationSeconds in result
  IF NOT (v_result ? 'durationSeconds') OR (v_result->>'durationSeconds')::NUMERIC < 0 THEN
    RAISE EXCEPTION 'Expected non-negative durationSeconds, got %', v_result;
  END IF;
  v_duration := (v_result->>'durationSeconds')::NUMERIC;
  RAISE NOTICE '✓ durationSeconds present in result: % seconds', v_duration;
  
  -- Verify durationSeconds is reasonable (within 1 second of actual elapsed time)
  IF abs(v_duration - EXTRACT(EPOCH FROM v_elapsed)) > 1.0 THEN
    RAISE EXCEPTION 'durationSeconds (%) differs significantly from actual elapsed time (%)', 
      v_duration, EXTRACT(EPOCH FROM v_elapsed);
  END IF;
  RAISE NOTICE '✓ durationSeconds matches actual elapsed time (within 1 second)';
  
  -- Verify upload status transitioned to published
  IF (SELECT status FROM public.lte_catalog_uploads WHERE id = v_upload_id) <> 'published' THEN
    RAISE EXCEPTION 'Upload was not transitioned to published';
  END IF;
  RAISE NOTICE '✓ Upload status transitioned to published';
  
  -- Verify publish_summary contains durationSeconds
  IF NOT ((SELECT publish_summary FROM public.lte_catalog_uploads WHERE id = v_upload_id) ? 'durationSeconds') THEN
    RAISE EXCEPTION 'publish_summary does not contain durationSeconds';
  END IF;
  RAISE NOTICE '✓ publish_summary contains durationSeconds';
  
  -- Verify publish_summary durationSeconds matches result
  IF (SELECT (publish_summary->>'durationSeconds')::NUMERIC FROM public.lte_catalog_uploads WHERE id = v_upload_id) <> v_duration THEN
    RAISE EXCEPTION 'publish_summary durationSeconds does not match result durationSeconds';
  END IF;
  RAISE NOTICE '✓ publish_summary durationSeconds matches result';

  -- Test 3: Reject uploads not in 'publishing' status
  RAISE NOTICE '';
  RAISE NOTICE 'Test 3: Reject uploads not in publishing status';
  
  UPDATE public.lte_catalog_uploads SET status = 'validated' WHERE id = v_upload_id;
  v_failed := FALSE;
  BEGIN
    PERFORM public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%expected publishing%';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected validated status to be rejected';
  END IF;
  RAISE NOTICE '✓ Validated status rejected (expected publishing)';
  
  -- Test with other invalid statuses
  UPDATE public.lte_catalog_uploads SET status = 'published' WHERE id = v_upload_id;
  v_failed := FALSE;
  BEGIN
    PERFORM public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%expected publishing%';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected published status to be rejected';
  END IF;
  RAISE NOTICE '✓ Published status rejected (expected publishing)';

  -- Test 4: Verify final_snapshot_hash (stored hash mismatch)
  RAISE NOTICE '';
  RAISE NOTICE 'Test 4: Verify final_snapshot_hash validation (stored hash mismatch)';
  
  UPDATE public.lte_catalog_uploads
  SET status = 'publishing', final_snapshot_hash = repeat('f', 64)
  WHERE id = v_upload_id;
  
  v_failed := FALSE;
  BEGIN
    PERFORM public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%hash mismatch%';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected stored final snapshot hash mismatch to be rejected';
  END IF;
  RAISE NOTICE '✓ Stored final_snapshot_hash mismatch detected and rejected';

  -- Test 5: Verify final_snapshot integrity (recomputed hash mismatch)
  RAISE NOTICE '';
  RAISE NOTICE 'Test 5: Verify final_snapshot integrity (recomputed hash mismatch)';
  
  UPDATE public.lte_catalog_uploads
  SET final_snapshot_hash = v_hash, final_snapshot = '{"tables":{},"tampered":true}'::JSONB
  WHERE id = v_upload_id;
  
  v_failed := FALSE;
  BEGIN
    PERFORM public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%hash mismatch%';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected recomputed final snapshot hash mismatch to be rejected';
  END IF;
  RAISE NOTICE '✓ Recomputed final_snapshot hash mismatch detected (tampering prevention)';

  -- Test 6: Verify final_snapshot and hash must exist
  RAISE NOTICE '';
  RAISE NOTICE 'Test 6: Verify final_snapshot and hash are required';
  
  UPDATE public.lte_catalog_uploads
  SET status = 'publishing', final_snapshot = NULL, final_snapshot_hash = NULL
  WHERE id = v_upload_id;
  
  v_failed := FALSE;
  BEGIN
    PERFORM public.publish_lte_catalog_snapshot(v_upload_id, v_user_id, v_hash);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%must be persisted%';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected NULL final_snapshot to be rejected';
  END IF;
  RAISE NOTICE '✓ NULL final_snapshot rejected';

  -- Test 7: Lock behavior with FOR UPDATE
  RAISE NOTICE '';
  RAISE NOTICE 'Test 7: Verify FOR UPDATE lock prevents concurrent modifications';
  
  -- Create a new upload for lock testing
  INSERT INTO public.lte_catalog_uploads (
    source_type, source_name, source_file_hash, snapshot_hash,
    normalized_snapshot, reviewed_snapshot, reviewed_snapshot_hash,
    final_snapshot, final_snapshot_hash, validation_result,
    status, asset_status, created_by
  ) VALUES (
    'xlsx', 'lock-test.xlsx', repeat('0', 64), v_hash,
    '{"tables":{}}', '{"tables":{}}', v_hash,
    '{"tables":{}}', v_hash, '{"valid":true}',
    'publishing', 'none', v_user_id
  ) RETURNING id INTO v_upload_id_2;
  
  -- In a real concurrent scenario, a second transaction attempting to acquire 
  -- FOR UPDATE on the same row would wait up to lock_timeout (10s).
  -- Since we can't easily simulate true concurrency in a single DO block,
  -- we verify that:
  -- 1. The function definition contains FOR UPDATE (already checked in Test 1)
  -- 2. The function successfully locks and updates the row
  
  v_result := public.publish_lte_catalog_snapshot(v_upload_id_2, v_user_id, v_hash);
  IF v_result->>'status' <> 'published' THEN
    RAISE EXCEPTION 'Lock test publish failed: %', v_result;
  END IF;
  RAISE NOTICE '✓ FOR UPDATE lock acquired and row updated successfully';
  RAISE NOTICE '  (Note: Full concurrent lock testing requires separate transactions)';

  -- Test 8: Verify all status values in result and database
  RAISE NOTICE '';
  RAISE NOTICE 'Test 8: Verify complete result structure';
  
  -- Verify result contains all expected fields
  IF NOT (
    (v_result ? 'status') AND
    (v_result ? 'message') AND
    (v_result ? 'inserted') AND
    (v_result ? 'skipped') AND
    (v_result ? 'durationSeconds') AND
    (v_result ? 'tableSummary')
  ) THEN
    RAISE EXCEPTION 'Result missing expected fields: %', v_result;
  END IF;
  RAISE NOTICE '✓ Result contains all expected fields';
  
  -- Verify publish_summary in database
  IF NOT (
    (SELECT publish_summary ? 'publishedAt' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) AND
    (SELECT publish_summary ? 'publishedBy' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) AND
    (SELECT publish_summary ? 'inserted' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) AND
    (SELECT publish_summary ? 'skipped' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) AND
    (SELECT publish_summary ? 'durationSeconds' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) AND
    (SELECT publish_summary ? 'tableSummary' FROM public.lte_catalog_uploads WHERE id = v_upload_id_2)
  ) THEN
    RAISE EXCEPTION 'publish_summary missing expected fields';
  END IF;
  RAISE NOTICE '✓ Database publish_summary contains all expected fields';

  -- Test 9: Verify asset_status preservation
  RAISE NOTICE '';
  RAISE NOTICE 'Test 9: Verify asset_status is preserved or defaults to active';
  
  -- Check that asset_status was preserved/set correctly
  IF (SELECT asset_status FROM public.lte_catalog_uploads WHERE id = v_upload_id_2) NOT IN ('none', 'active') THEN
    RAISE EXCEPTION 'asset_status should be none or active after publish';
  END IF;
  RAISE NOTICE '✓ asset_status preserved correctly: %', 
    (SELECT asset_status FROM public.lte_catalog_uploads WHERE id = v_upload_id_2);

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=== All Integration Tests Passed ===';
  RAISE NOTICE 'Tests completed:';
  RAISE NOTICE '  1. Function configuration (statement_timeout, lock_timeout, FOR UPDATE)';
  RAISE NOTICE '  2. Successful publish with timing metrics';
  RAISE NOTICE '  3. Status validation (must be publishing)';
  RAISE NOTICE '  4. Stored final_snapshot_hash validation';
  RAISE NOTICE '  5. Recomputed final_snapshot hash validation (tampering detection)';
  RAISE NOTICE '  6. Required final_snapshot and hash presence';
  RAISE NOTICE '  7. FOR UPDATE lock behavior';
  RAISE NOTICE '  8. Complete result structure validation';
  RAISE NOTICE '  9. asset_status preservation';
  
END
$test$;

ROLLBACK;
