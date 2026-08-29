'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { buildTableReport } from '@/lib/reports/report-builder';
import { getReportLayout } from '@/lib/report-layout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Loader2, 
  Printer, 
  Check, 
  ChevronsUpDown, 
  ArrowDownToLine 
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useProduction } from '@/hooks/use-production';
import { useProducts } from '@/hooks/use-products';
import { useInventory } from '@/hooks/use-inventory';
import { cn, formatNumber } from '@/lib/utils';
import { format } from 'date-fns';
import { ProtectedPage } from '@/components/protected-page';
import { useTranslations } from 'next-intl';

const reportFormSchema = z.object({
  materialId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function RawMaterialUsageReportPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  const [isClient, setIsClient] = useState(false);
  const tCommon = useTranslations('ProtectedPage');
  const [isGenerating, setIsGenerating] = useState(false);
    // Generate printable report
    function handleGenerateReport() {
      const columns = [
        { key: 'date', label: 'Date', align: 'left' },
        { key: 'materialName', label: 'Material', align: 'left' },
        { key: 'sourceProduct', label: 'Source Product', align: 'left' },
        { key: 'consumedQty', label: 'Qty Consumed', align: 'right' },
        { key: 'unitCost', label: 'Unit Cost', align: 'right' },
        { key: 'totalCost', label: 'Total Cost', align: 'right' },
      ];
      const rows = filteredData.map(row => ({
        ...row,
        date: format(row.date, 'MMM dd, yyyy'),
        consumedQty: `${formatNumber(row.consumedQty)} ${row.unit}`,
        unitCost: `$${row.unitCost.toFixed(2)}`,
        totalCost: `$${row.totalCost.toFixed(2)}`,
      }));
      const htmlBody = buildTableReport({
        title: '', // Remove duplicate title in body
        columns,
        rows,
      });
      const html = getReportLayout({
        title: 'Material Consumption Report',
        body: htmlBody,
      });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    }
  const { productionLog } = useProduction();
  const { products } = useProducts();
  const { allItems } = useInventory();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { materialId: 'all', startDate: '', endDate: '' },
  });

  useEffect(() => { setIsClient(true); }, []);

  // --- BRAIN: CONVERT PRODUCTION LOGS INTO RAW MATERIAL DEPLEATION ---
  const materialUsage = useMemo(() => {
    if (!productionLog || !products || !allItems) return [];

    const usageEntries: any[] = [];

    productionLog.forEach((log) => {
      // Find the product being made to get its recipe/BOM
      const product = products.find(p => p.id === log.productId);
      
      const recipe = product?.components || [];

      recipe.forEach((component: any) => {
        // Find the raw material details from allItems
        const item = allItems.find(i => i.id === component.rawMaterialId);
                
        if (!item) return;

        const qtyConsumed = log.snapshot.goodQuantity * component.quantity;
        const totalCost = qtyConsumed * (item.price || 0);

        usageEntries.push({
          id: `${log.id}-${item.id}`,
          date: log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt), // Ensure date is Date object
          materialName: item.item,
          materialId: item.id,
          consumedQty: qtyConsumed,
          unit: item.scale || 'unit',
          unitCost: item.price || 0,
          totalCost: totalCost,
          sourceProduct: product?.name,
          batchId: log.id.slice(-6).toUpperCase()
        });
      });
    });

    return usageEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [productionLog, products, allItems]);

  // --- FILTERING LOGIC ---
  const watched = form.watch();
  const filteredData = useMemo(() => {
    return materialUsage.filter(entry => {
      const matchMat = watched.materialId === 'all' || entry.materialId === watched.materialId;
      const matchStart = !watched.startDate || entry.date >= new Date(watched.startDate);
      const matchEnd = !watched.endDate || entry.date <= new Date(watched.endDate + 'T23:59:59');
      return matchMat && matchStart && matchEnd;
    });
  }, [materialUsage, watched]);

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.rawMaterials" pageTitle="Raw Material Reports">

      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Material Consumption</h1>
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

  if (!hasAccess('reports.rawMaterials')) {
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
    <ProtectedPage pageName="reports.rawMaterials" pageTitle="Raw Material Reports">
<div className="space-y-6 p-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Material Consumption</h1>
          <p className="text-muted-foreground text-sm">Calculated from {productionLog.length} production records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateReport} className="print:hidden bg-[#3560A0] text-white hover:bg-[#274472]">
            <Printer className="mr-2 h-4 w-4" /> Generate Report
          </Button>
        </div>
      </div>

      <Card className="border bg-background print:hidden">
        <Form {...form}>
          <form className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Date</FormLabel>
                  <Input type="date" {...field} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Date</FormLabel>
                  <Input type="date" {...field} />
                </FormItem>
              )}
            />
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground pb-2 italic">
                * Filters auto-apply to the preview below.
              </p>
            </div>
          </form>
        </Form>
      </Card>

      <Card className="border bg-background">
        <CardHeader>
          <CardTitle>Consumption Breakdown</CardTitle>
          <CardDescription>Raw materials used across all production batches.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Material</th>
                  <th className="p-3 text-left">Source Product</th>
                  <th className="p-3 text-right">Qty Consumed</th>
                  <th className="p-3 text-right">Unit Cost</th>
                  <th className="p-3 text-right font-bold">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  <>
                    <tr>
                      <td colSpan={6} style={{padding: 0, border: 0}}>
                        <div style={{maxHeight: '420px', overflowY: 'auto'}}>
                          <table className="w-full text-sm">
                            <tbody>
                              {filteredData.slice(0, 20).map((row) => (
                                <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                                  <td className="p-3 text-xs">{format(row.date, 'MMM dd, yyyy')}</td>
                                  <td className="p-3 font-semibold">{row.materialName}</td>
                                  <td className="p-3 text-muted-foreground text-xs">{row.sourceProduct}</td>
                                  <td className="p-3 text-right text-[#3560A0] font-medium">
                                    {formatNumber(row.consumedQty)} {row.unit}
                                  </td>
                                  <td className="p-3 text-right text-muted-foreground">${row.unitCost.toFixed(2)}</td>
                                  <td className="p-3 text-right font-bold">${row.totalCost.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      No consumption data matches your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}