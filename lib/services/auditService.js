import { supabaseAdmin } from '../supabase-admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log an audit entry
 * @param {string} actorId - User ID performing the action
 * @param {string} action - Action type (e.g., 'UPDATE_RECRUITER')
 * @param {string} target - Target resource ID
 * @param {Object} payload - Additional data
 * @param {string} ip - IP address
 */
export async function logAudit(actorId, action, target, payload = {}, ip = '') {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      id: uuidv4(),
      actorId,
      action,
      target,
      payload,
      ip,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
