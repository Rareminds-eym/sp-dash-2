import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * PUT /api/recruiters/[id] - Update a recruiter
 */
export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();

        // Prevent updating immutable fields if necessary
        delete body.id;
        delete body.createdat;

        const updateData = {
            ...body,
            updatedat: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('recruiters')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating recruiter:', error);
            return NextResponse.json({ error: 'Failed to update recruiter' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return handleError(error, 'Update Recruiter');
    }
}

/**
 * DELETE /api/recruiters/[id] - Delete a recruiter
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        // Hard delete or soft delete? 
        // Usually soft delete is safer, but if explicitly requested delete, we might do hard delete.
        // Let's implement hard delete for now as per "Delete Functionality" requirement, 
        // but often "Delete" in UI maps to "Deactivate" or "Soft Delete".
        // Given the task says "Delete Functionality", I will do a hard delete from the DB.

        // Fetch recruiter to get user_id
        const { data: recruiter, error: fetchError } = await supabaseAdmin
            .from('recruiters')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error fetching recruiter for deletion:', fetchError);
            return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
        }

        const userId = recruiter.user_id;

        // Delete from recruiters table first (to avoid FK constraint if we delete user first? 
        // No, usually delete child first. Recruiters has FK to Users. So delete Recruiter first.)
        const { error } = await supabaseAdmin
            .from('recruiters')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting recruiter:', error);
            return NextResponse.json({ error: 'Failed to delete recruiter' }, { status: 500 });
        }

        // Delete from users table
        if (userId) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .delete()
                .eq('id', userId);

            if (userError) {
                console.error('Error deleting user profile:', userError);
                // Continue to delete auth user anyway
            }

            // Delete from auth
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (authError) {
                console.error('Error deleting auth user:', authError);
            }
        }

        return NextResponse.json({ success: true, message: 'Recruiter deleted successfully' });
    } catch (error) {
        return handleError(error, 'Delete Recruiter');
    }
}
