'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useMemo, useState, useEffect, Fragment } from 'react';
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
import { useProduction, type WasteEntry } from '@/hooks/use-production';
import { useInventory } from '@/hooks/use-inventory';
import { useProducts } from '@/hooks/use-products';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Check, ChevronsUpDown, Package, Trash2, Printer } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateWasteAnalyticsReport } from '../../reports/waste-analytics/actions';
import { toDateSafe, formatDateSafe } from '@/lib/date';
import type { WasteAnalyticRecord } from '@/hooks/use-production';
import { ProtectedPage } from '@/components/protected-page';
import { useTranslations } from 'next-intl';

type AnalyticsData = {
  productId: string;
  productName: string;
  totalDamaged: number;
};

export default function WasteAnalyticsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  const { toast } = useToast();
  const tCommon = useTranslations('ProtectedPage');
  const { wasteLog, addWasteAnalyticsEvent, wasteAnalyticsLog } = useProduction();
  const { allItems: allRawMaterials, vendors, updateVendor } = useInventory();
  const { products: allProducts } = useProducts();
  const [selectedProductMaterials, setSelectedProductMaterials] = useState<Record<string, { rm1?: string; rm2?: string; rm3?: string; qty1?: number; qty2?: number; qty3?: number; notes?: string; }>>({});
  const [isClient, setIsClient] = useState(false);
  const [recordingProductId, setRecordingProductId] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [productId, setProductId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  
  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const damagedTotalsByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    wasteLog.forEach((entry: WasteEntry) => {
      const currentTotal = totals.get(entry.productId) || 0;
      totals.set(entry.productId, currentTotal + entry.damagedQuantity);
    });
    return totals;
  }, [wasteLog]);
  
  const handleMaterialSelect = (productId: string, dropdown: 'rm1' | 'rm2' | 'rm3', value: string) => {
    setSelectedProductMaterials(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [dropdown]: value,
      }
    }));
  };

  const handleQuantityChange = (productId: string, quantityKey: 'qty1' | 'qty2' | 'qty3', value: string) => {
    const quantity = value === '' ? undefined : Number(value);
    setSelectedProductMaterials(prev => ({
        ...prev,
        [productId]: {
            ...prev[productId],
            [quantityKey]: quantity,
        }
    }));
  };
  
  const handleNotesChange = (productId: string, value: string) => {
    setSelectedProductMaterials(prev => ({
        ...prev,
        [productId]: {
            ...prev[productId],
            notes: value,
        }
    }));
  };
  
  const handleRecordAnalytics = async (productId: string, totalDamaged: number) => {
    setRecordingProductId(productId);
    try {
      const product = allProducts.find(p => p.id === productId);
      const productData = selectedProductMaterials[productId];

      if (!product) {
        throw new Error("Product not found.");
      }
      
      const materialsToDeduct: { materialId: string; quantity: number; materialName: string }[] = [];
      const quantities = [productData?.qty1, productData?.qty2, productData?.qty3];
      const materialIds = [productData?.rm1, productData?.rm2, productData?.rm3];

      for (let i = 0; i < materialIds.length; i++) {
        const matId = materialIds[i];
        const qty = quantities[i];
        if (matId && qty && qty > 0) {
          const material = getMaterialById(matId);
          if (material) {
            materialsToDeduct.push({ materialId: matId, quantity: qty, materialName: getMaterialLabel(material) || 'Unknown' });
          }
        }
      }

      if (materialsToDeduct.length === 0 && !productData?.notes) {
        toast({
          title: 'No Data to Record',
          description: 'Please enter a quantity for at least one material or add a note.',
        });
        return;
      }
      
      await addWasteAnalyticsEvent(
        productId,
        product.name,
        totalDamaged,
        materialsToDeduct,
        productData?.notes
      );
      
      toast({
        title: 'Success',
        description: `Waste recorded and inventory updated for ${product.name}.`,
      });

      setSelectedProductMaterials(prev => ({
        ...prev,
        [productId]: {},
      }));

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            variant: 'destructive',
            title: 'Recording Failed',
            description: message,
        });
    } finally {
        setRecordingProductId(null);
    }
  };

  const sortedProductsWithDamage = useMemo(() => {
    return [...allProducts]
      .map(p => ({ ...p, totalDamaged: damagedTotalsByProduct.get(p.id) || 0 }))
      .filter(p => p.totalDamaged > 0)
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [allProducts, damagedTotalsByProduct]);

  const getMaterialLabel = (material: any) => {
    return (
      material.item?.trim() ||
      material.name?.trim() ||
      material.materialName?.trim() ||
      material.sku?.trim() ||
      null
    );
  };

  const calculateCost = (materialId: string | undefined, quantity: number | undefined) => {
    if (!materialId || quantity === undefined) return 0;
    const material = allRawMaterials.find(m => m.id === materialId);
    if (!material) return 0;
    return material.price * quantity;
  };

  const getMaterialById = (materialId: string | undefined) => {
    if (!materialId) return null;
    return allRawMaterials.find(m => m.id === materialId) || null;
  };
  
  const validMaterials = allRawMaterials.filter(
    (m: any) => getMaterialLabel(m)
  );

  const productSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'All Products' },
      ...[...allProducts].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
    ],
    [allProducts]
  );

  const { filteredRecords, filterTitle } = useMemo(() => {
    let result = wasteAnalyticsLog;
    let titleParts: string[] = [];
    
    const product = allProducts.find(p => p.id === productId);
    if (product) {
      titleParts.push(`Product: ${product.name}`);
    }

    if (startDate) {
      titleParts.push(`From: ${formatDateSafe(startDate)}`);
    }
     if (endDate) {
      titleParts.push(`To: ${formatDateSafe(endDate)}`);
    }

    const start = toDateSafe(startDate);
    const end = toDateSafe(endDate);

    if (productId && productId !== 'all') {
      result = result.filter(r => r.productId === productId);
    }
    if (start) {
        start.setHours(0,0,0,0);
        result = result.filter(r => r.createdAt >= start);
    }
    if (end) {
        end.setHours(23,59,59,999);
        result = result.filter(r => r.createdAt <= end);
    }
    return {
        filteredRecords: result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        filterTitle: titleParts.join(' | ')
    };

  }, [wasteAnalyticsLog, productId, startDate, endDate, allProducts]);

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
    );
  }

  if (!hasAccess('waste.analytics')) {
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
    <div className="space-y-8">
      <Alert variant="default" className="block md:hidden">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Desktop Recommended</AlertTitle>
        <AlertDescription>
          This section is optimized for desktop use. Please access it from a computer.
        </AlertDescription>
      </Alert>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Waste Analytics
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Analytics by Product</CardTitle>
          <CardDescription>
            This section shows the total number of damaged items for each
            product, aggregated across all production phases. Deduct the raw materials used for the damaged goods here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedProductsWithDamage.length > 0 ? (
            <div className="space-y-6">
              {sortedProductsWithDamage.map((product) => {
                const totalDamaged = product.totalDamaged;
                const isRecording = recordingProductId === product.id;
                const currentSelections = selectedProductMaterials[product.id] || {};
                const cost1 = calculateCost(currentSelections.rm1, currentSelections.qty1);
                const cost2 = calculateCost(currentSelections.rm2, currentSelections.qty2);
                const cost3 = calculateCost(currentSelections.rm3, currentSelections.qty3);
                const totalCost = cost1 + cost2 + cost3;

                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/50">
                      <div>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>Total Damaged: <span className="font-bold text-destructive">{formatNumber(totalDamaged)}</span> units</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">Total Cost: {formatCurrency(totalCost)}</span>
                        <Button size="sm" onClick={() => handleRecordAnalytics(product.id, totalDamaged)} disabled={isRecording}>
                          {isRecording ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Record & Clear
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label>Raw Material 1</Label>
                          <Select value={currentSelections.rm1 || ''} onValueChange={(value) => handleMaterialSelect(product.id, 'rm1', value)}>
                            <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                            <SelectContent>{validMaterials.map((m: any) => <SelectItem value={m.id} key={m.id}>{getMaterialLabel(m)}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Qty" value={currentSelections.qty1 ?? ''} onChange={(e) => handleQuantityChange(product.id, 'qty1', e.target.value)} />
                            <div className="h-10 flex items-center justify-center px-3 text-sm font-mono bg-muted rounded-md w-24">{formatCurrency(cost1)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Raw Material 2</Label>
                          <Select value={currentSelections.rm2 || ''} onValueChange={(value) => handleMaterialSelect(product.id, 'rm2', value)}>
                            <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                            <SelectContent>{validMaterials.map((m: any) => <SelectItem value={m.id} key={m.id}>{getMaterialLabel(m)}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Qty" value={currentSelections.qty2 ?? ''} onChange={(e) => handleQuantityChange(product.id, 'qty2', e.target.value)} />
                            <div className="h-10 flex items-center justify-center px-3 text-sm font-mono bg-muted rounded-md w-24">{formatCurrency(cost2)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Raw Material 3</Label>
                          <Select value={currentSelections.rm3 || ''} onValueChange={(value) => handleMaterialSelect(product.id, 'rm3', value)}>
                            <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                            <SelectContent>{validMaterials.map((m: any) => <SelectItem value={m.id} key={m.id}>{getMaterialLabel(m)}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Qty" value={currentSelections.qty3 ?? ''} onChange={(e) => handleQuantityChange(product.id, 'qty3', e.target.value)} />
                            <div className="h-10 flex items-center justify-center px-3 text-sm font-mono bg-muted rounded-md w-24">{formatCurrency(cost3)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6">
                          <Label>Notes</Label>
                          <Textarea
                              placeholder="Add notes about the cause of waste for this product..."
                              value={currentSelections.notes ?? ''}
                              onChange={(e) => handleNotesChange(product.id, e.target.value)}
                          />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <Package className="mx-auto h-12 w-12" />
              <p className="mt-4">No products with damaged items found.</p>
              <p className="text-sm">Log damaged goods on the Production page to analyze them here.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Generate Waste Analytics Report</CardTitle>
            <CardDescription>
              Select filters to generate a detailed report of waste analytics.
            </CardDescription>
          </div>
           <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Printer className="mr-2 h-4 w-4" />
            )}
            Generate Report
            </Button>
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
      </Card>
    </div>
  );
}