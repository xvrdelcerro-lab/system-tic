'use server';

import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { getReportLayout } from '@/lib/report-layout';
import { formatNumber } from '@/lib/utils';

// TODO: Import your data fetching functions
// import { getInvoices } from '@/lib/invoices';
// import { getExpenses } from '@/lib/expenses';
// import { getProductionRecords } from '@/lib/production';
// import { getInventoryItems } from '@/lib/inventory';

type MonthlyData = {
  month: Date;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
};

async function calculateRevenue(startDate: Date, endDate: Date): Promise<number> {
  // Fetch all invoices in date range (paid + unpaid)
  const { db } = await import('@/lib/firebase-admin');
  
  const invoicesSnapshot = await db
    .collection('invoices')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();
  
  let total = 0;
  invoicesSnapshot.forEach(doc => {
    const invoice = doc.data();
    total += invoice.total || 0;
  });
  
  return total;
}

async function calculateCOGS(startDate: Date, endDate: Date): Promise<number> {
  const { db } = await import('@/lib/firebase-admin');
  
  // 1. Calculate raw materials cost from production
  const productionSnapshot = await db
    .collection('production_events')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();
  
  let rawMaterialCost = 0;
  
  for (const prodDoc of productionSnapshot.docs) {
    const production = prodDoc.data();
    const totalProduced = (production.snapshot?.goodQuantity || 0) + (production.snapshot?.damagedQuantity || 0);
    
    // Get product to find components
    const productDoc = await db.collection('products').doc(production.productId).get();
    if (!productDoc.exists) continue;
    
    const product = productDoc.data();
    const components = product?.components || [];
    
    // Calculate cost for each component
    for (const component of components) {
      // Get inventory item to get price
      const itemDoc = await db.collection('inventory').doc(component.itemId).get();
      if (!itemDoc.exists) continue;
      
      const item = itemDoc.data();
      const unitPrice = item?.price || 0;
      const componentQty = component.quantity || 0;
      
      // Cost = total produced × component quantity × unit price
      rawMaterialCost += totalProduced * componentQty * unitPrice;
    }
  }
  
  // 2. Add Direct Labor expenses
  const laborSnapshot = await db
    .collection('expenses')
    .where('category', '==', 'Direct Labor')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();
  
  let laborCost = 0;
  laborSnapshot.forEach(doc => {
    const expense = doc.data();
    laborCost += expense.amount || 0;
  });
  
  return rawMaterialCost + laborCost;
}

async function calculateOperatingExpenses(startDate: Date, endDate: Date): Promise<number> {
  const { db } = await import('@/lib/firebase-admin');
  
  // Fetch all expenses EXCEPT "Direct Labor" category
  const expensesSnapshot = await db
    .collection('expenses')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();
  
  let total = 0;
  expensesSnapshot.forEach(doc => {
    const expense = doc.data();
    // Exclude Direct Labor (already counted in COGS)
    if (expense.category !== 'Direct Labor') {
      total += expense.amount || 0;
    }
  });
  
  return total;
}

async function getMonthlyData(startDate: Date, endDate: Date): Promise<MonthlyData[]> {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  const monthlyData: MonthlyData[] = [];
  
  for (const month of months) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const revenue = await calculateRevenue(monthStart, monthEnd);
    const cogs = await calculateCOGS(monthStart, monthEnd);
    const operatingExpenses = await calculateOperatingExpenses(monthStart, monthEnd);
    
    monthlyData.push({
      month,
      revenue,
      cogs,
      operatingExpenses,
    });
  }
  
  return monthlyData;
}

