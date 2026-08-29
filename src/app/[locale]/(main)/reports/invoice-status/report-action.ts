'use server';

import { format, startOfMonth, isSameMonth } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';

type InvoiceReportData = {
  invoiceNumber: string;
  customer: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  total: number;
  paid: boolean;
  paidDate: Date | null;
  overdue: boolean;
};

type Summary = {
  total: number;
  paid: number;
  unpaid: number;
  paidAmount: number;
  unpaidAmount: number;
  overdue: number;
};

type MonthlyGroup = {
  monthLabel: string;
  invoices: InvoiceReportData[];
  totalAmount: number;
  count: number;
};

export async function generateInvoiceStatusReport(params: {
  invoices: InvoiceReportData[];
  summary: Summary;
  translations: any;
  clientTimezone: string;
}) {
  try {
    const { invoices, summary, translations, clientTimezone } = params;

    // Group invoices by month
    const monthlyGroups: { [key: string]: MonthlyGroup } = {};

    invoices.forEach((inv) => {
      if (!inv.invoiceDate) return;

      const monthKey = format(startOfMonth(inv.invoiceDate), 'yyyy-MM');
      const monthLabel = format(inv.invoiceDate, 'MMMM yyyy');

      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          monthLabel,
          invoices: [],
          totalAmount: 0,
          count: 0,
        };
      }

      monthlyGroups[monthKey].invoices.push(inv);
      monthlyGroups[monthKey].totalAmount += inv.total;
      monthlyGroups[monthKey].count += 1;
    });

    // Sort months in descending order (most recent first)
    const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => b.localeCompare(a));

    // Build monthly sections
    let monthlyContent = '';
    let grandTotal = 0;
    let totalInvoiceCount = 0;

    sortedMonths.forEach((monthKey) => {
      const group = monthlyGroups[monthKey];
      grandTotal += group.totalAmount;
      totalInvoiceCount += group.count;

      let tableRows = '';
      group.invoices.forEach((inv) => {
        const statusBadge = inv.paid
          ? '<span style="background: #16a34a; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">PAID</span>'
          : inv.overdue
          ? '<span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">OVERDUE</span>'
          : '<span style="background: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">UNPAID</span>';

        const rowBg = inv.paid ? 'background: #f0fdf4;' : '';

        // Days overdue calculation
        let daysOverdue = '';
        if (!inv.paid && inv.dueDate) {
          const today = new Date();
          const due = inv.dueDate;
          if (today > due) {
            daysOverdue = String(Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
        tableRows += `
          <tr style="${rowBg}">
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${inv.invoiceNumber}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${inv.customer}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${inv.invoiceDate ? format(inv.invoiceDate, 'MMM-dd-yy') : '-'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${inv.dueDate ? format(inv.dueDate, 'MMM-dd-yy') : '-'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #dc2626; font-weight: bold;">${daysOverdue}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(inv.total)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${statusBadge}</td>
          </tr>
        `;
      });

      monthlyContent += `
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <div style="background: #3560AD; color: white; padding: 12px 16px; border-radius: 6px 6px 0 0; margin-bottom: 0;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${group.monthLabel}</h3>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${group.count} invoice${group.count !== 1 ? 's' : ''}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-top: none;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.invoiceNumber}</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.customer}</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.date}</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.dueDate}</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.daysOverdue}</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.total}</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px;">${translations.tableHeaders.status}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #3560AD; background: #eff6ff;">
                <td colspan="5" style="padding: 12px; font-weight: bold; font-size: 15px; color: #1e40af;">Month Total</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px; color: #3560AD;">${formatCurrency(group.totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });

    const bodyContent = `
      <div style="margin-bottom: 30px;">
        <h2 style="margin-bottom: 20px; color: #1f2937; font-size: 20px; border-bottom: 2px solid #3560AD; padding-bottom: 10px;">Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: white;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Total Invoices</div>
            <div style="font-size: 28px; font-weight: bold; color: #1f2937;">${summary.total}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: white;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Paid</div>
            <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${summary.paid}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${formatCurrency(summary.paidAmount)}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: white;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Unpaid</div>
            <div style="font-size: 28px; font-weight: bold; color: #f97316;">${summary.unpaid}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${formatCurrency(summary.unpaidAmount)}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: white;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Overdue</div>
            <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${summary.overdue}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: white;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Total Value</div>
            <div style="font-size: 24px; font-weight: bold; color: #3560AD;">${formatCurrency(summary.paidAmount + summary.unpaidAmount)}</div>
          </div>
        </div>
      </div>

      <h2 style="margin-bottom: 25px; color: #1f2937; font-size: 20px; border-bottom: 2px solid #3560AD; padding-bottom: 10px;">Invoices by Month</h2>
      ${monthlyContent}
    `;

    const reportHtml = getReportLayout({
      title: 'Invoice Status Report',
      subtitle: `${summary.total} invoices • ${summary.paid} paid • ${summary.unpaid} unpaid • ${summary.overdue} overdue`,
      body: bodyContent,
      clientTimezone,
    });

    return { success: true, reportContent: reportHtml };
  } catch (error) {
    console.error('Error generating invoice status report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}