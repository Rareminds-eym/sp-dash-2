/**
 * Validation utilities for course management
 */

/**
 * Validate course fields
 * @param {Object} data - Course data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateCourseData(data, isUpdate = false) {
  const errors = [];

  // Required fields for creation
  if (!isUpdate) {
    const requiredFields = [
      'name',
      'course_code',
      'description',
      'university',
      'duration',
      'credits',
      'category',
      'thumbnail_url',
      'target_outcomes'
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    }
  }

  // Validate name
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('name must be a string');
    } else if (data.name.trim().length === 0) {
      errors.push('name cannot be empty');
    } else if (data.name.length < 3) {
      errors.push('name must be at least 3 characters long');
    } else if (data.name.length > 200) {
      errors.push('name must not exceed 200 characters');
    }
  }

  // Validate course_code
  if (data.course_code !== undefined) {
    if (typeof data.course_code !== 'string') {
      errors.push('course_code must be a string');
    } else if (data.course_code.trim().length === 0) {
      errors.push('course_code cannot be empty');
    } else if (!/^[A-Z0-9-_]+$/i.test(data.course_code)) {
      errors.push('course_code can only contain letters, numbers, hyphens, and underscores');
    } else if (data.course_code.length > 50) {
      errors.push('course_code must not exceed 50 characters');
    }
  }

  // Validate description
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('description must be a string');
    } else if (data.description.trim().length === 0) {
      errors.push('description cannot be empty');
    } else if (data.description.length < 10) {
      errors.push('description must be at least 10 characters long');
    } else if (data.description.length > 5000) {
      errors.push('description must not exceed 5000 characters');
    }
  }

  // Validate university
  if (data.university !== undefined) {
    if (typeof data.university !== 'string') {
      errors.push('university must be a string');
    } else if (data.university.trim().length === 0) {
      errors.push('university cannot be empty');
    } else if (data.university.length > 200) {
      errors.push('university must not exceed 200 characters');
    }
  }

  // Validate duration
  if (data.duration !== undefined) {
    if (typeof data.duration !== 'string') {
      errors.push('duration must be a string');
    } else if (data.duration.trim().length === 0) {
      errors.push('duration cannot be empty');
    } else if (!/^\d+\s*(week|weeks|month|months|hour|hours|day|days)$/i.test(data.duration)) {
      errors.push('duration must be in format like "4 weeks", "3 months", "40 hours"');
    }
  }

  // Validate credits
  if (data.credits !== undefined) {
    const credits = Number(data.credits);
    if (isNaN(credits)) {
      errors.push('credits must be a valid number');
    } else if (credits < 0) {
      errors.push('credits cannot be negative');
    } else if (credits > 100) {
      errors.push('credits must not exceed 100');
    } else if (!Number.isInteger(credits)) {
      errors.push('credits must be a whole number');
    }
  }

  // Validate category
  if (data.category !== undefined) {
    if (typeof data.category !== 'string') {
      errors.push('category must be a string');
    } else if (data.category.trim().length === 0) {
      errors.push('category cannot be empty');
    } else if (data.category.length > 100) {
      errors.push('category must not exceed 100 characters');
    }
  }

  // Validate thumbnail_url
  if (data.thumbnail_url !== undefined) {
    if (typeof data.thumbnail_url !== 'string') {
      errors.push('thumbnail_url must be a string');
    } else if (data.thumbnail_url.trim().length === 0) {
      errors.push('thumbnail_url cannot be empty');
    } else {
      try {
        const url = new URL(data.thumbnail_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('thumbnail_url must be a valid HTTP or HTTPS URL');
        }
      } catch (e) {
        errors.push('thumbnail_url must be a valid URL');
      }
    }
  }

  // Validate target_outcomes
  if (data.target_outcomes !== undefined) {
    if (!Array.isArray(data.target_outcomes)) {
      errors.push('target_outcomes must be an array');
    } else if (data.target_outcomes.length === 0) {
      errors.push('target_outcomes must contain at least one outcome');
    } else if (data.target_outcomes.length > 50) {
      errors.push('target_outcomes must not exceed 50 items');
    } else {
      // Validate each outcome
      data.target_outcomes.forEach((outcome, index) => {
        if (typeof outcome !== 'string') {
          errors.push(`target_outcomes[${index}] must be a string`);
        } else if (outcome.trim().length === 0) {
          errors.push(`target_outcomes[${index}] cannot be empty`);
        } else if (outcome.length > 500) {
          errors.push(`target_outcomes[${index}] must not exceed 500 characters`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validatePagination(page, limit) {
  const errors = [];

  if (isNaN(page) || page < 1) {
    errors.push('page must be a positive integer');
  }

  if (isNaN(limit) || limit < 1) {
    errors.push('limit must be a positive integer');
  } else if (limit > 100) {
    errors.push('limit must not exceed 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate course approval data
 * @param {Object} data - Approval data
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateApprovalData(data) {
  const errors = [];

  if (!data.courseId) {
    errors.push('courseId is required');
  } else if (typeof data.courseId !== 'string' || data.courseId.trim().length === 0) {
    errors.push('courseId must be a valid string');
  }

  if (!data.userId) {
    errors.push('userId is required');
  } else if (typeof data.userId !== 'string' || data.userId.trim().length === 0) {
    errors.push('userId must be a valid string');
  }

  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== 'string') {
      errors.push('notes must be a string');
    } else if (data.notes.length > 1000) {
      errors.push('notes must not exceed 1000 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate course rejection data
 * @param {Object} data - Rejection data
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateRejectionData(data) {
  const errors = [];

  if (!data.courseId) {
    errors.push('courseId is required');
  } else if (typeof data.courseId !== 'string' || data.courseId.trim().length === 0) {
    errors.push('courseId must be a valid string');
  }

  if (!data.userId) {
    errors.push('userId is required');
  } else if (typeof data.userId !== 'string' || data.userId.trim().length === 0) {
    errors.push('userId must be a valid string');
  }

  if (!data.reason) {
    errors.push('reason is required');
  } else if (typeof data.reason !== 'string') {
    errors.push('reason must be a string');
  } else if (data.reason.trim().length === 0) {
    errors.push('reason cannot be empty');
  } else if (data.reason.length < 10) {
    errors.push('reason must be at least 10 characters long');
  } else if (data.reason.length > 1000) {
    errors.push('reason must not exceed 1000 characters');
  }

  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== 'string') {
      errors.push('notes must be a string');
    } else if (data.notes.length > 1000) {
      errors.push('notes must not exceed 1000 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize course data for database insertion
 * @param {Object} data - Course data
 * @returns {Object} Sanitized data
 */
export function sanitizeCourseData(data) {
  return {
    title: data.name?.trim(),
    code: data.course_code?.trim().toUpperCase(),
    description: data.description?.trim(),
    university: data.university?.trim(),
    duration: data.duration?.trim(),
    credits: Number(data.credits),
    category: data.category?.trim(),
    thumbnail: data.thumbnail_url?.trim(),
    target_outcomes: Array.isArray(data.target_outcomes) 
      ? data.target_outcomes.map(o => o?.trim()).filter(Boolean)
      : []
  };
}
