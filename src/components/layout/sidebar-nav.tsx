'use client';

import { usePathname, Link } from '@/navigation';
import React from 'react';
import {
  LayoutDashboard,
  Book,
  Box,
  Truck,
  Users,
  UserCheck,
  ClipboardList,
  Timer,
  FileText,
  Package,
  Factory,
  ChevronDown,
  ShoppingBag,
  Trash2,
  BarChart,
  DollarSign,
  Shapes,
  Ruler,
  LineChart,
  Boxes,
  Receipt,
  TrendingUp,
  Calculator,
  Shield,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ICON_COLOR = '#3560AD';

const menuConfig = (t: (key: string) => string, tt: (key: string) => string) => [
  {
    href: '/dashboard',
    label: t('Dashboard'),
    tooltip: tt('Dashboard'),
    icon: LayoutDashboard,
  },
  {
    href: '/team',
    label: t('Team'),
    tooltip: tt('Team'),
    icon: Shield,
  },
  {
    label: t('Catalogs'),
    tooltip: tt('Catalogs'),
    icon: Book,
    basePath: '/catalogs',
    subItems: [
      { href: '/catalogs/accounts', label: t('Accounts'), icon: ClipboardList },
      { href: '/catalogs/customers', label: t('Customers'), icon: Users },
      { href: '/catalogs/material-types', label: t('MaterialTypes'), icon: Shapes },
      { href: '/catalogs/phases', label: t('Phases'), icon: Timer },
      { href: '/catalogs/products', label: t('Products'), icon: Package },
      { href: '/catalogs/raw-materials', label: t('RawMaterials'), icon: Box },
      { href: '/catalogs/scales', label: t('Scales'), icon: Ruler },
      { href: '/catalogs/vendors', label: t('Vendors'), icon: Truck },
    ],
  },
  {
    href: '/expenses',
    label: t('Expenses'),
    tooltip: tt('Expenses'),
    icon: Receipt,
  },
  {
    href: '/inventory/arrivals',
    label: t('Intakes'),
    tooltip: tt('Intakes'),
    icon: ShoppingBag,
  },
  {
    label: t('Inventories'),
    tooltip: tt('Inventories'),
    icon: Boxes,
    basePath: '/inventories',
    subItems: [
      { href: '/inventories/products', label: t('Products'), icon: Package },
      { href: '/inventories/raw-materials', label: t('RawMaterials'), icon: Box },
    ],
  },
  {
    href: '/invoices',
    label: t('Invoices'),
    tooltip: tt('Invoices'),
    icon: FileText,
  },
  {
    href: '/production',
    label: t('Production'),
    tooltip: tt('Production'),
    icon: Factory,
  },
  { 
    href: '/reports/expenses-metrics', 
    label: t('ExpensesMetrics'), 
    icon: Calculator 
  },
  {
    label: t('Reports'),
    tooltip: tt('Reports'),
    icon: BarChart,
    basePath: '/reports',
    subItems: [
      { href: '/reports/access-log', label: t('AccessLog'), icon: Users },
      { href: '/reports/customers', label: t('Customers'), icon: UserCheck },
      { href: '/reports/intakes', label: t('IntakesReport'), icon: ShoppingBag },
      { href: '/reports/production', label: t('Production'), icon: Factory },
      { href: '/reports/products', label: t('Products'), icon: Package },
      { href: '/reports/raw-materials', label: t('RawMaterials'), icon: Box },
      { href: '/reports/sales', label: t('Sales'), icon: TrendingUp },
      { href: '/reports/invoice-status', label: t('Invoices'), icon: DollarSign },
      { href: '/reports/vendors', label: t('Vendors'), icon: Truck },
      { href: '/reports/waste', label: t('Waste'), icon: Trash2 },
      { href: '/reports/waste-analytics', label: t('WasteAnalytics'), icon: BarChart },
      { href: '/reports/expenses', label: t('Expenses'), icon: Receipt },
      { href: '/reports/profit-loss', label: t('ProfitLoss'), icon: LineChart },
    ],
  },
  {
    label: t('Waste'),
    tooltip: tt('Waste'),
    icon: Trash2,
    basePath: '/waste',
    subItems: [
      { href: '/waste', label: t('DamagedLog'), icon: ClipboardList },
      { href: '/waste/analytics', label: t('Analytics'), icon: BarChart },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const t = useTranslations('Sidebar');
  const tt = useTranslations('SidebarTooltips');
  const isCollapsed = state === 'collapsed';

  const iconSize = isCollapsed ? 20 : 36;
  const currentMenu = menuConfig(t, tt);

  return (
    <nav className="space-y-1">
      {currentMenu.slice(0, -1).map((item) => {
        const IconComponent = item.icon;
        const isActive =
          item.href
            ? pathname === item.href
            : item.basePath ? pathname.startsWith(item.basePath) : false;

        if (!item.subItems) {
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <Link href={item.href!}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-4 py-3 text-lg font-medium transition-all duration-200',
                      isActive && 'bg-muted'
                    )}
                    style={{ color: ICON_COLOR }}
                  >
                    {IconComponent && <IconComponent size={iconSize} className="shrink-0" />}
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Collapsible key={item.label} defaultOpen={isActive}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-4 py-3 text-lg font-medium transition-all duration-200"
                    style={{ color: ICON_COLOR }}
                  >
                    {IconComponent && <IconComponent size={iconSize} className="shrink-0" />}
                    <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                    <ChevronDown
                      size={18}
                      className={cn("group-data-[collapsible=icon]:hidden transition-transform duration-200", isActive && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>

            <CollapsibleContent className="ml-10 space-y-1 group-data-[collapsible=icon]:hidden">
              {item.subItems.map((sub) => {
                const SubIconComponent = sub.icon;
                const subActive = pathname === sub.href;

                return (
                  <Link key={sub.href} href={sub.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 py-2 text-base font-normal transition-all duration-200',
                        subActive && 'bg-muted'
                      )}
                      style={{ color: ICON_COLOR }}
                    >
                      {SubIconComponent && <SubIconComponent size={18} />}
                      {sub.label}
                    </Button>
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}


      {/* Waste menu item (last item) */}
      {(() => {
        const item = currentMenu[currentMenu.length - 1];
        const IconComponent = item.icon;
        const isActive = item.basePath ? pathname.startsWith(item.basePath) : false;

        return (
          <Collapsible key={item.label} defaultOpen={isActive}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-4 py-3 text-lg font-medium transition-all duration-200"
                    style={{ color: ICON_COLOR }}
                  >
                    {IconComponent && <IconComponent size={iconSize} className="shrink-0" />}
                    <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                    <ChevronDown
                      size={18}
                      className={cn("group-data-[collapsible=icon]:hidden transition-transform duration-200", isActive && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>

            <CollapsibleContent className="ml-10 space-y-1 group-data-[collapsible=icon]:hidden">
              {item.subItems!.map((sub) => {
                const SubIconComponent = sub.icon;
                const subActive = pathname === sub.href;

                return (
                  <Link key={sub.href} href={sub.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 py-2 text-base font-normal transition-all duration-200',
                        subActive && 'bg-muted'
                      )}
                      style={{ color: ICON_COLOR }}
                    >
                      {SubIconComponent && <SubIconComponent size={18} />}
                      {sub.label}
                    </Button>
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })()}
    </nav>
  );
}