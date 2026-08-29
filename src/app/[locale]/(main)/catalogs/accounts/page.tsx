'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import React, { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, FileText, Loader2, Pencil, Trash2, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateAccountsReport } from './actions';
import { useAccounts, type Account, type AccountCategory } from '@/hooks/use-accounts';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProtectedPage } from '@/components/protected-page';

const useAccountSchemas = (t: ReturnType<typeof useTranslations>) => {
    const categorySchema = useMemo(() => z.object({
        name: z.string().min(1, t('validation.categoryNameRequired')),
    }), [t]);

    const accountSchema = useMemo(() => z.object({
        name: z.string().min(1, t('validation.accountNameRequired')),
        description: z.string().optional(),
        type: z.string().min(1, 'Type is required.'), 
        category: z.string().min(1, t('validation.categoryRequired')),
    }), [t]);

    return { categorySchema, accountSchema };
};

export default function AccountsPage() {
    const t = useTranslations('AccountsPage');
  const tData = useTranslations('DefaultData');
  const locale = useLocale();
  const { toast } = useToast();
  
  const { 
    accountCategories, 
    uncategorizedAccounts,
    allAccounts,
    loading, 
    createCategory,
    updateCategory,
    deleteCategory,
    createAccount,
    updateAccount,
    deleteAccount
  } = useAccounts();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const { categorySchema, accountSchema } = useAccountSchemas(t);

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' }
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
  });

  const handleReport = async () => {
    setIsGenerating(true);
    
    const hasGrandTotal = t.has('manageAccounts.grandTotal');
    const hasUncategorized = t.has('uncategorized.title');

    const translations = {
        title: t('title'),
        nameHeader: t('account.table.nameHeader'),
        descriptionHeader: t('account.table.descriptionHeader'),
        typeHeader: t('account.table.typeHeader'),
        totalLabel: hasGrandTotal ? t('manageAccounts.grandTotal') : "Grand Total", 
        uncategorizedLabel: hasUncategorized ? t('uncategorized.title') : "Uncategorized",
        generatedAt: new Date().toLocaleString(locale, { 
          dateStyle: 'long', 
          timeStyle: 'short' 
        }),
        DefaultData: {
          AccountCategories: tData.raw('AccountCategories'),
          Accounts: tData.raw('Accounts'),
          AccountTypes: tData.raw('AccountTypes')
        }
    };

    try {
        const result = await generateAccountsReport(
            Intl.DateTimeFormat().resolvedOptions().timeZone, 
            locale,
            translations
        );
        
        if (result.success && result.reportContent) {
          const reportWindow = window.open();
          if (reportWindow) {
            reportWindow.document.write(result.reportContent);
            reportWindow.document.close();
          }
        } else {
            toast({ variant: 'destructive', title: t('generateReport.errorTitle'), description: result.error });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: t('generateReport.errorTitle'), description: error.message });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleOpenCategoryDialog = (category?: AccountCategory) => {
    setEditingCategory(category || null);
    categoryForm.reset({ name: category?.name || '' });
    setIsCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (data: z.infer<typeof categorySchema>) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data.name);
        toast({ title: t('category.toasts.updated') });
      } else {
        await createCategory(data.name);
        toast({ title: t('category.toasts.added'), description: t('category.toasts.addedDesc') });
      }
      setIsCategoryDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: editingCategory ? t('category.toasts.updateError') : t('category.toasts.addError'), description: e.message });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      toast({ title: t('category.toasts.deleted'), description: t('category.toasts.deletedDesc') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('category.toasts.deleteError'), description: e.message });
    }
  };

  const handleOpenAccountDialog = (account?: Account | null, categoryName?: string) => {
    if (account?.isSystem) {
      toast({
        variant: 'destructive',
        title: 'System Account',
        description: 'This account is required for reports and cannot be modified.',
      });
      return;
    }
    
    setEditingAccount(account || null);
    accountForm.reset({
        name: account?.name || '',
        description: account?.description || '',
        type: account?.type || 'Expense',
        category: account?.category || categoryName || ''
    });
    setIsAccountDialogOpen(true);
  };
  
  const handleAccountSubmit = async (data: z.infer<typeof accountSchema>) => {
    try {
      if(editingAccount) {
        await updateAccount(editingAccount.id, data);
        toast({ title: t('account.toasts.updated'), description: t('account.toasts.updatedDesc') });
      } else {
        await createAccount(data);
        toast({ title: t('account.toasts.added'), description: t('account.toasts.addedDesc') });
      }
      setIsAccountDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: editingAccount ? t('account.toasts.updateError') : t('account.toasts.addError'), description: e.message });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const account = allAccounts.find(a => a.id === id);
    if (account?.isSystem) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete',
        description: 'This is a system account required for reports.',
      });
      return;
    }
    
    try {
        await deleteAccount(id);
        toast({ title: t('account.toasts.deleted'), description: t('account.toasts.deletedDesc') });
    } catch(e: any) {
        toast({ variant: 'destructive', title: t('account.toasts.deleteError'), description: e.message });
    }
  };

  return (
    <ProtectedPage pageName="catalogs.accounts" pageTitle="Accounts">
<TooltipProvider>
    <div className="flex flex-col gap-6 p-4 md:p-8 min-h-screen">
      <div className="flex justify-between items-center">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <span className="text-3xl font-bold text-muted-foreground">{allAccounts.length}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReport} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <FileText className="h-4 w-4 mr-2" />}
            {t('generateReport.button')}
          </Button>
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <Button onClick={() => handleOpenCategoryDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('newCategoryButton')}
              </Button>
            <DialogContent>
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)}>
                  <DialogHeader>
                    <DialogTitle>{editingCategory ? t('category.editDialog.title') : t('category.addDialog.title')}</DialogTitle>
                    {!editingCategory && <DialogDescription>{t('category.addDialog.description')}</DialogDescription>}
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <FormField
                      control={categoryForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('category.addDialog.nameLabel')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('category.addDialog.namePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">{editingCategory ? t('category.editDialog.saveButton') : t('category.addDialog.saveButton')}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>{t('manageAccounts.title')}</CardTitle>
            <CardDescription>{t('manageAccounts.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
            ) : (
                <ScrollArea className="h-[65vh]">
                    <div className="space-y-6 pr-4">
                        {accountCategories.map((cat) => (
                            <div key={cat.id} className="border-b pb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                      {tData(`AccountCategories.${cat.name}` as any, {}, { default: cat.name })}
                                      <span className="text-base font-normal text-muted-foreground">({cat.accounts.length})</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCategoryDialog(cat)}><Pencil className="h-4 w-4 text-muted-foreground"/></Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('category.deleteDialog.title')}</AlertDialogTitle>
                                                <AlertDialogDescription>{t('category.deleteDialog.description')}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('category.deleteDialog.cancel')}</AlertDialogCancel>
                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteCategory(cat.id)}>{t('category.deleteDialog.delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </h3>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenAccountDialog(null, cat.name)}>
                                        <Plus className="h-4 w-4 mr-2"/>
                                        {t('account.addButton')}
                                    </Button>
                                </div>
                                {cat.accounts.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('account.table.nameHeader')}</TableHead>
                                                <TableHead>{t('account.table.descriptionHeader')}</TableHead>
                                                <TableHead>{t('account.table.typeHeader')}</TableHead>
                                                <TableHead className="text-right">{t('account.table.actionsHeader')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cat.accounts.map((acc) => (
                                                <TableRow key={acc.id}>
                                                    <TableCell className="font-medium">
                                                      <div className="flex items-center gap-2">
                                                        {acc.isSystem && (
                                                          <Tooltip>
                                                            <TooltipTrigger>
                                                              <Lock className="h-4 w-4 text-blue-600" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                              <p>System account - Required for reports</p>
                                                            </TooltipContent>
                                                          </Tooltip>
                                                        )}
                                                        {tData(`Accounts.${acc.name}.name` as any, {}, { default: acc.name })}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{tData(`Accounts.${acc.name}.description` as any, {}, { default: acc.description })}</TableCell>
                                                    <TableCell>{tData(`AccountTypes.${acc.type}` as any, {}, {default: acc.type})}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <span>
                                                              <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleOpenAccountDialog(acc)}
                                                                disabled={acc.isSystem}
                                                              >
                                                                <Pencil className="h-4 w-4"/>
                                                              </Button>
                                                            </span>
                                                          </TooltipTrigger>
                                                          {acc.isSystem && (
                                                            <TooltipContent>
                                                              <p>Cannot edit system accounts</p>
                                                            </TooltipContent>
                                                          )}
                                                        </Tooltip>
                                                        <AlertDialog>
                                                          <Tooltip>
                                                            <TooltipTrigger asChild>
                                                              <span>
                                                                <AlertDialogTrigger asChild>
                                                                  <Button 
                                                                    variant="ghost" 
                                                                    size="icon"
                                                                    disabled={acc.isSystem}
                                                                  >
                                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                                  </Button>
                                                                </AlertDialogTrigger>
                                                              </span>
                                                            </TooltipTrigger>
                                                            {acc.isSystem && (
                                                              <TooltipContent>
                                                                <p>Cannot delete system accounts</p>
                                                              </TooltipContent>
                                                            )}
                                                          </Tooltip>
                                                          <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>{t('account.deleteDialog.title')}</AlertDialogTitle><AlertDialogDescription>{t('account.deleteDialog.description')}</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>{t('account.deleteDialog.cancel')}</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteAccount(acc.id)}>{t('account.deleteDialog.delete')}</AlertDialogAction></AlertDialogFooter>
                                                          </AlertDialogContent>
                                                        </AlertDialog>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : <p className="text-sm text-muted-foreground p-4 text-center">{t('account.table.noAccounts')}</p>}
                            </div>
                        ))}

                        {uncategorizedAccounts.length > 0 && (
                             <div className="border border-amber-500 rounded-lg p-4 bg-amber-50">
                                <h3 className="text-lg font-semibold text-amber-700">{t('uncategorized.warningTitle')}</h3>
                                <p className="text-sm text-amber-600 mb-4">{t('uncategorized.warningDescription')}</p>
                                <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>{t('account.table.nameHeader')}</TableHead>
                                          <TableHead>{t('account.table.descriptionHeader')}</TableHead>
                                          <TableHead className="text-right">{t('account.table.actionsHeader')}</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {uncategorizedAccounts.map((acc) => (
                                      <TableRow key={acc.id}>
                                          <TableCell className="font-medium">{acc.name}</TableCell>
                                          <TableCell className="text-muted-foreground">{acc.description}</TableCell>
                                          <TableCell className="text-right">
                                              <Button variant="ghost" size="icon" onClick={() => handleOpenAccountDialog(acc)}><Pencil className="h-4 w-4"/></Button>
                                          </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                             </div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </CardContent>
      </Card>
      
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)}>
              <DialogHeader>
                <DialogTitle>{editingAccount ? t('account.editDialog.title') : t('account.addDialog.title')} {accountForm.getValues('category')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField control={accountForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('account.addDialog.nameLabel')}</FormLabel><FormControl><Input placeholder={t('account.addDialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={accountForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('account.addDialog.descriptionLabel')}</FormLabel><FormControl><Textarea placeholder={t('account.addDialog.descriptionPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={accountForm.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('account.editDialog.categoryLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder={t('account.editDialog.categoryPlaceholder')} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {accountCategories.map(c => <SelectItem key={c.id} value={c.name}>{tData(`AccountCategories.${c.name}` as any, {}, { default: c.name })}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={accountForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('account.table.typeHeader')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Income">{tData('AccountTypes.Income')}</SelectItem>
                          <SelectItem value="Expense">{tData('AccountTypes.Expense')}</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
              <DialogFooter>
                <Button type="submit">{editingAccount ? t('account.editDialog.saveButton') : t('account.addDialog.saveButton')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
    </ProtectedPage>
  );
}