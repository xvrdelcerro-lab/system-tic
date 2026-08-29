'use server';

import { formatNumber, formatCurrency } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';
import { formatDateSafe, toDateSafe } from '@/lib/date';
import { adminDb } from '@/lib/firebase-admin';
import type { Invoice } from '@/lib/types';

type ProductReportPayload = {
  filters: {
    productId?: string;
    startDate?: string;
    endDate?: string;
  };
  clientTimezone: string;
  translations: any;
};

type SalesKpiMetrics = {
  averageSalesCycleDays: number;
  totalPieces: number;
  totalValue: number;
  averagePiecesPerShipment: number;
  averageValuePerShipment: number;
  satisfactionPercent: number;
  registeredComplaints: number;
  averageShipmentsPerWeek: number;
  periodDays: number;
};

// Shared: fetch invoices and flatten into line-item records
async function fetchRecords(filters: ProductReportPayload['filters']): Promise<any[]> {
  const { productId, startDate, endDate } = filters;

  const invoicesSnap = await adminDb.collection('invoices').where('invoiceType', '==', 'invoice').get();

  let records: any[] = [];
  invoicesSnap.docs.forEach(doc => {
    const invoice = doc.data() as Invoice;
    const invoiceDate = toDateSafe(invoice.invoiceDate);
    if (!invoiceDate) return;

    (invoice.lineItems || []).forEach(item => {
      records.push({
        ...item,
        invoiceDate: invoiceDate,
        invoiceNumber: invoice.invoiceNumber,
      });
    });
  });

  if (productId && productId !== 'all') {
    records = records.filter(r => r.productId === productId);
  }
  if (startDate) {
    const start = toDateSafe(startDate);
    if (start) {
      start.setHours(0, 0, 0, 0);
      records = records.filter(r => r.invoiceDate >= start);
    }
  }
  if (endDate) {
    const end = toDateSafe(endDate);
    if (end) {
      end.setHours(23, 59, 59, 999);
      records = records.filter(r => r.invoiceDate <= end);
    }
  }

  records.sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());
  return records;
}

