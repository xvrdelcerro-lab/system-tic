'use server';

import { formatInTimeZone } from 'date-fns-tz';
import { formatNumber } from '@/lib/utils';
import type { ProductionRecord } from '@/hooks/use-production';
import { getReportLayout } from '@/lib/report-layout';

function formatPieceAmount(pieces: number, pieceUnit?: string): string {
  return `${formatNumber(pieces)} ${pieceUnit || 'pieces'}`;
}

function formatScaleAmount(pieces: number, unitAmount?: number, unitScale?: string): string {
  if (!unitAmount || unitAmount <= 1 || !unitScale) return '';
  const total = pieces * unitAmount;
  return `${formatNumber(total)} ${unitScale}`;
}

function needsScaleColumn(records: ProductionRecord[]): boolean {
  return records.some(rec => {
    const unitAmount = (rec.snapshot as any).unitAmount || 1;
    return unitAmount > 1;
  });
}

function isPackaging(phaseName: string): boolean {
  return phaseName.toLowerCase() === 'packaging';
}

function getProductionLabel(phaseName: string): string {
  return isPackaging(phaseName) ? 'FINISHED' : 'PROCESSED';
}

function generateReportHtml(
  records: ProductionRecord[],
  filterTitle: string,
  translations: any,
  clientTimezone: string
) {
  if (records.length === 0) {
    return getReportLayout({
      title: translations.title,
      subtitle: filterTitle,
      body: `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noRecords}</p>`,
      clientTimezone,
    });
  }

  const showScale = needsScaleColumn(records);
  let bodyContent = '';

  // --- 1. CALCULATE GRAND TOTALS ---
  const grandProductTotals: Record<string, any> = {};
  const grandPhaseTotals: Record<string, any> = {};
  let totalProducedAll = 0;
  let totalDamagedAll = 0;

  records.forEach(rec => {
    const productName = rec.productName;
    const phaseName = rec.snapshot.phaseName;
    const good = rec.snapshot.goodQuantity;
    const damaged = rec.snapshot.damagedQuantity;

    if (!grandProductTotals[productName]) {
      grandProductTotals[productName] = { produced: 0, damaged: 0, pieceUnit: (rec.snapshot as any).pieceUnit || 'pieces' };
    }
    grandProductTotals[productName].produced += good;
    grandProductTotals[productName].damaged += damaged;

    if (!grandPhaseTotals[phaseName]) {
      grandPhaseTotals[phaseName] = { produced: 0, damaged: 0, pieceUnit: (rec.snapshot as any).pieceUnit || 'pieces' };
    }
    grandPhaseTotals[phaseName].produced += good;
    grandPhaseTotals[phaseName].damaged += damaged;

    totalProducedAll += good;
    totalDamagedAll += damaged;
  });

  // --- PACKAGING BREAKDOWN ---
  const packagingBreakdown: Record<string, any> = {};
  let packagingTotal = 0;
  let packagingDamagedTotal = 0;

  records.forEach(rec => {
    const phaseName = rec.snapshot.phaseName;
    if (isPackaging(phaseName)) {
      const productName = rec.productName;
      const good = rec.snapshot.goodQuantity;
      const damaged = rec.snapshot.damagedQuantity;
      const pieceUnit = (rec.snapshot as any).pieceUnit || 'pieces';

      if (!packagingBreakdown[productName]) {
        packagingBreakdown[productName] = { produced: 0, damaged: 0, pieceUnit };
      }
      packagingBreakdown[productName].produced += good;
      packagingBreakdown[productName].damaged += damaged;
      packagingTotal += good;
      packagingDamagedTotal += damaged;
    }
  });

  // --- 2. BUILD SUMMARY TABLES ---
  const productRows = Object.entries(grandProductTotals).map(([name, totals]) => `
    <tr>
      <td><strong>${name}</strong></td>
      <td class="text-right">${formatPieceAmount(totals.produced, totals.pieceUnit)}</td>
      <td class="text-right" style="color: #b91c1c;">${formatPieceAmount(totals.damaged, totals.pieceUnit)}</td>
    </tr>`).join('');

  const phaseRows = Object.entries(grandPhaseTotals).map(([name, totals]) => `
    <tr>
      <td><strong>${name}</strong></td>
      <td class="text-right">${formatPieceAmount(totals.produced, totals.pieceUnit)}</td>
      <td class="text-right" style="color: #b91c1c;">${formatPieceAmount(totals.damaged, totals.pieceUnit)}</td>
    </tr>`).join('');

  const packagingRows = Object.entries(packagingBreakdown).map(([name, totals]) => `
    <tr>
      <td><strong>${name}</strong></td>
      <td class="text-right">${formatPieceAmount(totals.produced, totals.pieceUnit)}</td>
      <td class="text-right" style="color: #b91c1c;">${formatPieceAmount(totals.damaged, totals.pieceUnit)}</td>
    </tr>`).join('');

  const packagingTable = Object.keys(packagingBreakdown).length > 0 ? `
    <div style="flex: 1; min-width: 300px;">
      <h3>Packaging Phase Breakdown (Finished Products)</h3>
      <table>
        <thead><tr><th>PRODUCT</th><th class="text-right">FINISHED</th><th class="text-right">DAMAGED</th></tr></thead>
        <tbody>
          ${packagingRows}
          <tr style="background: #f1f5f9; font-weight: bold;">
            <td>TOTAL FINISHED</td>
            <td class="text-right">${formatNumber(packagingTotal)} pieces</td>
            <td class="text-right" style="color: #b91c1c;">${formatNumber(packagingDamagedTotal)} pieces</td>
          </tr>
        </tbody>
      </table>
    </div>` : '';

  bodyContent += `
    <div class="section" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
      <h2 style="margin-top:0; color: #1e40af; border-left: 4px solid #1e40af; padding-left: 10px;">REPORT SUMMARY</h2>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px;">
          <h3>Totals per Item</h3>
          <table>
            <thead><tr><th>PRODUCT</th><th class="text-right">UNITS</th><th class="text-right">DAMAGED</th></tr></thead>
            <tbody>
              ${productRows}
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td>GRAND TOTAL</td>
                <td class="text-right">${formatNumber(totalProducedAll)} pieces</td>
                <td class="text-right" style="color: #b91c1c;">${formatNumber(totalDamagedAll)} pieces</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="flex: 1; min-width: 300px;">
          <h3>Totals per Phase</h3>
          <table>
            <thead><tr><th>PHASE</th><th class="text-right">UNITS</th><th class="text-right">DAMAGED</th></tr></thead>
            <tbody>
              ${phaseRows}
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td>GRAND TOTAL</td>
                <td class="text-right">${formatNumber(totalProducedAll)}</td>
                <td class="text-right" style="color: #b91c1c;">${formatNumber(totalDamagedAll)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${packagingTable}
      </div>
    </div>
    <h2 style="text-align: center; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 40px 0;">Daily Production Logs</h2>
  `;

  // --- 3. BUILD DAILY LOGS ---
  const groupedByDay = records.reduce((acc, record) => {
    const dayKey = formatInTimeZone(record.createdAt, clientTimezone, 'yyyy-MM-dd');
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(record);
    return acc;
  }, {} as Record<string, ProductionRecord[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => a.localeCompare(b));

  bodyContent += sortedDays.map(dayKey => {
    const dayRecords = groupedByDay[dayKey];
    const formattedDate = formatInTimeZone(new Date(dayKey + 'T00:00:00'), clientTimezone, 'MMMM dd, yyyy');
    
    const groupedByPhase: Record<string, ProductionRecord[]> = {};
    dayRecords.forEach(rec => {
      const phase = rec.snapshot.phaseName;
      if (!groupedByPhase[phase]) groupedByPhase[phase] = [];
      groupedByPhase[phase].push(rec);
    });

    const detailTables = Object.entries(groupedByPhase).map(([phaseName, phaseRecords]) => {
      const phaseProduced = phaseRecords.reduce((sum, r) => sum + r.snapshot.goodQuantity, 0);
      const phaseDamaged = phaseRecords.reduce((sum, r) => sum + r.snapshot.damagedQuantity, 0);
      const pieceUnit = (phaseRecords[0].snapshot as any).pieceUnit || 'pieces';
      const productionLabel = getProductionLabel(phaseName);

      return `
        <h4 style="margin-top:1.5rem; color: #374151; background: #f1f5f9; padding: 8px;">${phaseName}</h4>
        <table>
          <thead><tr><th>TIME</th><th>PRODUCT</th><th class="text-right">${productionLabel}</th><th class="text-right">DAMAGED</th></tr></thead>
          <tbody>
            ${phaseRecords.map(rec => `
              <tr>
                <td>${formatInTimeZone(rec.createdAt, clientTimezone, 'p')}</td>
                <td><strong>${rec.productName}</strong></td>
                <td class="text-right">${formatPieceAmount(rec.snapshot.goodQuantity, (rec.snapshot as any).pieceUnit)}</td>
                <td class="text-right" style="color: #b91c1c;">${formatPieceAmount(rec.snapshot.damagedQuantity, (rec.snapshot as any).pieceUnit)}</td>
              </tr>
            `).join('')}
            <tr style="background: #fafafa; font-weight: bold; border-top: 2px solid #e2e8f0;">
              <td></td>
              <td>Total</td>
              <td class="text-right">${formatPieceAmount(phaseProduced, pieceUnit)}</td>
              <td class="text-right" style="color: #b91c1c;">${formatPieceAmount(phaseDamaged, pieceUnit)}</td>
            </tr>
          </tbody>
        </table>`;
    }).join('');

    return `<div class="day-section" style="margin-bottom: 4rem;">
              <h2 style="color: #3560AD; border-left: 4px solid #3560AD; padding-left: 10px;">${formattedDate}</h2>
              ${detailTables}
            </div>`;
  }).join('');

  return getReportLayout({
    title: translations.title,
    subtitle: filterTitle,
    body: bodyContent,
    clientTimezone,
  });
}

export async function generateProductionReport(
  records: ProductionRecord[],
  filterTitle: string,
  translations: any,
  clientTimezone: string
) {
  try {
    const finalHtml = generateReportHtml(records, filterTitle, translations, clientTimezone);
    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating production report:', error);
    return { success: false, error: `{t('ReportErrors.failedToGenerate')}` };
  }
}