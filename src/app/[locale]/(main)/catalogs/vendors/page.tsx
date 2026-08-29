'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Printer, Loader2, Pencil, Check, ChevronsUpDown, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { generateVendorsReport } from './actions';
import { useInventory } from '@/hooks/use-inventory';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { formatCurrency, cn } from '@/lib/utils';
import { useScales } from '@/hooks/use-scales';
import { useMaterialTypes } from '@/hooks/use-material-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Vendor } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useTranslations, useLocale } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const useVendorSchemas = (t: ReturnType<typeof useTranslations>) => {
    const itemSchema = useMemo(() => z.object({
        sku: z.string().min(1, t('validation.skuRequired')),
        item: z.string().min(1, t('validation.itemNameRequired')),
        price: z.number().min(0, t('validation.pricePositive')),
        scale: z.string().min(1, t('validation.scaleRequired')),
        type: z.string().min(1, t('validation.typeRequired')),
    }), [t]);

    const editItemSchema = useMemo(() => itemSchema.extend({
        vendorId: z.string(),
        originalSku: z.string(),
    }), [itemSchema]);

    const addItemSchema = useMemo(() => itemSchema.extend({
        vendorId: z.string(),
    }), [itemSchema]);

    const vendorFormSchema = useMemo(() => z.object({
        name: z.string().min(1, t('validation.vendorNameRequired')),
        email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
        contactPerson: z.string().optional(),
        country: z.string().optional(),
        items: z.array(itemSchema),
    }), [t, itemSchema]);

    const editVendorFormSchema = useMemo(() => z.object({
        name: z.string().min(1, t('validation.vendorNameRequired')),
        email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
        contactPerson: z.string().optional(),
        country: z.string().optional(),
    }), [t]);
    
    const reportFormSchema = useMemo(() => z.object({
        itemId: z.string().min(1, t('validation.vendorRequired')),
    }), [t]);
    
    return { itemSchema, editItemSchema, addItemSchema, vendorFormSchema, editVendorFormSchema, reportFormSchema };
};

