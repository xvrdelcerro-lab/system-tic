'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useExpenses } from '@/hooks/use-expenses';
import { useAccounts } from '@/hooks/use-accounts';
import { cn, formatCurrency } from '@/lib/utils';
import { Loader2, Printer, Check, ChevronsUpDown, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateExpensesReport } from './actions';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

export default function ExpensesReportPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ExpensesPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData');
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { expenses } = useExpenses();
  const { allAccounts } = useAccounts();
  const { toast } = useToast();
  const [clientTimezone, setClientTimezone] = useState('UTC');

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const expenseAccounts = useMemo(() => {
    return allAccounts.filter(acc => acc.type === 'Expense').sort((a,b) => a.name.localeCompare(b.name));
  }, [allAccounts]);

  const categorySelectOptions = useMemo(
    () => [
      { value: 'all', label: t('filters.allCategories') },
      ...expenseAccounts.map((c) => ({ 
        value: c.name, 
        label: tData(`Accounts.${c.name}.name`, {}, { default: c.name })
      })),
    ],
    [expenseAccounts, t, tData]
  );

  const { filteredRecords, filterTitle } = useMemo(() => {
    let result = expenses;
    let titleParts: string[] = [];
    
    if (categoryFilter && categoryFilter !== 'all') {
      const account = expenseAccounts.find(c => c.name === categoryFilter);
      const translatedCategory = account ? tData(`Accounts.${account.name}.name`, {}, { default: account.name }) : categoryFilter;
      result = result.filter(r => r.category === categoryFilter);
      titleParts.push(`${t('filters.categoryLabel')}: ${translatedCategory}`);
    }

    const formatDateForTitle = (dateString: string) => {
      if (!dateString) return '';
      const parts = dateString.split('-');
      if (parts.length !== 3) return '';
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (isNaN(date.getTime())) return '';
      return format(date, 'MMM-dd-yy');
    };

    if (startDate) titleParts.push(`${t('filters.startDateLabel')}: ${formatDateForTitle(startDate)}`);
    if (endDate) titleParts.push(`${t('filters.endDateLabel')}: ${formatDateForTitle(endDate)}`);

    if (startDate) {
      result = result.filter(r => {
          if (!r.date) return false;
          const expDate = new Date(r.date);
          const expDateStr = expDate.toLocaleDateString('en-CA');
          return expDateStr >= startDate;
      });
  }

  if (endDate) {
      result = result.filter(r => {
          if (!r.date) return false;
          const expDate = new Date(r.date);
          const expDateStr = expDate.toLocaleDateString('en-CA');
          return expDateStr <= endDate;
      });
  }

  return {
      filteredRecords: result.sort((a, b) => b.date.getTime() - a.date.getTime()),
      filterTitle: titleParts.join(' | ')
  };
  
  }, [expenses, categoryFilter, startDate, endDate, t, expenseAccounts, tData]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    const translations = {
      title: t('title'),
      grandTotal: t('log.grandTotal'),
      dateHeader: t('log.dateHeader'),
      categoryHeader: t('log.categoryHeader'),
      descriptionHeader: t('log.descriptionHeader'),
      amountHeader: t('log.amountHeader'),
      empty: t('empty'),
      Accounts: tData.raw('Accounts')
    };
    const result = await generateExpensesReport(filteredRecords, filterTitle, translations, clientTimezone);
    setIsGenerating(false);

    if (result.success && result.reportContent) {
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
        reportWindow.print();
      }
    } else {
      toast({
        variant: 'destructive',
        title: t('toasts.reportError'),
        description: result.error || 'An unknown error occurred.',
      });
    }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.expenses" pageTitle={t('title')}>

      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('log.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.expenses')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{tCommon('accessDenied.title')}</h1>
        <Alert variant="destructive">
          <AlertTitle>{tCommon('accessDenied.title')}</AlertTitle>
          <AlertDescription>
            {tCommon('accessDenied.description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ProtectedPage pageName="reports.expenses" pageTitle={t('title')}>
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
                <label className="text-sm font-medium">{t('filters.categoryLabel')}</label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full justify-between', !categoryFilter && 'text-muted-foreground')}>
                    {categoryFilter && categoryFilter !== 'all' 
                      ? categorySelectOptions.find(option => option.value === categoryFilter)?.label 
                      : t('filters.allCategories')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                    <CommandInput placeholder={t('filters.searchPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>{t('filters.empty')}</CommandEmpty>
                        <CommandGroup>
                        {categorySelectOptions.map((option) => (
                            <CommandItem
                            value={option.label}
                            key={option.value}
                            onSelect={() => {
                                setCategoryFilter(option.value);
                                setCategoryPopoverOpen(false);
                            }}
                            >
                            <Check className={cn('mr-2 h-4 w-4', option.value === categoryFilter ? 'opacity-100' : 'opacity-0')} />
                            {option.label}
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                    </Command>
                </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <label htmlFor="start-date" className="text-sm font-medium">{t('filters.startDateLabel')}</label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
                <label htmlFor="end-date" className="text-sm font-medium">{t('filters.endDateLabel')}</label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {t('generateButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('log.title')}</CardTitle>
          <CardDescription>{t('log.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('log.dateHeader')}</TableHead>
                  <TableHead>{t('log.categoryHeader')}</TableHead>
                  <TableHead>{t('log.descriptionHeader')}</TableHead>
                  <TableHead className="text-right">{t('log.amountHeader')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((rec) => (
                      <TableRow key={rec.id}>
                          <TableCell className="align-top">{format(rec.date, 'MMM-dd-yy')}</TableCell>
                          <TableCell className="align-top">{tData(`Accounts.${rec.category}.name`, {}, { default: rec.category })}</TableCell>
                          <TableCell className="align-top text-sm">
                              {rec.description}
                              {rec.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {rec.notes}</p>}
                          </TableCell>
                          <TableCell className="text-right font-medium align-top">{formatCurrency(rec.amount)}</TableCell>
                      </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <TrendingDown className="h-8 w-8" />
                          <span>{t('empty')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}