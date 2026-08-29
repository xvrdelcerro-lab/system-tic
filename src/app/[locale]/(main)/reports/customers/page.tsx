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
import { generateCustomerReport } from './actions';
import { useCustomers } from '@/hooks/use-customers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toDateSafe } from '@/lib/date';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const reportFormSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});


export default function CustomerReportsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('CustomerReportsPage');
  const tCommon = useTranslations('ProtectedPage');
  const tReport = useTranslations('CustomerReportsReport');
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { customers, loading } = useCustomers();
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      customerId: 'all',
      startDate: '',
      endDate: '',
    },
  });

  const handleGenerateReport = async (data: z.infer<typeof reportFormSchema>) => {
    setIsGenerating(true);

    const reportTranslations = {
      titleAll: tReport('titleAll'),
      titleSingle: tReport.raw('titleSingle'),
      subtitleAll: tReport.raw('subtitleAll'),
      subtitleSingle: tReport.raw('subtitleSingle'),
      period: tReport.raw('period'),
      totalInvoices: tReport('totalInvoices'),
      customerProfile: {
          customer: tReport('customerProfile.customer'),
          email: tReport('customerProfile.email'),
          phone: tReport('customerProfile.phone'),
      },
      invoiceHistory: {
          title: tReport('invoiceHistory.title'),
          table: {
              invoiceNo: tReport('invoiceHistory.table.invoiceNo'),
              date: tReport('invoiceHistory.table.date'),
              dueDate: tReport('invoiceHistory.table.dueDate'),
              status: tReport('invoiceHistory.table.status'),
              amount: tReport('invoiceHistory.table.amount'),
          },
          items: {
              title: tReport('invoiceHistory.items.title'),
              description: tReport('invoiceHistory.items.description'),
              qty: tReport('invoiceHistory.items.qty'),
              price: tReport('invoiceHistory.items.price'),
              total: tReport('invoiceHistory.items.total'),
          },
          totalInvoiced: tReport('invoiceHistory.totalInvoiced'),
          noInvoices: tReport('invoiceHistory.noInvoices'),
      },
      report: {
        addressLabel: "Address",
        websiteLabel: "Website",
        joinDateLabel: "Join Date",
      }
    };
    
    const result = await generateCustomerReport({
        customerId: data.customerId,
        startDate: data.startDate,
        endDate: data.endDate,
        translations: reportTranslations,
        clientTimezone: clientTimezone,
    });
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
        title: t('toasts.errorTitle'),
        description: result.error || t('toasts.errorDescription'),
      });
    }
  };
  
  const selectOptions = useMemo(() => ([
    { value: 'all', label: t('generateReport.allOption') },
    ...[...customers].sort((a, b) => a.name.localeCompare(b.name)).map(customer => ({
      value: customer.id,
      label: customer.name,
    })),
  ]), [customers, t]);

  if (permissionLoading || !isClient || loading) {
    return (
    <ProtectedPage pageName="reports.customers" pageTitle={t('title')}>

        <div className="space-y-8 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
                {t('title')}
            </h1>
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

  if (!hasAccess('reports.customers')) {
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
    <ProtectedPage pageName="reports.customers" pageTitle={t('title')}>
<div className="space-y-8 max-w-4xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <p className="text-xl font-semibold text-muted-foreground">
          {t('totalCustomers', { count: customers.length })}
        </p>
      </div>

      <Card>
        <Form {...reportForm}>
          <form onSubmit={reportForm.handleSubmit(handleGenerateReport)}>
            <CardHeader>
              <CardTitle>{t('generateReport.title')}</CardTitle>
              <CardDescription>
                {t('generateReport.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <FormField
                  control={reportForm.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:mr-4">
                      <FormLabel>{t('generateReport.customerLabel')}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-[270px] justify-between",
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
                        <PopoverContent className="w-[270px] p-0">
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
                                      reportForm.setValue("customerId", option.value)
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
                    <FormItem className="flex flex-col md:mr-4">
                      <FormLabel>{t('generateReport.startDateLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={reportForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:mr-4">
                      <FormLabel>{t('generateReport.endDateLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="mt-4 md:mt-0">
                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    {t('generateReport.generateButton')}
                  </Button>
                </div>
              </div>
            </CardContent>
            {/* Removed duplicate print button from CardFooter */}
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('existingCustomers.title')}</CardTitle>
          <CardDescription>{t('existingCustomers.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('existingCustomers.table.name')}</TableHead>
                <TableHead>{t('existingCustomers.table.email')}</TableHead>
                <TableHead>{t('existingCustomers.table.phone')}</TableHead>
                <TableHead>{t('existingCustomers.table.joinDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : customers.length > 0 ? (
                customers.slice(0, 20).map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.contact}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.joinDate ? format(toDateSafe(customer.joinDate)!, 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {t('existingCustomers.empty')}
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