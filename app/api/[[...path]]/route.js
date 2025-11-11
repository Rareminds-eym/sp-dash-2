import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Minimal catch-all route handler
 * This file serves as a fallback for any API routes that haven't been modularized yet.
 * Most endpoints have been moved to their own dedicated route files.
 */

export async function GET(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';

  // Root endpoint - API info
  if (path === '/' || path === '') {
    return NextResponse.json({
      message: 'Rareminds Platform API',
      version: '2.0',
      status: 'modularized',
      documentation: '/api/docs'
    });
  }

  // 404 for unhandled routes
  return NextResponse.json(
    { 
      error: 'Endpoint not found', 
      path,
      message: 'This endpoint may have been moved to a dedicated route. Check API documentation.'
    },
    { status: 404 }
  );
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  return NextResponse.json(
    { 
      error: 'Endpoint not found', 
      path,
      message: 'This endpoint may have been moved to a dedicated route. Check API documentation.'
    },
    { status: 404 }
  );
}

export async function PUT(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  return NextResponse.json(
    { 
      error: 'Endpoint not found', 
      path,
      message: 'This endpoint may have been moved to a dedicated route. Check API documentation.'
    },
    { status: 404 }
  );
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  return NextResponse.json(
    { 
      error: 'Endpoint not found', 
      path,
      message: 'This endpoint may have been moved to a dedicated route. Check API documentation.'
    },
    { status: 404 }
  );
}
