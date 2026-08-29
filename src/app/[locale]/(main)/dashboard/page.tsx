'use client';
import { ProtectedPage } from '@/components/protected-page';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  ArrowDownRight,
  Printer,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { ChartConfig } from '@/components/ui/chart';
import { useState, useEffect, useMemo } from 'react';
import { useProduction, type ProductionRecord, type WasteAnalyticRecord } from '@/hooks/use-production';
import { useInventory } from '@/hooks/use-inventory';
import type { Invoice } from '@/lib/types';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, format } from 'date-fns';
import { generateDashboardReport } from './actions';
import { useProducts } from '@/hooks/use-products';
import { usePhases } from '@/hooks/use-phases';
import { toDateSafe } from '@/lib/date';
import { useTranslations, useLocale } from 'next-intl';

type TimeRange = 'day' | 'week' | 'month' | 'year';

const salesChartConfig = {
  sales: {
    label: 'Sales',
    color: 'hsl(var(--chart-1))',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

const inventoryChartConfig = {
    value: {
      label: 'Value',
      color: 'hsl(var(--chart-1))',
    },
} satisfies ChartConfig;

const topSoldProductsChartConfig = {
  quantity: {
    label: 'Units Sold',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const locale = useLocale();
  const t = useTranslations('Dashboard');
  const [isClient, setIsClient] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('year');
  const [clientTimezone, setClientTimezone] = useState('UTC');

  const { productionLog, wasteAnalyticsLog, invoices } = useProduction();
  const { products: allProducts } = useProducts();
  const { allItems } = useInventory();
  const { phases } = usePhases();

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const { currentPeriod, previousPeriod, comparisonLabel, currentLabel } = useMemo(() => {
    const now = new Date();
    let currentStartDate, currentEndDate, previousStartDate, previousEndDate, label, currentPeriodLabel;

    switch (timeRange) {
        case 'day':
            currentStartDate = startOfDay(now);
            currentEndDate = endOfDay(now);
            previousStartDate = startOfDay(subDays(now, 1));
            previousEndDate = endOfDay(subDays(now, 1));
            label = t('comparisonLabels.day');
            currentPeriodLabel = t('currentLabels.day');
            break;
        case 'week':
            currentStartDate = startOfWeek(now);
            currentEndDate = endOfDay(now);
            previousStartDate = startOfWeek(subWeeks(now, 1));
            previousEndDate = endOfWeek(subWeeks(now, 1));
            label = t('comparisonLabels.week');
            currentPeriodLabel = t('currentLabels.week');
            break;
        case 'year':
            currentStartDate = startOfYear(now);
            currentEndDate = endOfDay(now);
            previousStartDate = startOfYear(subYears(now, 1));
            previousEndDate = endOfYear(subYears(now, 1));
            label = t('comparisonLabels.year');
            currentPeriodLabel = t('currentLabels.year');
            break;
        case 'month':
        default:
            currentStartDate = startOfMonth(now);
            currentEndDate = endOfDay(now);
            previousStartDate = startOfMonth(subMonths(now, 1));
            previousEndDate = endOfMonth(subMonths(now, 1));
            label = t('comparisonLabels.month');
            currentPeriodLabel = t('currentLabels.month');
            break;
    }
    return {
        currentPeriod: { start: currentStartDate, end: currentEndDate },
        previousPeriod: { start: previousStartDate, end: previousEndDate },
        comparisonLabel: label,
        currentLabel: currentPeriodLabel
    };
  }, [timeRange, t]);

  const calculateMetrics = (
    prodLog: ProductionRecord[],
    wasteLog: WasteAnalyticRecord[],
    inv: Invoice[], 
    period: {start: Date, end: Date}
  ) => {
    const periodProdLog = prodLog.filter(l => {
        const createdAt = new Date(l.createdAt);
        return createdAt >= period.start && createdAt <= period.end;
    });
    
    const periodWasteLog = wasteLog.filter(l => {
        const createdAt = new Date(l.createdAt);
        return createdAt >= period.start && createdAt <= period.end;
    });

    const periodInvoices = inv.filter(i => {
        const createdAt = toDateSafe(i.createdAt) || toDateSafe(i.invoiceDate);
        if (!createdAt) return false;
        return createdAt >= period.start && createdAt <= period.end;
    });

    const piecesMade = periodProdLog.reduce((acc, event) => {
        if (event.snapshot.phaseName === 'Packaging') {
            return acc + event.snapshot.goodQuantity;
        }
        return acc;
    }, 0);

    let rawMaterialsUsed = 0;
    let costOfRawMaterialsUsed = 0;
    
    periodProdLog.forEach(event => {
      if (event.snapshot.phaseName === 'Packaging') {
        const product = allProducts.find(p => p.id === event.productId);
        const unitsProduced = event.snapshot.goodQuantity;

        if (product && product.components && unitsProduced > 0) {
          product.components.forEach(component => {
            const totalComponentQty = component.quantity * unitsProduced;
            rawMaterialsUsed += totalComponentQty;
            
            const material = allItems.find(item => item.id === component.rawMaterialId);
            costOfRawMaterialsUsed += totalComponentQty * (material?.price || 0);
          });
        }
      }
    });

    periodWasteLog.forEach(log => {
      if (log.snapshot.recordedMaterials) {
        log.snapshot.recordedMaterials.forEach(material => {
          rawMaterialsUsed += material.quantity;
          costOfRawMaterialsUsed += material.cost;
        });
      }
    });
    
    const piecesSold = periodInvoices.reduce((acc, invoice) => {
        if (invoice.invoiceType !== 'proforma') {
            return acc + invoice.lineItems.reduce((itemAcc, item) => itemAcc + item.quantity, 0);
        }
        return acc;
    }, 0);
    
    const totalRevenue = periodInvoices.reduce((total, invoice) => {
        if (invoice.invoiceType === 'proforma') return total;
        const subtotal = invoice.lineItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        const discount = invoice.discount || 0;
        const tax = invoice.tax || 0;
        const subtotalAfterDiscount = subtotal - discount;
        const taxAmount = subtotalAfterDiscount * (tax / 100);
        return total + subtotalAfterDiscount + taxAmount;
    }, 0);
    
    return { piecesMade, rawMaterialsUsed, costOfRawMaterialsUsed, piecesSold, totalRevenue };
  };

  const currentMetrics = useMemo(() => calculateMetrics(productionLog, wasteAnalyticsLog, invoices, currentPeriod), [productionLog, wasteAnalyticsLog, invoices, currentPeriod, allProducts, allItems]);
  const previousMetrics = useMemo(() => calculateMetrics(productionLog, wasteAnalyticsLog, invoices, previousPeriod), [productionLog, wasteAnalyticsLog, invoices, previousPeriod, allProducts, allItems]);

  const getChange = (current: number, previous: number) => {
      if (previous === 0) {
          return current > 0 ? { change: "+100%", changeType: "positive" as const } : { change: "0%", changeType: "neutral" as const };
      }
      if(current === 0 && previous > 0) {
          return { change: "-100%", changeType: "negative" as const };
      }
      const diff = ((current - previous) / previous) * 100;
      const changeType = diff >= 0 ? "positive" : "negative";
      return { change: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, changeType };
  };

  const currentInventoryStock = useMemo(() => {
    if (!allProducts) return 0;
    return allProducts.reduce((acc, product) => acc + (product.quantity || 0), 0);
  }, [allProducts]);
  
  const startOfPeriodInventory = useMemo(() => {
    const totalPiecesMadeBefore = productionLog
        .filter(p => (p.createdAt as Date) < currentPeriod.start)
        .reduce((acc, event) => {
            if (event.snapshot.phaseName === 'Packaging') {
                return acc + event.snapshot.goodQuantity;
            }
            return acc;
        }, 0);

    const totalPiecesSoldBefore = invoices
        .filter(i => {
            const invDate = toDateSafe(i.createdAt) || toDateSafe(i.invoiceDate);
            return invDate && invDate < currentPeriod.start && i.invoiceType !== 'proforma';
        })
        .reduce((acc, invoice) => acc + invoice.lineItems.reduce((itemAcc, item) => itemAcc + item.quantity, 0), 0);
    
    return totalPiecesMadeBefore - totalPiecesSoldBefore;
  }, [productionLog, invoices, currentPeriod.start]);
  
  const metrics = useMemo(() => ([
    { name: t('metrics.piecesMade'), value: currentMetrics.piecesMade, unit: 'pcs', ...getChange(currentMetrics.piecesMade, previousMetrics.piecesMade) },
    { name: t('metrics.rawMaterialsUsed'), value: currentMetrics.rawMaterialsUsed, unit: "units", ...getChange(currentMetrics.rawMaterialsUsed, previousMetrics.rawMaterialsUsed) },
    { name: t('metrics.costOfRawMaterialsUsed'), value: currentMetrics.costOfRawMaterialsUsed, unit: "$", ...getChange(currentMetrics.costOfRawMaterialsUsed, previousMetrics.costOfRawMaterialsUsed) },
    { name: t('metrics.currentInventory'), value: currentInventoryStock, unit: 'pcs', ...getChange(currentInventoryStock, startOfPeriodInventory) },
    { name: t('metrics.piecesSold'), value: currentMetrics.piecesSold, unit: 'pcs', ...getChange(currentMetrics.piecesSold, previousMetrics.piecesSold) },
    { name: t('metrics.totalRevenue'), value: currentMetrics.totalRevenue, unit: "$", ...getChange(currentMetrics.totalRevenue, previousMetrics.totalRevenue) },
  ]), [currentMetrics, previousMetrics, currentInventoryStock, startOfPeriodInventory, t]);
  
  const inventoryData = useMemo(() => (
    allItems
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(item => ({ name: item.item, value: item.quantity }))
        .reverse()
  ), [allItems]);

  const topSoldProductsData = useMemo(() => {
    const productSales = new Map<string, number>();

    invoices.forEach(invoice => {
        if (invoice.invoiceType !== 'proforma') {
            invoice.lineItems.forEach(item => {
                const currentSales = productSales.get(item.productId) || 0;
                productSales.set(item.productId, currentSales + item.quantity);
            });
        }
    });

    const sortedProducts = Array.from(productSales.entries())
        .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
        .slice(0, 10);
    
    return sortedProducts.map(([productId, quantity]) => {
        const product = allProducts.find(p => p.id === productId);
        return {
        name: product?.name || t('charts.topProducts.unknownProduct'),
            quantity: quantity,
        };
    }).reverse();
  }, [invoices, allProducts, t]);

  const salesData = useMemo(() => {
    const monthlyData: { [key: string]: { sales: number, expenses: number } } = {};
    const twelveMonthsAgo = subMonths(new Date(), 11);
    
    for (let i = 0; i < 12; i++) {
        const date = subMonths(startOfMonth(new Date()), i);
        const monthKey = format(date, 'yyyy-MM');
        monthlyData[monthKey] = { sales: 0, expenses: 0 };
    }

    invoices.forEach(invoice => {
        const invDate = toDateSafe(invoice.createdAt) || toDateSafe(invoice.invoiceDate);
        if (invDate && invDate >= twelveMonthsAgo) {
            const monthKey = format(invDate, 'yyyy-MM');
            if (monthlyData[monthKey] && invoice.invoiceType !== 'proforma') {
                const total = invoice.lineItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                const discount = invoice.discount || 0;
                const tax = invoice.tax || 0;
                const grandTotal = (total - discount) * (1 + tax/100);
                monthlyData[monthKey].sales += grandTotal;
            }
        }
    });

    wasteAnalyticsLog.forEach(log => {
      const logDate = new Date(log.createdAt);
      if (logDate >= twelveMonthsAgo) {
        const monthKey = format(logDate, 'yyyy-MM');
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].expenses += log.snapshot.totalCost;
        }
      }
    });

    return Object.keys(monthlyData).map(key => ({
        month: format(new Date(key), 'MMM'),
        sales: monthlyData[key].sales,
        expenses: monthlyData[key].expenses,
    })).reverse();

  }, [invoices, wasteAnalyticsLog]);

  const handlePrint = async () => {
    try {
      const translations = {
        reportTitle: t('reportTitle'),
        timeRangeLabel: "Time Range",
        generatedOn: "Generated on",
        comparisonText: t('reportSubtitle', { currentLabel, comparisonLabel }),
        metricLabel: "Metric",
        valueLabel: "Value",
        changeLabel: "Change (%)",
        salesChartTitle: t('charts.salesOverview.title'),
        inventoryChartTitle: t('charts.inventory.title'),
        productsChartTitle: t('charts.topProducts.title'),
        footnote: "El porcentaje de cambio compara el período seleccionado con el período anterior equivalente."
      };

      const payload = {
        timeRange,
        metrics,
        clientTimezone,
        topSoldProducts: [...topSoldProductsData].reverse().map(p => ({ name: p.name, value: p.quantity })),
        inventory: [...inventoryData].reverse().map(i => ({ name: i.name, value: i.value })),
        translations: translations
      };
    
      const result = await generateDashboardReport(payload);
    
      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) return;
    
        reportWindow.document.open();
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
    
        reportWindow.onload = () => {
          reportWindow.focus();
          reportWindow.print();
        };
      }
    } catch (error) {
      console.error("Print failed:", error);
    }
  };

  if (!isClient) {
    return <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }

  return (
    <ProtectedPage pageName="dashboard" pageTitle="Dashboard">
<div id="dashboard-print-root" className="flex flex-col gap-8">
        <div className="flex items-center justify-between print:hidden">
          <div>
              <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
              <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2">
                  <Button variant={timeRange === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('day')}>{t('timeRanges.day')}</Button>
                  <Button variant={timeRange === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('week')}>{t('timeRanges.week')}</Button>
                  <Button variant={timeRange === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('month')}>{t('timeRanges.month')}</Button>
                  <Button variant={timeRange === 'year' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('year')}>{t('timeRanges.year')}</Button>
              </div>
            
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                {t('printButton')}
              </Button>
          </div>
        </div>
        
        <div className="print-container">
          <div className="hidden print:block text-center mb-4">
            <h1 className="text-2xl font-bold">{t('reportTitle')}</h1>
            <p className="text-muted-foreground">{t('reportSubtitle', { currentLabel, comparisonLabel })}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {metrics.map((metric) => (
              <Card key={metric.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold">
                    {metric.unit === '$'
                      ? formatCurrency(metric.value)
                      : formatNumber(metric.value)}
                    {metric.unit !== '$' && (
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {metric.unit}
                      </span>
                    )}
                  </div>
                  {metric.change && (
                     <div className={cn("flex items-center text-sm", {
                      "text-green-600": metric.changeType === "positive",
                      "text-red-600": metric.changeType === "negative",
                      "text-muted-foreground": metric.changeType === "neutral"
                    })}>
                      {metric.changeType === 'positive' && <ArrowUpRight className="h-4 w-4" />}
                      {metric.changeType === 'negative' && <ArrowDownRight className="h-4 w-4" />}
                      <span>{metric.change} {comparisonLabel}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 print:grid-cols-2 mt-4">
            <Card className="lg:col-span-6 print:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{t('charts.salesOverview.title')}</CardTitle>
                <CardDescription>{t('charts.salesOverview.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
                  <LineChart data={salesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `$${value/1000}k`} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number, { compact: true, showDecimals: false })} />}
                    />
                    <Line
                      dataKey="sales"
                      type="monotone"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      name="Sales"
                    />
                    <Line
                      dataKey="expenses"
                      type="monotone"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={false}
                      name="Expenses"
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3 print:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{t('charts.inventory.title')}</CardTitle>
                <CardDescription>{t('charts.inventory.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={inventoryChartConfig} className="h-[300px] w-full">
                    <BarChart data={inventoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} />
                        <XAxis type="number" hide />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" formatter={(value) => formatNumber(value as number)} />}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                    </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3 print:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{t('charts.topProducts.title')}</CardTitle>
                <CardDescription>{t('charts.topProducts.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topSoldProductsChartConfig} className="h-[300px] w-full">
                    <BarChart data={topSoldProductsData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} />
                        <XAxis type="number" hide />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" formatter={(value) => formatNumber(value as number)} />}
                        />
                        <Bar dataKey="quantity" fill="hsl(var(--chart-2))" radius={4} />
                    </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}