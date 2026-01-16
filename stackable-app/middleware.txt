import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')!;
  const pathname = req.nextUrl.pathname;

  // Extract subdomain
  const subdomain = host.split('.')[0];

  // Admin subdomain
  if (subdomain === 'login') {
    return NextResponse.rewrite(
      new URL(`/login${pathname}`, req.url)
    );
  }

  // App subdomain
  if (subdomain === 'dashboard') {
    return NextResponse.rewrite(
      new URL(`/dashboard${pathname}`, req.url)
    );
  }

  // Root domain
  return NextResponse.rewrite(
    new URL(`/home${pathname}`, req.url)
  );
}
