'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Printer, Check, ChevronsUpDown } from 'lucide-react';
import { generateProductReport } from './actions';
import { useProducts } from '@/hooks/use-products';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProtectedPage } from '@/components/protected-page';

const useReportFormSchema = (t: ReturnType<typeof useTranslations>) => useMemo(() => z.object({
  productId: z.string().min(1, t('generateReport.productLabel')),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}), [t]);


export default function ProductReportsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ProductReportsPage');
  const { toast } = useToast();
  const { products, loading } = useProducts();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const reportFormSchema = useReportFormSchema(t);

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      productId: 'all',
      startDate: ''
    },
  });

  const handleGenerateReport = async (data: z.infer<typeof reportFormSchema>) => {
    setIsGenerating(true);
    
    const result = await generateProductReport({
      filters: {
        productId: data.productId,
        startDate: data.startDate,
        endDate: data.endDate
      },
      clientTimezone: clientTimezone,
      translations: {
        reportTitle: t('report.reportTitle'),
        noSalesFound: t('report.noSalesFound'),
        totalSold: t('report.totalSold'),
        unknownProduct: t('report.unknownProduct'),
        filterLabels: {
            product: t('report.filterLabels.product'),
            from: t('report.filterLabels.from'),
            to: t('report.filterLabels.to'),
        },
        tableHeaders: {
          date: t('report.tableHeaders.date'),
          invoice: t('report.tableHeaders.invoice'),
          quantity: t('report.tableHeaders.quantity'),
          price: t('report.tableHeaders.price'),
          product: t('report.tableHeaders.product')
        },
        kpis: {
          sectionTitle: t('report.kpis.sectionTitle'),
          salesCycle: {
            title: t('report.kpis.salesCycle.title'),
            daysUnit: t('report.kpis.salesCycle.daysUnit'),
            subtitle: t('report.kpis.salesCycle.subtitle'),
          },
          salesAverage: {
            title: t('report.kpis.salesAverage.title'),
            totalLabel: t('report.kpis.salesAverage.totalLabel'),
            perShipmentLabel: t('report.kpis.salesAverage.perShipmentLabel'),
            piecesUnit: t('report.kpis.salesAverage.piecesUnit'),
          },
          satisfaction: {
            title: t('report.kpis.satisfaction.title'),
            complaintsLabel: t('report.kpis.satisfaction.complaintsLabel'),
            noComplaintsFallback: t('report.kpis.satisfaction.noComplaintsFallback'),
          },
          shipments: {
            title: t('report.kpis.shipments.title'),
            perWeekUnit: t('report.kpis.shipments.perWeekUnit'),
            periodPrefix: t('report.kpis.shipments.periodPrefix'),
            periodDaysUnit: t('report.kpis.shipments.periodDaysUnit'),
          }
        }
      }
    });

    setIsGenerating(false);

    if (result.success && result.reportContent) {
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
      } else {
        toast({
          variant: 'destructive',
          title: t('toasts.popupBlocked.title'),
          description: t('toasts.popupBlocked.description'),
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: t('toasts.reportError.title'),
        description: result.error || t('toasts.reportError.description'),
      });
    }
  };

  const sortedProducts = [...products].sort((a,b) => a.name.localeCompare(b.name));
  
  const selectOptions = [
    { value: 'all', label: t('generateReport.allOption') },
    ...sortedProducts.map(product => ({
      value: product.id,
      label: product.name,
    })),
  ];

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.products" pageTitle={t('title')}>

        <div className="space-y-8 max-w-4xl">
            <div className="flex items-baseline justify-between">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    {t('title')}
                </h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>{t('generateReport.title')}</CardTitle>
                    <CardDescription>{t('generateReport.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.products')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('accessDenied.title')}</h1>
        <Alert variant="destructive">
          <AlertTitle>{t('accessDenied.alertTitle')}</AlertTitle>
          <AlertDescription>
            {t('accessDenied.description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ProtectedPage pageName="reports.products" pageTitle={t('title')}>
<div className="space-y-8 max-w-4xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <p className="text-xl font-semibold text-muted-foreground">
          {t('totalProducts', { count: products.length })}
        </p>
      </div>

      <Card>
        <Form {...reportForm}>
          <form onSubmit={reportForm.handleSubmit(handleGenerateReport)}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('generateReport.title')}</CardTitle>
                <CardDescription>
                  {t('generateReport.description')}
                </CardDescription>
              </div>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {t('generateReport.generateButton')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <FormField
                  control={reportForm.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:col-span-2">
                      <FormLabel>{t('generateReport.productLabel')}</FormLabel>
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
                                ? selectOptions.find(
                                    (option) => option.value === field.value
                                  )?.label
                                : t('generateReport.selectPlaceholder')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder={t('generateReport.searchPlaceholder')} />
                            <CommandList>
                              <CommandEmpty>{t('generateReport.empty')}</CommandEmpty>
                              <CommandGroup>
                                {selectOptions.map((option) => (
                                  <CommandItem
                                    value={option.label}
                                    key={option.value}
                                    onSelect={() => {
                                      reportForm.setValue("productId", option.value)
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={reportForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('generateReport.startDateLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={reportForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('generateReport.endDateLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('productList.title')}</CardTitle>
          <CardDescription>{t('productList.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('productList.nameHeader')}</TableHead>
                <TableHead>{t('productList.categoryHeader')}</TableHead>
                <TableHead className="text-right">{t('productList.priceHeader')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : products.length > 0 ? (
                  products.slice(0, 20).map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(product.salePrice)}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    {t('productList.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}