
'use server';

import type { Customer, Invoice } from '@/lib/types';
import { getReportLayout } from '@/lib/report-layout';
import { adminDb } from '@/lib/firebase-admin';
import { formatCurrency } from '@/lib/utils';
import { toDateSafe, formatDateSafe } from '@/lib/date';

function generateSingleCustomerHtml(customer: Customer, invoices: (Invoice & { total: number })[], t: any) {
        const { name, contact, phone, address, city } = customer;
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const avgPurchaseValue = invoices.length > 0 ? totalInvoiced / invoices.length : 0;
        const lastPurchaseDate = invoices.length > 0 ? formatDateSafe(invoices[0].invoiceDate) : '-';
        const purchaseDates = invoices.map(inv => toDateSafe(inv.invoiceDate)).filter(Boolean).sort((a, b) => (a as Date).getTime() - (b as Date).getTime());
        let purchaseFrequency = '-';
        if (purchaseDates.length > 1) {
            let totalDays = 0;
            for (let i = 1; i < purchaseDates.length; i++) {
                totalDays += ((purchaseDates[i] as Date).getTime() - (purchaseDates[i-1] as Date).getTime()) / (1000*60*60*24);
            }
            purchaseFrequency = (totalDays / (purchaseDates.length - 1)).toFixed(1) + ' días';
        }
        // Product diversity and top products
        const productCounts: Record<string, number> = {};
        invoices.forEach(inv => {
            (inv.lineItems || []).forEach((item: any) => {
                if (!item.productName) return;
                productCounts[item.productName] = (productCounts[item.productName] || 0) + (item.quantity || 0);
            });
        });
        const productDiversity = Object.keys(productCounts).length;
        const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // KPI and chart styles (matching product report)
        const kpiStyle = `
            <style>
                .kpi-section { display: flex; gap: 0.7rem; justify-content: center; margin: 0.7rem 0 1.2rem 0; }
                .kpi-card {
                    background: #f5f8fa;
                    border-radius: 7px;
                    box-shadow: 0 1px 3px #e2e8f0;
                    padding: 0.6rem 0.8rem;
                    min-width: 110px;
                    text-align: center;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .kpi-title { font-size: 0.78rem; color: #3560AD; font-weight: 600; margin-bottom: 0.2rem; }
                .kpi-value { font-size: 1.15rem; font-weight: bold; color: #1a202c; margin-bottom: 0.1rem; }
                .kpi-desc { font-size: 0.7rem; color: #4a5568; }
                .kpi-bar-bg {
                    background: #e2e8f0;
                    border-radius: 4px;
                    height: 5px;
                    width: 100%;
                    margin: 0.15rem 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .kpi-bar-fill { height: 5px; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .kpi-bar-fill.total { background: #3560AD; }
                .kpi-bar-fill.avg { background: #805AD5; }
                .kpi-bar-fill.freq { background: #ED8936; }
                .kpi-bar-fill.last { background: #38A169; }
                .kpi-bar-fill.div { background: #3182CE; }
                .bar-chart { display: flex; align-items: flex-end; gap: 0.5rem; height: 60px; margin: 1rem 0 0.5rem 0; }
                .bar { background: #3560AD; border-radius: 3px 3px 0 0; width: 22px; display: flex; align-items: flex-end; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bar-label { font-size: 0.7rem; color: #222; text-align: center; margin-top: 2px; }
                .bar-value { font-size: 0.7rem; color: #3560AD; font-weight: bold; margin-bottom: 2px; }
            </style>
        `;

        // Calculate bar fill percentages for each KPI
        const maxPurchases = 50; // for bar scaling
        const maxAvgValue = 10000; // adjust as needed
        const maxFreq = 60; // days
        const maxDiversity = 20;
        const totalBar = Math.min((invoices.length / maxPurchases) * 100, 100);
        const avgBar = Math.min((avgPurchaseValue / maxAvgValue) * 100, 100);
        const freqNum = typeof purchaseFrequency === 'string' ? parseFloat(purchaseFrequency) : 0;
        const freqBar = purchaseFrequency !== '-' ? Math.max(100 - Math.min((freqNum / maxFreq) * 100, 100), 10) : 10;
        const lastBar = invoices.length > 0 ? 100 : 10;
        const divBar = Math.min((productDiversity / maxDiversity) * 100, 100);

        const kpiCards = `
            <div class="kpi-section">
                <div class="kpi-card">
                    <div class="kpi-title">Total Compras</div>
                    <div class="kpi-value">${invoices.length}</div>
                    <div class="kpi-bar-bg"><div class="kpi-bar-fill total" style="width:${totalBar}%"></div></div>
                    <div class="kpi-desc">Facturas emitidas</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Promedio Compra</div>
                    <div class="kpi-value">${formatCurrency(avgPurchaseValue)}</div>
                    <div class="kpi-bar-bg"><div class="kpi-bar-fill avg" style="width:${avgBar}%"></div></div>
                    <div class="kpi-desc">Valor promedio</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Frecuencia</div>
                    <div class="kpi-value">${purchaseFrequency}</div>
                    <div class="kpi-bar-bg"><div class="kpi-bar-fill freq" style="width:${freqBar}%"></div></div>
                    <div class="kpi-desc">Entre compras</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Última Compra</div>
                    <div class="kpi-value">${lastPurchaseDate}</div>
                    <div class="kpi-bar-bg"><div class="kpi-bar-fill last" style="width:${lastBar}%"></div></div>
                    <div class="kpi-desc">Fecha más reciente</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Diversidad</div>
                    <div class="kpi-value">${productDiversity}</div>
                    <div class="kpi-bar-bg"><div class="kpi-bar-fill div" style="width:${divBar}%"></div></div>
                    <div class="kpi-desc">Productos distintos</div>
                </div>
            </div>
        `;

        // Bar chart for top products
        const maxBar = topProducts.length > 0 ? topProducts[0][1] : 1;
        const barChart = topProducts.length > 0 ? `
            <div>
                <div class="bar-chart">
                    ${topProducts.map(([name, qty]) => `
                        <div class="bar" style="height: ${(qty as number) / maxBar * 55 + 5}px;">
                            <span class="bar-value">${qty}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: center;">
                    ${topProducts.map(([name]) => `<div class="bar-label" style="width: 22px;">${name.slice(0,5)}</div>`).join('')}
                </div>
            </div>
        ` : '';

        const customerProfileHtml = `
            <div class="section">
                <table style="margin-bottom: 20px;">
                        <tbody>
                                <tr>
                                        <th style="width: 15%; font-size: 10px;">${t.customerProfile.customer}</th>
                                        <td style="width: 35%;"><strong>${name}</strong></td>
                                        <th style="width: 15%; font-size: 10px;">${t.customerProfile.email}</th>
                                        <td style="width: 35%;">${contact}</td>
                                </tr>
                                <tr>
                                        <th style="width: 15%; font-size: 10px;">${t.report.addressLabel}</th>
                                        <td style="width: 35%;">${address || ''}, ${city || ''}</td>
                                        <th style="width: 15%; font-size: 10px;">${t.customerProfile.phone}</th>
                                        <td style="width: 35%;">${phone || 'N/A'}</td>
                                </tr>
                        </tbody>
                </table>
            </div>
        `;

        const invoicesHtml = `
                <div class="section">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                                <h2 style="border: none; padding: 0; color: #111827;">${t.invoiceHistory.title}</h2>
                                <span style="color: #3560AD; font-weight: bold; font-size: 14px;">Total: ${invoices.length} Invoices</span>
                        </div>
                        ${invoices.length > 0 ? `
                        <table>
                                <thead>
                                        <tr>
                                                <th>Invoice N°</th>
                                                <th>${t.invoiceHistory.table.date}</th>
                                                <th>${t.invoiceHistory.table.dueDate}</th>
                                                <th>${t.invoiceHistory.table.status}</th>
                                                <th class="text-right">${t.invoiceHistory.table.amount}</th>
                                        </tr>
                                </thead>
                                <tbody>
                                        ${invoices.map(inv => `
                                                <tr>
                                                        <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${inv.invoiceNumber}</strong></td>
                                                        <td>${formatDateSafe(inv.invoiceDate)}</td>
                                                        <td>${formatDateSafe(inv.dueDate)}</td>
                                                        <td>${inv.status}</td>
                                                        <td class="text-right">${formatCurrency(inv.total)}</td>
                                                </tr>
                                        `).join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                            <td colspan="4" class="text-right"><strong>${t.invoiceHistory.totalInvoiced}</strong></td>
                                            <td class="text-right">${formatCurrency(totalInvoiced)}</td>
                                    </tr>
                                </tfoot>
                        </table>
                        ` : `<p>${t.invoiceHistory.noInvoices}</p>`}
                </div>
        `;

        return `
            ${kpiStyle}
            ${customerProfileHtml}
            ${kpiCards}
            ${barChart}
            ${invoicesHtml}
        `;
}

async function generateAllCustomersHtml(allCustomers: Customer[], startDate?: string, endDate?: string, t?: any) {
    let bodyContent = '';

    for (const customer of allCustomers) {
        const invoicesSnap = await adminDb.collection('invoices').where('customerId', '==', customer.id).get();
        
        let customerInvoices = invoicesSnap.docs.map(doc => {
            const data = doc.data();
            const total = (data.lineItems || []).reduce((acc: number, item: any) => acc + (item.quantity || 0) * (item.price || 0), 0);
            const discount = data.discount || 0;
            const tax = data.tax || 0;
            const grandTotal = (total - discount) * (1 + tax / 100);
            
            return {
                ...data,
                id: doc.id,
                total: grandTotal,
            } as any;
        });

        if (startDate) {
            const start = toDateSafe(startDate);
            if (start) {
                start.setHours(0,0,0,0);
                customerInvoices = customerInvoices.filter(inv => {
                    const invDate = toDateSafe(inv.invoiceDate);
                    return invDate && invDate >= start;
                });
            }
        }
        if (endDate) {
            const end = toDateSafe(endDate);
            if (end) {
                end.setHours(23,59,59,999);
                customerInvoices = customerInvoices.filter(inv => {
                    const invDate = toDateSafe(inv.invoiceDate);
                    return invDate && invDate <= end;
                });
            }
        }

        customerInvoices.sort((a, b) => {
          const dateA = toDateSafe(a.invoiceDate)?.getTime() ?? 0;
          const dateB = toDateSafe(b.invoiceDate)?.getTime() ?? 0;
          return dateB - dateA;
        });

        const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);

        bodyContent += `
        <div class="section">
            <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #3560AD; margin-bottom: 10px;">
                <h2 style="border: none; padding: 0;">${customer.name}</h2>
                <span style="color: #3560AD; font-weight: bold; font-size: 14px;">Total: ${customerInvoices.length} Invoices</span>
            </div>
            ${customerInvoices.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Invoice N°</th>
                            <th>${t.invoiceHistory.table.date}</th>
                            <th class="text-right">${t.invoiceHistory.table.amount}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customerInvoices.map(inv => `
                            <tr>
                                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${inv.invoiceNumber}</strong></td>
                                <td>${formatDateSafe(inv.invoiceDate)}</td>
                                <td class="text-right">${formatCurrency(inv.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-right"><strong>${t.invoiceHistory.totalInvoiced}</strong></td>
                            <td class="text-right">${formatCurrency(totalInvoiced)}</td>
                        </tr>
                    </tfoot>
                </table>
            ` : `<p>${t.invoiceHistory.noInvoices}</p>`}
        </div>
        `;
    }
    return bodyContent;
}


export async function generateCustomerReport(payload: { customerId: string, startDate?: string, endDate?: string, translations: any, clientTimezone: string }) {
  try {
    const { customerId, startDate, endDate, translations: t, clientTimezone } = payload;
    
    const customersSnap = await adminDb.collection('customers').get();
    const customers: Customer[] = customersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        contact: data.contact || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        website: data.website || '',
        joinDate: data.joinDate?.toDate?.()?.toISOString() ?? '',
      }
    });

    let reportTitle = '';
    let bodyContent = '';
    let subtitle = '';
    
    if (customerId === 'all') {
      reportTitle = t.titleAll;
      const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
      bodyContent = await generateAllCustomersHtml(sortedCustomers, startDate, endDate, t);
      
      let dateRangeSubtitle = '';
      if(startDate || endDate) {
          const startStr = startDate ? formatDateSafe(startDate) : '...';
          const endStr = endDate ? formatDateSafe(endDate) : '...';
          dateRangeSubtitle = ` | ${t.period.replace('{start}', startStr).replace('{end}', endStr)}`;
      }
      subtitle = `${t.subtitleAll.replace('{count}', customers.length)}${dateRangeSubtitle}`;

    } else {
      const customer = customers.find((v) => v.id === customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      
      const invoicesSnap = await adminDb.collection('invoices').where('customerId', '==', customerId).get();
      
      let customerInvoices = invoicesSnap.docs.map(doc => {
          const data = doc.data();
          const total = (data.lineItems || []).reduce((acc: number, item: any) => acc + (item.quantity || 0) * (item.price || 0), 0);
          const discount = data.discount || 0;
          const tax = data.tax || 0;
          const grandTotal = (total - discount) * (1 + tax / 100);
          
          return {
              ...data,
              id: doc.id,
              total: grandTotal,
          } as any;
      });
      
      if (startDate) {
        const start = toDateSafe(startDate);
        if (start) {
          start.setHours(0,0,0,0);
          customerInvoices = customerInvoices.filter(inv => {
            const invDate = toDateSafe(inv.invoiceDate);
            return invDate && invDate >= start;
          });
        }
      }
      if (endDate) {
        const end = toDateSafe(endDate);
        if (end) {
          end.setHours(23,59,59,999);
          customerInvoices = customerInvoices.filter(inv => {
              const invDate = toDateSafe(inv.invoiceDate);
              return invDate && invDate <= end;
          });
        }
      }

      customerInvoices.sort((a, b) => {
        const dateA = toDateSafe(a.invoiceDate)?.getTime() ?? 0;
        const dateB = toDateSafe(b.invoiceDate)?.getTime() ?? 0;
        return dateB - dateA;
      });

      let dateRangeSubtitle = '';
      if(startDate || endDate) {
          const startStr = startDate ? formatDateSafe(startDate) : '...';
          const endStr = endDate ? formatDateSafe(endDate) : '...';
          dateRangeSubtitle = ` | ${t.period.replace('{start}', startStr).replace('{end}', endStr)}`;
      }
      
      reportTitle = t.titleSingle.replace('{name}', customer.name);
      subtitle = `${t.subtitleSingle.replace('{count}', customerInvoices.length)}${dateRangeSubtitle}`;

      bodyContent = generateSingleCustomerHtml(customer, customerInvoices, t);
    }

    const finalHtml = getReportLayout({
        title: reportTitle,
        subtitle: subtitle,
        body: bodyContent,
        clientTimezone: clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating report:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}
