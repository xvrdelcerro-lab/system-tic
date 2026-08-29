import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix, pathnames } from './i18n';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  defaultLocale: 'en',
  locales,
  localePrefix,
  pathnames
});

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Run the internationalization middleware
  const response = intlMiddleware(req);

  // 2. THE FIX: Firebase Client SDK doesn't use cookies by default.
  // If we block /dashboard here based on a missing cookie, 
  // the user will NEVER be able to log in.
  
  // For now, let the intlMiddleware handle the routing. 
  // We will let the Dashboard handle the "Auth Check" on the client side.
  
  return response;
}

export const config = {
  // This matcher ensures the middleware runs on all pages except static files
  matcher: ['/((?!api|_next|.*\\..*).*)']
};