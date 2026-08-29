'use client';

import React from 'react';
import { usePathname, Link } from '@/navigation';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type BreadcrumbProps = React.HTMLAttributes<HTMLElement>;

export function Breadcrumbs({ className, ...props }: BreadcrumbProps) {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter((segment) => segment);

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-sm font-medium text-muted-foreground', className)} {...props}>
      <ol className="flex items-center space-x-1">
        <li>
          <Link href="/dashboard" className="capitalize hover:text-foreground">
            Home
          </Link>
        </li>
        {pathSegments.map((segment, index) => {
          const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
          const isLast = index === pathSegments.length - 1;

          return (
            <React.Fragment key={href}>
              <li className="flex items-center">
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={href}
                  className={cn(
                    'ml-1 capitalize hover:text-foreground',
                    isLast && 'pointer-events-none text-foreground'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {segment.replace(/-/g, ' ')}
                </Link>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
