import { describe, expect, it } from 'vitest';
import { normalizeCourseHierarchy } from '@/lib/services/course-hierarchy';

const DB_SHAPE = [
  {
    id: 'm1',
    title: 'Module 1',
    description: 'desc',
    orderIndex: 0,
    skillTags: ['js'],
    activities: [{ kind: 'quiz' }],
    lessons: [
      {
        id: 'l1',
        title: 'Lesson 1',
        description: 'ld',
        content: 'rich content',
        duration: '30 mins',
        orderIndex: 0,
        resources: [
          {
            id: 'r1',
            name: 'Slides',
            type: 'pdf',
            url: '/api/courses/assets?key=courses/resources/2024/01/a.pdf',
            fileSize: '1.2 MB',
            thumbnailUrl: 'https://cdn/t.jpg',
            embedUrl: null,
            orderIndex: 0,
          },
        ],
      },
    ],
  },
];

describe('normalizeCourseHierarchy round-trip preservation', () => {
  it('preserves ids, content, activities, skill tags and sizes', () => {
    const [mod] = normalizeCourseHierarchy(DB_SHAPE);
    expect(mod.id).toBe('m1');
    expect(mod.skillTags).toEqual(['js']);
    expect(mod.activities).toEqual([{ kind: 'quiz' }]);
    const [lesson] = mod.lessons;
    expect(lesson.id).toBe('l1');
    expect(lesson.content).toBe('rich content');
    expect(lesson.duration).toBe('30 mins');
    const [res] = lesson.resources;
    expect(res.id).toBe('r1');
    expect(res.size).toBe('1.2 MB');
    expect(res.fileSize).toBe('1.2 MB');
    expect(res.thumbnailUrl).toBe('https://cdn/t.jpg');
  });

  it('populates both order and orderIndex aliases', () => {
    const [mod] = normalizeCourseHierarchy(DB_SHAPE);
    expect(mod.order).toBe(0);
    expect(mod.orderIndex).toBe(0);
    expect(mod.lessons[0].order).toBe(0);
    expect(mod.lessons[0].orderIndex).toBe(0);
    expect(mod.lessons[0].resources[0].order).toBe(0);
    expect(mod.lessons[0].resources[0].orderIndex).toBe(0);
  });

  it('accepts legacy snake_case keys from the database', () => {
    const [mod] = normalizeCourseHierarchy([
      {
        module_id: 'm9',
        title: 'M',
        order_index: 3,
        skill_tags: ['a'],
        lessons: [
          {
            lesson_id: 'l9',
            title: 'L',
            order_index: 2,
            resources: [
              { resource_id: 'r9', name: 'N', type: 'link', url: 'https://x', order_index: 4 },
            ],
          },
        ],
      },
    ]);
    expect(mod.id).toBe('m9');
    expect(mod.order).toBe(3);
    expect(mod.skillTags).toEqual(['a']);
    expect(mod.lessons[0].id).toBe('l9');
    expect(mod.lessons[0].order).toBe(2);
    expect(mod.lessons[0].resources[0].id).toBe('r9');
    expect(mod.lessons[0].resources[0].order).toBe(4);
  });

  it('handles empty course / empty module / lessons without resources', () => {
    expect(normalizeCourseHierarchy([])).toEqual([]);
    expect(normalizeCourseHierarchy(null)).toEqual([]);
    const [mod] = normalizeCourseHierarchy([{ id: 'm', title: 'M', lessons: [] }]);
    expect(mod.lessons).toEqual([]);
    const [mod2] = normalizeCourseHierarchy([
      { id: 'm', title: 'M', lessons: [{ id: 'l', title: 'L', resources: [] }] },
    ]);
    expect(mod2.lessons[0].resources).toEqual([]);
  });

  it('is idempotent: normalize(normalize(x)) deep-equals normalize(x)', () => {
    const once = normalizeCourseHierarchy(DB_SHAPE);
    const twice = normalizeCourseHierarchy(once);
    expect(twice).toEqual(once);
  });

  it('repeated save does not duplicate lessons or resources', () => {
    // Simulates edit → save → reload → edit: ids survive, counts stable.
    const first = normalizeCourseHierarchy(DB_SHAPE);
    const reloaded = JSON.parse(JSON.stringify(first));
    const second = normalizeCourseHierarchy(reloaded);
    expect(second[0].lessons).toHaveLength(1);
    expect(second[0].lessons[0].resources).toHaveLength(1);
    expect(second[0].lessons[0].resources[0].id).toBe('r1');
  });
});
