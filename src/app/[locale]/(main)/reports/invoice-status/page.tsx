'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import React, { useState, useEffect, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useProduction } from '@/hooks/use-production';
import { useCustomers } from '@/hooks/use-customers';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, FileText, AlertTriangle, Calendar as CalendarIcon, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isAfter, startOfDay } from 'date-fns';
import { toDateSafe } from '@/lib/date';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { useTranslations, useLocale } from 'next-intl';
import { es } from 'date-fns/locale';
import { ProtectedPage } from '@/components/protected-page';

const ITEMS_PER_PAGE = 20;

// Calculate invoice total from lineItems
const calculateInvoiceTotal = (invoice: any): number => {
  if (!invoice.lineItems || invoice.lineItems.length === 0) return 0;
  
  const subtotal = invoice.lineItems.reduce((sum: number, item: any) => {
    const itemTotal = (item.price || 0) * (item.quantity || 0);
    return sum + itemTotal;
  }, 0);
  
  const discount = invoice.discount || 0;
  const taxRate = (invoice.tax || 0) / 100;
  const afterDiscount = subtotal - discount;
  const taxAmount = afterDiscount * taxRate;
  
  return afterDiscount + taxAmount;
};

export default function InvoiceStatusPage() {
  const { toast } = useToast();
  const t = useTranslations('InvoiceStatusPage');
  const locale = useLocale();
  const dateFnsLocale = locale === 'es' ? es : undefined;
  
  const { invoices, updateInvoice } = useProduction();
  const { customers } = useCustomers();
  const [isClient, setIsClient] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ESC key closes warning
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pendingInvoiceId) {
        setPendingInvoiceId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [pendingInvoiceId]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(invoice => {
        const invoiceDate = toDateSafe(invoice.invoiceDate);
        if (!invoiceDate) return false;
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (invoiceDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (invoiceDate > end) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const dateA = toDateSafe(a.invoiceDate)?.getTime() ?? 0;
        const dateB = toDateSafe(b.invoiceDate)?.getTime() ?? 0;
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
  }, [invoices, startDate, endDate]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, end);
  }, [filteredInvoices, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate]);

  const summary = useMemo(() => {
    const total = filteredInvoices.length;
    const paid = filteredInvoices.filter(inv => inv.paid).length;
    const unpaid = total - paid;
    const paidAmount = filteredInvoices
      .filter(inv => inv.paid)
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
    const unpaidAmount = filteredInvoices
      .filter(inv => !inv.paid)
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
    
    const today = startOfDay(new Date());
    const overdue = filteredInvoices.filter(inv => {
      if (inv.paid) return false;
      const dueDate = toDateSafe(inv.dueDate);
      return dueDate && isAfter(today, dueDate);
    }).length;

    return { total, paid, unpaid, paidAmount, unpaidAmount, overdue };
  }, [filteredInvoices]);

  const handleCheckboxClick = async (invoiceId: string, currentPaidStatus: boolean) => {
    if (currentPaidStatus) {
      return;
    }

    if (pendingInvoiceId !== invoiceId) {
      setPendingInvoiceId(invoiceId);
      return;
    }

    setIsUpdating(true);
    try {
      await updateInvoice(invoiceId, { 
        paid: true, 
        paidDate: new Date() 
      });
      
      toast({
        title: t('toasts.markPaidSuccess'),
        description: t('toasts.markPaidSuccessDesc'),
      });
      
      setPendingInvoiceId(null);
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast({
        variant: 'destructive',
        title: t('toasts.markPaidError'),
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrintPreview = async () => {
    try {
      setIsUpdating(true);
      
      const { generateInvoiceStatusReport } = await import('./report-action');
      
      const reportData = filteredInvoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        customer: getCustomerName(inv.customerId),
        invoiceDate: toDateSafe(inv.invoiceDate),
        dueDate: toDateSafe(inv.dueDate),
        total: calculateInvoiceTotal(inv),
        paid: inv.paid || false,
        paidDate: inv.paidDate ? toDateSafe(inv.paidDate) : null,
        overdue: isOverdue(inv),
      }));
      
      const result = await generateInvoiceStatusReport({
        invoices: reportData,
        summary,
        translations: {
          title: t('title'),
          tableHeaders: {
            invoiceNumber: t('table.invoiceNumber'),
            customer: t('table.customer'),
            date: t('table.date'),
            dueDate: t('table.dueDate'),
            daysOverdue: t('table.daysOverdue'),
            total: t('table.total'),
            status: t('table.status'),
          },
          paid: t('table.paid'),
          unpaid: t('table.unpaid'),
          overdue: t('table.overdue'),
        },
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(result.reportContent);
          reportWindow.document.close();
        } else {
          toast({
            variant: 'destructive',
            title: 'Popup Blocked',
            description: 'Please allow popups to view the report.',
          });
        }
      } else {
        throw new Error(result.error || t('ReportErrors.failedToGenerate'));
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Report Error',
        description: error instanceof Error ? error.message : t('ReportErrors.failedToGenerate'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || t('unknownCustomer');
  };

  const isOverdue = (invoice: any) => {
    if (invoice.paid) return false;
    const dueDate = toDateSafe(invoice.dueDate);
    const today = startOfDay(new Date());
    return dueDate && isAfter(today, dueDate);
  };

  if (!isClient) {
    return (
      <ProtectedPage pageName="reports.invoiceStatus" pageTitle="Invoice Status">
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <Card>
            <CardHeader>
              <CardTitle>{t('loading')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage pageName="reports.invoiceStatus" pageTitle="Invoice Status">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('filter.title')}</CardTitle>
                <CardDescription>{t('filter.description')}</CardDescription>
              </div>
              <Button 
                onClick={handlePrintPreview}
                style={{ backgroundColor: '#3560AD', color: 'white' }}
                className="hover:opacity-90"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Preview
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="start-date">{t('filter.startDateLabel')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-2',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP', { locale: dateFnsLocale }) : <span>{t('filter.pickDate')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1">
                <Label htmlFor="end-date">{t('filter.endDateLabel')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-2',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP', { locale: dateFnsLocale }) : <span>{t('filter.pickDate')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                >
                  {t('filter.clearButton')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.total')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.paid')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.paid}</div>
              <p className="text-sm text-muted-foreground mt-1 font-semibold">
                {formatCurrency(summary.paidAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.unpaid')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.unpaid}</div>
              <p className="text-sm text-muted-foreground mt-1 font-semibold">
                {formatCurrency(summary.unpaidAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.overdue')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.totalValue')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(summary.paidAmount + summary.unpaidAmount)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('table.title')}</CardTitle>
            <CardDescription>
              {t('table.description')} • Showing {paginatedInvoices.length} of {filteredInvoices.length} invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.invoiceNumber')}</TableHead>
                  <TableHead>{t('table.customer')}</TableHead>
                  <TableHead>{t('table.date')}</TableHead>
                  <TableHead>{t('table.dueDate')}</TableHead>
                  <TableHead className="text-center">{t('table.daysOverdue')}</TableHead>
                  <TableHead className="text-right">{t('table.total')}</TableHead>
                  <TableHead className="text-center">{t('table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span>{t('table.empty')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {paginatedInvoices.map((invoice) => {
                      const invoiceDate = toDateSafe(invoice.invoiceDate);
                      const dueDate = toDateSafe(invoice.dueDate);
                      const paidDate = invoice.paidDate ? toDateSafe(invoice.paidDate) : null;
                      const showWarning = pendingInvoiceId === invoice.id && !invoice.paid;
                      const overdue = isOverdue(invoice);
                      let daysOverdue = '';
                      if (!invoice.paid && dueDate) {
                        const today = startOfDay(new Date());
                        if (isAfter(today, dueDate)) {
                          daysOverdue = String(Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
                        }
                      }
                      return (
                        <React.Fragment key={invoice.id}>
                          <TableRow className={cn(invoice.paid && 'bg-green-50/50')}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{getCustomerName(invoice.customerId)}</TableCell>
                            <TableCell>
                              {invoiceDate ? format(invoiceDate, 'MMM-dd-yy') : '-'}
                            </TableCell>
                            <TableCell>
                              {dueDate ? format(dueDate, 'MMM-dd-yy') : '-'}
                            </TableCell>
                            <TableCell className="text-center font-bold text-red-600">
                              {daysOverdue}
                            </TableCell>
                            <TableCell className="text-right font-medium relative">
                              <div className="flex items-center justify-end gap-2">
                                {formatCurrency(calculateInvoiceTotal(invoice))}
                                {overdue && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap">
                                    OVERDUE
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Checkbox
                                  checked={invoice.paid || false}
                                  disabled={invoice.paid || isUpdating}
                                  onCheckedChange={() => handleCheckboxClick(invoice.id, invoice.paid || false)}
                                  className={cn(
                                    invoice.paid && 'data-[state=checked]:bg-green-600'
                                  )}
                                />
                                {invoice.paid ? (
                                  <div className="flex flex-col items-start">
                                    <Badge variant="default" className="bg-green-600">
                                      {t('table.paid')}
                                    </Badge>
                                    {paidDate && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {format(paidDate, 'MMM-dd-yy')}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">{t('table.unpaid')}</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {showWarning && (
                            <TableRow>
                              <TableCell colSpan={7} className="p-2">
                                <AlertComponent variant="default" className="border-orange-500 bg-orange-50 max-w-full">
                                  <div className="flex items-center gap-2 justify-center">
                                    <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                    <AlertDescription className="text-orange-900 text-center">
                                      {t('warning.message')} <kbd className="px-2 py-1 text-xs bg-white rounded border border-orange-300">ESC</kbd> to cancel
                                    </AlertDescription>
                                  </div>
                                </AlertComponent>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
            
            {/* Totals */}
            {filteredInvoices.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold">Page Totals ({paginatedInvoices.length} invoices):</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(
                      paginatedInvoices.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="font-bold text-base">Grand Total ({filteredInvoices.length} invoices):</span>
                  <span className="font-bold text-xl" style={{ color: '#3560AD' }}>
                    {formatCurrency(summary.paidAmount + summary.unpaidAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}