
'use server';

import { formatNumber } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';

export type InventoryStockRecord = {
  productId: string;
  productName: string;
  category: string;
  packed: number;
  sold: number;
  inStock: number;
};

function generateBody(records: InventoryStockRecord[], translations: any): string {
    const grandTotalPacked = records.reduce((sum, rec) => sum + rec.packed, 0);
    const grandTotalSold = records.reduce((sum, rec) => sum + rec.sold, 0);
    const grandTotalStock = records.reduce((sum, rec) => sum + rec.inStock, 0);

    const bodyContent = `
        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th>${translations.table.product}</th>
                        <th>${translations.table.category}</th>
                        <th class="text-right">${translations.table.packed}</th>
                        <th class="text-right">${translations.table.sold}</th>
                        <th class="text-right">${translations.table.inStock}</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.length > 0 ? records.map(rec => `
                        <tr>
                            <td><strong>${rec.productName}</strong></td>
                            <td>${rec.category}</td>
                            <td class="text-right">${formatNumber(rec.packed)}</td>
                            <td class="text-right">${formatNumber(rec.sold)}</td>
                            <td class="text-right">${formatNumber(rec.inStock)}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="5" style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noRecords}</td>
                        </tr>
                    `}
                </tbody>
                ${records.length > 0 ? `
                <tfoot>
                    <tr>
                        <td colspan="2" class="text-right"><strong>${translations.grandTotals}</strong></td>
                        <td class="text-right">${formatNumber(grandTotalPacked)}</td>
                        <td class="text-right">${formatNumber(grandTotalSold)}</td>
                        <td class="text-right">${formatNumber(grandTotalStock)}</td>
                    </tr>
                </tfoot>
                ` : ''}
            </table>
        </div>
    `;
    return bodyContent;
}


export async function generateInventoryStockReport(
  records: InventoryStockRecord[], 
  clientTimezone: string,
  translations: any
) {
  try {
    const body = generateBody(records, translations);
    const totalItems = records.reduce((sum, rec) => sum + rec.inStock, 0);

    const finalHtml = getReportLayout({
        title: translations.title,
        subtitle: `${translations.totalLabel}: ${formatNumber(totalItems)}`,
        body,
        clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating finished products report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
