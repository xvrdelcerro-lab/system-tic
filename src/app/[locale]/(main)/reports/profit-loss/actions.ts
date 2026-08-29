'use server';

import { formatCurrency } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';

type MonthlyData = {
  monthLabel: string;
  revenue: number;
  cogs: number;
  cogsBreakdown: {
    beginningInventory: number;
    beginningRawMats: number;
    beginningFinishedGoods: number;
    purchases: number;
    labor: number;
    endingInventory: number;
    endingRawMats: number;
    endingFinishedGoods: number;
  };
  opex: number;
  grossMargin: number;
  netIncome: number;
};

type Totals = {
  revenue: number;
  cogs: number;
  opex: number;
  grossMargin: number;
  netIncome: number;
};

function generateReportBody(monthlyData: MonthlyData[], totals: Totals): string {
  const monthColumns = monthlyData.map(m => `<th class="text-right">${m.monthLabel}</th>`).join('');
  
  return `
    <style>
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
      th, td { padding: 4px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
      th { background-color: #f9fafb; font-weight: 600; }
      .text-right { text-align: right; }
      .indent-1 { padding-left: 24px; }
      .indent-2 { padding-left: 40px; font-size: 10px; color: #6b7280; }
      .section-total { font-weight: 600; border-top: 2px solid #374151; background-color: #f3f4f6; }
      .grand-total { font-weight: 700; border-top: 3px double #1f2937; background-color: #e5e7eb; }
      .negative { color: #dc2626; }
      .positive { color: #16a34a; }
    </style>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">CONCEPT</th>
            ${monthColumns}
            <th class="text-right" style="background-color: #e5e7eb;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <!-- REVENUE -->
          <tr>
            <td><strong>Revenue</strong></td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.revenue)}</td>`).join('')}
            <td class="text-right section-total">${formatCurrency(totals.revenue)}</td>
          </tr>

          <!-- COST OF GOODS SOLD -->
          <tr>
            <td><strong>Cost of Goods Sold</strong></td>
            ${monthlyData.map(m => `<td class="text-right negative">(${formatCurrency(m.cogs)})</td>`).join('')}
            <td class="text-right section-total negative">(${formatCurrency(totals.cogs)})</td>
          </tr>

          <!-- COGS BREAKDOWN -->
          <tr>
            <td class="indent-1">Beginning Inventory</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.beginningInventory)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>
          <tr>
            <td class="indent-2">Raw Materials</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.beginningRawMats)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>
          <tr>
            <td class="indent-2">Finished Goods</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.beginningFinishedGoods)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>

          <tr>
            <td class="indent-1">+ Purchases</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.purchases)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>

          <tr>
            <td class="indent-1">+ Direct Labor</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.labor)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>

          <tr>
            <td class="indent-1">- Ending Inventory</td>
            ${monthlyData.map(m => `<td class="text-right negative">(${formatCurrency(m.cogsBreakdown.endingInventory)})</td>`).join('')}
            <td class="text-right"></td>
          </tr>
          <tr>
            <td class="indent-2">Raw Materials</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.endingRawMats)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>
          <tr>
            <td class="indent-2">Finished Goods</td>
            ${monthlyData.map(m => `<td class="text-right">${formatCurrency(m.cogsBreakdown.endingFinishedGoods)}</td>`).join('')}
            <td class="text-right"></td>
          </tr>

          <!-- GROSS MARGIN -->
          <tr class="section-total">
            <td><strong>Gross Margin</strong></td>
            ${monthlyData.map(m => `<td class="text-right ${m.grossMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(m.grossMargin)}</td>`).join('')}
            <td class="text-right ${totals.grossMargin >= 0 ? 'positive' : 'negative'}">${formatCurrency(totals.grossMargin)}</td>
          </tr>

          <!-- OPERATING EXPENSES -->
          <tr>
            <td><strong>Operating Expenses</strong></td>
            ${monthlyData.map(m => `<td class="text-right negative">(${formatCurrency(m.opex)})</td>`).join('')}
            <td class="text-right section-total negative">(${formatCurrency(totals.opex)})</td>
          </tr>

          <!-- NET INCOME -->
          <tr class="grand-total">
            <td><strong>Net Income</strong></td>
            ${monthlyData.map(m => `<td class="text-right ${m.netIncome >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(m.netIncome)}</strong></td>`).join('')}
            <td class="text-right ${totals.netIncome >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(totals.netIncome)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function generatePLReport({
  monthlyData,
  totals,
  period,
  locale,
  clientTimezone,
}: {
  monthlyData: MonthlyData[];
  totals: Totals;
  period: string;
  locale: string;
  clientTimezone: string;
}) {
  try {
    const body = generateReportBody(monthlyData, totals);
    
    const finalHtml = getReportLayout({
      title: 'Profit & Loss Statement',
      subtitle: period,
      body,
      clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating P&L report:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}