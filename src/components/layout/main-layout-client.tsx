'use client';

import React, { useEffect } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { TrialStatusBadge } from '@/components/trial-status-badge';
import { LogOut } from 'lucide-react';
import { signOut } from "@/lib/auth";
import Image from 'next/image';
import { Link, useRouter, usePathname } from '@/navigation';

function LayoutContent({ children, isClient, handleLogout }: { 
  children: React.ReactNode, 
  isClient: boolean, 
  handleLogout: () => Promise<void> 
}) {
  const { state } = useSidebar();
  const pathname = usePathname();
  const isCollapsed = state === 'collapsed';

  // Hide sidebar on onboarding page
  const isOnboarding = pathname === '/onboarding';

  const sidebarWidth = isCollapsed ? '4rem' : '16rem';

  // If onboarding, render full-screen without sidebar
  if (isOnboarding) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
      {/* 1. THE SIDEBAR */}
      <Sidebar collapsible="icon" className="border-r shadow-sm">
        <SidebarHeader className="flex items-center justify-between p-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-xl text-primary group-data-[collapsible=icon]:hidden">System@ic</span>
          </Link>
          <div className="flex h-11 w-11 items-center justify-center">
            <SidebarTrigger className="text-primary" />
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          {isClient ? <SidebarNav /> : null}
        </SidebarContent>

        <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2 space-y-2">
          <TrialStatusBadge />
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* 2. THE DASHBOARD AREA */}
      <div 
        className="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out"
        style={{ 
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth})`
        }}
      >
        <Header isClient={isClient} />
        <main className="p-4 md:p-8 w-full">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = React.useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = async () => {
    // Clear password from session storage
    sessionStorage.clear();
    
    await signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <LayoutContent isClient={isClient} handleLogout={handleLogout}>
        {children}
      </LayoutContent>
    </SidebarProvider>
  );
}