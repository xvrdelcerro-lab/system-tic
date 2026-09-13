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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProductCategories } from '@/hooks/use-product-categories';
import type { ProductCategory } from '@/hooks/use-product-categories';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { ProtectedPage } from '@/components/protected-page';

const useCategorySchema = (t: ReturnType<typeof useTranslations>) => {
  return useMemo(() => z.object({
    name: z.string().min(1, t('validation.nameRequired')),
  }), [t]);
};

type CategoryFormValues = z.infer<ReturnType<typeof useCategorySchema>>;

export default function ProductCategoriesPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  const t = useTranslations('ProductCategoriesPage');
  const tCommon = useTranslations('ProtectedPage');
  const tData = useTranslations('DefaultData.ProductCategoriesData');

  const { toast } = useToast();
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useProductCategories();
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const categorySchema = useCategorySchema(t);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
  });

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const nameA = tData(a.name as any, {}, { default: a.name });
      const nameB = tData(b.name as any, {}, { default: b.name });
      return nameA.localeCompare(nameB);
    });
  }, [categories, tData]);

  const onSubmit = async (data: CategoryFormValues) => {
    if (categories.some(c => c.name.toLowerCase() === data.name.toLowerCase())) {
      form.setError('name', { message: t('toasts.alreadyExists') });
      return;
    }
    try {
      await createCategory(data.name);
      toast({
        title: t('toasts.saveSuccess.title'),
        description: t('toasts.saveSuccess.description', { categoryName: data.name }),
      });
      form.reset({ name: '' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.saveError'), description: e.message });
    }
  };

  const openEdit = (category: ProductCategory) => {
    setEditing(category);
    editForm.reset(category);
  };

  const submitEdit = async (data: CategoryFormValues) => {
    if (!editing) return;
    try {
      await updateCategory(editing.id, data.name);
      toast({
        title: t('toasts.updateSuccess.title'),
        description: t('toasts.updateSuccess.description', { categoryName: data.name }),
      });
      setEditing(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.updateError'), description: e.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteCategory(id);
      toast({
        title: t('toasts.deleteSuccess.title'),
        description: t('toasts.deleteSuccess.description', { categoryName: tData(name as any, {}, { default: name }) }),
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('toasts.deleteError'), description: e.message });
    }
  };

  if (permissionLoading || !isClient) {
    return (
      <ProtectedPage pageName="catalogs.products" pageTitle="Product Categories">
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
              <CardTitle>{t('newCategory.title')}</CardTitle>
              <CardDescription>{t('newCategory.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('existingCategories.title')}</CardTitle>
              <CardDescription>{t('existingCategories.description')}</CardDescription>
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

  if (!hasAccess('catalogs.products')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{tCommon('accessDenied.title')}</h1>
        <Alert variant="destructive">
          <AlertTitle>{tCommon('accessDenied.title')}</AlertTitle>
          <AlertDescription>{tCommon('accessDenied.description')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ProtectedPage pageName="catalogs.products" pageTitle="Product Categories">
      <div className="space-y-8">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
          </h1>
          <span className="text-3xl font-bold text-muted-foreground">
            {categories.length}
          </span>
        </div>

        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>{t('newCategory.title')}</CardTitle>
                <CardDescription>{t('newCategory.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t('newCategory.nameLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('newCategory.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">{t('newCategory.saveButton')}</Button>
                </div>
              </CardContent>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('existingCategories.title')}</CardTitle>
            <CardDescription>{t('existingCategories.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('existingCategories.table.name')}</TableHead>
                  <TableHead className="text-right">{t('existingCategories.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedCategories.length ? (
                  sortedCategories.map(category => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {tData(category.name as any, {}, { default: category.name })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
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
                                    categoryName: tData(category.name as any, {}, { default: category.name }),
                                    strong: (chunks) => <strong>{chunks}</strong>,
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleDelete(category.id, category.name)}
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
                    <TableCell colSpan={2} className="text-center">
                      {t('existingCategories.empty')}
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
                  <DialogDescription>{t('editDialog.description')}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('newCategory.nameLabel')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
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
