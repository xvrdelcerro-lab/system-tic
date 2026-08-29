
'use client';

import { ReactNode } from 'react';
import { CustomersProvider } from '@/hooks/use-customers';
import { InventoryProvider } from '@/hooks/use-inventory';
import { ProductsProvider } from '@/hooks/use-products';
import { PhasesProvider } from '@/hooks/use-phases';
import { AccountsProvider } from '@/hooks/use-accounts';
import { ScalesProvider } from '@/hooks/use-scales';
import { MaterialTypesProvider } from '@/hooks/use-material-types';
import { ProductCategoriesProvider } from '@/hooks/use-product-categories';
import { ExpensesProvider } from '@/hooks/use-expenses';
import { ProductionProvider } from '@/hooks/use-production';

export function MainLayoutProviders({ children }: { children: ReactNode }) {
  return (
    <CustomersProvider>
      <InventoryProvider>
        <ProductsProvider>
          <PhasesProvider>
            <AccountsProvider>
              <ScalesProvider>
                <MaterialTypesProvider>
                  <ProductCategoriesProvider>
                    <ExpensesProvider>
                      <ProductionProvider>
                        {children}
                      </ProductionProvider>
                    </ExpensesProvider>
                  </ProductCategoriesProvider>
                </MaterialTypesProvider>
              </ScalesProvider>
            </AccountsProvider>
          </PhasesProvider>
        </ProductsProvider>
      </InventoryProvider>
    </CustomersProvider>
  );
}
