'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { db } from '@/firebase/config';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Shield, Copy, Users, ChevronDown, ChevronRight, Key, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { auth } from '@/firebase/config';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type Permission = {
  dashboard: boolean;
  catalogs: {
    enabled: boolean;
    accounts: boolean;
    customers: boolean;
    materialTypes: boolean;
    phases: boolean;
    products: boolean;
    rawMaterials: boolean;
    scales: boolean;
    vendors: boolean;
  };
  expenses: boolean;
  intakes: boolean;
  inventories: {
    enabled: boolean;
    products: boolean;
    rawMaterials: boolean;
  };
  invoices: boolean;
  production: boolean;
  reports: {
    enabled: boolean;
    accessLog: boolean;
    customers: boolean;
    intakes: boolean;
    production: boolean;
    products: boolean;
    rawMaterials: boolean;
    sales: boolean;
    invoices: boolean;
    vendors: boolean;
    waste: boolean;
    wasteAnalytics: boolean;
    expenses: boolean;
    profitLoss: boolean;
  };
  waste: {
    enabled: boolean;
    waste: boolean;
    analytics: boolean;
  };
};

type TeamMember = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  password?: string;
  permissions: Permission;
};

export default function TeamPage() {
  const t = useTranslations('TeamPage');
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  
  // Track which categories are expanded for each user
  const [expandedCategories, setExpandedCategories] = useState<Record<string, Record<string, boolean>>>({});
  
  // Track password visibility for each user
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // Track password editing state
  const [editingPassword, setEditingPassword] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await loadTeamMembers(user);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadTeamMembers(user: any) {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        console.error('User document not found for UID:', user.uid);
        setLoading(false);
        return;
      }
      
      const userData = userSnap.data();
      const userTenantId = userData.tenantId;
      
      if (!userTenantId) {
        console.error('No tenantId found in user document');
        setLoading(false);
        return;
      }
      
      setTenantId(userTenantId);
      
      const tenantDocRef = doc(db, 'Tenants', userTenantId);
      const tenantSnap = await getDoc(tenantDocRef);
      
      if (tenantSnap.exists()) {
        const tenantData = tenantSnap.data();
        setIsOwner(tenantData.OwnerId === user.uid);
      }
      
      // FIXED: Load from members subcollection instead of users collection
      const membersRef = collection(db, 'Tenants', userTenantId, 'members');
      const membersSnap = await getDocs(membersRef);
      
      const teamMembers = membersSnap.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        role: doc.data().role || 'user',
        password: doc.data().password || '',
        permissions: doc.data().permissions,
      }));
      
      setMembers(teamMembers);
    } catch (error) {
      console.error('Error loading team:', error);
      toast({ variant: 'destructive', title: t('toasts.loadError') });
    } finally {
      setLoading(false);
    }
  }

  function toggleCategoryExpanded(userId: string, category: string) {
    setExpandedCategories(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [category]: !(prev[userId]?.[category] || false)
      }
    }));
  }

  function togglePasswordVisibility(userId: string) {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  }

  async function updatePassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      toast({ 
        variant: 'destructive', 
        title: 'Password too short',
        description: 'Password must be at least 6 characters'
      });
      return;
    }

    try {
      // Update in both users collection AND members subcollection
      await updateDoc(doc(db, 'users', userId), { password: newPassword });
      await updateDoc(doc(db, 'Tenants', tenantId, 'members', userId), { password: newPassword });
      
      setMembers(members.map(m => 
        m.id === userId ? { ...m, password: newPassword } : m
      ));
      
      setEditingPassword(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
      
      toast({ title: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ variant: 'destructive', title: 'Failed to update password' });
    }
  }

  function generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async function togglePermission(userId: string, path: string[], isMasterToggle: boolean = false) {
    const member = members.find(m => m.id === userId);
    if (!member || member.role === 'admin') return;
    
    const newPermissions = { ...member.permissions };
    
    // Navigate to the nested property and toggle it
    let current: any = newPermissions;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    const newValue = !current[path[path.length - 1]];
    current[path[path.length - 1]] = newValue;
    
    // If it's a master toggle and turning ON, auto-expand the category
    if (isMasterToggle && newValue) {
      toggleCategoryExpanded(userId, path[0]);
    }
    
    try {
      // Update in both users collection AND members subcollection
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
      await updateDoc(doc(db, 'Tenants', tenantId, 'members', userId), { permissions: newPermissions });
      
      setMembers(members.map(m => 
        m.id === userId ? { ...m, permissions: newPermissions } : m
      ));
      
      // Only show toast for individual permissions, not master toggles
      if (!isMasterToggle) {
        toast({ title: t('toasts.permissionsUpdated') });
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({ variant: 'destructive', title: t('toasts.updateError') });
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(tenantId);
    toast({ 
      title: 'Invite code copied!', 
      description: 'Share this code with your team members' 
    });
  }

  function copyPassword(password: string) {
    navigator.clipboard.writeText(password);
    toast({ 
      title: 'Password copied!', 
      description: 'Share this password with the team member' 
    });
  }

  if (loading) return <div>Loading...</div>;
  
  if (!isOwner) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{t('accessDenied.description')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <span className="text-sm text-muted-foreground">{members.length} / 6 {t('usersCount')}</span>
      </div>

      {/* How to Invite Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            How to Add Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Get your organization invite code</p>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <p className="text-sm text-muted-foreground">Share this code with new team members so they can join your organization.</p>
                  <Button variant="secondary" size="sm" onClick={copyInviteCode} disabled={!tenantId} className="whitespace-nowrap">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Send the code to your team member</p>
                <p className="text-sm text-muted-foreground">Share via email, Slack, WhatsApp, or any messaging platform</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium">They sign up and join</p>
                <p className="text-sm text-muted-foreground">New member creates an account, selects "Join Organization", and enters your invite code</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <p className="font-medium">Set their password and permissions below</p>
                <p className="text-sm text-muted-foreground">Once they join, assign them a password and adjust their access permissions</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#3560AD] border border-[#3560AD] rounded-lg p-4">
            <p className="text-sm text-white">
              <strong>{t('passwordNote.title')}</strong> {t('passwordNote.description')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Team Members ({members.length}/6)</h2>
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{member.email}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {member.role === 'admin' ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Shield className="h-4 w-4" /> {t('roles.admin')}
                          </span>
                        ) : (
                          t('roles.user')
                        )}
                      </p>
                    </div>
                    {member.role !== 'admin' && (
                      <div className="text-right mr-4">
                        <p className="text-sm font-semibold text-gray-700">{t('accessPermitsLabel')}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Password Section */}
                  {member.role !== 'admin' && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4 text-gray-600" />
                        <Label className="text-sm font-medium">Access Password</Label>
                      </div>
                      
                      {editingPassword[member.id] !== undefined ? (
                        // Editing mode
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={editingPassword[member.id]}
                            onChange={(e) => setEditingPassword(prev => ({
                              ...prev,
                              [member.id]: e.target.value
                            }))}
                            placeholder="Enter new password"
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => updatePassword(member.id, editingPassword[member.id])}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPassword(prev => {
                              const updated = { ...prev };
                              delete updated[member.id];
                              return updated;
                            })}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              type={showPasswords[member.id] ? 'text' : 'password'}
                              value={member.password || 'No password set'}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => togglePasswordVisibility(member.id)}
                            >
                              {showPasswords[member.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPassword(prev => ({
                              ...prev,
                              [member.id]: member.password || ''
                            }))}
                          >
                            Edit
                          </Button>
                          
                          {member.password && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyPassword(member.password!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            onClick={() => {
                              const newPwd = generateRandomPassword();
                              updatePassword(member.id, newPwd);
                            }}
                          >
                            Generate
                          </Button>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-600 mt-2">
                        User will enter this password to access pages you've granted permission to
                      </p>
                    </div>
                  )}
                </div>
                {member.role !== 'admin' && (
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            
            {member.role !== 'admin' && member.permissions && (
              <CardContent className="space-y-4">
                {/* Dashboard */}
                <div className="flex items-center justify-between py-2 border-b">
                  <Label className="font-medium">Dashboard</Label>
                  <Switch
                    checked={member.permissions.dashboard}
                    onCheckedChange={() => togglePermission(member.id, ['dashboard'])}
                  />
                </div>

                {/* Catalogs */}
                <Collapsible open={expandedCategories[member.id]?.catalogs || false} onOpenChange={() => toggleCategoryExpanded(member.id, 'catalogs')}>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                          {expandedCategories[member.id]?.catalogs ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Label className="font-medium cursor-pointer">Catalogs</Label>
                    </div>
                    <Switch
                      checked={member.permissions.catalogs?.enabled || false}
                      onCheckedChange={() => togglePermission(member.id, ['catalogs', 'enabled'], true)}
                    />
                  </div>
                  <CollapsibleContent className="ml-6 space-y-2 mt-2">
                    {['accounts', 'customers', 'materialTypes', 'phases', 'products', 'rawMaterials', 'scales', 'vendors'].map((item) => (
                      <div key={item} className="flex items-center justify-between py-1">
                        <Label className="text-sm capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</Label>
                        <Switch
                          checked={member.permissions.catalogs?.[item as keyof typeof member.permissions.catalogs] || false}
                          onCheckedChange={() => togglePermission(member.id, ['catalogs', item])}
                          disabled={!member.permissions.catalogs?.enabled}
                        />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Expenses */}
                <div className="flex items-center justify-between py-2 border-b">
                  <Label className="font-medium">Expenses</Label>
                  <Switch
                    checked={member.permissions.expenses}
                    onCheckedChange={() => togglePermission(member.id, ['expenses'])}
                  />
                </div>

                {/* Intakes */}
                <div className="flex items-center justify-between py-2 border-b">
                  <Label className="font-medium">Intakes</Label>
                  <Switch
                    checked={member.permissions.intakes}
                    onCheckedChange={() => togglePermission(member.id, ['intakes'])}
                  />
                </div>

                {/* Inventories */}
                <Collapsible open={expandedCategories[member.id]?.inventories || false} onOpenChange={() => toggleCategoryExpanded(member.id, 'inventories')}>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                          {expandedCategories[member.id]?.inventories ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Label className="font-medium cursor-pointer">Inventories</Label>
                    </div>
                    <Switch
                      checked={member.permissions.inventories?.enabled || false}
                      onCheckedChange={() => togglePermission(member.id, ['inventories', 'enabled'], true)}
                    />
                  </div>
                  <CollapsibleContent className="ml-6 space-y-2 mt-2">
                    {['products', 'rawMaterials'].map((item) => (
                      <div key={item} className="flex items-center justify-between py-1">
                        <Label className="text-sm capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</Label>
                        <Switch
                          checked={member.permissions.inventories?.[item as keyof typeof member.permissions.inventories] || false}
                          onCheckedChange={() => togglePermission(member.id, ['inventories', item])}
                          disabled={!member.permissions.inventories?.enabled}
                        />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Invoices */}
                <div className="flex items-center justify-between py-2 border-b">
                  <Label className="font-medium">Invoices</Label>
                  <Switch
                    checked={member.permissions.invoices}
                    onCheckedChange={() => togglePermission(member.id, ['invoices'])}
                  />
                </div>

                {/* Production */}
                <div className="flex items-center justify-between py-2 border-b">
                  <Label className="font-medium">Production</Label>
                  <Switch
                    checked={member.permissions.production}
                    onCheckedChange={() => togglePermission(member.id, ['production'])}
                  />
                </div>

                {/* Reports */}
                <Collapsible open={expandedCategories[member.id]?.reports || false} onOpenChange={() => toggleCategoryExpanded(member.id, 'reports')}>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                          {expandedCategories[member.id]?.reports ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Label className="font-medium cursor-pointer">Reports</Label>
                    </div>
                    <Switch
                      checked={member.permissions.reports?.enabled || false}
                      onCheckedChange={() => togglePermission(member.id, ['reports', 'enabled'], true)}
                    />
                  </div>
                  <CollapsibleContent className="ml-6 space-y-2 mt-2">
                    {['accessLog', 'customers', 'intakes', 'production', 'products', 'rawMaterials', 'sales', 'invoices', 'vendors', 'waste', 'wasteAnalytics', 'expenses', 'profitLoss'].map((item) => (
                      <div key={item} className="flex items-center justify-between py-1">
                        <Label className="text-sm capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</Label>
                        <Switch
                          checked={member.permissions.reports?.[item as keyof typeof member.permissions.reports] || false}
                          onCheckedChange={() => togglePermission(member.id, ['reports', item])}
                          disabled={!member.permissions.reports?.enabled}
                        />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Waste */}
                <Collapsible open={expandedCategories[member.id]?.waste || false} onOpenChange={() => toggleCategoryExpanded(member.id, 'waste')}>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                          {expandedCategories[member.id]?.waste ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Label className="font-medium cursor-pointer">Waste</Label>
                    </div>
                    <Switch
                      checked={member.permissions.waste?.enabled || false}
                      onCheckedChange={() => togglePermission(member.id, ['waste', 'enabled'], true)}
                    />
                  </div>
                  <CollapsibleContent className="ml-6 space-y-2 mt-2">
                    {['waste', 'analytics'].map((item) => (
                      <div key={item} className="flex items-center justify-between py-1">
                        <Label className="text-sm capitalize">{item}</Label>
                        <Switch
                          checked={member.permissions.waste?.[item as keyof typeof member.permissions.waste] || false}
                          onCheckedChange={() => togglePermission(member.id, ['waste', item])}
                          disabled={!member.permissions.waste?.enabled}
                        />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}