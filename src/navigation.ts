import {createLocalizedPathnamesNavigation} from 'next-intl/navigation';
import {locales, localePrefix, pathnames} from './i18n';

export const {Link, redirect, usePathname, useRouter} =
  createLocalizedPathnamesNavigation({locales, localePrefix, pathnames});
