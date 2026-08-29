'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Printer, Check, ChevronsUpDown } from 'lucide-react';
import { generateVendorsReport } from '@/app/[locale]/(main)/catalogs/vendors/actions';
import { useInventory } from '@/hooks/use-inventory';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useTranslations, useLocale } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const reportFormSchema = z.object({
  itemId: z.string().min(1, 'Please select a vendor.'),
});


export default function VendorReportsPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const { toast } = useToast();
  const { vendors } = useInventory();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const t = useTranslations('VendorsPage');
  const tCommon = useTranslations('ProtectedPage');
  const locale = useLocale();
  const tData = useTranslations('DefaultData');

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

  const handleGenerateReport = async (data: z.infer<typeof reportFormSchema>) => {
    setIsGenerating(true);
    const selectedId = data.itemId;
    const isSingle = selectedId !== 'all';
    
    const vendorsToPrint = isSingle ? vendors.filter(v => v.id === selectedId) : vendors;
    if (vendorsToPrint.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No vendor data to print.' });
      setIsGenerating(false);
      return;
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
          singleTitle: t('report.singleTitle', { name: vendorsToPrint[0]?.name }),
          allTitle: t('report.allTitle'),
          generatedDateLabel: t('report.generatedDateLabel'),
          noItems: t('report.noItems'),
          contactInfo: t('report.contactInfo'),
          itemsSupplied: t('report.itemsSupplied'),
          headers: t.raw('report.headers'),
        }
    });

    setIsGenerating(false);

    if (result.success && result.reportContent) {
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(result.reportContent);
        reportWindow.document.close();
      } else {
        toast({
          variant: 'destructive',
          title: 'Popup Blocked',
          description: 'Please allow popups to view the report.',
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'An unknown error occurred.',
      });
    }
  };
  
  const sortedVendors = [...vendors].sort((a,b) => a.name.localeCompare(b.name));
  
  const selectOptions = [
    { value: 'all', label: t('reportDialog.allOption') },
    ...sortedVendors.map(vendor => ({
      value: vendor.id,
      label: vendor.name,
    })),
  ];

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.vendors" pageTitle={t('title')}>

        <div className="space-y-8 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
                {t('title')}
            </h1>
            <Card>
                <CardHeader>
                  <CardTitle>{t('reportDialog.title')}</CardTitle>
                  <CardDescription>{t('reportDialog.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.vendors')) {
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
    <ProtectedPage pageName="reports.vendors" pageTitle={t('title')}>
<div className="space-y-8 max-w-2xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <p className="text-xl font-semibold text-muted-foreground">
          {t('totalVendors', { count: vendors.length })}
        </p>
      </div>

      <Card>
        <Form {...reportForm}>
          <form onSubmit={reportForm.handleSubmit(handleGenerateReport)}>
            <CardHeader>
              <CardTitle>{t('reportDialog.title')}</CardTitle>
              <CardDescription>
                {t('reportDialog.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
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
                                "w-[300px] justify-between",
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
                        <PopoverContent className="w-[300px] p-0">
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
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  {t('reportDialog.generateButton')}
                </Button>
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>
    </div>
    </ProtectedPage>
  );
}
