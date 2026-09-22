import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { supabaseLTE } from '@/lib/supabase-lte';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const capabilityCodeParam = searchParams.get('capabilityCode') || searchParams.get('capability');
    const levelParam = (searchParams.get('levelNo') || searchParams.get('level') || 'all').toLowerCase();
    
    const capabilityCode = capabilityCodeParam ? capabilityCodeParam.trim().toUpperCase() : '';
    const isAllLevels = levelParam === 'all' || levelParam === '0' || levelParam === 'full';
    const singleLevelNo = !isAllLevels ? Number(levelParam) || 1 : 1;

    // Default fallback capability data
    let capData = {
      id: capabilityCode ? `cap_${capabilityCode.toLowerCase()}` : 'cap_web_dev',
      code: capabilityCode || 'WEB_DEV',
      name: capabilityCode ? `${capabilityCode} Capability` : 'Web Application Development',
      description: 'Pre-filled capability mapping for course ingestion',
    };

    let rolesData: any[] = [];
    let roleSeqData: any[] = [];

    // If capabilityCode is provided, fetch exact capability & mapped roles from Supabase
    if (capabilityCode) {
      const { data: dbCap } = await supabaseLTE
        .from('capabilities')
        .select('*')
        .eq('code', capabilityCode)
        .maybeSingle();

      if (dbCap) {
        capData = {
          id: dbCap.id || `cap_${dbCap.code.toLowerCase()}`,
          code: dbCap.code,
          name: dbCap.name || dbCap.code,
          description: dbCap.description || `Capability for ${dbCap.code}`,
        };

        // Fetch mapped roles via role_capability_sequence
        const { data: seqs } = await supabaseLTE
          .from('role_capability_sequence')
          .select('*, roles(*)')
          .eq('capability_id', dbCap.id);

        if (seqs && seqs.length > 0) {
          seqs.forEach((s: any, idx: number) => {
            const roleObj = s.roles || s;
            if (roleObj && roleObj.role_name) {
              rolesData.push({
                id: roleObj.id || `role-${idx + 1}`,
                role_name: roleObj.role_name,
                role_family_name: roleObj.role_family_name || 'General',
                domain_name: roleObj.domain_name || 'Business',
                description: roleObj.description || `Role ${roleObj.role_name}`,
              });
              roleSeqData.push({
                id: s.id || `rcs-${idx + 1}`,
                role_id: roleObj.id || roleObj.role_name,
                capability_id: capData.code,
                sequence_order: s.sequence_order || idx + 1,
              });
            }
          });
        }
      }
    }

    if (rolesData.length === 0) {
      rolesData = [
        {
          id: 'role-uuid-1',
          role_name: 'Software Specialist',
          role_family_name: 'Engineering',
          domain_name: 'Technology',
          description: 'Designs and builds modern enterprise web applications',
        },
        {
          id: 'role-uuid-2',
          role_name: 'Senior Architect',
          role_family_name: 'Engineering',
          domain_name: 'Technology',
          description: 'Architects scalable enterprise cloud solutions',
        },
      ];
      roleSeqData = [
        {
          id: 'rcs-uuid-1',
          role_id: 'role-uuid-1',
          capability_id: capData.code,
          sequence_order: 1,
        },
        {
          id: 'rcs-uuid-2',
          role_id: 'role-uuid-2',
          capability_id: capData.code,
          sequence_order: 2,
        },
      ];
    }

    const levelNumbers = isAllLevels ? [1, 2, 3, 4, 5] : [singleLevelNo];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rareminds LTE Catalog';
    workbook.lastModifiedBy = 'Rareminds LTE Catalog';
    workbook.created = new Date();

    // Helper to style worksheet headers & rows
    const createSheetWithTemplate = (
      sheetName: string,
      columns: { header: string; key: string; width: number }[],
      sampleRows: Record<string, any>[]
    ) => {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = columns;

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' }, // Indigo brand color
        };
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
        };
      });

      // Add sample rows & style them
      sampleRows.forEach((row) => {
        const addedRow = sheet.addRow(row);
        addedRow.height = 22;
        addedRow.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      return sheet;
    };

    // 1. README_INSTRUCTIONS Sheet
    const readmeSheet = workbook.addWorksheet('README_INSTRUCTIONS');
    readmeSheet.columns = [
      { header: 'SECTION', key: 'section', width: 25 },
      { header: 'INSTRUCTION / DESCRIPTION', key: 'description', width: 85 },
    ];
    
    const readmeHeaderRow = readmeSheet.getRow(1);
    readmeHeaderRow.height = 28;
    readmeHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const instructions = [
      {
        section: 'Workbook Scope',
        description: isAllLevels
          ? `Full 5-Level Catalog Template (L1 to L5) for Capability: ${capData.code}`
          : `Single Level Template for Capability: ${capData.code} — Level ${singleLevelNo} (${capData.code}_L${singleLevelNo})`,
      },
      {
        section: 'Pre-filled Mappings',
        description: `Capability '${capData.code}' and its mapped Roles are pre-configured. Fill in your level titles, 6E content, and artifacts.`,
      },
      {
        section: 'Multi-Level Ingestion',
        description:
          'When uploaded to Upload & Validate, the ingestion engine parses all levels in the workbook and attaches them to the capability in sequence.',
      },
      {
        section: '6E Stages',
        description:
          'modules_content stage_name must be one of: engage, explore, explain, express, empower, evolve.',
      },
      {
        section: 'Pipe-Delimited Fields (|)',
        description:
          'Use pipe | symbol for multi-value list fields (tags, prerequisites, instructions).',
      },
    ];

    instructions.forEach((item) => {
      const row = readmeSheet.addRow(item);
      row.height = 24;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      });
    });

    // 2. roles
    createSheetWithTemplate(
      'roles',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'role_name', key: 'role_name', width: 28 },
        { header: 'role_family_name', key: 'role_family_name', width: 25 },
        { header: 'domain_name', key: 'domain_name', width: 22 },
        { header: 'description', key: 'description', width: 45 },
      ],
      rolesData
    );

    // 3. capabilities
    createSheetWithTemplate(
      'capabilities',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'code', key: 'code', width: 20 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'description', key: 'description', width: 45 },
      ],
      [
        {
          id: capData.id,
          code: capData.code,
          name: capData.name,
          description: capData.description,
        },
      ]
    );

    // 4. level_scale
    const levelScaleRows = levelNumbers.map((lvl) => ({
      id: `level-scale-uuid-${lvl}`,
      level_no: lvl,
      name: `Level ${lvl}`,
      description: `Level ${lvl} proficiency tier for ${capData.code}`,
    }));

    createSheetWithTemplate(
      'level_scale',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'level_no', key: 'level_no', width: 15 },
        { header: 'name', key: 'name', width: 25 },
        { header: 'description', key: 'description', width: 40 },
      ],
      levelScaleRows
    );

    // 5. role_capability_sequence
    createSheetWithTemplate(
      'role_capability_sequence',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'role_id', key: 'role_id', width: 25 },
        { header: 'capability_id', key: 'capability_id', width: 25 },
        { header: 'sequence_order', key: 'sequence_order', width: 18 },
      ],
      roleSeqData
    );

    // 6. skills
    const skillsRows = levelNumbers.map((lvl) => ({
      id: `skill-${capData.code.toLowerCase()}-l${lvl}`,
      code: `${capData.code}_SKILL_${lvl}`,
      name: `${capData.name} Skill Level ${lvl}`,
      description: `Applied skill competency for ${capData.code}_L${lvl}`,
      tags: `${capData.code} | Level ${lvl} | Core Competency`,
    }));

    createSheetWithTemplate(
      'skills',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'code', key: 'code', width: 20 },
        { header: 'name', key: 'name', width: 28 },
        { header: 'description', key: 'description', width: 45 },
        { header: 'tags', key: 'tags', width: 30 },
      ],
      skillsRows
    );

    // 7. levels
    const levelRows = levelNumbers.map((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      return {
        id: `level-${targetCode.toLowerCase()}-uuid`,
        capability_id: capData.code,
        level_id: `level-scale-uuid-${lvl}`,
        level_code: targetCode,
        title: `${capData.name} Level ${lvl}`,
        description: `Comprehensive Level ${lvl} mastery program for ${capData.code}`,
        problem_statement: `Solve Level ${lvl} challenges in ${capData.name}`,
        observable_behavior: `Demonstrates Level ${lvl} independent execution`,
        example_outputs: `Delivers Level ${lvl} project artifacts`,
      };
    });

    createSheetWithTemplate(
      'levels',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'capability_id', key: 'capability_id', width: 25 },
        { header: 'level_id', key: 'level_id', width: 25 },
        { header: 'level_code', key: 'level_code', width: 20 },
        { header: 'title', key: 'title', width: 35 },
        { header: 'description', key: 'description', width: 45 },
        { header: 'problem_statement', key: 'problem_statement', width: 40 },
        { header: 'observable_behavior', key: 'observable_behavior', width: 40 },
        { header: 'example_outputs', key: 'example_outputs', width: 40 },
      ],
      levelRows
    );

    // 8. level_skills
    const levelSkillsRows = levelNumbers.map((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      return {
        id: `ls-${targetCode.toLowerCase()}-uuid`,
        level_id: `level-${targetCode.toLowerCase()}-uuid`,
        skill_id: `skill-${capData.code.toLowerCase()}-l${lvl}`,
      };
    });

    createSheetWithTemplate(
      'level_skills',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'level_id', key: 'level_id', width: 25 },
        { header: 'skill_id', key: 'skill_id', width: 25 },
      ],
      levelSkillsRows
    );

    // 9. modules
    const modulesRows = levelNumbers.map((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      return {
        id: `module-${targetCode.toLowerCase()}-1`,
        level_id: `level-${targetCode.toLowerCase()}-uuid`,
        code: `MOD_${targetCode}_01`,
        title: `${capData.name} Level ${lvl} Core Module`,
        description: `Deep dive module for ${targetCode}`,
        sequence_order: 1,
        pressure_points: `Complex scenario analysis for Level ${lvl}`,
        user_confusion: `Advanced configuration edge cases in Level ${lvl}`,
        prerequisites: lvl > 1 ? `${capData.code}_L${lvl - 1} Completion` : 'Foundational Knowledge',
      };
    });

    createSheetWithTemplate(
      'modules',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'level_id', key: 'level_id', width: 25 },
        { header: 'code', key: 'code', width: 20 },
        { header: 'title', key: 'title', width: 35 },
        { header: 'description', key: 'description', width: 45 },
        { header: 'sequence_order', key: 'sequence_order', width: 18 },
        { header: 'pressure_points', key: 'pressure_points', width: 35 },
        { header: 'user_confusion', key: 'user_confusion', width: 35 },
        { header: 'prerequisites', key: 'prerequisites', width: 30 },
      ],
      modulesRows
    );

    // 10. modules_content
    const modulesContentRows: any[] = [];
    levelNumbers.forEach((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      const modId = `module-${targetCode.toLowerCase()}-1`;
      
      modulesContentRows.push({
        id: `mc-${targetCode.toLowerCase()}-1`,
        module_id: modId,
        stage_name: 'engage',
        stage_order: 1,
        curriculum_reference: `Section ${lvl}.1 Overview`,
        overview: `Engaging intro to ${targetCode}`,
      });
      modulesContentRows.push({
        id: `mc-${targetCode.toLowerCase()}-2`,
        module_id: modId,
        stage_name: 'explore',
        stage_order: 2,
        curriculum_reference: `Section ${lvl}.2 Guided Lab`,
        overview: `Exploratory hands-on exercise for ${targetCode}`,
      });
    });

    createSheetWithTemplate(
      'modules_content',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'module_id', key: 'module_id', width: 25 },
        { header: 'stage_name', key: 'stage_name', width: 20 },
        { header: 'stage_order', key: 'stage_order', width: 16 },
        { header: 'curriculum_reference', key: 'curriculum_reference', width: 35 },
        { header: 'overview', key: 'overview', width: 45 },
      ],
      modulesContentRows
    );

    // 11. e_content
    const eContentRows: any[] = [];
    levelNumbers.forEach((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      eContentRows.push({
        id: `econtent-${targetCode.toLowerCase()}-1`,
        modules_content_id: `mc-${targetCode.toLowerCase()}-1`,
        content_type: 'slide',
        title: `${targetCode} Master Lecture Slides`,
        url: `https://docs.google.com/presentation/d/${targetCode.toLowerCase()}_sample/edit`,
        duration_minutes: 15,
      });
    });

    createSheetWithTemplate(
      'e_content',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'modules_content_id', key: 'modules_content_id', width: 25 },
        { header: 'content_type', key: 'content_type', width: 20 },
        { header: 'title', key: 'title', width: 35 },
        { header: 'url', key: 'url', width: 45 },
        { header: 'duration_minutes', key: 'duration_minutes', width: 20 },
      ],
      eContentRows
    );

    // 12. module_artifacts
    const moduleArtifactsRows: any[] = [];
    levelNumbers.forEach((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      moduleArtifactsRows.push({
        id: `art-${targetCode.toLowerCase()}-1`,
        modules_content_id: `mc-${targetCode.toLowerCase()}-2`,
        title: `${targetCode} Capstone Lab Assignment`,
        description: `Practical assessment for ${targetCode}`,
        artifact_type: 'assignment',
      });
    });

    createSheetWithTemplate(
      'module_artifacts',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'modules_content_id', key: 'modules_content_id', width: 25 },
        { header: 'title', key: 'title', width: 35 },
        { header: 'description', key: 'description', width: 45 },
        { header: 'artifact_type', key: 'artifact_type', width: 22 },
      ],
      moduleArtifactsRows
    );

    // 13. artifact_questions
    const artifactQuestionsRows: any[] = [];
    levelNumbers.forEach((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      artifactQuestionsRows.push({
        id: `q-${targetCode.toLowerCase()}-1`,
        artifact_id: `art-${targetCode.toLowerCase()}-1`,
        question_text: `How do you handle edge cases in ${targetCode}?`,
        instructions:
          'Required: Detailed explanation | Pass Criteria: 80% accuracy | Critical Fail: Incorrect framework selection',
      });
    });

    createSheetWithTemplate(
      'artifact_questions',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'artifact_id', key: 'artifact_id', width: 25 },
        { header: 'question_text', key: 'question_text', width: 45 },
        { header: 'instructions', key: 'instructions', width: 55 },
      ],
      artifactQuestionsRows
    );

    // 14. artifact_templates
    const artifactTemplatesRows: any[] = [];
    levelNumbers.forEach((lvl) => {
      const targetCode = `${capData.code}_L${lvl}`;
      artifactTemplatesRows.push({
        id: `tmpl-${targetCode.toLowerCase()}-1`,
        artifact_id: `art-${targetCode.toLowerCase()}-1`,
        template_type: 'starter_template',
        file_url: `https://cdn.rareminds.in/templates/${targetCode.toLowerCase()}_starter.xlsx`,
        content_structure: 'Standard Exercise Structure',
      });
    });

    createSheetWithTemplate(
      'artifact_templates',
      [
        { header: 'id', key: 'id', width: 25 },
        { header: 'artifact_id', key: 'artifact_id', width: 25 },
        { header: 'template_type', key: 'template_type', width: 22 },
        { header: 'file_url', key: 'file_url', width: 45 },
        { header: 'content_structure', key: 'content_structure', width: 35 },
      ],
      artifactTemplatesRows
    );

    const buffer = await workbook.xlsx.writeBuffer();

    const filename = isAllLevels
      ? capabilityCode ? `LTE_${capData.code}_Full_L1_to_L5_Template.xlsx` : `LTE_Learning_Catalog_Full_L1_to_L5_Template.xlsx`
      : `LTE_${capData.code}_L${singleLevelNo}_Template.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Error generating LTE template Excel:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate Excel template' },
      { status: 500 }
    );
  }
}
