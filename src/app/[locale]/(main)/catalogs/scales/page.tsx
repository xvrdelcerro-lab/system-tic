'use client';
import { usePermissions } from '@/hooks/use-permissions';


import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useMemo, useState, useEffect } from 'react';
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
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil, Printer, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useScales } from '@/hooks/use-scales';
import type { Scale } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { generateScalesReport } from './actions';
import { useTranslations, useLocale } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';


const useScaleSchemas = (t: ReturnType<typeof useTranslations>) => {
    return useMemo(() => z.object({
        name: z.string().min(1, t('validation.nameRequired')),
        type: z.string().min(1, t('validation.typeRequired')),
    }), [t]);
};

type ScaleFormValues = z.infer<ReturnType<typeof useScaleSchemas>>;

const scaleTypeOptions = ['Weight', 'Volume', 'Length', 'Units'];

export default function ScalesPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('ScalesPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData');
  const tScaleTypes = useTranslations('DefaultData.ScaleTypes');
  
  const { toast } = useToast();
  const { scales, loading, createScale, updateScale, deleteScale } = useScales();
  const [editing, setEditing] = useState<Scale | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const scaleSchema = useScaleSchemas(t);

  const form = useForm<ScaleFormValues>({
    resolver: zodResolver(scaleSchema),
    defaultValues: { name: '', type: '' },
  });

  const editForm = useForm<ScaleFormValues>({
    resolver: zodResolver(scaleSchema),
  });

  const sortedScales = useMemo(
    () => [...scales].sort((a, b) => a.name.localeCompare(b.name)),
    [scales]
  );
  
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    const grouped = scales.reduce((acc, scale) => {
        const typeKey = scale.type || 'Uncategorized';
        const typeLabel = tScaleTypes.has(typeKey) ? tScaleTypes(typeKey) : typeKey;
        if (!acc[typeLabel]) {
            acc[typeLabel] = [];
        }
        acc[typeLabel].push(scale);
        return acc;
    }, {} as Record<string, any[]>);
    
    const scalesByType = Object.keys(grouped).map(type => ({
        type,
        scales: grouped[type].sort((a: any, b: any) => tData(`scaleNames.${a.name}`).localeCompare(tData(`scaleNames.${b.name}`))),
    })).sort((a, b) => a.type.localeCompare(b.type));

    const translatedScalesByType = scalesByType.map(group => ({
        ...group,
        scales: group.scales.map(scale => ({
            ...scale,
            name: tData(`scaleNames.${scale.name}`, {}, { default: scale.name }),
            type: tScaleTypes(scale.type as any, {}, { default: scale.type })
        }))
    }));

    const payload = {
      scalesByType: translatedScalesByType,
      clientTimezone,
      translations: {
        title: t('report.title'),
        generatedDateLabel: t('report.generatedDateLabel'),
        headers: {
            name: t('existingScales.table.name'),
        }
      }
    };
    
    try {
        const result = await generateScalesReport(payload);
        if (result.success && result.reportContent) {
            const reportWindow = window.open('', '_blank');
            if (reportWindow) {
                reportWindow.document.write(result.reportContent);
                reportWindow.document.close();
            } else {
                 toast({ variant: 'destructive', title: t('toasts.popupBlocked.title'), description: t('toasts.popupBlocked.description')});
            }
        } else {
            throw new Error(result.error || t('toasts.reportErrorDesc'));
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: t('toasts.reportError'),
            description: error.message,
        });
    } finally {
        setIsGenerating(false);
    }
  };

  const onSubmit = async (data: ScaleFormValues) => {
    if (scales.some(s => s.name.toLowerCase() === data.name.toLowerCase())) {
      form.setError('name', { message: t('toasts.alreadyExists') });
      return;
    }
    try {
        await createScale(data.name, data.type);
        toast({
          title: t('toasts.saveSuccess.title'),
          description: t('toasts.saveSuccess.description', { scaleName: data.name }),
        });
        form.reset({ name: '', type: '' });
    } catch (e: any) {
        toast({ variant: "destructive", title: t('toasts.saveError'), description: e.message });
    }
  };

  const openEdit = (scale: Scale) => {
    setEditing(scale);
    editForm.reset(scale);
  };

  const submitEdit = async (data: ScaleFormValues) => {
    if (!editing) return;
    try {
        await updateScale(editing.id, data.name, data.type);
        toast({
          title: t('toasts.updateSuccess.title'),
          description: t('toasts.updateSuccess.description', { scaleName: data.name }),
        });
        setEditing(null);
    } catch (e: any) {
        toast({ variant: "destructive", title: t('toasts.updateError'), description: e.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
        await deleteScale(id);
        toast({
          title: t('toasts.deleteSuccess.title'),
          description: t('toasts.deleteSuccess.description', { scaleName: tData(`scaleNames.${name}`) }),
        });
    } catch (e: any) {
        toast({ variant: "destructive", title: t('toasts.deleteError'), description: e.message });
    }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="catalogs.scales" pageTitle="Scales">

      <div className="space-y-8">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('newScale.title')}</CardTitle>
            <CardDescription>
              {t('newScale.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('existingScales.title')}</CardTitle>
            <CardDescription>
              {t('existingScales.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('catalogs.scales')) {
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
    <ProtectedPage pageName="catalogs.scales" pageTitle="Scales">
<div className="space-y-8">
      <div className="flex items-baseline gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <span className="text-3xl font-bold text-muted-foreground">
          {scales.length}
        </span>
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('newScale.title')}</CardTitle>
                <CardDescription>
                  {t('newScale.description')}
                </CardDescription>
              </div>
              <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {t('reportButton')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('newScale.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('newScale.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="w-1/3">
                      <FormLabel>{t('newScale.typeLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('newScale.typePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scaleTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{tScaleTypes(opt as any)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">{t('newScale.saveButton')}</Button>
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('existingScales.title')}</CardTitle>
          <CardDescription>
            {t('existingScales.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('existingScales.table.name')}</TableHead>
                <TableHead>{t('existingScales.table.type')}</TableHead>
                <TableHead className="text-right">{t('existingScales.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedScales.length ? (
                sortedScales.map(scale => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-medium">
                      {tData(`scaleNames.${scale.name}`, {}, {default: scale.name})}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tScaleTypes(scale.type as any, {}, {default: scale.type})}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(scale)}
                        >
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
                              <AlertDialogTitle>
                                {t('deleteDialog.title')}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t.rich('deleteDialog.description', { scaleName: tData(`scaleNames.${scale.name}`, {}, {default: scale.name}), strong: (chunks) => <strong>{chunks}</strong>})}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() =>
                                  handleDelete(scale.id, scale.name)
                                }
                              >
                                {t('deleteDialog.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    {t('existingScales.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(submitEdit)}>
              <DialogHeader>
                <DialogTitle>{t('editDialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('editDialog.description')}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newScale.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newScale.typeLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('newScale.typePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scaleTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{tScaleTypes(opt as any)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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