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
import { useProduction } from '@/hooks/use-production';
import { useProducts } from '@/hooks/use-products';
import { formatNumber } from '@/lib/utils';
import { Loader2, Package, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { generateInventoryStockReport } from './actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

export type FinishedProductRecord = {
  productId: string;
  productName: string;
  category: string;
  packed: number;
  sold: number;
  inStock: number;
};

export default function ProductsInventoryPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ProductsInventoryPage');
  const tReport = useTranslations('ProductsInventoryReport');
  const [isClient, setIsClient] = useState(false);
  const { invoices, productionLog } = useProduction();
  const { products: allProducts } = useProducts();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const finishedProductsInventory: FinishedProductRecord[] = useMemo(() => {
    if (!allProducts) return [];

    const packedTotals = new Map<string, number>();
    productionLog.forEach((event) => {
        if (event.snapshot.phaseName === 'Packaging' && event.snapshot.goodQuantity > 0) {
            const current = packedTotals.get(event.productId) || 0;
            packedTotals.set(event.productId, current + event.snapshot.goodQuantity);
        }
    });

    const soldTotals = new Map<string, number>();
    invoices.forEach((invoice) => {
        if (invoice.invoiceType === 'proforma') return;
        invoice.lineItems.forEach(item => {
            const current = soldTotals.get(item.productId) || 0;
            soldTotals.set(item.productId, current + item.quantity);
        });
    });

    const inventory: FinishedProductRecord[] = allProducts.map(product => {
        const packed = packedTotals.get(product.id) || 0;
        const sold = soldTotals.get(product.id) || 0;
        const inStock = packed - sold;

        return {
          productId: product.id,
          productName: product.name || t('table.unknownProduct'),
          category: product.category || t('table.uncategorized'),
          packed,
          sold,
          inStock,
        };
      });

    return inventory
        .filter(p => p.packed > 0 || p.sold > 0)
        .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [invoices, allProducts, productionLog]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    const reportTranslations = {
      title: tReport('title'),
      subtitle: tReport('subtitle'),
      table: {
        product: tReport('table.product'),
        category: tReport('table.category'),
        packed: tReport('table.packed'),
        sold: tReport('table.sold'),
        inStock: tReport('table.inStock')
      },
      noRecords: tReport('noRecords'),
      grandTotals: tReport('grandTotals')
    };

    const result = await generateInventoryStockReport(finishedProductsInventory, clientTimezone, reportTranslations);
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

  if (permissionLoading || !isClient) {
    return <div>Loading...</div>;
  }

  return (
    <ProtectedPage pageName="inventories.products" pageTitle="Products Inventory">
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">
            {finishedProductsInventory.length}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('card.title')}</CardTitle>
            <CardDescription>
              {t('card.description')}
            </CardDescription>
          </div>
          <Button onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {t('card.printButton')}
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.product')}</TableHead>
                  <TableHead>{t('table.category')}</TableHead>
                  <TableHead className="text-right">{t('table.packed')}</TableHead>
                  <TableHead className="text-right">{t('table.sold')}</TableHead>
                  <TableHead className="text-right">{t('table.inStock')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finishedProductsInventory.length > 0 ? (
                  finishedProductsInventory.map((record) => (
                    <TableRow key={record.productId}>
                      <TableCell className="font-medium">
                        {record.productName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(record.packed)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(record.sold)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          record.inStock > 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {formatNumber(record.inStock)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Package className="h-8 w-8" />
                        <span>{t('empty.title')}</span>
                        <span className="text-xs">
                          {t('empty.subtitle')}
                        </span>
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