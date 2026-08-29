'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PrintUsersButton } from "./PrintUsersButton";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/components/providers/auth-provider';
import { sendPasswordReset } from '@/lib/auth';
import { canCreateUser, createUser, updateUser, deleteUser, listUsers } from './actions';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

type User = {
    uid: string;
    email: string;
    createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [canAddUser, setCanAddUser] = useState(false);
  const { user } = useAuth();
  const t = useTranslations('UsersPage');

  const { toast } = useToast();
  
  const editUserSchema = useMemo(() => z.object({
    uid: z.string().min(1),
    email: z.string().email({ message: t('validation.emailInvalid') }),
  }), [t]);

  const createUserSchema = useMemo(() => z.object({
    email: z.string().email({ message: t('validation.emailInvalid') }),
  }), [t]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const userList = await listUsers();
      setUsers(userList || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        variant: 'destructive',
        title: t('toasts.loadUsersError.title'),
        description: message,
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const checkCreationAbility = async () => {
    try {
        const can = await canCreateUser();
        setCanAddUser(can);
    } catch (e) {
        setCanAddUser(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    checkCreationAbility();
  }, []);

  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
  });

  const createForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '' }
  });
  
  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    editForm.reset({ uid: user.uid, email: user.email });
    setIsEditDialogOpen(true);
  };

  const onEditSubmit = async (data: z.infer<typeof editUserSchema>) => {
    const formData = new FormData();
    formData.append('uid', data.uid);
    formData.append('email', data.email);
    try {
      await updateUser(formData);
      toast({ title: t('toasts.updateSuccess.title') });
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
       toast({
        variant: "destructive",
        title: t('toasts.updateError.title'),
        description: error instanceof Error ? error.message : t('toasts.updateError.unknownError'),
      });
    }
  };

  const onCreateSubmit = async (data: z.infer<typeof createUserSchema>) => {
    setIsCreating(true);
    const formData = new FormData();
    formData.append('email', data.email);
    try {
        await createUser(formData);
        toast({ title: t('toasts.createSuccess.title') });
        createForm.reset();
        fetchUsers();
        checkCreationAbility(); // Re-check if user limit is reached
    } catch (error) {
        toast({
            variant: "destructive",
            title: t('toasts.createError.title'),
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
    } finally {
        setIsCreating(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const formData = new FormData();
    formData.append('uid', uid);
    try {
      await deleteUser(formData);
      toast({ title: t('toasts.deleteSuccess.title') });
      fetchUsers();
      checkCreationAbility();
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('toasts.deleteError.title'),
        description: error instanceof Error ? error.message : t('toasts.deleteError.unknownError'),
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
        toast({
            variant: "destructive",
            title: t('toasts.passwordResetError.title'),
            description: t('toasts.passwordResetError.noEmail'),
        });
        return;
    }
    setIsResettingPassword(true);
    try {
        await sendPasswordReset(user.email);
        toast({
            title: t('toasts.passwordResetSuccess.title'),
            description: t('toasts.passwordResetSuccess.description', { email: user.email }),
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: t('toasts.passwordResetError.title'),
            description: error instanceof Error ? error.message : t('toasts.passwordResetError.unknownError'),
        });
    } finally {
        setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
            {t('title')}
            </h1>
        </div>
        
        {canAddUser ? (
          <Card>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
                <CardHeader>
                  <CardTitle>{t('createUser.title')}</CardTitle>
                  <CardDescription>{t('createUser.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('createUser.emailLabel')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t('createUser.emailPlaceholder')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('createUser.createButton')}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Form>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('createUser.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('createUser.limitReached')}</p>
            </CardContent>
          </Card>
        )}

        <Card>
            <CardHeader>
                <CardTitle>{t('myAccount.title')}</CardTitle>
                <CardDescription>{t('myAccount.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                    <div className="flex-grow">
                        <Label>{t('myAccount.emailLabel')}</Label>
                        <div className="mt-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                            {user?.email ?? '...'}
                        </div>
                    </div>
                    <div>
                        <Button onClick={handlePasswordReset} disabled={isResettingPassword}>
                            {isResettingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t('myAccount.changePasswordButton')}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>{t('registeredUsers.title')}</CardTitle>
                    <CardDescription>{t('registeredUsers.description')}</CardDescription>
                </div>
                <PrintUsersButton />
            </CardHeader>
            <CardContent>
                {loading ? (
                <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : users.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                    {t('registeredUsers.noUsers')}
                </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">{t('registeredUsers.table.number')}</TableHead>
                                <TableHead>{t('registeredUsers.table.email')}</TableHead>
                                <TableHead>{t('registeredUsers.table.created')}</TableHead>
                                <TableHead className="text-right">{t('registeredUsers.table.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user, index) => (
                                <TableRow key={user.uid}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">{user.email}</TableCell>
                                    <TableCell>
                                        {user.createdAt
                                        ? format(new Date(user.createdAt), "MMM-dd-yy, p")
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)}>
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
                                                        {t.rich('deleteDialog.description', { email: user.email, strong: (chunks) => <strong>{chunks}</strong> })}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteUser(user.uid)}>{t('deleteDialog.delete')}</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>


        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
                <DialogHeader>
                    <DialogTitle>{t('editDialog.title')}</DialogTitle>
                    <DialogDescription>
                    {t('editDialog.description', { email: selectedUser?.email || '' })}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('editDialog.emailLabel')}</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <DialogFooter>
                    <Button type="submit">{t('editDialog.save')}</Button>
                </DialogFooter>
                </form>
            </Form>
            </DialogContent>
      </Dialog>
    </div>
  );
}
