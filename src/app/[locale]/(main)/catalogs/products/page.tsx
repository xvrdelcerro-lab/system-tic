'use client';
import { usePermissions } from '@/hooks/use-permissions';


import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Printer, Check, ChevronsUpDown, Pencil, ChevronDown, ShoppingBag, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { generateCatalogReport } from './actions';
import type { Product } from '@/lib/types';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { useProducts } from '@/hooks/use-products';
import { useInventory } from '@/hooks/use-inventory';
import { useProductCategories } from '@/hooks/use-product-categories';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { useTranslations, useLocale } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const scaleOptions = ['Kilo', 'Piece', 'Gallon', 'Pound', 'Liter'] as const;

const scaleTranslations: Record<string, string> = {
  'Kilo': 'Kilo',
  'Piece': 'Pieza',
  'Gallon': 'Galón',
  'Pound': 'Libra',
  'Liter': 'Litro'
};

const reportFormSchema = z.object({
  itemId: z.string().min(1, 'Please select a product.'),
});

const componentSchema = z.object({
    rawMaterialId: z.string().min(1, "Please select a material."),
    quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
});

const productEditSchema = z.object({
    id: z.string(),
    category: z.string().min(1, 'Category is required.'),
    salePrice: z.number().min(0, 'Sale price must be a positive number.'),
    unitAmount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
    unitScale: z.enum(scaleOptions),
});

const componentsFormSchema = z.object({
    productId: z.string(),
    components: z.array(componentSchema).min(1, "At least one component is required."),
});

const newProductFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Product name is required."),
  salePrice: z.number().min(0, "Sale price must be a positive number."),
  category: z.string().min(1, 'Category is required.'),
  unitAmount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  unitScale: z.enum(scaleOptions),
  components: z.array(componentSchema),
});

const newProductInitialState = {
  id: 'new_product',
  name: '',
  salePrice: 0,
  category: 'Apparel',
  components: [],
  unitAmount: 1,
  unitScale: 'Piece' as const
};

