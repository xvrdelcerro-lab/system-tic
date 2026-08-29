'use client';

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
  DialogTrigger,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Printer, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import type { Phase } from '@/lib/types';
import { usePhases } from '@/hooks/use-phases';
import { generateCatalogReport } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useTranslations, useLocale } from 'next-intl';

type PhaseFormValues = z.infer<ReturnType<typeof usePhaseFormSchema>>;

const usePhaseFormSchema = (t: ReturnType<typeof useTranslations>) => {
    return useMemo(() => z.object({
        id: z.string().optional(),
        name: z.string().min(1, t('validation.nameRequired')),
        description: z.string().min(1, t('validation.descriptionRequired')),
    }), [t]);
}

const useReportFormSchema = (t: ReturnType<typeof useTranslations>) => {
    return useMemo(() => z.object({
        itemId: z.string().min(1, t('validation.itemRequired')),
    }), [t]);
}

export default function PhasesPage() {
  const { toast } = useToast();
  const t = useTranslations('PhasesPage');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  const { phases, loading, createPhase, updatePhase, deletePhase } = usePhases();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const phaseFormSchema = usePhaseFormSchema(t);
  const reportFormSchema = useReportFormSchema(t);

  const form = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const editForm = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseFormSchema),
  });

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { itemId: 'all' },
  });

  const onSubmit = async (data: PhaseFormValues) => {
    try {
      await createPhase(data);
      toast({
        title: t('toasts.saved.title'),
        description: t('toasts.saved.description', { phaseName: data.name }),
      });
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.saveError'), description: e.message });
    }
  };

  const handleOpenEditDialog = (phase: Phase) => {
    if (phase.isDefault) {
      toast({
        variant: 'destructive',
        title: t('toasts.editNotAllowed.title'),
        description: t('toasts.editNotAllowed.description', { phaseName: tData(`PhasesData.${phase.name}`) }),
      });
      return;
    }
    setEditingPhase(phase);
    editForm.reset(phase);
    setIsEditDialogOpen(true);
  };
  
  const handleEditSubmit = async (data: PhaseFormValues) => {
    if (!editingPhase) return;
    try {
      await updatePhase(editingPhase.id, data);
      toast({
          title: t('toasts.updateSuccess.title'),
          description: t('toasts.updateSuccess.description', { phaseName: data.name })
      });
      setIsEditDialogOpen(false);
      setEditingPhase(null);
    } catch (e: any) {
       toast({ variant: 'destructive', title: t('toasts.updateError'), description: e.message });
    }
  };

  const handleDeletePhase = async (phase: Phase) => {
    if (phase.isDefault) {
       toast({
          variant: 'destructive',
          title: t('toasts.deleteNotAllowed.title'),
          description: t('toasts.deleteNotAllowed.description'),
      });
      return;
    }
    try {
      await deletePhase(phase.id);
      toast({
          title: t('toasts.deleteSuccess.title'),
          description: t('toasts.deleteSuccess.description')
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.deleteError'), description: e.message });
    }
  };

  const handleGenerateReport = async () => {
    const selectedId = reportForm.getValues('itemId');
    const isSingle = selectedId !== 'all';
    
    setIsGenerating(true);

    const translatedData = phases
      .filter(p => !isSingle || p.id === selectedId)
      .map(p => {
        const nameKey = `PhasesData.${p.name}`;
        const descKey = `PhasesData.${p.name}_desc`;
        
        return {
          ...p,
          name: tData.has(nameKey) ? tData(nameKey) : p.name,
          description: tData.has(descKey) ? tData(descKey) : p.description
        };
      });

    const selectedItem = translatedData.find(p => p.id === selectedId);

    const reportLabels = {
      title: isSingle 
        ? t('reportDialog.title') + ': ' + (selectedItem?.name || '')
        : t('reportDialog.title'),
      totalLabel: locale === 'es' ? "Total de Fases" : "Total Phases",
      nameCol: t('existingPhases.table.name'),
      descCol: t('existingPhases.table.description'),
      orderCol: t('existingPhases.table.number'),
    };

    try {
      const formData = new FormData();
      formData.append('itemId', selectedId);
      
      const result = await generateCatalogReport(
        formData, 
        translatedData, 
        clientTimezone, 
        reportLabels, 
        locale
      );

      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(result.reportContent);
          reportWindow.document.close();
        }
        setIsPrintDialogOpen(false);
      } else {
        throw new Error(result.error || t('toasts.reportErrorDesc'));
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t('toasts.reportError'),
        description: e.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('newPhase.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedPhasesForSelect = [...phases].sort((a,b) => a.name.localeCompare(b.name));
  
  const reportSelectOptions = [
    { value: 'all', label: t('reportDialog.allOption') },
    ...sortedPhasesForSelect.map(item => ({
      value: item.id,
      label: tData(`PhasesData.${item.name}` as any),
    })),
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">{phases.length}</span>
        </div>
        <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Printer className="mr-2 h-4 w-4" />
              {t('printButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <Form {...reportForm}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGenerateReport();
                }}
              >
                <DialogHeader>
                  <DialogTitle>{t('reportDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('reportDialog.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? reportSelectOptions.find(
                                      (option) => option.value === field.value
                                    )?.label
                                  : t('reportDialog.selectPlaceholder')}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder={t('reportDialog.searchPlaceholder')} />
                              <CommandList>
                                <CommandEmpty>{t('reportDialog.empty')}</CommandEmpty>
                                <CommandGroup>
                                  {reportSelectOptions.map((option) => (
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
                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    {t('reportDialog.generateButton')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>{t('newPhase.title')}</CardTitle>
              <CardDescription>
                {t('newPhase.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newPhase.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('newPhase.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newPhase.descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('newPhase.descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit">{t('newPhase.saveButton')}</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('existingPhases.title')}</CardTitle>
          <CardDescription>
            {t('existingPhases.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('existingPhases.table.number')}</TableHead>
                <TableHead>{t('existingPhases.table.name')}</TableHead>
                <TableHead>{t('existingPhases.table.description')}</TableHead>
                <TableHead className="text-right">{t('existingPhases.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {phases.length > 0 ? (
              phases.map((phase) => (
                <TableRow key={phase.id}>
                  <TableCell className="font-medium">{phase.order}</TableCell>
                  <TableCell className="font-medium">{tData(`PhasesData.${phase.name}` as any)}</TableCell>
                  <TableCell>{tData(`PhasesData.${phase.name}_desc` as any, {}, { default: phase.description })}</TableCell>
                  <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(phase)} disabled={phase.isDefault}>
                              <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={phase.isDefault}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          {t.rich('deleteDialog.description', {
                                              phaseName: tData(`PhasesData.${phase.name}` as any),
                                              strong: (chunks) => <strong>{chunks}</strong>,
                                          })}
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeletePhase(phase)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {t('existingPhases.empty')}
                </TableCell>
              </TableRow>
            )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Edit Phase Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditSubmit)}>
                    <DialogHeader>
                        <DialogTitle>{t('editDialog.title', { phaseName: tData(`PhasesData.${editingPhase?.name}` as any) })}</DialogTitle>
                        <DialogDescription>{t('editDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <FormField
                            control={editForm.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('newPhase.nameLabel')}</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={editForm.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('newPhase.descriptionLabel')}</FormLabel>
                                    <FormControl><Textarea {...field} /></FormControl>
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
  );
}