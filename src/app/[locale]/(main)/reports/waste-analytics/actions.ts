
'use server';

import { format } from 'date-fns';
import { formatNumber, formatCurrency } from '@/lib/utils';
import type { WasteAnalyticRecord } from '@/hooks/use-production';
import { getReportLayout } from '@/lib/report-layout';

function generateBody(records: WasteAnalyticRecord[]): string {
    const grandTotalCost = records.reduce((sum, rec) => sum + rec.snapshot.totalCost, 0);

    // --- Damaged summary per item ---
    // Aggregate damaged pieces per product
    const damagedByProduct: Record<string, { name: string; total: number }> = {};
    let totalDamaged = 0;
    for (const rec of records) {
        if (!damagedByProduct[rec.productId]) {
            damagedByProduct[rec.productId] = { name: rec.productName, total: 0 };
        }
        damagedByProduct[rec.productId].total += rec.snapshot.totalDamaged;
        totalDamaged += rec.snapshot.totalDamaged;
    }

    const summaryTable = records.length > 0 ? `
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 0.5rem; font-size: 1.1em; color: #1e293b;">Summary of Damaged Pieces per Item</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align: left; padding: 0.3rem 0.5rem;">Product</th>
                        <th style="text-align: right; padding: 0.3rem 0.5rem;">Damaged</th>
                        <th style="text-align: right; padding: 0.3rem 0.5rem;">% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(damagedByProduct).map(item => `
                        <tr>
                            <td style="padding: 0.3rem 0.5rem;">${item.name}</td>
                            <td style="text-align: right; padding: 0.3rem 0.5rem;">${formatNumber(item.total)}</td>
                            <td style="text-align: right; padding: 0.3rem 0.5rem;">${totalDamaged > 0 ? ((item.total / totalDamaged) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td style="text-align: right; font-weight: bold; padding: 0.3rem 0.5rem;">Total</td>
                        <td style="text-align: right; font-weight: bold; padding: 0.3rem 0.5rem;">${formatNumber(totalDamaged)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    ` : '';

    const bodyContent = `
        ${summaryTable}
        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Details</th>
                        <th class="text-right">Total Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.length > 0 ? records.map(rec => `
                        <tr>
                            <td>${format(rec.createdAt, 'MMM-dd-yy, p')}</td>
                            <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${rec.productName}</strong></td>
                            <td>
                                <p><strong>Total Damaged:</strong> ${rec.snapshot.totalDamaged} units</p>
                                ${rec.snapshot.recordedMaterials && rec.snapshot.recordedMaterials.length > 0 ? `
                                    <ul style="margin: 0.5rem 0 0; padding-left: 1.2rem; font-size: 0.9em; color: #4b5563;">
                                        ${rec.snapshot.recordedMaterials.map(mat => `
                                            <li>${mat.materialName}: ${formatNumber(mat.quantity)} units (${formatCurrency(mat.cost)})</li>
                                        `).join('')}
                                    </ul>
                                ` : ''}
                                ${rec.snapshot.notes ? `<p style="margin-top: 0.5rem; font-size: 0.9em; font-style: italic;"><strong>Notes:</strong> ${rec.snapshot.notes}</p>` : ''}
                            </td>
                            <td class="text-right">${formatCurrency(rec.snapshot.totalCost)}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="4" style="text-align: center; color: #6b7280; padding: 2rem 0;">No records found for the selected filters.</td>
                        </tr>
                    `}
                </tbody>
                ${records.length > 0 ? `
                <tfoot>
                  <tr>
                    <td colspan="3" class="text-right"><strong>Grand Total Cost</strong></td>
                    <td class="text-right">${formatCurrency(grandTotalCost)}</td>
                  </tr>
                </tfoot>
                ` : ''}
            </table>
        </div>
    `;

    return bodyContent;
}

export async function generateWasteAnalyticsReport(records: WasteAnalyticRecord[], filterTitle: string, clientTimezone: string) {
  try {
    const body = generateBody(records);
    
    const finalHtml = getReportLayout({
        title: 'Waste Analytics Report',
        subtitle: filterTitle,
        body,
        clientTimezone: clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating waste analytics report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
