export type ReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  type?: 'text' | 'number' | 'kpi';
};

type ReportBuilderProps<T> = {
  title: string;
  subtitle?: string;
  meta?: string;
  columns: ReportColumn[];
  rows: T[];
};

/* -----------------------------
   Helpers
--------------------------------*/

function renderCell(value: any, col: ReportColumn): string {
  if (value === null || value === undefined) return '—';

  if (col.type === 'kpi') {
    const num = Number(value);
    if (isNaN(num)) return String(value);

    if (num > 0) {
      return `<span class="kpi positive">&#9650; ${num}%</span>`;
    }

    if (num < 0) {
      return `<span class="kpi negative">&#9660; ${Math.abs(num)}%</span>`;
    }

    return `<span class="kpi neutral">0%</span>`;
  }

  return String(value);
}

/* -----------------------------
   Builder
--------------------------------*/

export function buildTableReport<T extends Record<string, any>>({
  title,
  subtitle,
  meta,
  columns,
  rows,
}: ReportBuilderProps<T>) {
  // Calculate grand total and days count
  const allDates = Array.from(new Set(rows.map(r => r.date)));
  const daysCount = allDates.length;
  const grandTotal = rows.reduce((sum, r) => {
    const val = r.totalCost ? Number(String(r.totalCost).replace(/[^\d.-]+/g, '')) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const { formatNumber } = require('@/lib/utils');
  const header = `
<div class="report-title">
  <h1>${title}</h1>
  <div style="margin: 12px 0; font-size: 15px; font-weight: bold; color: #3560AD;">
    Grand Total Cost: $${formatNumber(grandTotal.toFixed(2))} &mdash; Period: ${daysCount} day${daysCount !== 1 ? 's' : ''}
  </div>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  <div class="meta">
    ${meta ?? `Generated on ${new Date().toLocaleDateString()}`}
  </div>
</div>
<hr />
`;

  const thead = `
<thead>
  <tr>
    ${columns
      .map(
        (col) =>
          `<th style="text-align:${col.align ?? 'left'}">${col.label}</th>`
      )
      .join('')}
  </tr>
</thead>
`;

  // Group rows by date for summary
  const rowsByDate = rows.reduce((acc, row) => {
    const date = row.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(row);
    return acc;
  }, {} as Record<string, T[]>);

  const tbody = `
<tbody>
  ${Object.entries(rowsByDate)
    .map(([date, dayRows]) => {
      const dayRowsHtml = dayRows
        .map(
          (row) => `
        <tr>
          ${columns
            .map(
              (col) => `
            <td style="text-align:${col.align ?? 'left'}">
              ${renderCell(row[col.key], col)}
            </td>
          `
            )
            .join('')}
        </tr>
      `
        )
        .join('');
      // Calculate grand total for the day
      const totalCost = dayRows.reduce((sum, r) => {
        const val = r.totalCost ? Number(String(r.totalCost).replace(/[^\d.-]+/g, '')) : 0;
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      // Use formatNumber for thousand separator
      // Import at top: import { formatNumber } from '@/lib/utils';
      return `
        ${dayRowsHtml}
        <tr style="background:#f3f4f6;font-weight:bold;">
          <td colspan="${columns.length - 1}" style="text-align:right;">Grand Total for ${date}:</td>
          <td style="text-align:right;">$${require('@/lib/utils').formatNumber(totalCost.toFixed(2))}</td>
        </tr>
      `;
    })
    .join('')}
</tbody>
`;

  return `
${header}

<table>
  ${thead}
  ${tbody}
</table>

<div class="legend">
  ▲ / ▼ = change vs previous period
</div>

</body>
</html>
`;
}
