'use client';

import * as React from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from '@/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

export function LanguageToggle({ variant = 'outline' }: { variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant={variant} size="icon" className="h-8 w-8">
              <Languages className="h-4 w-4" />
              <span className="sr-only">Toggle language</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Language</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleLanguageChange('en')} className="justify-between">
          English
          <Check className={cn('h-4 w-4', locale !== 'en' && 'opacity-0')} />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange('es')} className="justify-between">
          Spanish
          <Check className={cn('h-4 w-4', locale !== 'es' && 'opacity-0')} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
