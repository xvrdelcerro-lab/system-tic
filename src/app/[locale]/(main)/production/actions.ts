'use server';

import { format } from 'date-fns';
import { formatNumber } from '@/lib/utils';
import type { ProductionRecord } from '@/hooks/use-production';
import { getReportLayout } from '@/lib/report-layout';

// Helper to format scaled units (kg, l, g, etc.)
function formatScaledAmount(pieces: number, scale?: number, scaleUnit?: string): string {
  if (!scale || scale <= 0 || !scaleUnit) {
    return `${formatNumber(pieces)} pieces`;
  }
  const total = pieces * scale;
  return `${formatNumber(pieces)} pieces (${formatNumber(total)} ${scaleUnit})`;
}

// Helper specifically for damaged quantities or totals (weight only)
function formatWeight(pieces: number, scale?: number, scaleUnit?: string): string {
  if (!scale || scale <= 0 || !scaleUnit) {
    return `${formatNumber(pieces)} pieces`;
  }
  const total = pieces * scale;
  return `${formatNumber(total)} ${scaleUnit}`;
}

function generateReportHtml(records: ProductionRecord[], filterTitle: string, translations: any, clientTimezone: string) {
  let grandTotalProducedPieces = 0;
  let grandTotalDamagedPieces = 0;
  let grandTotalProducedWeight = 0;
  let grandTotalDamagedWeight = 0;
  let weightUnit = '';

  records.forEach(rec => {
    const produced = rec.snapshot.phaseName === 'Packaging' ? rec.snapshot.goodQuantity : 0;
    const damaged = rec.snapshot.damagedQuantity;
    const scale = (rec.snapshot as any).scale || 0;
    const scaleUnit = (rec.snapshot as any).scaleUnit || '';

    grandTotalProducedPieces += produced;
    grandTotalDamagedPieces += damaged;

    if (scale > 0) {
      grandTotalProducedWeight += produced * scale;
      grandTotalDamagedWeight += damaged * scale;
      if (!weightUnit) weightUnit = scaleUnit;
    }
  });

  const groupedByDay = records.reduce((acc, record) => {
    const dayKey = format(record.createdAt, 'yyyy-MM-dd');
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(record);
    return acc;
  }, {} as Record<string, ProductionRecord[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => a.localeCompare(b));

  let bodyContent = '';

  if (records.length > 0) {
    bodyContent = sortedDays.map(dayKey => {
      const dayRecords = groupedByDay[dayKey];
      const sortedDayRecords = dayRecords.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      let dayTotalProducedPieces = 0;
      let dayTotalDamagedPieces = 0;
      let dayTotalProducedWeight = 0;
      let dayTotalDamagedWeight = 0;

      dayRecords.forEach(rec => {
        const produced = rec.snapshot.phaseName === 'Packaging' ? rec.snapshot.goodQuantity : 0;
        const damaged = rec.snapshot.damagedQuantity;
        const scale = (rec.snapshot as any).scale || 0;

        dayTotalProducedPieces += produced;
        dayTotalDamagedPieces += damaged;

        if (scale > 0) {
          dayTotalProducedWeight += produced * scale;
          dayTotalDamagedWeight += damaged * scale;
        }
      });

      const formattedDate = format(new Date(dayKey + 'T00:00:00'), 'MMMM dd, yyyy');

      return `
        <div class="section">
          <h2>${formattedDate}</h2>
          <table>
            <thead>
              <tr>
                <th>${translations.table.time}</th>
                <th>${translations.table.product}</th>
                <th>${translations.table.phase}</th>
                <th class="text-right">${translations.table.produced}</th>
                <th class="text-right">${translations.table.damaged}</th>
              </tr>
            </thead>
            <tbody>
              ${sortedDayRecords.map(rec => {
                const scale = (rec.snapshot as any).scale || 0;
                const scaleUnit = (rec.snapshot as any).scaleUnit || '';
                return `
                  <tr>
                    <td>${format(rec.createdAt, 'p')}</td>
                    <td><strong>${rec.productName}</strong></td>
                    <td>${rec.snapshot.phaseName}</td>
                    <td class="text-right">${formatScaledAmount(rec.snapshot.goodQuantity, scale, scaleUnit)}</td>
                    <td class="text-right" style="color: #b91c1c;">${formatWeight(rec.snapshot.damagedQuantity, scale, scaleUnit)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-right"><strong>${translations.totals.daily}</strong></td>
                <td class="text-right">${formatScaledAmount(dayTotalProducedPieces, weightUnit ? dayTotalProducedWeight / dayTotalProducedPieces : 0, weightUnit)}</td>
                <td class="text-right" style="color: #b91c1c;">${formatScaledAmount(dayTotalDamagedPieces, weightUnit ? dayTotalDamagedWeight / dayTotalDamagedPieces : 0, weightUnit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    const showWeight = weightUnit && grandTotalProducedWeight > 0;

    bodyContent += `
      <div style="margin-top: 2rem;">
        <table style="width: ${showWeight ? '60%' : '50%'}; margin-left: auto; border: none;">
          <tbody style="border-top: 2px solid #333;">
            <tr>
              <td class="text-right" style="font-weight: bold; border: none; padding: 8px 0;">${translations.totals.produced}</td>
              <td class="text-right" style="font-weight: bold; border: none; padding: 8px 0; width: 30%;">${formatNumber(grandTotalProducedPieces)} pieces</td>
              ${showWeight ? `<td class="text-right" style="font-weight: bold; border: none; padding: 8px 0; width: 30%;">${grandTotalProducedWeight.toFixed(2)} ${weightUnit}</td>` : ''}
            </tr>
            <tr>
              <td class="text-right" style="font-weight: bold; border: none; padding: 8px 0;">${translations.totals.damaged}</td>
              <td class="text-right" style="font-weight: bold; border: none; padding: 8px 0; color: #b91c1c;">${formatNumber(grandTotalDamagedPieces)} pieces</td>
              ${showWeight ? `<td class="text-right" style="font-weight: bold; border: none; padding: 8px 0; color: #b91c1c;">${grandTotalDamagedWeight.toFixed(2)} ${weightUnit}</td>` : ''}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else {
    bodyContent = `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noRecords}</p>`;
  }

  return getReportLayout({
    title: translations.title,
    subtitle: filterTitle,
    body: bodyContent,
    clientTimezone: clientTimezone,
  });
}

export async function generateProductionReport(records: ProductionRecord[], filterTitle: string, translations: any, clientTimezone: string) {
  try {
    const finalHtml = generateReportHtml(records, filterTitle, translations, clientTimezone);
    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating production report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
