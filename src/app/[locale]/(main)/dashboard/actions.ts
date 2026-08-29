'use server';

import { formatInTimeZone } from 'date-fns-tz';
import { formatCurrency, formatNumber } from '@/lib/utils';

type Metric = {
  name: string;
  value: number;
  unit?: string;
  change?: string;
};

// Logic for the Green/Red Indicators on the far right
function renderKPI(changeValue: string | undefined): string {
  if (!changeValue) return '<span style="color: #6b7280;">0.0%</span>';
  
  const num = parseFloat(changeValue.replace(/[▲▼%\s,]/g, ''));
  if (isNaN(num)) return `<span>${changeValue}</span>`;
  
  if (num > 0) {
    return `<span style="color: #15803d; font-weight: bold;">&#9650; ${num.toFixed(1)}%</span>`;
  } else if (num < 0) {
    return `<span style="color: #b91c1c; font-weight: bold;">&#9660; ${Math.abs(num).toFixed(1)}%</span>`;
  }
  return `<span style="color: #6b7280;">0.0%</span>`;
}

export async function generateDashboardReport(payload: {
  timeRange: string;
  metrics: Metric[];
  clientTimezone: string;
  topSoldProducts: { name: string; value: number }[];
  inventory: { name: string; value: number }[];
  translations: any; // Passed from frontend t() hook
}) {
  try {
    const t = payload.translations;
    const BRAND_BLUE = "#3560AD";

    const generatedDate = formatInTimeZone(new Date(), payload.clientTimezone, "MMM-dd-yy 'at' HH:mm");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: sans-serif; color: #1f2937; font-size: 12px; margin: 0.5in; }
    /* Header matches Chart of Accounts sample */
    .report-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 2px solid ${BRAND_BLUE}; padding-bottom: 10px; }
    .report-header img { height: 45px; }
    .company h1 { margin: 0; font-size: 22px; color: ${BRAND_BLUE}; }
    .company p { margin: 0; font-size: 12px; color: #6b7280; }
    
    .report-title-section { margin: 20px 0; }
    .report-title-section h2 { margin: 0; font-size: 18px; color: #000; text-align: center; }
    .meta { font-size: 10px; color: #777; text-align: center; margin-top: 5px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding: 8px; }
    td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }

    /* Chart Boxes with Blue Accent Sidebar */
    .chart-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .chart-box { border: 1px solid #e5e7eb; padding: 15px; border-radius: 4px; page-break-inside: avoid; }
    .chart-box.full { grid-column: span 2; }
    .chart-title { 
      border-left: 4px solid ${BRAND_BLUE}; 
      padding-left: 8px; 
      color: ${BRAND_BLUE}; 
      font-weight: bold; 
      text-transform: uppercase; 
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <img src="/logo.png" />
    <div class="company">
      <h1>System@ic</h1>
      <p>Business Management System</p>
    </div>
  </div>

  <div class="report-title-section">
    <h2>${t.reportTitle}</h2>
    <div class="meta">
      ${t.timeRangeLabel}: ${payload.timeRange.toUpperCase()} · ${t.generatedOn}: ${generatedDate} · ${t.comparisonText}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t.metricLabel}</th>
        <th style="text-align: right;">${t.valueLabel}</th>
        <th style="text-align: right;">${t.changeLabel}</th>
      </tr>
    </thead>
    <tbody>
      ${payload.metrics.map(m => `
        <tr>
          <td style="font-weight: bold;">${m.name}</td>
          <td style="text-align: right;">${m.unit === '$' ? formatCurrency(m.value) : formatNumber(m.value)} ${m.unit && m.unit !== '$' ? m.unit : ''}</td>
          <td style="text-align: right;">${renderKPI(m.change)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="chart-box full" style="margin-top: 25px;">
    <div class="chart-title">${t.salesChartTitle}</div>
    <canvas id="salesChart" height="100"></canvas>
  </div>

  <div class="chart-container">
    <div class="chart-box">
      <div class="chart-title">${t.inventoryChartTitle}</div>
      <canvas id="inventoryChart" height="180"></canvas>
    </div>
    <div class="chart-box">
      <div class="chart-title">${t.productsChartTitle}</div>
      <canvas id="productsChart" height="180"></canvas>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    const brandBlue = '${BRAND_BLUE}';
    
    new Chart(document.getElementById('salesChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(payload.metrics.map(m => m.name))},
        datasets: [{ data: ${JSON.stringify(payload.metrics.map(m => m.value))}, borderColor: brandBlue, backgroundColor: 'rgba(53,96,173,0.1)', fill: true, tension: 0.4 }]
      },
      options: { plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('inventoryChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(payload.inventory.map(i => i.name))},
        datasets: [{ data: ${JSON.stringify(payload.inventory.map(i => i.value))}, backgroundColor: brandBlue }]
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('productsChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(payload.topSoldProducts.map(p => p.name))},
        datasets: [{ data: ${JSON.stringify(payload.topSoldProducts.map(p => p.value))}, backgroundColor: '#f59e0b' }]
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  </script>
</body>
</html>`;

    return { success: true, reportContent: html };
  } catch (e) {
    return { success: false, error: 'Report generation failed' };
  }
}