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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Printer, ChevronsUpDown, Check, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { generateCustomersReport } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Customer } from '@/lib/types';
import { useCustomers } from '@/hooks/use-customers';
import { useTranslations, useLocale } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

export default function CustomersPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const { toast } = useToast();
  const { customers, loading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const t = useTranslations('CustomersPage');
  const tCommon = useTranslations('ProtectedPage');
  const locale = useLocale();
  const [isClient, setIsClient] = useState(false);

  const customerFormSchema = useMemo(() => z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    address: z.string().min(1, t('validation.addressRequired')),
    phone: z.string().min(1, t('validation.phoneRequired')),
    city: z.string().min(1, t('validation.cityRequired')),
    website: z.string().url({ message: t('validation.urlInvalid') }).or(z.literal("")).optional(),
    email: z.string().email({ message: t('validation.emailInvalid') }).or(z.literal("")).optional(),
  }), [t]);

  const reportFormSchema = useMemo(() => z.object({
    itemId: z.string().min(1, t('validation.itemRequired')),
  }), [t]);

  type CustomerFormValues = z.infer<typeof customerFormSchema>;

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      city: '',
      website: '',
      email: '',
    },
  });

  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
  });

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      itemId: 'all',
    },
  });

  const reportSelectOptions = useMemo(() => [
    { value: 'all', label: t('reportDialog.allOption') },
    ...customers.map(customer => ({
      value: customer.id,
      label: customer.name,
    })),
  ], [customers, t]);

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      await createCustomer(data);
      toast({
        title: t('toasts.saved.title'),
        description: t('toasts.saved.description', { customerName: data.name }),
      });
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.saveError.title'), description: e.message });
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const selectedId = reportForm.getValues('itemId');
      const isSingle = selectedId !== 'all';
      const customer = isSingle ? customers.find(c => c.id === selectedId) : null;
      
      const title = isSingle && customer 
        ? t('report.profileTitle', { name: customer.name }) 
        : t('report.directoryTitle');

      const result = await generateCustomersReport({
        customerId: selectedId,
        isSingle: isSingle,
        clientTimezone: clientTimezone,
        title: title,
        translations: {
          directoryTitle: t('report.directoryTitle'),
          generatedDateLabel: t('report.generatedDateLabel'),
          nameLabel: t('customerList.table.name'),
          emailLabel: t('customerList.table.email'),
          phoneLabel: t('customerList.table.phone'),
          cityLabel: t('customerList.table.city'),
          addressLabel: t('form.addressLabel'),
          totalLabel: t('report.totalLabel'),
          websiteLabel: t('report.websiteLabel'),
          joinDateLabel: t('report.joinDateLabel'),
        }
      });

      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(result.reportContent);
          reportWindow.document.close();
          reportWindow.onload = () => {
            reportWindow.focus();
            reportWindow.print();
          };
        }
        setIsDialogOpen(false);
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

  const handleOpenEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    editForm.reset({
      name: customer.name,
      address: customer.address || '',
      phone: customer.phone || '',
      city: customer.city || '',
      website: customer.website || '',
      email: customer.contact.includes('@') ? customer.contact : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (data: CustomerFormValues) => {
      if (!editingCustomer) return;
      try {
        await updateCustomer(editingCustomer.id, data);
        toast({
            title: t('toasts.updated.title'),
            description: t('toasts.updated.description', { customerName: data.name })
        });
        setIsEditDialogOpen(false);
        setEditingCustomer(null);
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('toasts.updateError.title'), description: e.message });
      }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
        await deleteCustomer(customerId);
        toast({
            title: t('toasts.deleted.title'),
            description: t('toasts.deleted.description'),
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: t('toasts.deleteError.title'), description: e.message });
    }
  };
  
  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="catalogs.customers" pageTitle="Customers">

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('newCustomer.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('catalogs.customers')) {
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
    <ProtectedPage pageName="catalogs.customers" pageTitle="Customers">
<div className="space-y-8">
      <Alert variant="default" className="block md:hidden">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('mobileWarning.title')}</AlertTitle>
        <AlertDescription>
          {t('mobileWarning.description')}
        </AlertDescription>
      </Alert>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">{customers.length}</span>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('newCustomer.title')}</CardTitle>
                <CardDescription>
                  {t('newCustomer.description')}
                </CardDescription>
              </div>
              <Button type="submit">{t('newCustomer.saveButton')}</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.phoneLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.phonePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.emailLabel')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('form.emailPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.websiteLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.websitePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.addressLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.addressPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.cityLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.cityPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>{t('customerList.title')}</CardTitle>
            <CardDescription>
                {t('customerList.description')}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('customerList.table.name')}</TableHead>
                        <TableHead>{t('customerList.table.email')}</TableHead>
                        <TableHead>{t('customerList.table.phone')}</TableHead>
                        <TableHead>{t('customerList.table.city')}</TableHead>
                        <TableHead className="text-right">{t('customerList.table.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                         <TableRow>
                            <TableCell colSpan={5} className="text-center">
                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </TableCell>
                        </TableRow>
                    ) : customers.length > 0 ? customers.map(customer => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.contact}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell>{customer.city}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(customer)}>
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
                                                <AlertDialogDescription>
                                                    {t.rich('deleteDialog.description', {
                                                        customerName: customer.name,
                                                        strong: (chunks) => <strong>{chunks}</strong>,
                                                    })}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteCustomer(customer.id)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center">{t('customerList.empty')}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
              <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleEditSubmit)}>
                      <DialogHeader>
                          <DialogTitle>{t('editDialog.title', { customerName: editingCustomer?.name })}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                  control={editForm.control}
                                  name="name"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.nameLabel')}</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <FormField
                                  control={editForm.control}
                                  name="phone"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.phoneLabel')}</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                      </FormItem>
                                  )}
                              />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                  control={editForm.control}
                                  name="email"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.emailLabel')}</FormLabel>
                                      <FormControl><Input type="email" {...field} /></FormControl>
                                      <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <FormField
                                  control={editForm.control}
                                  name="website"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.websiteLabel')}</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                      </FormItem>
                                  )}
                              />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                  control={editForm.control}
                                  name="address"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.addressLabel')}</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <FormField
                                  control={editForm.control}
                                  name="city"
                                  render={({ field }) => (
                                      <FormItem>
                                      <FormLabel>{t('form.cityLabel')}</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
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