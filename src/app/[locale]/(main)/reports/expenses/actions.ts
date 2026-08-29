'use server';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Expense } from '@/lib/types';
import { getReportLayout } from '@/lib/report-layout';

function generateBody(records: Expense[], translations: any): string {
    const grandTotal = records.reduce((sum, rec) => sum + rec.amount, 0);

    const bodyContent = `
        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th>${translations.dateHeader}</th>
                        <th>${translations.categoryHeader}</th>
                        <th>${translations.descriptionHeader}</th>
                        <th class="text-right">${translations.amountHeader}</th>
                        <th class="text-right">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.length > 0 ? records.map(rec => {
                        const accountKey = rec.category;
                        const translatedCategory = translations.Accounts?.[accountKey]?.name || rec.category;
                        const percentage = grandTotal > 0 ? ((rec.amount / grandTotal) * 100).toFixed(2) : '0.00';
                        
                        return `
                        <tr>
                            <td>${format(rec.date, 'MMM-dd-yy')}</td>
                            <td>${translatedCategory}</td>
                            <td>
                                ${rec.description}
                                ${rec.notes ? `<p style="font-size: 0.9em; font-style: italic; color: #6b7280; margin-top: 4px;">Note: ${rec.notes}</p>` : ''}
                            </td>
                            <td class="text-right">${formatCurrency(rec.amount)}</td>
                            <td class="text-right">${percentage}%</td>
                        </tr>
                    `}).join('') : `
                        <tr>
                            <td colspan="5" style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.empty}</td>
                        </tr>
                    `}
                </tbody>
                ${records.length > 0 ? `
                <tfoot>
                  <tr>
                    <td colspan="3" class="text-right"><strong>${translations.grandTotal}</strong></td>
                    <td class="text-right"><strong>${formatCurrency(grandTotal)}</strong></td>
                    <td class="text-right"><strong>100.00%</strong></td>
                  </tr>
                </tfoot>
                ` : ''}
            </table>
        </div>
    `;
    
    return bodyContent;
}

export async function generateExpensesReport(records: Expense[], filterTitle: string, translations: any, clientTimezone: string) {
  try {
    const body = generateBody(records, translations);
    const finalHtml = getReportLayout({
        title: translations.title,
        subtitle: filterTitle,
        body: body,
        clientTimezone: clientTimezone,
    });
    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating expenses report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}