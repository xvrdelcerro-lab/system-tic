'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCustomers } from '@/hooks/use-customers';
import { useProducts } from '@/hooks/use-products';
import { PlusCircle, Trash2, Loader2, FileText, Pencil, Printer, ChevronsUpDown, Check, AlertCircle, CalendarIcon } from 'lucide-react';
import { generateInvoiceAction, getInvoiceReportData } from './actions';
import { cn, formatCurrency } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useProduction } from '@/hooks/use-production';
import { InputWithDecimals } from '@/components/ui/input-with-decimals';
import { createRoot } from 'react-dom/client';
import { InvoiceTemplate } from './invoice-template';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toDateSafe } from '@/lib/date';
import type { Invoice } from '@/lib/types';
import { useTranslations, useLocale } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { ProtectedPage } from '@/components/protected-page';

export default function InvoicesPage() {
  const { toast } = useToast();
  const t = useTranslations('InvoicesPage');
  const tpl = useTranslations('InvoiceTemplate');
  const { invoices, addInvoice } = useProduction();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isReportPopoverOpen, setIsReportPopoverOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const locale = useLocale();
  const dateFnsLocale = locale === 'es' ? es : undefined;
  
  const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    setIsClient(true);
  }, []);

  const lineItemSchema = useMemo(() => z.object({
    productId: z.string().min(1, t('validation.productRequired')),
    description: z.string().min(1, t('validation.descriptionRequired')),
    quantity: z.coerce.number().int(t('validation.quantityInt')).min(1, t('validation.quantityMin')),
    price: z.coerce.number().min(0, t('validation.pricePositive')),
  }), [t]);

  const invoiceFormSchema = useMemo(() => z.object({
    customerId: z.string().min(1, t('validation.customerRequired')),
    invoiceType: z.enum(['proforma', 'invoice']),
    invoiceNumber: z.string().min(1, t('validation.invoiceNumberRequired')),
    invoiceDate: z.date({
      required_error: t('validation.invoiceDateRequired'),
    }),
    dueDate: z.date({
      required_error: t('validation.dueDateRequired'),
    }),
    lineItems: z.array(lineItemSchema).min(1, t('validation.lineItemsRequired')),
    discount: z.coerce.number().optional(),
    tax: z.coerce.number().optional(),
    notes: z.string().optional(),
  }), [t, lineItemSchema]);

  const reportFormSchema = useMemo(() => z.object({
    invoiceId: z.string().min(1, t('validation.invoiceIdRequired')),
  }), [t]);
  
  const discountSchema = useMemo(() => z.object({
    discount: z.coerce.number().min(0, t('validation.discountPositive')).optional(),
  }), [t]);
  
  const taxSchema = useMemo(() => z.object({
    tax: z.coerce.number().min(0, t('validation.taxPositive')).optional(),
  }), [t]);


  type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

  const defaultInvoiceValues: InvoiceFormValues = {
    customerId: '',
    invoiceType: 'invoice',
    invoiceNumber: `INV-${new Date().getFullYear()}-`,
    invoiceDate: new Date(),
    dueDate: addDays(new Date(), 5),
    lineItems: [{ productId: '', description: '', quantity: 1, price: 0 }],
    discount: 0,
    tax: 10,
    notes: t('notesCard.defaultNote'),
  };

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaultInvoiceValues,
    mode: 'onBlur',
  });

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      invoiceId: '',
    },
  });
  
  const discountForm = useForm<z.infer<typeof discountSchema>>({
    resolver: zodResolver(discountSchema),
  });

  const taxForm = useForm<z.infer<typeof taxSchema>>({
    resolver: zodResolver(taxSchema),
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });
  
  const watchedInvoiceNumber = form.watch('invoiceNumber');
  const lineItems = form.watch('lineItems');
  const discount = form.watch('discount');
  const tax = form.watch('tax');

  const subtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  const discountedTotal = subtotal - (discount || 0);
  const total = discountedTotal * (1 + (tax || 0) / 100);
  
  useEffect(() => {
    discountForm.setValue('discount', discount);
  }, [discount, discountForm]);
  
  useEffect(() => {
    taxForm.setValue('tax', tax);
  }, [tax, taxForm]);
  
  useEffect(() => {
    if (invoices.some(inv => inv.invoiceNumber.toLowerCase() === watchedInvoiceNumber.toLowerCase())) {
        form.setError('invoiceNumber', { type: 'manual', message: t('validation.invoiceNumberExists') });
    } else {
        form.clearErrors('invoiceNumber');
    }
  }, [watchedInvoiceNumber, invoices, form, t]);

  const reportTranslations = {
    invoiceNumber: tpl('invoiceNumber'),
    issued: tpl('issued'),
    due: tpl('due'),
    billTo: tpl('billTo'),
    description: tpl('description'),
    quantity: tpl('quantity'),
    unitPrice: tpl('unitPrice'),
    totalHeader: tpl('totalHeader'),
    subtotal: tpl('subtotal'),
    discount: tpl('discount'),
    tax: tpl('tax'),
    grandTotal: tpl('grandTotal'),
    notes: tpl('notes')
  };

  const onSubmit = async (data: InvoiceFormValues) => {
    setIsGenerating(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      toast({
        variant: "destructive",
        title: t('toasts.generateError'),
        description: t('toasts.timeoutError'),
      });
      setIsGenerating(false);
    }, 20000);

    try {
        const existingInvoiceNumbers = invoices.map(inv => inv.invoiceNumber);
        
        const result = await generateInvoiceAction(data, existingInvoiceNumbers);

        if (result.success && result.validatedData) {
          const dataForDb = {
            ...result.validatedData,
            invoiceDate: toDateSafe(result.validatedData.invoiceDate),
            dueDate: toDateSafe(result.validatedData.dueDate),
          };
          await addInvoice(dataForDb as Omit<Invoice, 'id'>);
          
          toast({
              title: t('toasts.generateSuccess'),
              description: t('toasts.generateSuccessDesc', {invoiceNumber: result.validatedData.invoiceNumber})
          });

          const reportWindow = window.open('', '_blank');
          if (reportWindow) {
            reportWindow.document.write('<div id="invoice-root"></div>');
            reportWindow.document.close();
            reportWindow.onload = () => {
                const invoiceRootEl = reportWindow.document.getElementById('invoice-root');
                if (invoiceRootEl) {
                    const root = createRoot(invoiceRootEl);
                    root.render(<InvoiceTemplate {...result.validatedData} translations={reportTranslations} />);
                }
                setTimeout(() => {
                    reportWindow.focus();
                    reportWindow.print();
                }, 200);
            };
          }
          form.reset(defaultInvoiceValues);

        } else {
          throw new Error(result.error || 'An unknown server error occurred.');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        if (error instanceof Error && error.name !== 'AbortError') {
          toast({
              variant: "destructive",
              title: t('toasts.generateError'),
              description: message,
          });
        }
    } finally {
        clearTimeout(timeout);
        setIsGenerating(false);
    }
  };

  const handleGenerateReport = async (data: z.infer<typeof reportFormSchema>) => {
    if (!data.invoiceId) {
      toast({
        variant: 'destructive',
        title: t('toasts.reportSelectionError'),
        description: t('toasts.reportSelectionErrorDesc'),
      });
      return;
    }
    
    setIsReportGenerating(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
        toast({
            variant: "destructive",
            title: t('toasts.reportError'),
            description: t('toasts.reportTimeoutError'),
        });
        setIsReportGenerating(false);
    }, 20000);

    try {
      const formData = new FormData();
      formData.append('invoiceId', data.invoiceId);
      
      const result = await getInvoiceReportData(formData, invoices);

      if (result.success && result.reportData) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.write('<div id="invoice-root"></div>');
            reportWindow.document.close();
            reportWindow.onload = () => {
                const invoiceRootEl = reportWindow.document.getElementById('invoice-root');
                if (invoiceRootEl) {
                    const root = createRoot(invoiceRootEl);
                    root.render(<InvoiceTemplate {...result.reportData as any} translations={reportTranslations} />);
                }
                setTimeout(() => {
                    reportWindow.focus();
                    reportWindow.print();
                }, 200);
            };
        }
      } else {
        throw new Error(result.error || "An unknown error occurred while generating the report.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            variant: 'destructive',
            title: t('toasts.reportError'),
            description: message,
        });
      }
    } finally {
        clearTimeout(timeout);
        setIsReportGenerating(false);
    }
  };
  
  const handleDiscountSave = (data: z.infer<typeof discountSchema>) => {
    form.setValue('discount', data.discount);
    setIsDiscountDialogOpen(false);
  };
  
  const handleTaxSave = (data: z.infer<typeof taxSchema>) => {
    form.setValue('tax', data.tax);
    setIsTaxDialogOpen(false);
  };
  
  const handleProductSelect = (value: string, index: number) => {
    const product = sortedProducts.find(p => p.id === value);
    if (product) {
      form.setValue(`lineItems.${index}.productId`, product.id);
      form.setValue(`lineItems.${index}.description`, product.name);
      form.setValue(`lineItems.${index}.price`, product.salePrice);
    }
  };
  
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(invoice => {
        const invoiceDate = toDateSafe(invoice.invoiceDate);
        if (!invoiceDate) return false;
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (invoiceDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (invoiceDate > end) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const dateA = toDateSafe(a.invoiceDate)?.getTime() ?? 0;
        const dateB = toDateSafe(b.invoiceDate)?.getTime() ?? 0;
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
  }, [invoices, startDate, endDate]);
  
  const reportSelectOptions = filteredInvoices.map((invoice) => ({
      value: invoice.id,
      label: invoice.invoiceNumber,
    }));

  if (!isClient) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t('title')}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('createCard.title')}</CardTitle>
            <CardDescription>Loading form...</CardDescription>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <ProtectedPage pageName="invoices" pageTitle="Invoices">
      <div className="space-y-8">
        <Alert variant="default" className="block md:hidden">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('mobileWarning.title')}</AlertTitle>
          <AlertDescription>
            {t('mobileWarning.description')}
          </AlertDescription>
        </Alert>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card>
                  <CardHeader>
                      <CardTitle>{t('createCard.title')}</CardTitle>
                      <CardDescription>{t('createCard.description')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {/* Invoice Header */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('form.customerLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                    <FormControl>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t('form.customerPlaceholder')} />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {sortedCustomers.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                              control={form.control}
                              name="invoiceType"
                              render={({ field }) => (
                                  <FormItem>
                                  <FormLabel>{t('form.typeLabel')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder={t('form.typePlaceholder')} />
                                      </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                          <SelectItem value="invoice">{t('form.finalInvoice')}</SelectItem>
                                          <SelectItem value="proforma">{t('form.proforma')}</SelectItem>
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>{t('form.invoiceNumberLabel')}</FormLabel>
                                  <FormControl><Input placeholder={t('form.invoiceNumberPlaceholder')} {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}/>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>{t('form.invoiceDateLabel')}</FormLabel>
                                  <Popover>
                                      <PopoverTrigger asChild>
                                          <FormControl>
                                              <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                  {field.value ? format(field.value, "PPP", { locale: dateFnsLocale }) : <span>Pick a date</span>}
                                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                              </Button>
                                          </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                                      </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                              </FormItem>
                          )}/>
                          <FormField control={form.control} name="dueDate" render={({ field }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>{t('form.dueDateLabel')}</FormLabel>
                                  <Popover>
                                      <PopoverTrigger asChild>
                                          <FormControl>
                                              <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                  {field.value ? format(field.value, "PPP", { locale: dateFnsLocale }) : <span>Pick a date</span>}
                                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                              </Button>
                                          </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                                      </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                              </FormItem>
                          )}/>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>{t('lineItemsCard.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {fields.map((item, index) => (
                          <div key={item.id} className="grid grid-cols-12 items-end gap-x-4 gap-y-2 p-4 border rounded-lg">
                              <div className="col-span-12 md:col-span-5">
                                  <FormField
                                      control={form.control}
                                      name={`lineItems.${index}.productId`}
                                      render={({ field }) => (
                                          <FormItem>
                                              <FormLabel>{t('lineItemsCard.productLabel')}</FormLabel>
                                              <Select onValueChange={(value) => handleProductSelect(value, index)} value={field.value}>
                                                  <FormControl>
                                                      <SelectTrigger>
                                                          <SelectValue placeholder={t('lineItemsCard.productPlaceholder')} />
                                                      </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent>
                                                      {sortedProducts.map(product => (
                                                          <SelectItem key={product.id} value={product.id}>
                                                              {product.name}
                                                          </SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                              <FormMessage />
                                          </FormItem>
                                      )}
                                  />
                              </div>
                            <div className="col-span-4 md:col-span-2">
                                  <FormField
                                      control={form.control}
                                      name={`lineItems.${index}.quantity`}
                                      render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>{t('lineItemsCard.quantityLabel')}</FormLabel>
                                          <FormControl>
                                          <Input type="number" placeholder="0" step="1" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                      </FormItem>
                                      )}
                                  />
                              </div>
                              <div className="col-span-4 md:col-span-2">
                                  <FormField
                                      control={form.control}
                                      name={`lineItems.${index}.price`}
                                      render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>{t('lineItemsCard.priceLabel')}</FormLabel>
                                          <FormControl>
                                              <InputWithDecimals
                                                  placeholder="$0.00"
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
                            <div className="col-span-4 md:col-span-2 text-right">
                                <FormLabel>{t('lineItemsCard.totalLabel')}</FormLabel>
                                <p className="p-2 h-10 font-mono text-sm">
                                    {formatCurrency(lineItems[index]?.quantity * lineItems[index]?.price || 0)}
                                </p>
                            </div>
                              <div className="col-span-12 md:col-span-1 flex justify-end">
                                  <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => remove(index)}
                                      disabled={fields.length <= 1}
                                  >
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                          </div>
                      ))}
                      <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => append({ productId: '', description: '', quantity: 1, price: 0 })}
                          >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          {t('lineItemsCard.addItemButton')}
                      </Button>
                  </CardContent>
                  <CardFooter className="flex flex-col items-end space-y-2">
                      <div className="w-full max-w-sm space-y-2">
                          <div className="flex justify-between items-center">
                              <span className="text-lg font-medium">{t('summary.subtotal')}</span>
                              <span className="text-right font-mono text-lg">{formatCurrency(subtotal)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-medium">{t('summary.discount')}</span>
                              <div className="flex items-center gap-2">
                                  <span className="text-right font-mono text-lg">{formatCurrency(discount || 0)}</span>
                                  <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
                                      <DialogTrigger asChild>
                                          <Button variant="outline" size="icon" className="h-7 w-7">
                                              <Pencil className="h-4 w-4" />
                                          </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-[425px]">
                                          <Form {...discountForm}>
                                              <form onSubmit={discountForm.handleSubmit(handleDiscountSave)}>
                                                  <DialogHeader>
                                                      <DialogTitle>{t('dialogs.discount.title')}</DialogTitle>
                                                  </DialogHeader>
                                                  <div className="py-4">
                                                      <FormField
                                                          control={discountForm.control}
                                                          name="discount"
                                                          render={({ field }) => (
                                                              <FormItem>
                                                                  <FormLabel>{t('dialogs.discount.label')}</FormLabel>
                                                                  <FormControl>
                                                                      <InputWithDecimals
                                                                          prefix="$"
                                                                          fixedDecimalScale={true}
                                                                          placeholder="0.00"
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
                                                  <DialogFooter>
                                                      <Button type="submit">{t('dialogs.discount.saveButton')}</Button>
                                                  </DialogFooter>
                                              </form>
                                          </Form>
                                      </DialogContent>
                                  </Dialog>
                              </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1 text-lg font-medium">
                                <span>{t('summary.tax')}</span>
                                <FormField
                                  control={form.control}
                                  name="tax"
                                  render={({ field }) => (
                                      <FormItem>
                                          <FormControl>
                                              <Input 
                                                  type="number" 
                                                  className="h-7 w-14 text-center p-1"
                                                  {...field}
                                                  onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                                              />
                                          </FormControl>
                                      </FormItem>
                                  )}
                                />
                                <span>%:</span>
                              </div>
                              <span className="text-right font-mono text-lg">{formatCurrency(discountedTotal * ((tax || 0) / 100))}</span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t">
                              <span className="font-bold text-xl">{t('summary.total')}</span>
                              <span className="text-right font-mono font-bold text-xl">{formatCurrency(total)}</span>
                          </div>
                      </div>
                  </CardFooter>
              </Card>
              
              <Card>
                  <CardHeader>
                      <CardTitle>{t('notesCard.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>{t('notesCard.label')}</FormLabel>
                              <FormControl>
                                  <Textarea
                                  placeholder={t('notesCard.placeholder')}
                                  className="min-h-[100px]"
                                  {...field}
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                  </CardContent>
              </Card>

              <div className="flex justify-start">
                  <Button type="submit" size="lg" disabled={isGenerating}>
                      {isGenerating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                          <FileText className="mr-2 h-4 w-4" />
                      )}
                      {t('generateButton')}
                  </Button>
              </div>
          </form>
        </Form>

        <Card>
          <Form {...reportForm}>
            <form onSubmit={reportForm.handleSubmit(handleGenerateReport)}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('reportCard.title')}</CardTitle>
                  <CardDescription>{t('reportCard.description')}</CardDescription>
                </div>
                <Button type="submit" disabled={isReportGenerating}>
                  {isReportGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  {t('reportCard.generateButton')}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-row items-end gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start-date">{t('reportCard.startDateLabel')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                      <Button
                        id="start-date"
                        variant={"outline"}
                        className={cn(
                        "w-[192px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP", { locale: dateFnsLocale }) : <span>{t('reportCard.pickDatePlaceholder')}</span>}
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
                    <Label htmlFor="end-date">{t('reportCard.endDateLabel')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                      <Button
                        id="end-date"
                        variant={"outline"}
                        className={cn(
                        "w-[192px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: dateFnsLocale }) : <span>{t('reportCard.pickDatePlaceholder')}</span>}
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
                  <div className="grid gap-2">
                    <Label>{t('reportCard.label')}</Label>
                    <FormField
                      control={reportForm.control}
                      name="invoiceId"
                      render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <Popover open={isReportPopoverOpen} onOpenChange={setIsReportPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                            "w-[200px] justify-between",
                            !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                            ? reportSelectOptions.find(
                              (option) => option.value === field.value
                              )?.label
                            : t('reportCard.selectPlaceholder')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                          <CommandInput placeholder={t('reportCard.searchPlaceholder')} />
                          <CommandList>
                            <CommandEmpty>{t('reportCard.empty')}</CommandEmpty>
                            <CommandGroup>
                            {reportSelectOptions.map((option) => (
                              <CommandItem
                              value={option.label}
                              key={option.value}
                              onSelect={() => {
                                reportForm.setValue("invoiceId", option.value);
                                setIsReportPopoverOpen(false);
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
                </div>
              </CardContent>
            </form>
          </Form>
        </Card>
      </div>
    </ProtectedPage>
  );
}