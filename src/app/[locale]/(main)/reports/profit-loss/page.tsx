'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, FileBarChart } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslations, useLocale } from 'next-intl';
import { useProduction } from '@/hooks/use-production';
import { useExpenses } from '@/hooks/use-expenses';
import { useProducts } from '@/hooks/use-products';
import { useInventory } from '@/hooks/use-inventory';
import { generatePLReport } from './actions';
import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ProtectedPage } from '@/components/protected-page';

export default function PLReportPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('PLReportPage');
  const tCommon = useTranslations('ProtectedPage');
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : undefined;
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const { invoices = [], productionLog: productionEvents = [] } = useProduction();
  const { expenses = [] } = useExpenses();
  const { products = [] } = useProducts();
  const { vendors = [] } = useInventory();

  function calcInvoiceTotal(inv: any): number {
    if (inv.total > 0) return inv.total;
    if (!inv.lineItems?.length) return 0;
    const sub = inv.lineItems.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0);
    const aft = sub - (inv.discount || 0);
    return aft + aft * ((inv.tax || 0) / 100);
  }

  function toDate(raw: any): Date | null {
    if (!raw) return null;
    if (raw instanceof Date) return raw;
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (raw.seconds) return new Date(raw.seconds * 1000);
    if (typeof raw === 'string') { const d = new Date(raw); return isNaN(d.getTime()) ? null : d; }
    return null;
  }

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: t('validation.selectRange'), description: t('validation.selectBothDates') });
      return;
    }
    if (startDate > endDate) {
      toast({ variant: 'destructive', title: t('validation.invalidRange'), description: t('validation.startBeforeEnd') });
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch intakes directly from Firestore
      const intakesSnap = await getDocs(collection(db, 'intakes'));
      const allIntakes = intakesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Fetch finished products inventory
      const finishedProductsSnap = await getDocs(collection(db, 'inventories/products/items'));
      const finishedProductItems = finishedProductsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Helper: get price for a material by materialId (vendorId-sku)
      function getMaterialPrice(materialId: string): number {
        const dashIndex = materialId.indexOf('-');
        if (dashIndex === -1) return 0;
        const vendorId = materialId.substring(0, dashIndex);
        const sku = materialId.substring(dashIndex + 1);
        const vendor = vendors.find((v: any) => v.id === vendorId);
        if (!vendor?.items) return 0;
        const item = vendor.items.find((i: any) => i.sku === sku);
        return item?.price || 0;
      }

      // Helper: calculate raw materials value at a given date
      // Uses intakes up to that date minus production usage
      function calculateRawMaterialsValue(upToDate: Date): number {
        // Get all intakes up to date
        const intakesUpTo = allIntakes.filter(intake => {
          const d = toDate(intake.date);
          return d && d <= upToDate;
        });

        // Sum up value per material
        const materialQty: Record<string, number> = {};
        intakesUpTo.forEach(intake => {
          const materialId = intake.materialId;
          if (!materialId) return;
          materialQty[materialId] = (materialQty[materialId] || 0) + (intake.quantity || 0);
        });

        // Subtract materials used in production (packaging phase) up to date
        productionEvents
          .filter(pe => {
            const d = toDate(pe.createdAt);
            return d && d <= upToDate &&
                   pe.snapshot?.phaseName?.toLowerCase() === 'packaging';
          })
          .forEach(pe => {
            const product = products.find((p: any) => p.id === pe.productId);
            if (!product?.components) return;
            const qty = pe.snapshot?.goodQuantity || 0;
            product.components.forEach((comp: any) => {
              const rid = comp.rawMaterialId;
              if (!rid) return;
              materialQty[rid] = (materialQty[rid] || 0) - (comp.quantity || 0) * qty;
            });
          });

        // Calculate total value
        let total = 0;
        Object.entries(materialQty).forEach(([materialId, qty]) => {
          if (qty <= 0) return;
          const price = getMaterialPrice(materialId);
          total += qty * price;
        });

        return total;
      }

      // Helper: calculate finished goods value at a given date
      function calculateFinishedGoodsValue(upToDate: Date): number {
        const productQty: Record<string, number> = {};

        // Add packaged production up to date
        productionEvents
          .filter(pe => {
            const d = toDate(pe.createdAt);
            return d && d <= upToDate &&
                   pe.snapshot?.phaseName?.toLowerCase() === 'packaging';
          })
          .forEach(pe => {
            const productId = pe.productId;
            const goodQty = pe.snapshot?.goodQuantity || 0;
            productQty[productId] = (productQty[productId] || 0) + goodQty;
          });

        // Subtract sold products up to date
        invoices
          .filter(inv => {
            const d = toDate(inv.invoiceDate);
            return d && d <= upToDate;
          })
          .forEach(inv => {
            inv.lineItems?.forEach((item: any) => {
              if (item.productId) {
                productQty[item.productId] = (productQty[item.productId] || 0) - (item.quantity || 0);
              }
            });
          });

        // Calculate value using sale price
        let total = 0;
        Object.entries(productQty).forEach(([productId, qty]) => {
          if (qty <= 0) return;
          const product = products.find((p: any) => p.id === productId);
          if (product?.salePrice) {
            total += qty * product.salePrice;
          }
        });

        return total;
      }

      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      const monthlyData = months.map(month => {
        const mStart = startOfMonth(month);
        const mEnd = endOfMonth(month);
        mEnd.setHours(23, 59, 59, 999);

        // Beginning inventory = ending of previous month
        const prevMonthEnd = new Date(mStart);
        prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
        prevMonthEnd.setHours(23, 59, 59, 999);

        const beginningRawMats = calculateRawMaterialsValue(prevMonthEnd);
        const beginningFinishedGoods = calculateFinishedGoodsValue(prevMonthEnd);
        const beginningInventory = beginningRawMats + beginningFinishedGoods;

        // Revenue
        const revenue = invoices
          .filter(inv => { const d = toDate(inv.invoiceDate); return d && d >= mStart && d <= mEnd; })
          .reduce((s, inv) => s + calcInvoiceTotal(inv), 0);

        // Purchases = intakes in period x price
        const purchases = allIntakes
          .filter(intake => {
            const d = toDate(intake.date);
            return d && d >= mStart && d <= mEnd;
          })
          .reduce((sum, intake) => {
            const price = getMaterialPrice(intake.materialId);
            return sum + (price * (intake.quantity || 0));
          }, 0);

        // Direct Labor
        const labor = expenses
          .filter((e: any) => {
            const d = e.date instanceof Date ? e.date : toDate(e.date);
            return d && d >= mStart && d <= mEnd && e.category === 'Direct Labor';
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        // Ending inventory
        const endingRawMats = calculateRawMaterialsValue(mEnd);
        const endingFinishedGoods = calculateFinishedGoodsValue(mEnd);
        const endingInventory = endingRawMats + endingFinishedGoods;

        // COGS = Beginning + Purchases + Labor - Ending
        const cogs = beginningInventory + purchases + labor - endingInventory;

        // Operating Expenses (all except Direct Labor)
        const opex = expenses
          .filter((e: any) => {
            const d = e.date instanceof Date ? e.date : toDate(e.date);
            return d && d >= mStart && d <= mEnd && e.category !== 'Direct Labor';
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const grossMargin = revenue - cogs;
        const netIncome = grossMargin - opex;

        return { 
          monthLabel: format(month, 'MMM yyyy', { locale: dateLocale }), 
          revenue, 
          cogs,
          cogsBreakdown: {
            beginningInventory,
            beginningRawMats,
            beginningFinishedGoods,
            purchases,
            labor,
            endingInventory,
            endingRawMats,
            endingFinishedGoods
          },
          opex, 
          grossMargin, 
          netIncome 
        };
      });

      const totals = monthlyData.reduce((acc, m) => ({
        revenue: acc.revenue + m.revenue,
        cogs: acc.cogs + m.cogs,
        opex: acc.opex + m.opex,
        grossMargin: acc.grossMargin + m.grossMargin,
        netIncome: acc.netIncome + m.netIncome,
      }), { revenue: 0, cogs: 0, opex: 0, grossMargin: 0, netIncome: 0 });

      const period = format(startOfMonth(startDate), 'MMM-dd-yy', { locale: dateLocale }) + 
                    ' to ' + 
                    format(endOfMonth(endDate), 'MMM-dd-yy', { locale: dateLocale });

      const result = await generatePLReport({ 
        monthlyData, 
        totals, 
        period, 
        locale, 
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
      });

      if (!result.success || !result.reportContent) {
        throw new Error(result.error || t('validation.error'));
      }

      const w = window.open('', '_blank');
      if (w) { 
        w.document.write(result.reportContent); 
        w.document.close(); 
      } else {
        toast({ 
          variant: 'destructive', 
          title: t('validation.popupBlocked'), 
          description: t('validation.allowPopups') 
        });
      }

    } catch (err) {
      toast({ 
        variant: 'destructive', 
        title: t('validation.error'), 
        description: err instanceof Error ? err.message : t('validation.unknownError') 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (permissionLoading) {
    return (
    <ProtectedPage pageName="reports.profitLoss" pageTitle={t('title')}>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.profitLoss')) {
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
    <ProtectedPage pageName="reports.profitLoss" pageTitle={t('title')}>
<div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('selectPeriod.title')}</CardTitle>
          <CardDescription>{t('selectPeriod.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">{t('selectPeriod.startDate')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP', { locale: dateLocale }) : t('selectPeriod.pickDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={dateLocale} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">{t('selectPeriod.endDate')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP', { locale: dateLocale }) : t('selectPeriod.pickDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={dateLocale} />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleGenerate} disabled={isGenerating || !startDate || !endDate} className="bg-[#3560AD] hover:bg-[#2a4d8a]">
              {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('selectPeriod.generating')}</> : <><FileBarChart className="mr-2 h-4 w-4" />{t('selectPeriod.generateButton')}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('contents.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-semibold text-foreground">{t('contents.revenue')}:</span> {t('contents.revenueDesc')}</p>
          <p><span className="font-semibold text-foreground">{t('contents.cogs')}:</span> {t('contents.cogsDesc')}</p>
          <p><span className="font-semibold text-foreground">{t('contents.grossMargin')}:</span> {t('contents.grossMarginDesc')}</p>
          <p><span className="font-semibold text-foreground">{t('contents.opex')}:</span> {t('contents.opexDesc')}</p>
          <p><span className="font-semibold text-foreground">{t('contents.netIncome')}:</span> {t('contents.netIncomeDesc')}</p>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}