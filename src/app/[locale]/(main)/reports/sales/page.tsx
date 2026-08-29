'use client';
import { usePermissions } from '@/hooks/use-permissions';


import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCustomers } from '@/hooks/use-customers';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, ShoppingBag, Check, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSalesReport } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useSalesLog } from '@/hooks/use-sales-log';
import { useProduction } from '@/hooks/use-production';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useProducts } from '@/hooks/use-products';
import { useTranslations } from 'next-intl';
import { toDateSafe } from '@/lib/date';
import { differenceInCalendarDays, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ProtectedPage } from '@/components/protected-page';

const reportFormSchema = z.object({
  productId: z.string().optional(),
  customerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function SalesReportsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { invoices } = useProduction();
  const t = useTranslations('SalesReportsPage');
  
  const [productId, setProductId] = useState('all');
  const [customerId, setCustomerId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [trendStart, setTrendStart] = useState('');
  const [trendEnd, setTrendEnd] = useState('');
  
  const { 
    records: filteredRecords, 
    loading,
  } = useSalesLog({
    productId,
    customerId,
    startDate,
    endDate,
  });
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const productSelectOptions = useMemo(() => {
    const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { value: 'all', label: t('allProductsOption') },
      ...sortedProducts.map(p => ({ value: p.id, label: p.name })),
    ];
  }, [products, t]);
  
  const customerSelectOptions = useMemo(() => {
    const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { value: 'all', label: t('allCustomersOption') },
      ...sortedCustomers.map(v => ({ value: v.id, label: v.name })),
    ]
  }, [customers, t]);

  const trendStats = useMemo(() => {
    if (!trendStart || !trendEnd) return null;
    const start = toDateSafe(trendStart);
    const end = toDateSafe(trendEnd);
    if (!start || !end) return null;

    const today = startOfDay(new Date());
    const rangeStart = startOfDay(start);
    const rangeEnd = endOfDay(end);

    const effectiveWorkedEnd = isBefore(today, rangeEnd) 
      ? (isBefore(today, rangeStart) ? rangeStart : today) 
      : rangeEnd;
    
    const workedDays = isAfter(rangeStart, effectiveWorkedEnd) 
      ? 0 
      : differenceInCalendarDays(effectiveWorkedEnd, rangeStart) + 1;

    const totalRangeDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    const remainingDays = Math.max(0, totalRangeDays - workedDays);

    const periodSales = invoices.filter(invoice => {
        if (invoice.invoiceType === 'proforma') return false;
        const d = toDateSafe(invoice.invoiceDate);
        if (!d || d < rangeStart || d > rangeEnd) return false;
        if (customerId !== 'all' && invoice.customerId !== customerId) return false;
        return true;
    }).reduce((sum, invoice) => {
        const invoiceSubtotal = (invoice.lineItems || []).reduce((acc, item) => {
            if (productId !== 'all' && item.productId !== productId) return acc;
            return acc + (item.quantity * item.price);
        }, 0);

        if (invoiceSubtotal === 0) return sum;

        const fullSubtotal = (invoice.lineItems || []).reduce((acc, item) => acc + (item.quantity * item.price), 0);
        const ratio = fullSubtotal > 0 ? invoiceSubtotal / fullSubtotal : 0;
        
        const discount = (invoice.discount || 0) * ratio;
        const taxRate = (invoice.tax !== undefined && invoice.tax !== null ? Number(invoice.tax) : 10) / 100;
        
        const afterDiscount = invoiceSubtotal - discount;
        const taxAmount = afterDiscount * taxRate;
        
        return sum + (afterDiscount + taxAmount);
    }, 0);

    const dailyAvg = workedDays > 0 ? periodSales / workedDays : 0;
    const trend = dailyAvg * totalRangeDays;

    return {
        sales: periodSales,
        workedDays,
        remainingDays,
        trend
    };
  }, [trendStart, trendEnd, invoices, productId, customerId]);

  // KPIs and chart data for filtered product & customer
  const showKPIsAndChart = productId !== 'all' && customerId !== 'all';
  const kpiData = useMemo(() => {
    if (!showKPIsAndChart) return null;
    // Filter records for selected product & customer
    const records = filteredRecords.filter(
      r => r.productId === productId && r.customerId === customerId
    );
    const totalSales = records.reduce((sum, r) => sum + (r.totalValue || 0), 0);
    const avgSale = records.length > 0 ? totalSales / records.length : 0;
    return {
      totalSales,
      avgSale,
      numSales: records.length
    };
  }, [filteredRecords, productId, customerId, showKPIsAndChart]);

  // Prepare chart data: sales by date
  const chartData = useMemo(() => {
    if (!showKPIsAndChart) return [];
    const records = filteredRecords.filter(
      r => r.productId === productId && r.customerId === customerId
    );
    // Group by date
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = 0;
      grouped[r.date] += r.totalValue || 0;
    });
    return Object.entries(grouped).map(([date, value]) => ({ date, value }));
  }, [filteredRecords, productId, customerId, showKPIsAndChart]);

  const handlePrintReport = async () => {
      setIsPrinting(true);
      try {
        const result = await generateSalesReport({
          filters: { productId, customerId, startDate, endDate },
          clientTimezone,
          translations: {
            reportTitle: t('report.title'),
            noSalesFound: t('report.noSales'),
            grandTotals: t('report.grandTotal'),
            filterLabels: {
                product: t('report.filterLabels.product'),
                customer: t('report.filterLabels.customer'),
                from: t('report.filterLabels.from'),
                to: t('report.filterLabels.to'),
            },
            tableHeaders: {
                date: t('report.tableHeaders.date'),
                product: t('report.tableHeaders.product'),
                customer: t('report.tableHeaders.customer'),
                quantity: t('report.tableHeaders.quantity'),
                price: t('report.tableHeaders.price'),
                total: t('report.tableHeaders.total')
            }
          }
        });
        if (result.success && result.reportContent) {
            const reportWindow = window.open('', '_blank');
            if (reportWindow) {
              reportWindow.document.write(result.reportContent);
              reportWindow.document.close();
            }
        } else {
            throw new Error(result.error);
        }
      } catch (err: any) {
          toast({ variant: 'destructive', title: t('toasts.printError.title'), description: err.message || t('toasts.printError.description') });
      } finally {
          setIsPrinting(false);
      }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.sales" pageTitle={t('title')}>

      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <Card>
          <CardContent className="pt-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.sales')) {
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
    <ProtectedPage pageName="reports.sales" pageTitle={t('title')}>
<div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>



      <Card className="border-primary/20 bg-primary/5">
        <CardHeader><CardTitle className="text-primary flex items-center gap-2"><CalendarIcon className="h-5 w-5" />{t('salesTrend.title')}</CardTitle></CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.15fr_1.15fr_1fr_1fr_1fr_1fr] gap-4 items-end">
                <div className="space-y-2"><Label>{t('salesTrend.startDateLabel')}</Label><Input type="date" value={trendStart} onChange={(e) => setTrendStart(e.target.value)} /></div>
                <div className="space-y-2"><Label>{t('salesTrend.endDateLabel')}</Label><Input type="date" value={trendEnd} onChange={(e) => setTrendEnd(e.target.value)} /></div>
                <div className="p-3 bg-background rounded-md border shadow-sm flex flex-col justify-center"><Label className="text-[10px] text-muted-foreground uppercase mb-1">{t('salesTrend.sales')}</Label><div className="text-base font-bold truncate">{formatCurrency(trendStats?.sales || 0)}</div></div>
                <div className="p-3 bg-background rounded-md border shadow-sm flex flex-col justify-center"><Label className="text-[10px] text-muted-foreground uppercase mb-1">{t('salesTrend.workedDays')}</Label><div className="text-base font-bold">{trendStats?.workedDays || 0}</div></div>
                <div className="p-3 bg-background rounded-md border shadow-sm flex flex-col justify-center"><Label className="text-[10px] text-muted-foreground uppercase mb-1">{t('salesTrend.remaining')}</Label><div className="text-base font-bold">{trendStats?.remainingDays || 0}</div></div>
                <div className="p-3 bg-primary text-primary-foreground rounded-md shadow-sm flex flex-col justify-center"><Label className="text-[10px] opacity-80 uppercase mb-1">{t('salesTrend.projection')}</Label><div className="text-base font-bold truncate">{formatCurrency(trendStats?.trend || 0)}</div></div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('filter.title')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>{t('filter.productLabel')}</Label>
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-between", !productId && "text-muted-foreground")}>
                    {productId && productId !== 'all' ? productSelectOptions.find(o => o.value === productId)?.label : t('filter.productPlaceholder')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder={t('filter.productSearch')} />
                    <CommandList>
                      <CommandEmpty>{t('filter.productEmpty')}</CommandEmpty>
                      <CommandGroup>
                        {productSelectOptions.map(o => (
                          <CommandItem key={o.value} onSelect={() => { setProductId(o.value); setProductPopoverOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", o.value === productId ? "opacity-100" : "opacity-0")} />
                            {o.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t('filter.customerLabel')}</Label>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-between", !customerId && "text-muted-foreground")}>
                    {customerId && customerId !== 'all' ? customerSelectOptions.find(o => o.value === customerId)?.label : t('filter.customerPlaceholder')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder={t('filter.customerSearch')} />
                    <CommandList>
                      <CommandEmpty>{t('filter.customerEmpty')}</CommandEmpty>
                      <CommandGroup>
                        {customerSelectOptions.map(o => (
                          <CommandItem key={o.value} onSelect={() => { setCustomerId(o.value); setCustomerPopoverOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", o.value === customerId ? "opacity-100" : "opacity-0")} />
                            {o.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2"><Label>{t('filter.startDateLabel')}</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{t('filter.endDateLabel')}</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <Button onClick={handlePrintReport} disabled={loading || isPrinting}>{(loading || isPrinting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}{t('filter.printButton')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('log.title')}</CardTitle><CardDescription>{t('log.description')}</CardDescription></CardHeader>
        <CardContent>
          <ScrollArea>
            <Table>
              <TableHeader><TableRow><TableHead>{t('log.table.date')}</TableHead><TableHead>{t('log.table.product')}</TableHead><TableHead>{t('log.table.customer')}</TableHead><TableHead className="text-right">{t('log.table.quantity')}</TableHead><TableHead className="text-right">{t('log.table.unitPrice')}</TableHead><TableHead className="text-right">{t('log.table.total')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell></TableRow> : filteredRecords.length > 0 ? filteredRecords.map((rec, i) => (<TableRow key={i}><TableCell>{rec.date}</TableCell><TableCell className="font-medium">{rec.product}</TableCell><TableCell>{rec.customerName}</TableCell><TableCell className="text-right">{formatNumber(rec.quantity)}</TableCell><TableCell className="text-right">{formatCurrency(rec.unitPrice)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(rec.totalValue)}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={6} className="h-24 text-center"><div className="flex flex-col items-center justify-center gap-2 text-muted-foreground"><ShoppingBag className="h-8 w-8" /><span>{t('log.empty')}</span></div></TableCell></TableRow>}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}