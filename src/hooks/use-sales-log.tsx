
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Invoice } from '@/lib/types';
import { useProduction } from './use-production';
import { formatDateSafe, toDateSafe } from '@/lib/date';
import { useCustomers } from './use-customers';
import { useProducts } from './use-products';
import { useTranslations } from 'next-intl';

export type EnrichedSaleEntry = {
    date: string;
    product: string;
    productId: string;
    customerName: string;
    customerId: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
};

type SalesLogFilters = {
    productId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
};

export function useSalesLog(filters: SalesLogFilters) {
    const t = useTranslations('SalesReportsPage');
    const { invoices } = useProduction();
    const { customers } = useCustomers();
    const { products } = useProducts();
    const [records, setRecords] = useState<EnrichedSaleEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { productId, customerId, startDate, endDate } = filters;

    const filterAndEnrichData = useCallback(() => {
        setLoading(true);
        setError(null);
        try {
            let flattenedItems: (EnrichedSaleEntry & { rawDate: Date })[] = [];
            
            invoices.forEach(invoice => {
                if (!invoice.lineItems) return;

                const invoiceDate = toDateSafe(invoice.invoiceDate) || toDateSafe(invoice.createdAt);
                if (!invoiceDate) return;
                
                const customer = customers.find(c => c.id === invoice.customerId);

                invoice.lineItems.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    const unitPrice = item.price || product?.salePrice || 0;
                    
                    flattenedItems.push({
                        rawDate: invoiceDate,
                        date: formatDateSafe(invoiceDate),
                        product: item.description || product?.name || t('log.unknownProduct'),
                        productId: product?.id || 'unknown',
                        customerName: customer?.name || t('log.unknownCustomer'),
                        customerId: invoice.customerId,
                        quantity: Number(item.quantity) || 0,
                        unitPrice: unitPrice,
                        totalValue: (Number(item.quantity) || 0) * unitPrice,
                    });
                });
            });

            // Apply filters
            if (productId && productId !== 'all') {
                flattenedItems = flattenedItems.filter(item => item.productId === productId);
            }
            if (customerId && customerId !== 'all') {
                flattenedItems = flattenedItems.filter(item => item.customerId === customerId);
            }
            if (startDate) {
                const start = toDateSafe(startDate);
                if (start) {
                    start.setHours(0, 0, 0, 0);
                    flattenedItems = flattenedItems.filter(item => item.rawDate.getTime() >= start.getTime());
                }
            }
            if (endDate) {
                const end = toDateSafe(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    flattenedItems = flattenedItems.filter(item => item.rawDate.getTime() <= end.getTime());
                }
            }

            flattenedItems.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
            
            const finalRecords = flattenedItems.map(({ rawDate, ...rest }) => rest);
            setRecords(finalRecords);

        } catch (e) {
            const message = e instanceof Error ? e.message : t('log.processingError');
            setError(message);
            console.error("Error in filterAndEnrichData:", e);
        } finally {
            setLoading(false);
        }
    }, [invoices, productId, customerId, startDate, endDate, customers, products]);

    useEffect(() => {
        filterAndEnrichData();
    }, [filterAndEnrichData]);
    
    const filterTitle = useMemo(() => {
        let titleParts: string[] = [];
        const product = products.find(p => p.id === productId);
        if (product) {
                    titleParts.push(`${t('report.filterLabels.product')}: ${product.name}`);
        }
        const customer = customers.find(v => v.id === customerId);
        if (customer) {
                    titleParts.push(`${t('report.filterLabels.customer')}: ${customer.name}`);
        }
        if (startDate) {
                    titleParts.push(`${t('report.filterLabels.from')}: ${formatDateSafe(startDate)}`);
        }
         if (endDate) {
                    titleParts.push(`${t('report.filterLabels.to')}: ${formatDateSafe(endDate)}`);
        }
        return titleParts.join(' | ');
        }, [productId, customerId, startDate, endDate, customers, products, t]);

    return {
        records,
        loading,
        error,
        filterTitle,
    };
}

    
