'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useExpenses } from '@/hooks/use-expenses';
import { useAccounts } from '@/hooks/use-accounts';
import { cn, formatCurrency } from '@/lib/utils';
import { Loader2, Printer, Check, ChevronsUpDown, TrendingDown, Trash2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateExpensesReport } from './actions';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { ProtectedPage } from '@/components/protected-page';

const useExpenseSchemas = (t: ReturnType<typeof useTranslations>) => {
    const expenseSchema = z.object({
        description: z.string().min(1, t('validation.descriptionRequired')),
        amount: z.coerce.number().gt(0, t('validation.amountPositive')),
        category: z.string().min(1, t('validation.categoryRequired')),
        date: z.date({ required_error: t('validation.dateRequired') }),
        notes: z.string().optional(),
    });
    
    return { expenseSchema };
};

export default function ExpensesPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  // PERMISSION CHECK ADDED HERE
    const t = useTranslations('ExpensesPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData');
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { expenses, loading: expensesLoading, createExpense, deleteExpense } = useExpenses();
  const { allAccounts, loading: accountsLoading } = useAccounts();
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

  const { expenseSchema } = useExpenseSchemas(t);
  
  const loading = expensesLoading || accountsLoading;

  const expenseAccounts = useMemo(() => {
    return allAccounts.filter(acc => acc.type === 'Expense').sort((a,b) => a.name.localeCompare(b.name));
  }, [allAccounts]);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: undefined,
      category: '',
      date: new Date(),
      notes: '',
    },
  });

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

  const onExpenseSubmit = async (data: z.infer<typeof expenseSchema>) => {
    try {
      await createExpense(data);
      toast({ title: t('toasts.expenseAdded') });
      form.reset({
        description: '',
        amount: undefined,
        category: '',
        date: new Date(),
        notes: '',
      });
    } catch(e: any) {
      toast({ variant: 'destructive', title: t('toasts.error'), description: e.message });
    }
  };

  // PERMISSION CHECK
  if (permissionLoading || !isClient || loading) {
    return (
    <ProtectedPage pageName="expenses" pageTitle="Expenses">

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

  if (!hasAccess('expenses')) {
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
    <ProtectedPage pageName="expenses" pageTitle="Expenses">
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
      </div>

      <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onExpenseSubmit)}>
                <CardHeader>
                    <CardTitle>{t('newExpense.title')}</CardTitle>
                    <CardDescription>{t('newExpense.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-4">
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('newExpense.descriptionLabel')}</FormLabel>
                                    <FormControl><Input placeholder={t('newExpense.descriptionPlaceholder')} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="md:col-span-1">
                             <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('newExpense.amountLabel')}</FormLabel>
                                        <FormControl>
                                            <InputWithDecimals
                                                placeholder="0.00"
                                                prefix="$"
                                                name={field.name}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                value={field.value ?? ''}
                                                onValueChange={(values) => {
                                                  field.onChange(values.floatValue === undefined ? undefined : values.floatValue)
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-end">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('newExpense.categoryLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('newExpense.categoryPlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>{expenseAccounts.map(c => <SelectItem key={c.id} value={c.name}>{tData(`Accounts.${c.name}.name`, {}, { default: c.name })}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>{t('newExpense.dateLabel')}</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild><FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "PPP") : <span>{t('newExpense.datePlaceholder')}</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                                </Popover><FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                    <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>{t('newExpense.notesLabel')}</FormLabel><FormControl><Textarea placeholder={t('newExpense.notesPlaceholder')} {...field}/></FormControl><FormMessage/></FormItem>)}/>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{t('newExpense.saveButton')}</Button>
                </CardFooter>
            </form>
        </Form>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('filters.title')}</CardTitle>
            </div>
            <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {t('generateButton')}
            </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
                <label className="text-sm font-medium">{t('filters.categoryLabel')}</label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full justify-between', !categoryFilter && 'text-muted-foreground')}>
                    {categoryFilter && categoryFilter !== 'all' ? tData(`Accounts.${categoryFilter}.name`, {}, { default: categoryFilter }) : t('filters.allCategories')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command>
                    <CommandInput placeholder={t('filters.searchPlaceholder')} />
                    <CommandList><CommandEmpty>{t('filters.empty')}</CommandEmpty><CommandGroup>
                        <CommandItem key="all" onSelect={() => { setCategoryFilter('all'); setCategoryPopoverOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', categoryFilter === 'all' ? 'opacity-100' : 'opacity-0')}/>{t('filters.allCategories')}
                        </CommandItem>
                        {expenseAccounts.map((c) => (<CommandItem value={tData(`Accounts.${c.name}.name`, {}, { default: c.name })} key={c.id} onSelect={() => { setCategoryFilter(c.name); setCategoryPopoverOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', c.name === categoryFilter ? 'opacity-100' : 'opacity-0')}/>{tData(`Accounts.${c.name}.name`, {}, { default: c.name })}
                        </CommandItem>))}
                    </CommandGroup></CommandList>
                </Command></PopoverContent>
                </Popover>
            </div>
              <div className="space-y-2 w-full">
                  <label htmlFor="start-date" className="text-sm font-medium">{t('filters.startDateLabel')}</label>
                  <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2 w-full">
                  <label htmlFor="end-date" className="text-sm font-medium">{t('filters.endDateLabel')}</label>
                  <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
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
                  <TableHead className="text-right">{t('log.actionsHeader')}</TableHead>
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
                           <TableCell className="text-right align-top">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle><AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteExpense(rec.id)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                           </TableCell>
                      </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
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