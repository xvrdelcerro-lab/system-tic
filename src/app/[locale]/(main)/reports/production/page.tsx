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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { formatNumber, cn } from '@/lib/utils';
import { Loader2, Printer, Check, ChevronsUpDown } from 'lucide-react';
import { useProduction } from '@/hooks/use-production';
import { useToast } from '@/hooks/use-toast';
import { generateProductionReport } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProducts } from '@/hooks/use-products';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const reportFormSchema = z.object({
  productId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export default function ProductionReportsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ProductionReportsPage');
  const tCommon = useTranslations('ProtectedPage');
  const tReport = useTranslations('ProductionReport');
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { productionLog } = useProduction();
  const { products } = useProducts();
  const { toast } = useToast();
  const [clientTimezone, setClientTimezone] = useState('UTC');

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      productId: 'all',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const productSelectOptions = useMemo(() => [
    { value: 'all', label: t('allProductsOption') },
    ...sortedProducts.map(p => ({ value: p.id, label: p.name })),
  ], [sortedProducts, t]);

  const watchedFilters = form.watch();

  const { filteredRecords, filterTitle } = useMemo(() => {
    const { productId, startDate, endDate } = watchedFilters;
    let result = productionLog;
    let titleParts: string[] = [];
    
    const product = sortedProducts.find(p => p.id === productId);
    if (product) {
      titleParts.push(`${t('productLabel')}: ${product.name}`);
    }
    
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length !== 3) return '';
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (isNaN(date.getTime())) return '';
        return format(date, 'MMM-dd-yy');
    }

    if (startDate) {
        titleParts.push(`${t('startDateLabel')}: ${formatDate(startDate)}`);
    }
     if (endDate) {
        titleParts.push(`${t('endDateLabel')}: ${formatDate(endDate)}`);
    }

    if (productId && productId !== 'all') {
      result = result.filter(r => r.productId === productId);
    }
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        result = result.filter(r => r.createdAt >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        result = result.filter(r => r.createdAt <= end);
    }

    return {
        filteredRecords: result.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()),
        filterTitle: titleParts.join(' | ')
    };
  }, [productionLog, watchedFilters, sortedProducts, t]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    const reportTranslations = {
      title: tReport('title'),
      generatedOn: tReport('generatedOn'),
      table: tReport.raw('table'),
      totals: tReport.raw('totals'),
      noRecords: tReport('noRecords'),
    };
    const result = await generateProductionReport(filteredRecords, filterTitle, reportTranslations, clientTimezone);
    setIsGenerating(false);

    if (result.success && result.reportContent) {
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'An unknown error occurred.',
      });
    }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.production" pageTitle={t('title')}>

      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>{t('logDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.production')) {
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
    <ProtectedPage pageName="reports.production" pageTitle={t('title')}>
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
      </div>

      <Card>
        <Form {...form}>
          <form>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('filterTitle')}</CardTitle>
              </div>
              <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                <Printer className="mr-2 h-4 w-4" />
                )}
                {t('generateButton')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                  <FormItem className="flex flex-col md:col-span-2">
                      <FormLabel>{t('productLabel')}</FormLabel>
                      <Popover>
                          <PopoverTrigger asChild>
                          <FormControl>
                              <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                              )}
                              >
                              {field.value
                                  ? productSelectOptions.find(
                                      (option) => option.value === field.value
                                  )?.label
                                  : t('selectProductPlaceholder')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                          </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                              <CommandInput placeholder={t('searchProductPlaceholder')} />
                              <CommandList>
                              <CommandEmpty>{t('noProductFound')}</CommandEmpty>
                              <CommandGroup>
                                  {productSelectOptions.map((option) => (
                                  <CommandItem
                                      value={option.label}
                                      key={option.value}
                                      onSelect={() => {
                                      form.setValue("productId", option.value)
                                      }}
                                  >
                                      <Check
                                      className={cn(
                                          "mr-2 h-4 w-4",
                                          option.value === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                      />
                                      {option.label}
                                  </CommandItem>
                                  ))}
                              </CommandGroup>
                              </CommandList>
                          </Command>
                          </PopoverContent>
                      </Popover>
                  </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                  <FormItem className="flex flex-col">
                      <FormLabel>{t('startDateLabel')}</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} />
                      </FormControl>
                  </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                  <FormItem className="flex flex-col">
                      <FormLabel>{t('endDateLabel')}</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} />
                      </FormControl>
                  </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>{t('logDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
              <ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.date')}</TableHead>
                      <TableHead>{t('table.product')}</TableHead>
                      <TableHead>{t('table.phase')}</TableHead>
                      <TableHead className="text-right">{t('table.produced')}</TableHead>
                      <TableHead className="text-right">{t('table.damaged')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.slice(0, 20).map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell>
                            {formatInTimeZone(rec.createdAt, clientTimezone, 'MMM-dd-yy, p')}
                          </TableCell>
                          <TableCell className="font-medium">{rec.productName}</TableCell>
                          <TableCell>{rec.snapshot.phaseName}</TableCell>
                          <TableCell className="text-right">{formatNumber(rec.snapshot.goodQuantity)}</TableCell>
                          <TableCell className="text-right text-destructive">{formatNumber(rec.snapshot.damagedQuantity)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {t('emptyLog')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}