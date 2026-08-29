import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// 1. Define supported locales
export const locales = ['en', 'es'] as const;
export const localePrefix = 'as-needed';

// 2. Map your internal routes (Keep your existing pathnames object here)
export const pathnames = {
  '/': '/',
  '/dashboard': '/dashboard',
  // ... (keep all your other paths exactly as they are)
} as const;

// 3. Export the request configuration for Next.js 15
export default getRequestConfig(async ({ requestLocale }) => {
  // Await the locale promise - this is the critical fix for Next.js 15
  const locale = await requestLocale;

  // Validate that the incoming locale is valid
  if (!locales.includes(locale as any)) notFound();

  try {
    // Dynamically import the translation file
    const module = await import(`./messages/${locale}.json`);
    
    // Some environments require .default, others return the raw object
    const messages = module.default ?? module;

    return {
      locale,
      messages
    };

  } catch (error) {
    console.error(`Error loading messages for locale "${locale}":`, error);
    return {
      locale,
      messages: {} 
    };
  }
});