export default function ProductsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ProductsPage');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  const { toast } = useToast();
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct } = useProducts();
  const { allItems: allRawMaterials } = useInventory();
  const { categories: categoryOptions } = useProductCategories();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isComponentsDialogOpen, setIsComponentsDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { itemId: 'all' },
  });
  
  const editForm = useForm<z.infer<typeof productEditSchema>>({
    resolver: zodResolver(productEditSchema),
  });
  
  const newProductForm = useForm<z.infer<typeof newProductFormSchema>>({
    resolver: zodResolver(newProductFormSchema),
    defaultValues: newProductInitialState,
  });

  const componentsForm = useForm<z.infer<typeof componentsFormSchema>>({
    resolver: zodResolver(componentsFormSchema),
  });

  const watchedComponents = componentsForm.watch("components");
  const { fields, append, remove } = useFieldArray({
    control: componentsForm.control,
    name: "components"
  });

  const newProduct = newProductForm.watch();

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const selectedId = reportForm.getValues('itemId');
      const isSingle = selectedId !== 'all';
      const productsToReport = isSingle ? products.filter(p => p.id === selectedId) : products;

      if (productsToReport.length === 0) {
        toast({ variant: 'destructive', title: t('generateReport.error.title'), description: t('generateReport.error.noProducts') });
        setIsGenerating(false);
        return;
      }
      
      const result = await generateCatalogReport({
        products: productsToReport,
        clientTimezone,
        isSingle,
        allRawMaterials,
        translations: {
          title: isSingle ? `${t('report.productTitle')}: ${productsToReport[0].name}` : t('report.inventoryTitle'),
          totalLabel: t('report.totalLabel'),
          noProducts: t('generateReport.error.noProducts'),
          headers: {
              name: t('report.nameLabel'),
              category: t('report.categoryLabel'),
              price: t('report.priceLabel'),
          },
          bom: {
            title: t('report.bom.title'),
            sku: t('report.bom.sku'),
            item: t('report.bom.item'),
            vendor: t('report.bom.vendor'),
            quantity: t('report.bom.quantity'),
            scale: t('report.bom.scale'),
            noComponents: t('report.bom.noComponents'),
          }
        }
      });

      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(result.reportContent);
          reportWindow.document.close();
        }
        setIsPrintDialogOpen(false);
      } else {
        throw new Error(result.error || t('generateReport.error.description'));
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('generateReport.error.title'), description: error.message || t('generateReport.error.description') });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleOpenEditDialog = (product: any) => {
    editForm.reset({
      id: product.id,
      category: product.category,
      salePrice: product.salePrice,
      unitAmount: product.unitAmount || 1,
      unitScale: (product.unitScale as any) || 'Piece',
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenComponentsDialog = (product: any) => {
    componentsForm.reset({
      productId: product.id,
      components: product.components.length > 0 ? product.components : [{ rawMaterialId: '', quantity: 1 }],
    });
    setIsComponentsDialogOpen(true);
  };

  const handleEditProduct = async (data: z.infer<typeof productEditSchema>) => {
    try {
        if (data.id === 'new_product') {
            newProductForm.setValue('category', data.category);
            newProductForm.setValue('salePrice', data.salePrice);
            newProductForm.setValue('unitAmount', data.unitAmount);
            newProductForm.setValue('unitScale', data.unitScale);
        } else {
            await updateProduct(data.id, { 
              category: data.category, 
              salePrice: Number(data.salePrice),
              unitAmount: Number(data.unitAmount),
              unitScale: data.unitScale,
            });
            toast({ title: t('editProductDialog.toasts.updateSuccess'), description: t('editProductDialog.toasts.updateSuccessDesc') });
        }
        setIsEditDialogOpen(false);
    } catch(e: any) {
        toast({ variant: 'destructive', title: t('editProductDialog.toasts.updateError'), description: e.message });
    }
  };

  const handleEditComponents = async (data: z.infer<typeof componentsFormSchema>) => {
    try {
        if (data.productId === 'new_product') {
            newProductForm.setValue('components', data.components);
        } else {
            await updateProduct(data.productId, { components: data.components });
            toast({ title: t('editComponentsDialog.toasts.updateSuccess'), description: t('editComponentsDialog.toasts.updateSuccessDesc') });
        }
        setIsComponentsDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('editComponentsDialog.toasts.updateError'), description: e.message });
    }
  };

  const handleSaveProduct = async () => {
    const isValid = await newProductForm.trigger();
    if (!isValid) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please check all required fields.' });
      return;
    }
    try {
        const productToAdd = newProductForm.getValues();
        const { id, ...newProductData } = productToAdd;
        await createProduct(newProductData);
        toast({ title: t('addNewProduct.toasts.saveSuccess'), description: t('addNewProduct.toasts.saveSuccessDesc', { productName: newProductData.name }) });
        newProductForm.reset(newProductInitialState);
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('addNewProduct.toasts.saveError'), description: e.message });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      toast({ title: t('availableProducts.toasts.deleteSuccess'), description: t('availableProducts.toasts.deleteSuccessDesc') });
    } catch(e: any) {
      toast({ variant: 'destructive', title: t('availableProducts.toasts.deleteError'), description: e.message });
    }
  };

  const toggleRow = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) newExpanded.delete(productId);
    else newExpanded.add(productId);
    setExpandedRows(newExpanded);
  };

  const selectOptions = [
    { value: 'all', label: t('generateReport.allOption') },
    ...(products || []).map(item => ({ value: item.id, label: `${item.name} (${item.category})` })),
  ];
  
  const getEditingProduct = (id: string) => {
      if (id === 'new_product') return newProductForm.getValues();
      return products.find(p => p.id === id);
  };

  if (permissionLoading || !isClient) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Alert variant="default" className="block md:hidden">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('mobileWarning.title')}</AlertTitle>
        <AlertDescription>{t('mobileWarning.description')}</AlertDescription>
      </Alert>
      
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <span className="text-3xl font-bold text-muted-foreground">{(products || []).length}</span>
        </div>
        <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#3560A0] hover:bg-[#3560A0]/90"><Printer className="mr-2 h-4 w-4" /> {t('generateReport.title')}</Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...reportForm}>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerateReport();}}>
                        <DialogHeader>
                            <DialogTitle>{t('generateReport.title')}</DialogTitle>
                            <DialogDescription>{t('generateReport.description')}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <FormField
                                control={reportForm.control}
                                name="itemId"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Product</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                            {field.value ? selectOptions.find(o => o.value === field.value)?.label : t('generateReport.selectPlaceholder')}
                                            <Check className={cn("ml-2 h-4 w-4 shrink-0 opacity-50")} />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder={t('generateReport.searchPlaceholder')} />
                                            <CommandList>
                                            <CommandEmpty>{t('generateReport.empty')}</CommandEmpty>
                                            <CommandGroup>
                                                {selectOptions.map((o) => (
                                                <CommandItem key={o.value} value={o.label} onSelect={() => {
                                                    reportForm.setValue("itemId", o.value);
                                                }}>
                                                    <Check className={cn("mr-2 h-4 w-4", o.value === field.value ? "opacity-100" : "opacity-0")} />
                                                    {o.label}
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
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isGenerating} className="bg-[#3560A0] hover:bg-[#3560A0]/90">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />}
                                {t('generateReport.button')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      
      <Form {...newProductForm}>
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }}>
          <Card className="border bg-background max-w-[740px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{t('addNewProduct.title')}</CardTitle>
              <div className="flex items-center gap-2">
                <Select onValueChange={(value) => {
                  const product = products.find(p => p.id === value);
                  if (product) {
                      newProductForm.reset({
                          id: 'new_product',
                          name: product.name,
                          category: product.category,
                          salePrice: product.salePrice,
                          unitAmount: product.unitAmount || 1,
                          unitScale: (product.unitScale as any) || 'Piece',
                          components: product.components
                      });
                  }
                }}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder={t('addNewProduct.existingProductsPlaceholder')} /></SelectTrigger>
                    <SelectContent>{products.map(item => (<SelectItem key={item.id} value={item.id}>{`${item.name} (${item.category})`}</SelectItem>))}</SelectContent>
                </Select>
                <Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('addNewProduct.saveButton')}</Button>
              </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px] p-2 text-left">Producto</TableHead>
                            <TableHead className="w-[70px] p-2 text-left">Medida</TableHead>
                            <TableHead className="w-[90px] p-2 text-left">Precio Venta</TableHead>
                            <TableHead className="w-[90px] p-2 text-left">Categoría</TableHead>
                            <TableHead className="w-[70px] p-2 text-center">Comp.</TableHead>
                            <TableHead className="w-[240px] p-2 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="p-2 text-left">
                                <FormField control={newProductForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormControl><Input placeholder={t('addNewProduct.namePlaceholder')} className="h-8 text-xs" {...field} /></FormControl></FormItem>
                                )} />
                            </TableCell>
                            <TableCell className="p-2 text-left">
                                <Badge variant="outline" className="text-[10px] py-0">{newProduct.unitAmount !== 1 ? `${newProduct.unitAmount} ` : ''}{tData(`scaleNames.${newProduct.unitScale}`, {}, { default: newProduct.unitScale })}</Badge>
                            </TableCell>
                            <TableCell className="p-2 text-left text-xs font-semibold">{formatCurrency(newProduct.salePrice)}</TableCell>
                            <TableCell className="p-2 text-left"><Badge variant="outline" className="text-[10px] py-0">{newProduct.category}</Badge></TableCell>
                            <TableCell className="p-2 text-center"><Badge variant="secondary" className="text-[10px] py-0">{newProduct.components.length}</Badge></TableCell>
                            <TableCell className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" type="button" onClick={() => handleOpenEditDialog({ ...newProduct, id: 'new_product' })} className="h-7 text-xs px-2">
                                        <Pencil className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" type="button" onClick={() => handleOpenComponentsDialog({ ...newProduct, id: 'new_product' })} className="h-7 text-xs px-2">
                                        <ShoppingBag className="h-3 w-3 mr-1" /> BOM
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
        </form>
      </Form>
      
      <Card className="border bg-background max-w-[740px]">
        <CardHeader>
          <CardTitle>{t('availableProducts.title')}</CardTitle>
          <CardDescription>{t('availableProducts.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px] p-2 text-left">Producto</TableHead>
                        <TableHead className="w-[70px] p-2 text-left">Medida</TableHead>
                        <TableHead className="w-[90px] p-2 text-left">Precio Venta</TableHead>
                        <TableHead className="w-[90px] p-2 text-left">Categoría</TableHead>
                        <TableHead className="w-[70px] p-2 text-center">Comp.</TableHead>
                        <TableHead className="w-[240px] p-2 text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {productsLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : products.length > 0 ? (
                    products.map((product) => (
                        <Fragment key={product.id}>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="p-2 font-medium text-xs text-left">{product.name}</TableCell>
                                <TableCell className="p-2 text-left">
                                    <Badge variant="outline" className="text-[10px] py-0">
                                        {product.unitAmount && product.unitAmount !== 1 ? `${product.unitAmount} ` : ''}{tData(`scaleNames.${product.unitScale || 'Piece'}`, {}, { default: product.unitScale || 'Piece' })}
                                    </Badge>
                                </TableCell>
                                <TableCell className="p-2 text-left text-xs font-semibold">{formatCurrency(product.salePrice)}</TableCell>
                                <TableCell className="p-2 text-left"><Badge variant="outline" className="text-[10px] py-0">{product.category}</Badge></TableCell>
                                <TableCell className="p-2 text-center"><Badge variant="secondary" className="text-[10px] py-0">{product.components.length}</Badge></TableCell>
                                <TableCell className="p-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(product)} className="h-7 text-xs px-2">
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('availableProducts.deleteDialog.title')}</AlertDialogTitle>
                                                    <AlertDialogDescription>{t('availableProducts.deleteDialog.description', { productName: product.name })}</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('availableProducts.deleteDialog.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteProduct(product.id)}>{t('availableProducts.deleteDialog.delete')}</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button variant="ghost" size="sm" onClick={() => toggleRow(product.id)} className="h-7 w-7 p-0">
                                            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expandedRows.has(product.id) && "rotate-180")} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                            {expandedRows.has(product.id) && (
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={6} className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="font-semibold flex items-center text-xs"><ShoppingBag className="h-3 w-3 mr-2" />{t('availableProducts.bom.title', { productName: product.name })}</h4>
                                          <Button variant="outline" size="sm" onClick={() => handleOpenComponentsDialog(product)} className="h-6 text-[10px]">
                                            <Pencil className="h-2.5 w-2.5 mr-1" /> {t('availableProducts.bom.editButton')}
                                          </Button>
                                        </div>
                                        {product.components.length > 0 ? (
                                            <div className="border rounded-md">
                                                <Table>
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            <TableHead className="text-[10px] h-7">{t('availableProducts.bom.table.material')}</TableHead>
                                                            <TableHead className="text-[10px] h-7">{t('availableProducts.bom.table.vendor')}</TableHead>
                                                            <TableHead className="text-[10px] h-7 text-right">{t('availableProducts.bom.table.quantity')}</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {product.components.map((c, i) => {
                                                            const m = allRawMaterials.find(rm => rm.id === c.rawMaterialId);
                                                            return (
                                                                <TableRow key={i}>
                                                                    <TableCell className="text-[10px] py-1">{m?.item || 'Unknown'}</TableCell>
                                                                    <TableCell className="text-[10px] py-1">{m?.vendorName || 'N/A'}</TableCell>
                                                                    <TableCell className="text-[10px] py-1 text-right">{c.quantity} {tData(`scaleNames.${m?.scale}`, {}, { default: m?.scale })}</TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground text-center py-2 border rounded-md bg-muted/30">{t('availableProducts.bom.empty')}</p>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )}
                        </Fragment>
                    ))
                ) : (<TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{t('availableProducts.empty')}</TableCell></TableRow>)}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      {/* Edit Product Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(handleEditProduct)}>
                        <DialogHeader>
                            <DialogTitle>{t('editProductDialog.title', { productName: getEditingProduct(editForm.getValues('id'))?.name || 'Product' })}</DialogTitle>
                            <DialogDescription>{t('editProductDialog.description')}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <FormField control={editForm.control} name="category" render={({ field }) => (
                                <FormItem><FormLabel>{t('editProductDialog.categoryLabel')}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{categoryOptions.map(cat => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={editForm.control} name="unitAmount" render={({ field }) => (
                                    <FormItem><FormLabel>{t('editProductDialog.scaleAmountLabel')}</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={editForm.control} name="unitScale" render={({ field }) => (
                                    <FormItem><FormLabel>{t('editProductDialog.scaleUnitLabel')}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{scaleOptions.map(opt => (<SelectItem key={opt} value={opt}>{scaleTranslations[opt]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={editForm.control} name="salePrice" render={({ field }) => (
                                <FormItem><FormLabel>{t('editProductDialog.salePriceLabel')}</FormLabel><FormControl><InputWithDecimals prefix="$" fixedDecimalScale={true} value={field.value ?? ''} onValueChange={(v) => field.onChange(v.floatValue ?? 0)} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <DialogFooter><Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('editProductDialog.saveButton')}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

      {/* Edit Components Dialog */}
        <Dialog open={isComponentsDialogOpen} onOpenChange={setIsComponentsDialogOpen}>
            <DialogContent className="sm:max-w-3xl">
                <Form {...componentsForm}>
                    <form onSubmit={componentsForm.handleSubmit(handleEditComponents)}>
                        <DialogHeader><DialogTitle>{t('editComponentsDialog.title', { productName: getEditingProduct(componentsForm.getValues('productId'))?.name || 'Product' })}</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-6">
                            {fields.map((field, index) => (
                               <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg">
                                    <FormField control={componentsForm.control} name={`components.${index}.rawMaterialId`} render={({ field }) => (
                                        <FormItem className="flex-1"><FormLabel>{t('editComponentsDialog.materialLabel')}</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('editComponentsDialog.materialPlaceholder')} /></SelectTrigger></FormControl>
                                            <SelectContent>{allRawMaterials.map(m => (<SelectItem key={m.id} value={m.id}>{m.item} ({m.vendorName})</SelectItem>))}</SelectContent>
                                        </Select><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={componentsForm.control} name={`components.${index}.quantity`} render={({ field }) => {
                                        const m = allRawMaterials.find(rm => rm.id === watchedComponents?.[index]?.rawMaterialId);
                                        return (
    <ProtectedPage pageName="catalogs.products" pageTitle="Products">
<FormItem><FormLabel>{t('editComponentsDialog.quantityLabel')}</FormLabel><div className="flex items-center gap-1"><FormControl><Input type="number" step="0.01" {...field} className="w-24"/></FormControl><div className="h-10 px-3 py-2 border rounded-md bg-muted text-xs flex items-center min-w-[60px] justify-center">{tData(`scaleNames.${m?.scale}`, {}, { default: m?.scale }) || '----'}</div></div><FormMessage /></FormItem>
    </ProtectedPage>
  )
                                    }} />
                                     <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                               </div>
                            ))}
                             <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ rawMaterialId: '', quantity: 1 })}><PlusCircle className="mr-2 h-4 w-4" />{t('editComponentsDialog.addButton')}</Button>
                        </div>
                        <DialogFooter><Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('editComponentsDialog.saveButton')}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </div>
  );
}