function generateReportHtml(
  monthlyData: MonthlyData[],
  startDate: Date,
  endDate: Date,
  translations: any,
  clientTimezone: string
) {
  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
  const totalCOGS = monthlyData.reduce((sum, m) => sum + m.cogs, 0);
  const totalOperatingExpenses = monthlyData.reduce((sum, m) => sum + m.operatingExpenses, 0);
  const totalGrossMargin = totalRevenue - totalCOGS;
  const totalNetIncome = totalGrossMargin - totalOperatingExpenses;
  
  const periodTitle = format(startDate, 'MMMM yyyy') + ' - ' + format(endDate, 'MMMM yyyy');
  
  let tableRows = '';
  
  // Header row
  tableRows += '<tr><th style="text-align: left;">Item</th>';
  monthlyData.forEach(m => {
    tableRows += `<th style="text-align: right;">${format(m.month, 'MMM yyyy')}</th>`;
  });
  tableRows += '<th style="text-align: right; font-weight: bold;">TOTAL</th></tr>';
  
  // Revenue row
  tableRows += '<tr><td style="font-weight: bold;">Revenue</td>';
  monthlyData.forEach(m => {
    tableRows += `<td style="text-align: right;">$${formatNumber(m.revenue)}</td>`;
  });
  tableRows += `<td style="text-align: right; font-weight: bold;">$${formatNumber(totalRevenue)}</td></tr>`;
  
  // COGS row
  tableRows += '<tr><td style="font-weight: bold;">Cost of Goods Sold</td>';
  monthlyData.forEach(m => {
    tableRows += `<td style="text-align: right;">$${formatNumber(m.cogs)}</td>`;
  });
  tableRows += `<td style="text-align: right; font-weight: bold;">$${formatNumber(totalCOGS)}</td></tr>`;
  
  // Separator
  tableRows += '<tr style="border-top: 2px solid #333;"><td style="font-weight: bold;">Gross Margin</td>';
  monthlyData.forEach(m => {
    const grossMargin = m.revenue - m.cogs;
    tableRows += `<td style="text-align: right; font-weight: bold;">$${formatNumber(grossMargin)}</td>`;
  });
  tableRows += `<td style="text-align: right; font-weight: bold;">$${formatNumber(totalGrossMargin)}</td></tr>`;
  
  // Blank row
  tableRows += '<tr><td colspan="' + (monthlyData.length + 2) + '" style="height: 20px;"></td></tr>';
  
  // Operating Expenses row
  tableRows += '<tr><td style="font-weight: bold;">Operating Expenses</td>';
  monthlyData.forEach(m => {
    tableRows += `<td style="text-align: right;">$${formatNumber(m.operatingExpenses)}</td>`;
  });
  tableRows += `<td style="text-align: right; font-weight: bold;">$${formatNumber(totalOperatingExpenses)}</td></tr>`;
  
  // Separator
  tableRows += '<tr style="border-top: 2px solid #333;"><td style="font-weight: bold;">Net Income</td>';
  monthlyData.forEach(m => {
    const netIncome = m.revenue - m.cogs - m.operatingExpenses;
    const color = netIncome >= 0 ? '#059669' : '#b91c1c';
    tableRows += `<td style="text-align: right; font-weight: bold; color: ${color};">$${formatNumber(netIncome)}</td>`;
  });
  const totalColor = totalNetIncome >= 0 ? '#059669' : '#b91c1c';
  tableRows += `<td style="text-align: right; font-weight: bold; color: ${totalColor};">$${formatNumber(totalNetIncome)}</td></tr>`;
  
  const bodyContent = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        ${tableRows}
      </thead>
    </table>
  `;
  
  return getReportLayout({
    title: 'Profit & Loss Statement',
    subtitle: periodTitle,
    body: bodyContent,
    clientTimezone,
  });
}

export async function generatePLReport(
  startDate: Date,
  endDate: Date,
  translations: any,
  clientTimezone: string
) {
  try {
    const monthlyData = await getMonthlyData(startDate, endDate);
    const reportHtml = generateReportHtml(monthlyData, startDate, endDate, translations, clientTimezone);
    
    return { success: true, reportContent: reportHtml };
  } catch (error) {
    console.error('Error generating P&L report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}