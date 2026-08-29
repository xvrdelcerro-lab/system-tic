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
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Check, ChevronsUpDown, Printer, Loader2 } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInventory } from '@/hooks/use-inventory';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProduction } from '@/hooks/use-production';
import { useTranslations, useLocale } from 'next-intl';
import { generateIntakesReport } from './actions';
import { toDateSafe } from '@/lib/date';

const useIntakeFormSchema = (t: ReturnType<typeof useTranslations>) => {
    return useMemo(() => z.object({
        materialId: z.string().min(1, t('validation.materialRequired')),
        quantity: z.coerce.number({
            invalid_type_error: t('validation.quantityRequired'),
        }).gt(0, t('validation.quantityPositive')),
        scale: z.string().optional(),
        date: z.date({ required_error: t('validation.dateRequired') }),
    }), [t]);
};


type IntakeFormValues = z.infer<ReturnType<typeof useIntakeFormSchema>>;

export default function ArrivalsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  const t = useTranslations('ArrivalsPage');
  const tCommon = useTranslations('ProtectedPage');
  const tIntakesReport = useTranslations('IntakesReport');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const { allItems, vendors, updateVendor } = useInventory();
  const { intakes, addIntake } = useProduction();
  const [open, setOpen] = useState(false);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');


  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const intakeFormSchema = useIntakeFormSchema(t);
  
  const defaultValues: Partial<IntakeFormValues> = {
      materialId: '',
      quantity: undefined,
      scale: '',
      date: new Date(),
  };

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: defaultValues,
    mode: 'onBlur',
  });
  
  const materialId = form.watch('materialId');

  useEffect(() => {
    if (materialId) {
      const material = allItems.find(item => item.id === materialId);
      if (material && material.scale) {
        const translatedScale = tData(`scaleNames.${material.scale}` as any, {}, { default: material.scale });
        form.setValue('scale', translatedScale, { shouldValidate: true });
      }
    } else {
        form.resetField('scale');
    }
  }, [materialId, form, allItems, tData]);

  const onSubmit = async (data: IntakeFormValues) => {
    try {
        const material = allItems.find(item => item.id === data.materialId);
        if (!material) {
          toast({
            variant: 'destructive',
            title: t('toasts.error.title'),
            description: t('toasts.error.materialNotFound'),
          });
          return;
        }

        const vendor = vendors.find(v => v.id === material.vendorId);
        if (!vendor) {
            toast({
                variant: 'destructive',
                title: t('toasts.error.title'),
                description: t('toasts.error.vendorNotFound'),
            });
            return;
        }

        const updatedItems = vendor.items.map(item => {
            if (item.sku === material.sku) {
                return { ...item, quantity: (item.quantity || 0) + (data.quantity || 0) };
            }
            return item;
        });

        await updateVendor(vendor.id, { items: updatedItems });
        
        await addIntake({
            materialId: data.materialId,
            quantity: data.quantity || 0,
            date: data.date,
            scale: material?.scale
        });

        toast({
          title: t('toasts.success.title'),
          description: t('toasts.success.description', { 
            quantity: data.quantity, 
            scale: data.scale,
            materialName: material?.item 
          }),
        });
        form.reset(defaultValues);
    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: t('toasts.error.title'),
            description: e.message || 'An unknown error occurred'
        });
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    let filteredIntakes = [...intakes];

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filteredIntakes = filteredIntakes.filter(i => {
            const intakeDate = toDateSafe(i.date);
            return intakeDate && intakeDate >= start;
        });
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredIntakes = filteredIntakes.filter(i => {
            const intakeDate = toDateSafe(i.date);
            return intakeDate && intakeDate <= end;
        });
    }
    
    const enrichedData = filteredIntakes.map(intake => {
        const material = allItems.find(item => item.id === intake.materialId);
        return {
            ...intake,
            materialName: material?.item || 'Unknown',
            vendorName: material?.vendorName || 'Unknown',
            materialType: material?.type || 'Uncategorized'
        };
    });
    
    const filterTitleParts = [];
    if(startDate) filterTitleParts.push(`${t('report.startDateLabel')}: ${format(startDate, 'PPP')}`);
    if(endDate) filterTitleParts.push(`${t('report.endDateLabel')}: ${format(endDate, 'PPP')}`);
    const filterTitle = filterTitleParts.join(' | ');

    const reportTranslations = {
        title: tIntakesReport('title'),
        noRecords: tIntakesReport('noRecords'),
        total: tIntakesReport('total'),
        table: {
            material: tIntakesReport('table.material'),
            vendor: tIntakesReport('table.vendor'),
            quantity: tIntakesReport('table.quantity'),
            date: tIntakesReport('table.date'),
        },
        itemTotal: tIntakesReport('itemTotal'),
        grandTotal: tIntakesReport('grandTotal'),
        uncategorized: tIntakesReport('uncategorized')
    };

    try {
        const result = await generateIntakesReport(enrichedData, filterTitle, clientTimezone, reportTranslations);

        if (result.success && result.reportContent) {
            const reportWindow = window.open('', '_blank');
            if (reportWindow) {
                reportWindow.document.write(result.reportContent);
                reportWindow.document.close();
                 reportWindow.onload = () => {
                    reportWindow.focus();
                    reportWindow.print();
                };
            } else {
                toast({
                    variant: 'destructive',
                    title: t('toasts.reportError.title'),
                    description: t('toasts.reportError.popupBlocked'),
                });
            }
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
  
  const selectOptions = allItems.map(item => ({
    value: item.id,
    label: `${item.item} (${item.vendorName})`,
  }));

  if (permissionLoading || !isClient) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('newIntake.title')}</CardTitle>
            <CardDescription>
              {t('newIntake.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess('intakes')) {
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
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>{t('newIntake.title')}</CardTitle>
                      <CardDescription>
                          {t('newIntake.description')}
                      </CardDescription>
                  </div>
                  <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                          <FormItem className="w-[240px]">
                              <FormLabel>{t('newIntake.dateLabel')}</FormLabel>
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <FormControl>
                                          <Button
                                              variant={"outline"}
                                              className={cn(
                                                  "w-full pl-3 text-left font-normal",
                                                  !field.value && "text-muted-foreground"
                                              )}
                                          >
                                              {field.value ? (
                                                  format(field.value, "PPP")
                                              ) : (
                                                  <span>{t('newIntake.datePlaceholder')}</span>
                                              )}
                                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                          </Button>
                                      </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          disabled={(date) =>
                                              date > new Date() || date < new Date("2000-01-01")
                                          }
                                          initialFocus
                                      />
                                  </PopoverContent>
                              </Popover>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-4 pt-2">
                    <div className="md:col-span-2">
                        <FormField
                            control={form.control}
                            name="materialId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('newIntake.materialLabel')}</FormLabel>
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            'w-full justify-between',
                                            !field.value && 'text-muted-foreground'
                                        )}
                                        >
                                        {field.value
                                            ? selectOptions.find(
                                                (option) => option.value === field.value
                                            )?.label
                                            : t('newIntake.materialPlaceholder')}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder={t('newIntake.materialSearchPlaceholder')} />
                                        <CommandList>
                                        <CommandEmpty>{t('newIntake.materialEmpty')}</CommandEmpty>
                                        <CommandGroup>
                                            {selectOptions.map((option) => (
                                            <CommandItem
                                                value={option.label}
                                                key={option.value}
                                                onSelect={() => {
                                                form.setValue('materialId', option.value === field.value ? '' : option.value);
                                                setOpen(false)
                                                }}
                                            >
                                                <Check
                                                className={cn(
                                                    'mr-2 h-4 w-4',
                                                    option.value === field.value
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
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <div>
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('newIntake.quantityLabel')}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder={t('newIntake.quantityPlaceholder')}
                                    step="0.01"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(value === '' ? undefined : value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <div>
                        <FormField
                            control={form.control}
                            name="scale"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('newIntake.scaleLabel')}</FormLabel>
                                <FormControl>
                                    <Input {...field} value={field.value || ''} readOnly className="w-full bg-muted" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">{t('newIntake.submitButton')}</Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('report.title')}</CardTitle>
          <CardDescription>{t('report.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">{t('report.startDateLabel')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date"
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">{t('report.endDateLabel')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date"
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {t('report.printButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('history.title')}</CardTitle>
          <CardDescription>
            {t('history.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('history.table.material')}</TableHead>
                  <TableHead>{t('history.table.vendor')}</TableHead>
                  <TableHead className="text-right">{t('history.table.quantity')}</TableHead>
                  <TableHead>{t('history.table.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intakes.length > 0 ? (
                  intakes.slice(0, 20).map((intake, index) => {
                     const material = allItems.find(item => item.id === intake.materialId || item.sku === intake.materialId);
                     return (
                       <TableRow key={index}>
                          <TableCell className="font-medium">{material?.item || 'Unknown'}</TableCell>
                          <TableCell>{material?.vendorName || 'Unknown'}</TableCell>
                          <TableCell className="text-right">{formatNumber(intake.quantity)} {intake.scale || material?.scale}</TableCell>
                          <TableCell>{intake.date ? format(toDateSafe(intake.date)!, 'MMM-dd-yy') : ''}</TableCell>
                       </TableRow>
                     )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      {t('history.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
    