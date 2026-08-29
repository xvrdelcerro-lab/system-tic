
'use server';

import { format } from 'date-fns';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';
import { formatDateSafe, toDateSafe } from '@/lib/date';
import { adminDb } from '@/lib/firebase-admin';
import type { Invoice } from '@/lib/types';

type SalesReportPayload = {
    filters: {
        productId?: string;
        customerId?: string;
        startDate?: string;
        endDate?: string;
    };
    clientTimezone: string;
    translations: any;
};

async function generateBody(payload: SalesReportPayload, allProducts: any[], allCustomers: any[]): Promise<string> {
    const { filters, translations } = payload;
    const { customerId, productId, startDate, endDate } = filters;

    let invoicesQuery = adminDb.collection('invoices').where('invoiceType', '==', 'invoice');
    if (customerId && customerId !== 'all') {
        invoicesQuery = invoicesQuery.where('customerId', '==', customerId);
    }
    const invoicesSnap = await invoicesQuery.get();
    
    let records: any[] = [];
    invoicesSnap.docs.forEach(doc => {
        const invoice = doc.data() as Invoice;
        const invoiceDate = toDateSafe(invoice.invoiceDate);
        if (!invoiceDate) return;

        (invoice.lineItems || []).forEach(item => {
            records.push({
                ...item,
                invoiceDate: invoiceDate,
                customerId: invoice.customerId,
            });
        });
    });

    if (productId && productId !== 'all') {
        records = records.filter(r => r.productId === productId);
    }
    if (startDate) {
        const start = toDateSafe(startDate);
        if (start) {
            start.setHours(0,0,0,0);
            records = records.filter(r => r.invoiceDate >= start);
        }
    }
    if (endDate) {
        const end = toDateSafe(endDate);
        if (end) {
            end.setHours(23,59,59,999);
            records = records.filter(r => r.invoiceDate <= end);
        }
    }

        if (records.length === 0) {
            return `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noSalesFound}</p>`;
        }
        records.sort((a,b) => b.invoiceDate.getTime() - a.invoiceDate.getTime());

        // KPIs
        const totalSales = records.reduce((sum, rec) => sum + (rec.quantity * rec.price), 0);
        const avgSale = records.length > 0 ? totalSales / records.length : 0;
        const numSales = records.length;

        // Sales over time (by date)
        const salesByDate = {};
        records.forEach(rec => {
            const date = formatDateSafe(rec.invoiceDate);
            if (!salesByDate[date]) salesByDate[date] = 0;
            salesByDate[date] += rec.quantity * rec.price;
        });
        const chartPoints = Object.entries(salesByDate).map(([date, value]) => ({ date, value }));

        // Simple SVG line chart (inline, for print)
        function renderSVGChart(points) {
            if (points.length < 2) return '';
            const w = 320, h = 80, pad = 30;
            const max = Math.max(...points.map(p => p.value));
            const min = Math.min(...points.map(p => p.value));
            const range = max - min || 1;
            const stepX = (w - pad * 2) / (points.length - 1);
            const scaleY = v => h - pad - ((v - min) / range) * (h - pad * 2);
            const scaleX = i => pad + i * stepX;
            const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(p.value)}`).join(' ');
            return `<svg width="${w}" height="${h}" style="background:#f9fafb;border-radius:8px;"><polyline fill="none" stroke="#2563eb" stroke-width="2" points="${points.map((p,i)=>`${scaleX(i)},${scaleY(p.value)}`).join(' ')}" /><text x="${pad}" y="${h-5}" font-size="10" fill="#888">${points[0].date}</text><text x="${w-pad-40}" y="${h-5}" font-size="10" fill="#888">${points[points.length-1].date}</text></svg>`;
        }

        const kpiSection = `
            <div class="section" style="display:flex;gap:32px;align-items:center;justify-content:flex-start;margin-bottom:24px;">
                <div style="min-width:120px;text-align:center;">
                    <div style="font-size:11px;color:#6b7280;">Total Sales</div>
                    <div style="font-size:18px;font-weight:bold;">${formatCurrency(totalSales)}</div>
                </div>
                <div style="min-width:120px;text-align:center;">
                    <div style="font-size:11px;color:#6b7280;">Average Sale</div>
                    <div style="font-size:18px;font-weight:bold;">${formatCurrency(avgSale)}</div>
                </div>
                <div style="min-width:120px;text-align:center;">
                    <div style="font-size:11px;color:#6b7280;">Number of Sales</div>
                    <div style="font-size:18px;font-weight:bold;">${numSales}</div>
                </div>
                <div style="flex:1;min-width:200px;">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Sales Over Time</div>
                    ${renderSVGChart(chartPoints)}
                </div>
            </div>
        `;

        const grandTotalQuantity = records.reduce((sum, rec) => sum + rec.quantity, 0);
        const grandTotalValue = totalSales;

        const bodyContent = `
            ${kpiSection}
            <div class="section">
                    <table>
                            <thead>
                                    <tr>
                                            <th>${translations.tableHeaders.date}</th>
                                            <th>${translations.tableHeaders.product}</th>
                                            <th>${translations.tableHeaders.customer}</th>
                                            <th class="text-right">${translations.tableHeaders.quantity}</th>
                                            <th class="text-right">${translations.tableHeaders.price}</th>
                                            <th class="text-right">${translations.tableHeaders.total}</th>
                                    </tr>
                            </thead>
                            <tbody>
                                    ${records.map(rec => {
                                            const product = allProducts.find(p => p.id === rec.productId);
                                            const customer = allCustomers.find(c => c.id === rec.customerId);
                                            return `
                                                    <tr>
                                                            <td>${formatDateSafe(rec.invoiceDate)}</td>
                                                            <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${product?.name || rec.description}</strong></td>
                                                            <td>${customer?.name || 'Unknown'}</td>
                                                            <td class="text-right">${formatNumber(rec.quantity)}</td>
                                                            <td class="text-right">${formatCurrency(rec.price)}</td>
                                                            <td class="text-right">${formatCurrency(rec.quantity * rec.price)}</td>
                                                    </tr>
                                            `
                                    }).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" class="text-right"><strong>${translations.grandTotals}</strong></td>
                                    <td class="text-right">${formatNumber(grandTotalQuantity)}</td>
                                    <td></td>
                                    <td class="text-right">${formatCurrency(grandTotalValue)}</td>
                                </tr>
                            </tfoot>
                    </table>
            </div>
        `;

        return bodyContent;
}

export async function generateSalesReport(payload: SalesReportPayload) {
  try {
    const [productsSnap, customersSnap] = await Promise.all([
        adminDb.collection('products').get(),
        adminDb.collection('customers').get()
    ]);
    const allProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const body = await generateBody(payload, allProducts, allCustomers);
    
    let subtitle = '';
    const filterParts: string[] = [];
    const customer = payload.filters.customerId !== 'all' ? allCustomers.find(c => c.id === payload.filters.customerId) : null;
    const product = payload.filters.productId !== 'all' ? allProducts.find(p => p.id === payload.filters.productId) : null;

    if (customer) filterParts.push(`${payload.translations.filterLabels.customer}: ${customer.name}`);
    if (product) filterParts.push(`${payload.translations.filterLabels.product}: ${product.name}`);
    if (payload.filters.startDate) filterParts.push(`${payload.translations.filterLabels.from}: ${formatDateSafe(payload.filters.startDate)}`);
    if (payload.filters.endDate) filterParts.push(`${payload.translations.filterLabels.to}: ${formatDateSafe(payload.filters.endDate)}`);
    
    if (filterParts.length > 0) {
      subtitle = filterParts.join(' | ');
    }

    const finalHtml = getReportLayout({
      title: payload.translations.reportTitle,
      subtitle: subtitle,
      body,
      clientTimezone: payload.clientTimezone
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating sales report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
