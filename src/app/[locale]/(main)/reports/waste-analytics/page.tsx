'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo, Fragment } from 'react';
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
import { useProduction } from '@/hooks/use-production';
import { useProducts } from '@/hooks/use-products';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { Loader2, Printer, Check, ChevronsUpDown, Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateWasteAnalyticsReport } from './actions';
import { format } from 'date-fns';
import type { WasteAnalyticRecord } from '@/hooks/use-production';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProtectedPage } from '@/components/protected-page';
import { useTranslations } from 'next-intl';

export default function WasteAnalyticsReportPage() {
    const { hasAccess, loading: permissionLoading } = usePermissions();
    const [isClient, setIsClient] = useState(false);
    const tCommon = useTranslations('ProtectedPage');
    const [isGenerating, setIsGenerating] = useState(false);
    const { wasteAnalyticsLog } = useProduction();
    const { products } = useProducts();
    const { toast } = useToast();

    const [productId, setProductId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const productSelectOptions = useMemo(
      () => [
        { value: 'all', label: 'All Products' },
        ...[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
      ],
      [products]
    );

    const { filteredRecords, filterTitle } = useMemo(() => {
      let result = wasteAnalyticsLog;
      let titleParts: string[] = [];
      const product = products.find(p => p.id === productId);
      if (product) {
        titleParts.push(`Product: ${product.name}`);
      }
      const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length !== 3) return '';
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (isNaN(date.getTime())) return '';
        return format(date, 'MMM-dd-yy');
      };
      if (startDate) {
        titleParts.push(`From: ${formatDate(startDate)}`);
      }
      if (endDate) {
        titleParts.push(`To: ${formatDate(endDate)}`);
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
        filteredRecords: result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        filterTitle: titleParts.join(' | ')
      };
    }, [wasteAnalyticsLog, productId, startDate, endDate, products]);

    const handleGenerateReport = async () => {
      setIsGenerating(true);
      const result = await generateWasteAnalyticsReport(filteredRecords, filterTitle);
      setIsGenerating(false);
      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        reportWindow?.document.write(result.reportContent);
        reportWindow?.document.close();
        reportWindow?.print();
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
        <ProtectedPage pageName="reports.wasteAnalytics" pageTitle="Waste Analytics">
          <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Waste Analytics Reports</h1>
            <Card>
              <CardHeader>
                <CardTitle>Waste Analytics Log</CardTitle>
              </CardHeader>
              <CardContent>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </ProtectedPage>
      );
    }

    if (!hasAccess('reports.wasteAnalytics')) {
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
      <ProtectedPage pageName="reports.wasteAnalytics" pageTitle="Waste Analytics">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
              Waste Analytics Reports
            </h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Filter Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product</label>
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'w-full justify-between',
                          !productId && 'text-muted-foreground'
                        )}
                      >
                        {productId && productId !== 'all'
                          ? productSelectOptions.find(
                              (option) => option.value === productId
                            )?.label
                          : 'Select product'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {productSelectOptions.map((option) => (
                              <CommandItem
                                value={option.label}
                                key={option.value}
                                onSelect={() => {
                                  setProductId(option.value);
                                  setProductPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    option.value === productId
                                      ? 'opacity-100'
                                      : 'opacity-0'
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
                </div>
                <div className="space-y-2">
                  <label htmlFor="start-date" className="text-sm font-medium">Start Date</label>
                  <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="end-date" className="text-sm font-medium">End Date</label>
                  <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Generate Report
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Waste Analytics Log</CardTitle>
              <CardDescription>
                Historical data of recorded waste analytics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((rec) => (
                        <Fragment key={rec.id}>
                          <TableRow>
                            <TableCell className="align-top">{format(rec.createdAt, 'MMM-dd-yy, p')}</TableCell>
                            <TableCell className="font-medium align-top">{rec.productName}</TableCell>
                            <TableCell className="align-top">
                              <p><strong>Total Damaged:</strong> {rec.snapshot.totalDamaged} units</p>
                              {rec.snapshot.recordedMaterials && rec.snapshot.recordedMaterials.length > 0 && (
                                <div className="mt-2">
                                  <p className="font-semibold">Materials Used:</p>
                                  <ul className="list-disc pl-5 text-sm">
                                    {rec.snapshot.recordedMaterials.map(mat => (
                                      <li key={mat.materialId}>
                                        {mat.materialName}: {formatNumber(mat.quantity)} units ({formatCurrency(mat.cost)})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium align-top">{formatCurrency(rec.snapshot.totalCost)}</TableCell>
                          </TableRow>
                          {rec.snapshot.notes && (
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/50 py-2 px-4">
                                <p className="text-sm"><strong className="pr-2">Notes:</strong>{rec.snapshot.notes}</p>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Trash2 className="h-8 w-8" />
                            <span>No waste analytics records found.</span>
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