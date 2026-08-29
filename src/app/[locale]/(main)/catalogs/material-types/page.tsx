'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMaterialTypes, type MaterialType } from '@/hooks/use-material-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Printer, Pencil, Trash2, PlusCircle, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { generateCatalogReport } from './actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useInventory } from '@/hooks/use-inventory';
import { ProtectedPage } from '@/components/protected-page';

const useMaterialTypeSchemas = (t: ReturnType<typeof useTranslations>) => {
    const formSchema = useMemo(() => z.object({
        name: z.string().min(1, t('validation.nameRequired')),
        description: z.string().optional(),
    }), [t]);
    
    const reportSchema = useMemo(() => z.object({
        itemId: z.string().min(1, t('validation.itemRequired'))
    }), [t]);

    return { formSchema, reportSchema };
}

export default function MaterialTypesPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('MaterialTypesPage');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  
  const { toast } = useToast();
  const { materialTypes, createMaterialType, updateMaterialType, deleteMaterialType, loading } = useMaterialTypes();
  const { allItems } = useInventory();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isAddOrEditDialogOpen, setAddOrEditDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [editingMaterialType, setEditingMaterialType] = useState<MaterialType | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  const { formSchema, reportSchema } = useMaterialTypeSchemas(t);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });

  const reportForm = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: { itemId: 'all' },
  });

  const isMaterialTypeInUse = (typeName: string) => {
    return allItems.some(item => item.type === typeName);
  };

  const handleOpenAddOrEditDialog = (materialType?: MaterialType) => {
    setEditingMaterialType(materialType || null);
    form.reset(materialType ? { name: materialType.name, description: materialType.description } : { name: '', description: '' });
    setAddOrEditDialogOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (editingMaterialType) {
        await updateMaterialType(editingMaterialType.id, data);
        toast({ title: t('toasts.updated.title'), description: t('toasts.updated.description', { typeName: data.name }) });
      } else {
        await createMaterialType(data);
        toast({ title: t('toasts.saved.title'), description: t('toasts.saved.description', { typeName: data.name }) });
      }
      setAddOrEditDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: editingMaterialType ? t('toasts.updateError') : t('toasts.saveError'), description: e.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      if (deleteMaterialType) {
        await deleteMaterialType(id);
        toast({ title: t('toasts.deleted.title'), description: t('toasts.deleted.description', { typeName: name }) });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: t('toasts.deleteError'), description: e.message });
    }
  };
  
  const handleGenerateReport = async (reportData: z.infer<typeof reportSchema>) => {
    setIsGenerating(true);
    
    const isSingle = reportData.itemId !== 'all';
    
    const translatedData = materialTypes
        .filter(m => !isSingle || m.id === reportData.itemId)
        .map(item => ({
            ...item,
            name: tData(`MaterialTypesData.${item.name}`, {}, { default: item.name })
        }));

    const selectedItem = translatedData.find(m => m.id === reportData.itemId);
  
    const reportLabels = {
      title: isSingle 
        ? `${t('reportDialog.title')}: ${selectedItem?.name}` 
        : t('reportDialog.title'),
      subtitle: locale === 'es' ? "Sistema de Control Interno" : "Internal Control System",
      totalLabel: locale === 'es' ? "TOTAL GENERAL" : "GRAND TOTAL",
      nameCol: t('existingMaterialTypes.table.name'), 
      descCol: t('existingMaterialTypes.table.description'),
      sectionTitle: t('existingMaterialTypes.title')
    };

    const formData = new FormData();
    formData.append('itemId', reportData.itemId);
    
    try {
      const result = await generateCatalogReport(
        formData, 
        translatedData,
        Intl.DateTimeFormat().resolvedOptions().timeZone, 
        reportLabels,
        locale
      );
  
      if (result.success && result.reportContent) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(result.reportContent);
          win.document.close();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ 
        variant: 'destructive', 
        title: locale === 'es' ? "Error de Reporte" : "Report Error", 
        description: e.message 
      });
    } finally {
      setIsGenerating(false);
    }
};

  const reportSelectOptions = useMemo(() => ([
    { value: 'all', label: t('reportDialog.allOption') },
    ...materialTypes.map(item => ({
      value: item.id,
      label: item.name,
    })),
  ]), [materialTypes, t]);

  if (permissionLoading || !isClient) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  return (
    <ProtectedPage pageName="catalogs.materialTypes" pageTitle="Material Types">
<div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <div className="flex items-center gap-2">
            <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Printer className="h-4 w-4 mr-2" /> {t('printButton')}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <Form {...reportForm}>
                        <form onSubmit={reportForm.handleSubmit(handleGenerateReport)}>
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
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between",!field.value && "text-muted-foreground")}>
                                                        {field.value ? 
                                                            (reportSelectOptions.find((option) => option.value === field.value)?.value === 'all'
                                                                ? reportSelectOptions.find((option) => option.value === field.value)?.label
                                                                : tData(`MaterialTypesData.${reportSelectOptions.find((option) => option.value === field.value)?.label}`, {}, {default: reportSelectOptions.find((option) => option.value === field.value)?.label}))
                                                            : t('reportDialog.selectPlaceholder')}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder={t('reportDialog.searchPlaceholder')} />
                                                    <CommandList>
                                                        <CommandEmpty>{t('reportDialog.empty')}</CommandEmpty>
                                                        <CommandGroup>
                                                            {reportSelectOptions.map((option) => (
                                                                <CommandItem value={option.label} key={option.value} onSelect={() => {reportForm.setValue("itemId", option.value)}}>
                                                                    <Check className={cn("mr-2 h-4 w-4", option.value === field.value ? "opacity-100" : "opacity-0")}/>
                                                                    {option.value === 'all'
                                                                        ? option.label
                                                                        : tData(`MaterialTypesData.${option.label}`, {}, {default: option.label})}
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
                            <Button type="submit" disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />}
                                {t('reportDialog.generateButton')}
                            </Button>
                        </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <div className="flex items-baseline gap-3">
                <CardTitle>{t('existingMaterialTypes.title')}</CardTitle>
                <span className="text-2xl font-bold text-muted-foreground">({materialTypes.length})</span>
                </div>
                <CardDescription>{t('existingMaterialTypes.description')}</CardDescription>
            </div>
            <Button onClick={() => handleOpenAddOrEditDialog()}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {t('newMaterialType.title')}
            </Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('existingMaterialTypes.table.name')}</TableHead>
                        <TableHead>{t('existingMaterialTypes.table.description')}</TableHead>
                        <TableHead className="text-right">{t('existingMaterialTypes.table.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center py-10">
                                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : materialTypes.length > 0 ? (
                        materialTypes.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-semibold">{tData(`MaterialTypesData.${item.name}`, {}, {default: item.name})}</TableCell>
                            <TableCell className="text-muted-foreground">{item.description || '—'}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenAddOrEditDialog(item)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isMaterialTypeInUse(item.name)} title={isMaterialTypeInUse(item.name) ? t('existingMaterialTypes.inUseTooltip') : ''}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                                                <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t.raw('deleteDialog.description', { typeName: item.name })}} />
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(item.id, item.name)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">{t('existingMaterialTypes.empty')}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOrEditDialogOpen} onOpenChange={setAddOrEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{editingMaterialType ? t('editDialog.title', { typeName: editingMaterialType.name }) : t('newMaterialType.title')}</DialogTitle>
                        <DialogDescription>{editingMaterialType ? t('editDialog.description') : t('newMaterialType.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">{t('newMaterialType.nameLabel')}</FormLabel>
                                <FormControl><Input placeholder={t('newMaterialType.namePlaceholder')} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">{t('newMaterialType.descriptionLabel')}</FormLabel>
                                <FormControl><Input placeholder={t('newMaterialType.descriptionPlaceholder')} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="w-full md:w-auto">
                            {editingMaterialType ? t('editDialog.saveButton') : t('newMaterialType.saveButton')}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedPage>
  );
}