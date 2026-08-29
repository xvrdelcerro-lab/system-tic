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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { formatNumber, cn } from '@/lib/utils';
import { Loader2, Printer, Check, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { useProduction } from '@/hooks/use-production';
import { useToast } from '@/hooks/use-toast';
import { generateIntakesReport, type EnrichedIntake } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useInventory } from '@/hooks/use-inventory';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { toDateSafe } from '@/lib/date';
import { Calendar } from '@/components/ui/calendar';
import { ProtectedPage } from '@/components/protected-page';

export default function IntakesReportPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('IntakesReportPage');
  const tCommon = useTranslations('ProtectedPage');
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { intakes } = useProduction();
  const { allItems } = useInventory();
  const { toast } = useToast();

  const [materialId, setMaterialId] = useState('all');
  const [vendorId, setVendorId] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const { vendors } = useInventory();
  const materialSelectOptions = useMemo(() => ([
    { value: 'all', label: t('allMaterialsOption') },
    ...allItems.map(p => ({ value: p.id, label: `${p.item} (${p.vendorName})` })),
  ]), [allItems, t]);
  
  const vendorSelectOptions = useMemo(() => ([
    { value: 'all', label: t('allVendorsOption') },
    ...vendors.map(v => ({ value: v.id, label: v.name })),
  ]), [vendors, t]);

  const { filteredRecords, filterTitle } = useMemo(() => {
    let result = intakes;
    let titleParts: string[] = [];

    const material = allItems.find(p => p.id === materialId);
    if (material) {
      titleParts.push(`${t('materialLabel')}: ${material.item}`);
    }
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
        titleParts.push(`${t('vendorLabel')}: ${vendor.name}`);
    }
    
    if (startDate) {
        titleParts.push(`${t('startDateLabel')}: ${format(startDate, 'MMM-dd-yy')}`);
    }
    if (endDate) {
        titleParts.push(`${t('endDateLabel')}: ${format(endDate, 'MMM-dd-yy')}`);
    }

    if (materialId && materialId !== 'all') {
      result = result.filter(r => r.materialId === materialId);
    }
    if (vendorId && vendorId !== 'all') {
      const vendorItems = allItems.filter(item => item.vendorId === vendorId).map(item => item.id);
      result = result.filter(r => vendorItems.includes(r.materialId));
    }
    
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter(r => toDateSafe(r.date)! >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        result = result.filter(r => toDateSafe(r.date)! <= end);
    }

    return {
        filteredRecords: result.sort((a,b) => toDateSafe(b.date)!.getTime() - toDateSafe(a.date)!.getTime()),
        filterTitle: titleParts.join(' | ')
    };
  }, [intakes, materialId, vendorId, startDate, endDate, allItems, vendors, t]);

  const enrichedRecords: EnrichedIntake[] = useMemo(() => {
    return filteredRecords.map(intake => {
        const material = allItems.find(item => item.id === intake.materialId);
        return {
            date: intake.date instanceof Date ? intake.date.toISOString() : intake.date,
            materialName: material?.item || 'Unknown Material',
            vendorName: material?.vendorName || 'Unknown Vendor',
            quantity: intake.quantity,
            scale: intake.scale || material?.scale || ''
        }
    })
  }, [filteredRecords, allItems]);


  const handleGenerateReport = async () => {
    setIsGenerating(true);
    const reportTranslations = {
      title: t('title'),
      table: {
        date: t('table.date'),
        material: t('table.material'),
        vendor: t('table.vendor'),
        quantity: t('table.quantity'),
      },
      noRecords: t('emptyLog')
    };

    const result = await generateIntakesReport(enrichedRecords, filterTitle, clientTimezone, reportTranslations);
    setIsGenerating(false);

    if (result.success && result.reportContent) {
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
      } else {
        toast({
            variant: 'destructive',
            title: t('toasts.popupBlockedTitle'),
            description: t('toasts.popupBlockedDescription'),
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: t('toasts.printErrorTitle'),
        description: result.error || t('toasts.printErrorDescription'),
      });
    }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.intakes" pageTitle={t('title')}>

      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>{t('logDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.intakes')) {
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
    <ProtectedPage pageName="reports.intakes" pageTitle={t('title')}>
<div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
      </div>

      <Card>
        <form>
          <CardHeader>
            <CardTitle>{t('filterTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Row 1: Dates and Button */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2 w-full">
                  <Label htmlFor="start-date">{t('startDateLabel')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="start-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}> 
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>{t('pickDatePlaceholder')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 w-full">
                  <Label htmlFor="end-date">{t('endDateLabel')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="end-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}> 
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>{t('pickDatePlaceholder')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4 md:mt-0 w-full flex md:justify-end">
                  <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    {t('generateButton')}
                  </Button>
                </div>
              </div>
              {/* Row 2: Material and Vendor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2 w-full">
                  <Label>{t('materialLabel')}</Label>
                  <Popover open={materialPopoverOpen} onOpenChange={setMaterialPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !materialId && "text-muted-foreground"
                        )}
                      >
                        {materialId && materialId !== 'all'
                          ? materialSelectOptions.find(
                              (option) => option.value === materialId
                            )?.label
                          : t('materialPlaceholder')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder={t('searchMaterialPlaceholder')} />
                        <CommandList>
                          <CommandEmpty>{t('noMaterialFound')}</CommandEmpty>
                          <CommandGroup>
                            {materialSelectOptions.map((option) => (
                              <CommandItem
                                value={option.label}
                                key={option.value}
                                onSelect={() => {
                                  setMaterialId(option.value);
                                  setMaterialPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    option.value === materialId
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
                </div>
                <div className="space-y-2 w-full">
                {/* Empty cell for alignment with button above */}
                <div className="hidden md:block"></div>
                  <Label>{t('vendorLabel')}</Label>
                  <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !vendorId && "text-muted-foreground"
                        )}
                      >
                        {vendorId && vendorId !== 'all'
                          ? vendorSelectOptions.find(
                              (option) => option.value === vendorId
                            )?.label
                          : t('vendorPlaceholder')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder={t('searchVendorPlaceholder')} />
                        <CommandList>
                          <CommandEmpty>{t('noVendorFound')}</CommandEmpty>
                          <CommandGroup>
                            {vendorSelectOptions.map((option) => (
                              <CommandItem
                                value={option.label}
                                key={option.value}
                                onSelect={() => {
                                  setVendorId(option.value);
                                  setVendorPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    option.value === vendorId
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
                </div>
              </div>
            </div>
          </CardContent>
        </form>
      </Card>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>{t('logDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.date')}</TableHead>
                    <TableHead>{t('table.material')}</TableHead>
                    <TableHead>{t('table.vendor')}</TableHead>
                    <TableHead className="text-right">{t('table.quantity')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedRecords.length > 0 ? (
                    enrichedRecords.slice(0, 20).map((rec, i) => (
                      <TableRow key={`${rec.date}-${rec.materialName}-${i}`}>
                        <TableCell>{format(new Date(rec.date), 'MMM-dd-yy')}</TableCell>
                        <TableCell className="font-medium">{rec.materialName}</TableCell>
                        <TableCell>{rec.vendorName}</TableCell>
                        <TableCell className="text-right">{`${formatNumber(rec.quantity)} ${rec.scale}`}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {t('emptyLog')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}