export default function VendorsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('VendorsPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  const { toast } = useToast();
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useInventory();
  const { scales } = useScales();
  const { materialTypes } = useMaterialTypes();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const [isClient, setIsClient] = useState(false);
  const [isItemEditDialogOpen, setIsItemEditDialogOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<z.infer<ReturnType<typeof useVendorSchemas>['editItemSchema']> | null>(null);
  const [addingItemToVendor, setAddingItemToVendor] = useState<Vendor | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isEditVendorDialogOpen, setIsEditVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const { vendorFormSchema, editItemSchema, addItemSchema, editVendorFormSchema, reportFormSchema } = useVendorSchemas(t);
  type VendorFormValues = z.infer<typeof vendorFormSchema>;
  type EditItemFormValues = z.infer<typeof editItemSchema>;
  type AddItemFormValues = z.infer<typeof addItemSchema>;

  const editItemForm = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema),
  });

  const addItemForm = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
  });

  const editVendorForm = useForm<z.infer<typeof editVendorFormSchema>>({
    resolver: zodResolver(editVendorFormSchema),
  });

  useEffect(() => {
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setIsClient(true);
  }, []);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      country: '',
      items: [{ sku: '', item: '', price: 0, scale: '', type: '' }],
    },
  });
  
  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      itemId: 'all',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const selectOptions = useMemo(() => ([
    { value: 'all', label: t('reportDialog.allOption') },
    ...vendors.map(vendor => ({
      value: vendor.id,
      label: vendor.name,
    })),
  ]), [vendors, t]);

  const onSubmit = async (data: VendorFormValues) => {
    setIsSubmitting(true);
    try {
        await createVendor(data);
        toast({ title: t('toasts.vendorCreated.title'), description: t('toasts.vendorCreated.description', { vendorName: data.name }) });
        form.reset();
    } catch(e: any) {
        toast({ variant: 'destructive', title: t('toasts.error'), description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    const selectedId = reportForm.getValues('itemId');
    const isSingle = selectedId !== 'all';

    setIsGenerating(true);

    try {
      const vendorsToPrint = isSingle
        ? vendors.filter(v => v.id === selectedId)
        : vendors;

      if (vendorsToPrint.length === 0) {
        throw new Error("No vendor data found for the report.");
      }
      
      const result = await generateVendorsReport({
        vendors: vendorsToPrint,
        isSingle: isSingle,
        clientTimezone,
        locale,
        tData: {
          MaterialTypesData: tData.raw('MaterialTypesData'),
          scaleNames: tData.raw('scaleNames')
        },
        translations: {
          singleTitle: t('report.singleTitle', {name: vendorsToPrint[0]?.name}),
          allTitle: t('report.allTitle'),
          generatedDateLabel: t('report.generatedDateLabel'),
          noItems: t('report.noItems'),
          headers: t.raw('report.headers'),
          contactInfo: t('report.contactInfo'),
          itemsSupplied: t('report.itemsSupplied'),
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
        throw new Error(result.error || t('ReportErrors.failedToGenerate'));
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('toasts.reportError.title'),
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenEditItemDialog = (vendor: Vendor, item: Vendor['items'][number]) => {
    const itemToEdit = {
      ...item,
      originalSku: item.sku,
      vendorId: vendor.id,
    };
    setEditingItem(itemToEdit);
    editItemForm.reset(itemToEdit);
    setIsItemEditDialogOpen(true);
  };

  const handleOpenAddItemDialog = (vendor: Vendor) => {
    setAddingItemToVendor(vendor);
    addItemForm.reset({
      vendorId: vendor.id,
      sku: '',
      item: '',
      price: undefined as any,
      scale: '',
      type: '',
    });
    setIsAddItemDialogOpen(true);
  };
  
  const handleEditItemSubmit = async (data: EditItemFormValues) => {
    const vendor = vendors.find(v => v.id === data.vendorId);
    if (!vendor) return;

    if (data.sku !== data.originalSku && vendor.items?.some(i => i.sku === data.sku)) {
        editItemForm.setError('sku', { type: 'manual', message: t('validation.skuExists') });
        return;
    }

    const updatedItems = vendor.items?.map(item => {
        if (item.sku === data.originalSku) {
            return {
                sku: data.sku,
                item: data.item,
                price: data.price,
                scale: data.scale,
                type: data.type,
                quantity: item.quantity,
            };
        }
        return item;
    });

    try {
        await updateVendor(data.vendorId, { items: updatedItems });
        toast({ title: t('toasts.itemUpdated.title') });
        setIsItemEditDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('toasts.itemUpdateError'), description: e.message });
    }
  };

  const handleAddItemSubmit = async (data: AddItemFormValues) => {
    const vendor = vendors.find(v => v.id === data.vendorId);
    if (!vendor) return;

    if (vendor.items?.some(i => i.sku === data.sku)) {
        addItemForm.setError('sku', { type: 'manual', message: t('validation.skuExists') });
        return;
    }

    const newItem = {
        sku: data.sku,
        item: data.item,
        price: data.price,
        scale: data.scale,
        type: data.type,
        quantity: 0,
    };

    const updatedItems = [...(vendor.items || []), newItem];

    try {
        await updateVendor(data.vendorId, { items: updatedItems });
        toast({ title: t('toasts.itemAdded.title'), description: t('toasts.itemAdded.description', { itemName: data.item }) });
        setIsAddItemDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('toasts.itemAddError'), description: e.message });
    }
  };

  const handleDeleteItemFromVendor = async (vendorId: string, itemSku: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;

    const updatedItems = vendor.items?.filter(item => item.sku !== itemSku);
    
    try {
        await updateVendor(vendorId, { items: updatedItems });
        toast({ title: t('toasts.itemDeleted.title') });
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('toasts.error'), description: e.message });
    }
  };

  const handleOpenEditVendorDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    editVendorForm.reset({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        contactPerson: vendor.contactPerson,
        country: vendor.country,
    });
    setIsEditVendorDialogOpen(true);
  };

  const handleEditVendorSubmit = async (data: z.infer<typeof editVendorFormSchema>) => {
      if (!editingVendor) return;
      try {
          await updateVendor(editingVendor.id, data);
          toast({ title: t('toasts.vendorUpdated.title') });
          setIsEditVendorDialogOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: t('toasts.vendorUpdateError'), description: e.message });
      }
  };

  const handleDeleteVendor = async (vendorId: string) => {
      try {
          await deleteVendor(vendorId);
          toast({ title: t('toasts.vendorDeleted.title') });
      } catch (e: any) {
          toast({ variant: 'destructive', title: t('toasts.vendorDeleteError'), description: e.message });
      }
  };
  
  const materialTypeOptions = materialTypes.map(m => m.name).sort();
  
  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="catalogs.vendors" pageTitle="Vendors">

      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <Card className="border bg-background">
          <CardHeader>
            <CardTitle>{t('addNewVendor.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('catalogs.vendors')) {
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
    <ProtectedPage pageName="catalogs.vendors" pageTitle="Vendors">
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">{vendors.length}</span>
        </div>
      </div>
      <Card className="border bg-background">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('addNewVendor.title')}</CardTitle>
                <CardDescription>{t('addNewVendor.description')}</CardDescription>
              </div>
              <Button type="submit" disabled={isSubmitting} className="bg-[#3560A0] hover:bg-[#3560A0]/90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('addNewVendor.saveButton')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('form.vendorName')}</FormLabel><FormControl><Input placeholder={t('form.vendorNamePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>{t('form.contactPerson')}</FormLabel><FormControl><Input placeholder={t('form.contactPersonPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>{t('form.email')}</FormLabel><FormControl><Input type="email" placeholder={t('form.emailPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>{t('form.phone')}</FormLabel><FormControl><Input placeholder={t('form.phonePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>{t('form.address')}</FormLabel><FormControl><Input placeholder={t('form.addressPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>{t('form.country')}</FormLabel><FormControl><Input placeholder={t('form.countryPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">{t('form.itemsTitle')}</h3>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.item`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('form.item')}</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-[1fr,1.2fr,0.6fr,1fr,auto] items-end gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.sku`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.sku')}</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="w-full">
                              <FormLabel>{t('form.type')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t('form.typePlaceholder')} /></SelectTrigger></FormControl>
                                <SelectContent>{materialTypes.map(type => (<SelectItem key={type.id} value={type.name}>{tData(`MaterialTypesData.${type.name}`, {}, { default: type.name })}</SelectItem>))}</SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.price')}</FormLabel>
                              <FormControl><InputWithDecimals placeholder="0.00" prefix="$" fixedDecimalScale={true} value={field.value ?? ''} onValueChange={(values) => field.onChange(values.floatValue ?? 0)} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.scale`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.scale')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t('form.scalePlaceholder')} /></SelectTrigger></FormControl>
                                <SelectContent>{scales.map(scale => (<SelectItem key={scale.id} value={scale.name}>{tData(`scaleNames.${scale.name}`, {}, { default: scale.name })}</SelectItem>))}</SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ sku: '', item: '', price: 0, scale: '', type: '' })}><PlusCircle className="mr-2 h-4 w-4" />{t('form.addItemButton')}</Button>
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>

      <Card className="border bg-background">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('vendorList.title')}</CardTitle>
            <CardDescription>{t('vendorList.description')}</CardDescription>
          </div>
          <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#3560A0] hover:bg-[#3560A0]/90">
                    <Printer className="mr-2 h-4 w-4" />
                    {t('reportDialog.trigger')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
                <Form {...reportForm}>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerateReport(); }}>
                        <DialogHeader>
                            <DialogTitle>{t('reportDialog.title')}</DialogTitle>
                            <DialogDescription>{t('reportDialog.description')}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <FormField
                                control={reportForm.control}
                                name="itemId"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>{t('reportDialog.label')}</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                    "w-[150%] justify-between",
                                                    !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value
                                                    ? selectOptions.find(
                                                        (option) => option.value === field.value
                                                        )?.label
                                                    : t('reportDialog.selectPlaceholder')}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <Command>
                                            <CommandInput placeholder={t('reportDialog.searchPlaceholder')} />
                                            <CommandList>
                                                <CommandEmpty>{t('reportDialog.empty')}</CommandEmpty>
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
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isGenerating} className="bg-[#3560A0] hover:bg-[#3560A0]/90">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />}
                                {t('reportDialog.generateButton')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : vendors.length > 0 ? (
                vendors.map(vendor => (
                    <AccordionItem key={vendor.id} value={vendor.id}>
                        <AccordionTrigger className="w-full justify-between hover:no-underline">
                           <span className="font-semibold text-left">{vendor.name}</span>
                           <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 accordion-chevron" />
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="p-4 bg-muted/50 rounded-md mb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{vendor.contactPerson}</p>
                                        <p className="text-sm text-muted-foreground">{vendor.email}</p>
                                        <p className="text-sm text-muted-foreground">{vendor.phone}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="bg-[#3560A0] text-white hover:bg-[#3560A0]/90 hover:text-white"
                                            onClick={() => handleOpenAddItemDialog(vendor)}
                                        >
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            {t('addItemButton')}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditVendorDialog(vendor)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('deleteDialogs.vendorTitle')}</AlertDialogTitle>
                                                    <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t.raw('deleteDialogs.vendorDescription', { vendorName: vendor.name }) }}/>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('deleteDialogs.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteVendor(vendor.id)}>{t('deleteDialogs.delete')}</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </div>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('form.sku')}</TableHead>
                                        <TableHead>{t('form.item')}</TableHead>
                                        <TableHead>{t('form.price')}</TableHead>
                                        <TableHead>{t('form.scale')}</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendor.items && vendor.items.length > 0 ? (
                                        vendor.items.map(item => (
                                            <TableRow key={item.sku}>
                                                <TableCell className="font-mono">{item.sku}</TableCell>
                                                <TableCell>{item.item}</TableCell>
                                                <TableCell>{formatCurrency(item.price)}</TableCell>
                                                <TableCell>{item.scale}</TableCell>
                                                <TableCell className="text-right">
                                                     <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditItemDialog(vendor, item)}>
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
                                                                    <AlertDialogTitle>{t('deleteDialogs.itemTitle')}</AlertDialogTitle>
                                                                    <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t.raw('deleteDialogs.itemDescription', { itemName: item.item }) }}/>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>{t('deleteDialogs.cancel')}</AlertDialogCancel>
                                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteItemFromVendor(vendor.id, item.sku)}>{t('deleteDialogs.delete')}</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">{t('vendorList.noItems')}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                           </Table>
                        </AccordionContent>
                    </AccordionItem>
                ))
            ) : (
                <p className="text-muted-foreground text-center p-4">{t('vendorList.noVendors')}</p>
            )}
          </Accordion>
        </CardContent>
      </Card>
      
      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent>
            <Form {...addItemForm}>
                <form onSubmit={addItemForm.handleSubmit(handleAddItemSubmit)}>
                    <DialogHeader>
                        <DialogTitle>{t('addItemDialog.title', { vendorName: addingItemToVendor?.name })}</DialogTitle>
                        <DialogDescription>{t('addItemDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={addItemForm.control} name="sku" render={({ field }) => (<FormItem><FormLabel>{t('form.sku')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={addItemForm.control} name="item" render={({ field }) => (<FormItem><FormLabel>{t('form.item')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <FormField control={addItemForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>{t('form.type')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('form.typePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{materialTypes.map(type => (<SelectItem key={type.id} value={type.name}>{tData(`MaterialTypesData.${type.name}`, {}, { default: type.name })}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                          <FormField control={addItemForm.control} name="price" render={({ field }) => (<FormItem><FormLabel>{t('form.price')}</FormLabel><FormControl><InputWithDecimals placeholder="0.00" prefix="$" fixedDecimalScale={true} value={field.value ?? ''} onValueChange={(values) => field.onChange(values.floatValue ?? 0)} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <FormField control={addItemForm.control} name="scale" render={({ field }) => (<FormItem><FormLabel>{t('form.scale')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('form.scalePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{scales.map(option => (<SelectItem key={option.id} value={option.name}>{tData(`scaleNames.${option.name}`, {}, { default: option.name })}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                       </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('addItemDialog.saveButton')}</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isItemEditDialogOpen} onOpenChange={setIsItemEditDialogOpen}>
        <DialogContent>
            <Form {...editItemForm}>
                <form onSubmit={editItemForm.handleSubmit(handleEditItemSubmit)}>
                    <DialogHeader>
                        <DialogTitle>{t('editItemDialog.title', { itemName: editingItem?.item })}</DialogTitle>
                        <DialogDescription>{t('editItemDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editItemForm.control} name="sku" render={({ field }) => (<FormItem><FormLabel>{t('form.sku')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                           <FormField control={editItemForm.control} name="item" render={({ field }) => (<FormItem><FormLabel>{t('editItemDialog.itemNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <FormField control={editItemForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>{t('form.type')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('form.typePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{materialTypes.map(type => (<SelectItem key={type.id} value={type.name}>{tData(`MaterialTypesData.${type.name}`, {}, { default: type.name })}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                           <FormField control={editItemForm.control} name="price" render={({ field }) => (<FormItem><FormLabel>{t('form.price')}</FormLabel><FormControl><InputWithDecimals placeholder="0.00" prefix="$" fixedDecimalScale={true} value={field.value ?? ''} onValueChange={(values) => field.onChange(values.floatValue ?? 0)} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <FormField control={editItemForm.control} name="scale" render={({ field }) => (<FormItem><FormLabel>{t('form.scale')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('form.scalePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{scales.map(option => (<SelectItem key={option.id} value={option.name}>{tData(`scaleNames.${option.name}`, {}, { default: option.name })}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                       </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('editItemDialog.saveButton')}</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Vendor Dialog */}
      <Dialog open={isEditVendorDialogOpen} onOpenChange={setIsEditVendorDialogOpen}>
          <DialogContent>
              <Form {...editVendorForm}>
                  <form onSubmit={editVendorForm.handleSubmit(handleEditVendorSubmit)}>
                      <DialogHeader>
                          <DialogTitle>{t('editVendorDialog.title', { vendorName: editingVendor?.name })}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={editVendorForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('form.vendorName')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={editVendorForm.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>{t('form.contactPerson')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={editVendorForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>{t('form.email')}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={editVendorForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>{t('form.phone')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={editVendorForm.control} name="address" render={({ field }) => (<FormItem><FormLabel>{t('form.address')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={editVendorForm.control} name="country" render={({ field }) => (<FormItem><FormLabel>{t('form.country')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                      </div>
                      <DialogFooter>
                          <Button type="submit" className="bg-[#3560A0] hover:bg-[#3560A0]/90">{t('editVendorDialog.saveButton')}</Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
    </div>
    </ProtectedPage>
  );
}