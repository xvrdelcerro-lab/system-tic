
'use server';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Expense } from '@/lib/types';
import { getReportLayout } from '@/lib/report-layout';

function generateReportHtml(records: Expense[], filterTitle: string, translations: any, clientTimezone: string) {
    const grandTotalCost = records.reduce((sum, rec) => sum + rec.amount, 0);

    // Group expenses by category
    const expensesByCategory: { [key: string]: Expense[] } = records.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(expense);
        return acc;
    }, {} as { [key: string]: Expense[] });

    let bodyContent = '';

    if (records.length > 0) {
        const sortedCategories = Object.keys(expensesByCategory).sort();

        for (const category of sortedCategories) {
            const categoryRecords = expensesByCategory[category];
            const categoryTotal = categoryRecords.reduce((sum, rec) => sum + rec.amount, 0);
            const categoryName = translations.Accounts?.[category]?.name || category;

            bodyContent += `
            <div class="section" style="page-break-inside: avoid;">
                <h2>${categoryName}</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">${translations.dateHeader}</th>
                            <th>${translations.descriptionHeader}</th>
                            <th style="text-align: right; width: 25%;">${translations.amountHeader}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoryRecords.map(rec => `
                            <tr>
                                <td style="vertical-align: top;">${format(rec.date, 'MMM-dd-yy')}</td>
                                <td style="vertical-align: top;">
                                    ${rec.description}
                                    ${rec.notes ? `<p style="font-size: 0.9em; font-style: italic; color: #6b7280;"><strong>Notes:</strong> ${rec.notes}</p>` : ''}
                                </td>
                                <td class="text-right" style="vertical-align: top;">${formatCurrency(rec.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="text-align: right; font-weight: bold;">Subtotal</td>
                            <td class="text-right" style="font-weight: bold;">${formatCurrency(categoryTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            `;
        }

        bodyContent += `
            <div style="width: 50%; margin-left: auto; margin-top: 2rem;">
                <table style="border: none;">
                    <tfoot style="border-top: 2px solid #333;">
                        <tr>
                            <td style="text-align: right; border: none; font-size: 1.1em; padding: 8px 0;"><strong>${translations.grandTotal}</strong></td>
                            <td style="text-align: right; border: none; font-size: 1.1em; width: 50%; padding: 8px 0;"><strong>${formatCurrency(grandTotalCost)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    } else {
        bodyContent = `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.empty}</p>`;
    }
    
    return getReportLayout({
        title: translations.title,
        subtitle: filterTitle,
        body: bodyContent,
        clientTimezone: clientTimezone,
    });
}

export async function generateExpensesReport(records: Expense[], filterTitle: string, translations: any, clientTimezone: string) {
  try {
    const finalHtml = generateReportHtml(records, filterTitle, translations, clientTimezone);
    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating expenses report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `Failed to generate report: ${errorMessage}` };
  }
}
