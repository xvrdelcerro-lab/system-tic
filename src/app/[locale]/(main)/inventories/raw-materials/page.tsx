'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Printer, Check, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react';
import { generateRawMaterialsReport } from '@/app/[locale]/(main)/catalogs/raw-materials/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useTranslations, useLocale } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMaterialTypes } from '@/hooks/use-material-types';
import { useScales } from '@/hooks/use-scales';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProtectedPage } from '@/components/protected-page';

// Schemas
const reportFormSchema = z.object({
  itemId: z.string().min(1, 'Please select an item.'),
});

const itemSchema = z.object({
  sku: z.string().min(1, 'SKU is required.'),
  item: z.string().min(1, 'Item name is required.'),
  type: z.string().min(1, 'Type is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  scale: z.string().min(1, 'Scale is required.'),
  quantity: z.coerce.number().min(0, 'Initial quantity is required.'),
});

const editItemSchema = itemSchema.extend({
  vendorId: z.string(),
  originalSku: z.string(),
});
type EditItemFormValues = z.infer<typeof editItemSchema>;


export default function RawMaterialsInventoryPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('RawMaterialsInventoryPage');
  const locale = useLocale();
  const { toast } = useToast();
  const { allItems, loading: inventoryLoading, vendors, updateVendor } = useInventory();
  const { materialTypes } = useMaterialTypes();
  const { scales } = useScales();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditItemFormValues | null>(null);

  const loading = inventoryLoading;

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      itemId: 'all',
    },
  });

  const editForm = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema),
  });

  const handleGenerateReport = async (data: z.infer<typeof reportFormSchema>) => {
    setIsGenerating(true);
    try {
      const selectedId = data.itemId;
      const isSingle = selectedId !== 'all';

      const itemsToPrint = isSingle
        ? allItems.filter(item => item.id === selectedId)
        : allItems;

      if (itemsToPrint.length === 0) {
        throw new Error("No raw materials found for the report.");
      }

      const result = await generateRawMaterialsReport({
        items: itemsToPrint,
        isSingle: isSingle,
        clientTimezone: clientTimezone,
        translations: {
            singleTitle: t('report.singleTitle', { itemName: itemsToPrint[0]?.item }),
            allTitle: t('report.allTitle'),
            generatedDateLabel: t('report.generatedDateLabel'),
            headers: {
                sku: t('table.sku'),
                item: t('table.item'),
                vendor: t('table.vendor'),
                price: t('table.price'),
                scale: t('table.scale'),
                inStock: t('table.inStock'),
            }
        }
      });

      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(result.reportContent);
          reportWindow.document.close();
        } else {
          toast({
            variant: 'destructive',
            title: t('toasts.reportError.popupBlockedTitle'),
            description: t('toasts.reportError.popupBlockedDescription'),
          });
        }
      } else {
        throw new Error(result.error || t('ReportErrors.failedToGenerate'));
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('toasts.reportError.title'),
        description: error.message || t('toasts.reportError.description'),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenEditDialog = (item: (typeof allItems)[0]) => {
    const itemToEdit = {
      ...item,
      originalSku: item.sku,
      vendorId: item.vendorId,
    };
    setEditingItem(itemToEdit);
    editForm.reset(itemToEdit);
    setIsEditDialogOpen(true);
  };
  
  const handleEditSubmit = async (data: EditItemFormValues) => {
    try {
      const vendor = vendors.find(v => v.id === data.vendorId);
      if (!vendor) throw new Error("Vendor not found");

      if (data.sku !== data.originalSku && vendor.items?.some(i => i.sku === data.sku)) {
        editForm.setError('sku', { type: 'manual', message: `SKU "${data.sku}" already exists for this vendor.` });
        throw new Error('SKU conflict');
      }

      const updatedItems = vendor.items?.map(item => {
        if (item.sku === data.originalSku) {
          const { vendorId, originalSku, ...newItemData } = data;
          return { ...item, ...newItemData };
        }
        return item;
      });

      await updateVendor(data.vendorId, { items: updatedItems });

      toast({ title: t('toasts.updateSuccess') });
      setIsEditDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'SKU conflict')) {
        toast({ variant: "destructive", title: t('toasts.updateError'), description: error instanceof Error ? error.message : "An unknown error occurred." });
      }
    }
  };

  const handleDeleteItem = async (vendorId: string, sku: string, itemName: string) => {
    try {
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) throw new Error("Vendor not found");

      const updatedItems = vendor.items?.filter(item => item.sku !== sku);
      await updateVendor(vendorId, { items: updatedItems });
      
      toast({ title: t('toasts.deleteSuccess') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('toasts.deleteError'), description: e.message });
    }
  };
  
  const selectOptions = [
    { value: 'all', label: t('reportCard.allOption') },
    ...allItems.map(item => ({
      value: item.id,
      label: `${item.item} (${item.vendorName})`,
    })),
  ];
  
  const scaleOptions = scales.map(s => s.name).sort();
  const materialTypeOptions = materialTypes.map(m => m.name).sort();

  if (permissionLoading || !isClient) {
    return <div>Loading...</div>;
  }

  return (
    <ProtectedPage pageName="inventories.rawMaterials" pageTitle="Raw Materials Inventory">
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">{allItems.length}</span>
        </div>
      </div>

      <Card>
        <Form {...reportForm}>
          <form
            onSubmit={reportForm.handleSubmit(handleGenerateReport)}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('reportCard.title')}</CardTitle>
                <CardDescription>
                  {t('reportCard.description')}
                </CardDescription>
              </div>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {t('reportCard.button')}
              </Button>
            </CardHeader>
            <CardContent>
              <FormField
                control={reportForm.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem className="flex flex-col max-w-sm">
                    <FormLabel>{t('reportCard.label')}</FormLabel>
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
                                : t('reportCard.selectPlaceholder')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder={t('reportCard.searchPlaceholder')} />
                            <CommandList>
                              <CommandEmpty>{t('reportCard.empty')}</CommandEmpty>
                              <CommandGroup>
                                {selectOptions.map((option) => (
                                  <CommandItem
                                    value={option.label}
                                    key={option.value}
                                    onSelect={() => {
                                      reportForm.setValue("itemId", option.value)
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
            </CardContent>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('listCard.title')}</CardTitle>
          <CardDescription>
            {t('listCard.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <Table className="min-w-[950px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.sku')}</TableHead>
                  <TableHead>{t('table.item')}</TableHead>
                  <TableHead>{t('table.vendor')}</TableHead>
                  <TableHead className="text-right">{t('table.price')}</TableHead>
                  <TableHead className="text-center">{t('table.scale')}</TableHead>
                  <TableHead className="text-right whitespace-nowrap">{t('table.inStock')}</TableHead>
                  <TableHead className="text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : allItems.length > 0 ? (
                  allItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.item}</TableCell>
                      <TableCell>{item.vendorName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.scale}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(item.quantity)}</TableCell>
                       <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)}>
                                  <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                                          <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t.raw('deleteDialog.description', { itemName: item.item, vendorName: item.vendorName }) }} />
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteItem(item.vendorId, item.sku, item.item)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditSubmit)}>
                    <DialogHeader>
                        <DialogTitle>{t('editDialog.title', { itemName: editingItem?.item })}</DialogTitle>
                        <DialogDescription>{t('editDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="sku"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('editDialog.skuLabel')}</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={editForm.control}
                            name="item"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('editDialog.itemNameLabel')}</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('editDialog.typeLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('editDialog.typePlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {materialTypeOptions.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={editForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('editDialog.priceLabel')}</FormLabel>
                                <FormControl>
                                  <InputWithDecimals 
                                    placeholder="0.00" 
                                    prefix="$" 
                                    fixedDecimalScale={true}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    value={field.value ?? ''}
                                    onValueChange={(values) => {
                                        field.onChange(values.floatValue ?? null)
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <FormField
                            control={editForm.control}
                            name="scale"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('editDialog.scaleLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('editDialog.scalePlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {scaleOptions.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                              control={editForm.control}
                              name="quantity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('editDialog.inStockLabel')}</FormLabel>
                                  <FormControl><Input type="number" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                       </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">{t('editDialog.saveButton')}</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedPage>
  );
}