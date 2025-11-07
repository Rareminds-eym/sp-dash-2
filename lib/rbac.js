/**
 * RBAC (Role-Based Access Control) Utility
 * 
 * This module provides functions for managing permissions and role-based access control.
 * It integrates with Supabase to fetch user roles and permissions, and provides
 * helper functions to check if a user has specific permissions.
 * 
 * Key Features:
 * - Fetch user permissions based on role
 * - Check if user has specific permission
 * - Require permission (throws error if missing)
 * - Entity-based access control (users tied to specific entities)
 * - Platform admin has all permissions by default
 * 
 * Usage:
 * ```javascript
 * import { getUserPermissions, hasPermission, requirePermission } from './rbac'
 * 
 * // Get all permissions for a user
 * const permissions = await getUserPermissions(userId)
 * 
 * // Check if user has permission
 * if (hasPermission(permissions, 'school:create')) {
 *   // Allow action
 * }
 * 
 * // Require permission (throws error if missing)
 * await requirePermission(userId, 'university:approve')
 * ```
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Get all permissions for a user based on their role
 * 
 * @param {string} userId - UUID of the user
 * @returns {Promise<string[]>} Array of permission names (e.g., ['school:create', 'student:read'])
 */
export async function getUserPermissions(userId) {
  try {
    // Fetch user with role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role, entity_type, entity_id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return []
    }

    // Fetch permissions for role
    const { data: rolePerms, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permissions (
          name,
          resource,
          action,
          description
        )
      `)
      .eq('role', user.role)

    if (permError) {
      console.error('Error fetching role permissions:', permError)
      return []
    }

    // Extract permission names
    const permissions = rolePerms?.map(rp => rp.permissions?.name).filter(Boolean) || []

    return permissions
  } catch (error) {
    console.error('Error in getUserPermissions:', error)
    return []
  }
}

/**
 * Get user details including role and entity information
 * 
 * @param {string} userId - UUID of the user
 * @returns {Promise<Object>} User object with role, entity_type, entity_id
 */
export async function getUserDetails(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, entity_type, entity_id')
      .eq('id', userId)
      .single()

    if (error || !user) {
      console.error('Error fetching user details:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Error in getUserDetails:', error)
    return null
  }
}

/**
 * Check if user has a specific permission
 * 
 * Platform admins (super_admin, platform_admin, admin) automatically have all permissions.
 * Other users are checked against their role's permissions.
 * 
 * @param {string[]} userPermissions - Array of permission names
 * @param {string} requiredPermission - Permission to check (e.g., 'school:create')
 * @returns {boolean} True if user has permission
 */
export function hasPermission(userPermissions, requiredPermission) {
  // Platform admin has all permissions
  if (userPermissions.includes('platform:manage_all')) {
    return true
  }
  
  // Check if user has the specific permission
  return userPermissions.includes(requiredPermission)
}

/**
 * Check if user has ANY of the specified permissions
 * 
 * @param {string[]} userPermissions - Array of permission names
 * @param {string[]} requiredPermissions - Array of permissions to check
 * @returns {boolean} True if user has at least one permission
 */
export function hasAnyPermission(userPermissions, requiredPermissions) {
  // Platform admin has all permissions
  if (userPermissions.includes('platform:manage_all')) {
    return true
  }
  
  // Check if user has any of the required permissions
  return requiredPermissions.some(perm => userPermissions.includes(perm))
}

/**
 * Check if user has ALL of the specified permissions
 * 
 * @param {string[]} userPermissions - Array of permission names
 * @param {string[]} requiredPermissions - Array of permissions to check
 * @returns {boolean} True if user has all permissions
 */
export function hasAllPermissions(userPermissions, requiredPermissions) {
  // Platform admin has all permissions
  if (userPermissions.includes('platform:manage_all')) {
    return true
  }
  
  // Check if user has all required permissions
  return requiredPermissions.every(perm => userPermissions.includes(perm))
}

/**
 * Require a specific permission (throws error if missing)
 * 
 * Use this in API routes to enforce permission checks.
 * 
 * @param {string} userId - UUID of the user
 * @param {string} permission - Permission to require (e.g., 'university:approve')
 * @throws {Error} If user doesn't have permission
 * @returns {Promise<boolean>} True if permission exists
 */
export async function requirePermission(userId, permission) {
  const permissions = await getUserPermissions(userId)
  
  if (!hasPermission(permissions, permission)) {
    throw new Error(`Missing permission: ${permission}`)
  }
  
  return true
}

/**
 * Require ANY of the specified permissions
 * 
 * @param {string} userId - UUID of the user
 * @param {string[]} permissions - Array of permissions (user needs at least one)
 * @throws {Error} If user doesn't have any of the permissions
 * @returns {Promise<boolean>} True if user has at least one permission
 */
export async function requireAnyPermission(userId, permissions) {
  const userPermissions = await getUserPermissions(userId)
  
  if (!hasAnyPermission(userPermissions, permissions)) {
    throw new Error(`Missing any of permissions: ${permissions.join(', ')}`)
  }
  
  return true
}

/**
 * Check entity-based access control
 * 
 * Ensures user can only access resources belonging to their entity.
 * Platform admins can access all entities.
 * 
 * @param {string} userId - UUID of the user
 * @param {string} entityType - Type of entity (e.g., 'school', 'university')
 * @param {string} entityId - UUID of the entity to access
 * @returns {Promise<boolean>} True if user has access to entity
 */
export async function canAccessEntity(userId, entityType, entityId) {
  const user = await getUserDetails(userId)
  
  if (!user) {
    return false
  }
  
  // Check if user has platform-wide access
  const permissions = await getUserPermissions(userId)
  if (permissions.includes('platform:manage_all')) {
    return true
  }
  
  // Check if user's entity matches the requested entity
  if (user.entity_type === entityType && user.entity_id === entityId) {
    return true
  }
  
  return false
}

/**
 * Get permission details
 * 
 * @param {string} permissionName - Name of permission (e.g., 'school:create')
 * @returns {Promise<Object>} Permission object with name, resource, action, description
 */
export async function getPermissionDetails(permissionName) {
  try {
    const { data: permission, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('name', permissionName)
      .single()

    if (error) {
      console.error('Error fetching permission details:', error)
      return null
    }

    return permission
  } catch (error) {
    console.error('Error in getPermissionDetails:', error)
    return null
  }
}

/**
 * Get all permissions for a specific role
 * 
 * @param {string} role - Role name (e.g., 'school_admin')
 * @returns {Promise<Object[]>} Array of permission objects
 */
export async function getRolePermissions(role) {
  try {
    const { data: rolePerms, error } = await supabase
      .from('role_permissions')
      .select(`
        permissions (
          id,
          name,
          resource,
          action,
          description
        )
      `)
      .eq('role', role)

    if (error) {
      console.error('Error fetching role permissions:', error)
      return []
    }

    return rolePerms?.map(rp => rp.permissions).filter(Boolean) || []
  } catch (error) {
    console.error('Error in getRolePermissions:', error)
    return []
  }
}

/**
 * Check if a role exists and is valid
 * 
 * @param {string} role - Role name to check
 * @returns {Promise<boolean>} True if role has permissions assigned
 */
export async function isValidRole(role) {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('role', role)
      .limit(1)

    if (error) {
      console.error('Error checking valid role:', error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error('Error in isValidRole:', error)
    return false
  }
}