// SINGLE PRODUCT: Product name on top, then detailed table (date, invoice #, qty, price), then totals
function generateSingleProductBody(records, product, translations) {
  // Calculate new KPIs
  const totalUnits = records.reduce((sum, rec) => sum + (rec.quantity || 0), 0);
  const totalRevenue = records.reduce((sum, rec) => sum + ((rec.quantity || 0) * (rec.price || 0)), 0);
  const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
  const uniqueCustomers = new Set(records.map(rec => rec.customerId || rec.customer || '')).size;

  // Monthly sales trend (last 6 months)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      units: 0
    });
  }
  records.forEach(rec => {
    const d = rec.invoiceDate;
    if (!(d instanceof Date)) return;
    const idx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx !== -1) months[idx].units += rec.quantity || 0;
  });

  // Top 5 customers
  const customerMap = {};
  records.forEach(rec => {
    const cid = rec.customerId || rec.customer || 'Unknown';
    if (!customerMap[cid]) customerMap[cid] = 0;
    customerMap[cid] += rec.quantity || 0;
  });
  const topCustomers = Object.entries(customerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Render HTML
  return `
    <style>
      .kpi-section { display: flex; gap: 1.2rem; justify-content: center; margin: 1rem 0 1.5rem 0; }
      .kpi-card {
        background: #f5f8fa;
        border-radius: 7px;
        box-shadow: 0 1px 3px #e2e8f0;
        padding: 0.7rem 1.1rem;
        min-width: 120px;
        text-align: center;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .kpi-title { font-size: 0.85rem; color: #3560AD; font-weight: 600; margin-bottom: 0.2rem; }
      .kpi-value { font-size: 1.25rem; font-weight: bold; color: #1a202c; margin-bottom: 0.1rem; }
      .kpi-desc { font-size: 0.7rem; color: #4a5568; }
      .chart-section { display: flex; gap: 2.5rem; justify-content: center; margin: 1.5rem 0; }
      .chart-card { background: #fff; border-radius: 7px; box-shadow: 0 1px 3px #e2e8f0; padding: 1rem 1.2rem; min-width: 320px; }
      .chart-title { font-size: 0.9rem; color: #3560AD; font-weight: 600; margin-bottom: 0.5rem; }
    </style>
    <div class="section">
      <h2 style="border-left: 4px solid #3560AD; padding-left: 10px; font-size: 13px; margin-bottom: 2px;">${product.name}</h2>
      <p style="color: #6b7280; font-size: 10px; margin-top: 0;">${product.category || ''}</p>
      <div class="kpi-section">
        <div class="kpi-card">
          <div class="kpi-title">Total Units Sold</div>
          <div class="kpi-value">${totalUnits}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Revenue</div>
          <div class="kpi-value">${formatCurrency(totalRevenue)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Avg. Selling Price</div>
          <div class="kpi-value">${formatCurrency(avgPrice)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Unique Customers</div>
          <div class="kpi-value">${uniqueCustomers}</div>
        </div>
      </div>
      <div class="chart-section">
        <div class="chart-card">
          <div class="chart-title">Monthly Sales Trend (Units)</div>
          <svg width="300" height="120">
            <polyline fill="none" stroke="#3560AD" stroke-width="3" points="
              ${months.map((m, i) => `${30 + i * 50},${100 - (m.units / Math.max(...months.map(mm => mm.units || 1), 1)) * 80}`).join(' ')}
            " />
            ${months.map((m, i) => `<circle cx="${30 + i * 50}" cy="${100 - (m.units / Math.max(...months.map(mm => mm.units || 1), 1)) * 80}" r="4" fill="#3560AD" />`).join('')}
            ${months.map((m, i) => `<text x="${30 + i * 50}" y="115" font-size="10" text-anchor="middle">${m.label}</text>`).join('')}
          </svg>
        </div>
        <div class="chart-card">
          <div class="chart-title">Top 5 Customers (Units)</div>
          <svg width="300" height="120">
            ${topCustomers.map((c, i) => `<rect x="${30 + i * 50}" y="${100 - (c[1] / Math.max(...topCustomers.map(tc => tc[1] || 1), 1)) * 80}" width="30" height="${(c[1] / Math.max(...topCustomers.map(tc => tc[1] || 1), 1)) * 80}" fill="#38A169" />`).join('')}
            ${topCustomers.map((c, i) => `<text x="${45 + i * 50}" y="115" font-size="10" text-anchor="middle">${c[0].toString().slice(0, 8)}</text>`).join('')}
          </svg>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${translations.tableHeaders.date}</th>
            <th>${translations.tableHeaders.invoice}</th>
            <th class="text-right">${translations.tableHeaders.quantity}</th>
            <th class="text-right">${translations.tableHeaders.price}</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(rec => `
            <tr>
              <td>${formatDateSafe(rec.invoiceDate)}</td>
              <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${rec.invoiceNumber || translations.tableHeaders.invoice}</strong></td>
              <td class="text-right">${rec.quantity}</td>
              <td class="text-right">${formatCurrency(rec.price)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="text-right"><strong>${translations.totalSold}</strong></td>
            <td class="text-right"><strong>${totalUnits}</strong></td>
            <td class="text-right"><strong>${formatCurrency(totalRevenue)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function calculateSalesKpis(records: any[]): SalesKpiMetrics {
  const sortedByDate = [...records].sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());

  const uniqueShipmentDates = Array.from(new Set(sortedByDate.map(rec => rec.invoiceDate.toISOString().slice(0, 10))))
    .map(dateString => new Date(`${dateString}T00:00:00`))
    .sort((a, b) => a.getTime() - b.getTime());

  let totalGapDays = 0;
  for (let i = 1; i < uniqueShipmentDates.length; i++) {
    const msDiff = uniqueShipmentDates[i].getTime() - uniqueShipmentDates[i - 1].getTime();
    totalGapDays += msDiff / (1000 * 60 * 60 * 24);
  }
  const averageSalesCycleDays = uniqueShipmentDates.length > 1
    ? totalGapDays / (uniqueShipmentDates.length - 1)
    : 0;

  const totalPieces = sortedByDate.reduce((sum, rec) => sum + Number(rec.quantity || 0), 0);
  const totalValue = sortedByDate.reduce((sum, rec) => sum + (Number(rec.quantity || 0) * Number(rec.price || 0)), 0);

  const uniqueInvoices = new Set(sortedByDate.map(rec => rec.invoiceNumber || `${rec.invoiceDate.toISOString().slice(0, 10)}-${rec.productId}`));
  const shipmentCount = uniqueInvoices.size || 1;

  const averagePiecesPerShipment = totalPieces / shipmentCount;
  const averageValuePerShipment = totalValue / shipmentCount;

  const minDate = uniqueShipmentDates[0] || null;
  const maxDate = uniqueShipmentDates[uniqueShipmentDates.length - 1] || null;
  const periodDays = minDate && maxDate
    ? Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  const averageShipmentsPerWeek = (uniqueInvoices.size / periodDays) * 7;

  const registeredComplaints = sortedByDate.reduce((sum, rec) => {
    if (typeof rec.complaintCount === 'number' && Number.isFinite(rec.complaintCount)) {
      return sum + Math.max(0, rec.complaintCount);
    }
    if (rec.registeredComplaint === true) {
      return sum + 1;
    }
    return sum;
  }, 0);

  const satisfactionPercent = shipmentCount > 0
    ? Math.max(0, (1 - (registeredComplaints / shipmentCount)) * 100)
    : 100;

  return {
    averageSalesCycleDays,
    totalPieces,
    totalValue,
    averagePiecesPerShipment,
    averageValuePerShipment,
    satisfactionPercent,
    registeredComplaints,
    averageShipmentsPerWeek,
    periodDays,
  };
}

// ALL PRODUCTS: Grouped by product → product name row, invoice numbers listed, subtotal per product, then grand total at the bottom
function generateAllProductsBody(records: any[], allProducts: any[], translations: any): string {
  const grouped: Record<string, any[]> = {};
  records.forEach(rec => {
    if (!grouped[rec.productId]) grouped[rec.productId] = [];
    grouped[rec.productId].push(rec);
  });

  let grandTotalQuantity = 0;
  let grandTotalValue = 0;

  const productBlocks = Object.entries(grouped).map(([productId, productRecords]) => {
    const product = allProducts.find(p => p.id === productId);
    const productName = product?.name || translations.unknownProduct;
    const subtotalQty = productRecords.reduce((sum, rec) => sum + rec.quantity, 0);
    const subtotalValue = productRecords.reduce((sum, rec) => sum + (rec.quantity * rec.price), 0);

    grandTotalQuantity += subtotalQty;
    grandTotalValue += subtotalValue;

    // This creates the list of invoices under the product
    const invoiceRows = productRecords.map(rec => `
      <tr style="font-size: 11px; color: #4b5563;">
        <td style="padding-left: 25px;">${formatDateSafe(rec.invoiceDate)}</td>
        <td>${translations.tableHeaders.invoice} ${rec.invoiceNumber || '---'}</td>
        <td class="text-right">${formatNumber(rec.quantity)}</td>
        <td class="text-right">${formatCurrency(rec.price)}</td>
      </tr>
    `).join('');

    return `
      <tr style="background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <td colspan="2" style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${productName}</strong></td>
        <td class="text-right"><strong>${formatNumber(subtotalQty)}</strong></td>
        <td class="text-right"><strong>${formatCurrency(subtotalValue)}</strong></td>
      </tr>
      ${invoiceRows}
      <tr><td colspan="4" style="height: 8px;"></td></tr>
    `;
  }).join('');

  return `
    <div class="section">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #3560AD; text-align: left;">
            <th>${translations.tableHeaders.product} / ${translations.tableHeaders.date}</th>
            <th>${translations.tableHeaders.invoice}</th>
            <th class="text-right">${translations.tableHeaders.quantity}</th>
            <th class="text-right">${translations.tableHeaders.price}</th>
          </tr>
        </thead>
        <tbody>
          ${productBlocks}
        </tbody>
        <tfoot style="border-top: 2px solid #3560AD;">
          <tr>
            <td colspan="2" class="text-right"><strong>${translations.totalSold}</strong></td>
            <td class="text-right"><strong>${formatNumber(grandTotalQuantity)}</strong></td>
            <td class="text-right"><strong>${formatCurrency(grandTotalValue)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

export async function generateProductReport(payload: ProductReportPayload) {
  try {
    const productsSnap = await adminDb.collection('products').get();
    const allProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const records = await fetchRecords(payload.filters);
    const translations = payload.translations;
    const isSingle = payload.filters.productId && payload.filters.productId !== 'all';

    // No records found for the filters
    if (records.length === 0) {
      const noDataHtml = `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noSalesFound}</p>`;
      const finalHtml = getReportLayout({
        title: translations.reportTitle,
        subtitle: '',
        body: noDataHtml,
        clientTimezone: payload.clientTimezone,
      });
      return { success: true, reportContent: finalHtml };
    }

    // Generate the correct body based on single vs all
    let body: string;
    if (isSingle) {
      const product = allProducts.find(p => p.id === payload.filters.productId);
      body = generateSingleProductBody(records, product, translations);
    } else {
      body = generateAllProductsBody(records, allProducts, translations);
    }

    // Build subtitle with active filters
    const filterParts: string[] = [];
    const product = isSingle ? allProducts.find(p => p.id === payload.filters.productId) : null;
    if (product) filterParts.push(`${translations.filterLabels.product}: ${product.name}`);
    if (payload.filters.startDate) filterParts.push(`${translations.filterLabels.from}: ${formatDateSafe(payload.filters.startDate)}`);
    if (payload.filters.endDate) filterParts.push(`${translations.filterLabels.to}: ${formatDateSafe(payload.filters.endDate)}`);

    const finalHtml = getReportLayout({
      title: translations.reportTitle,
      subtitle: filterParts.length > 0 ? filterParts.join(' | ') : '',
      body,
      clientTimezone: payload.clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating product report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
