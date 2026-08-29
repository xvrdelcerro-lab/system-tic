
'use server';
/**
 * @fileOverview Generates a waste report. This flow no longer uses an LLM due to persistent validation errors.
 * It now generates the HTML report directly for reliability.
 */

import { z } from 'zod';
import { format } from 'date-fns';
import { toDateSafe, formatDateSafe } from '@/lib/date';
import { formatNumber } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';

/* -------------------- SCHEMAS -------------------- */
const WasteEntrySchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  phaseId: z.string(),
  phaseName: z.string(),
  damagedQuantity: z.number(),
  date: z.union([z.date(), z.string()]), // Accept either Date or string
});
type WasteEntry = z.infer<typeof WasteEntrySchema>;

const TranslationsSchema = z.object({
  title: z.string(),
  totalDamaged: z.string(),
  loggedDate: z.string(),
  time: z.string(),
  phase: z.string(),
  productName: z.string(),
  damaged: z.string(),
  noRecords: z.string(),
});

const WasteReportInputSchema = z.object({
  rawWasteLog: z.array(WasteEntrySchema),
  filters: z.object({
      phase: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
  }),
  clientTimezone: z.string().optional(),
  translations: TranslationsSchema,
});
export type WasteReportInput = z.infer<typeof WasteReportInputSchema>;

const WasteReportOutputSchema = z.object({
  reportContent: z
    .string()
    .describe('The generated waste report as a full HTML document.'),
});
export type WasteReportOutput = z.infer<typeof WasteReportOutputSchema>;

/* -------------------- HTML GENERATION -------------------- */

function generateHtmlBody(reportData: { phaseName: string; data: WasteEntry[] }[], t: z.infer<typeof TranslationsSchema>): string {
    if (!reportData || reportData.length === 0 || reportData.every(p => p.data.length === 0)) {
        return `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${t.noRecords}</p>`;
    }

    return reportData
        .filter(phase => phase.data.length > 0)
        .map(phase => {
            const totalDamagedForPhase = phase.data.reduce((sum, item) => sum + item.damagedQuantity, 0);

            // --- Damaged summary per item for this phase ---
            const damagedByProduct: Record<string, { name: string; total: number }> = {};
            for (const entry of phase.data) {
                if (!damagedByProduct[entry.productId]) {
                    damagedByProduct[entry.productId] = { name: entry.productName, total: 0 };
                }
                damagedByProduct[entry.productId].total += entry.damagedQuantity;
            }
            // Sort products by descending damaged count
            const sortedDamaged = Object.values(damagedByProduct).sort((a, b) => b.total - a.total);
            const summaryTable = `
                <div style="margin-bottom: 1.2rem;">
                    <h4 style="margin-bottom: 0.3rem; font-size: 1em; color: #1e293b;">Summary of Damaged Pieces per Item</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 0.3rem 0.5rem;">Product</th>
                                <th style="text-align: right; padding: 0.3rem 0.5rem;">Damaged</th>
                                <th style="text-align: right; padding: 0.3rem 0.5rem;">% of Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedDamaged.map(item => `
                                <tr>
                                    <td style="padding: 0.3rem 0.5rem;">${item.name}</td>
                                    <td style="text-align: right; padding: 0.3rem 0.5rem;">${formatNumber(item.total)}</td>
                                    <td style="text-align: right; padding: 0.3rem 0.5rem;">${totalDamagedForPhase > 0 ? ((item.total / totalDamagedForPhase) * 100).toFixed(1) : '0.0'}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="text-align: right; font-weight: bold; padding: 0.3rem 0.5rem;">Total</td>
                                <td style="text-align: right; font-weight: bold; padding: 0.3rem 0.5rem;">${formatNumber(totalDamagedForPhase)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;

            const phaseRows = phase.data
                .map(item => {
                    const date = toDateSafe(item.date);
                    if (!date) return '';
                    return `
                        <tr>
                            <td>${format(date, "MMM-dd-yy")}</td>
                            <td>${format(date, "HH:mm")}</td>
                            <td>${item.phaseName}</td>
                            <td style="border-left: 4px solid #3560AD; padding-left: 10px;">${item.productName}</td>
                            <td class="text-right">${formatNumber(item.damagedQuantity)}</td>
                        </tr>
                    `;
                })
                .join('');

            return `
                <div class="section">
                    <h2>${phase.phaseName} (${t.totalDamaged}: ${formatNumber(totalDamagedForPhase)})</h2>
                    ${summaryTable}
                    <div style=\"margin: 0.7rem 0 0.3rem; font-weight: bold; font-size: 1em; color: #334155;\">Records</div>
                    <table>
                        <thead>
                            <tr>
                                <th>${t.loggedDate}</th>
                                <th>${t.time}</th>
                                <th>${t.phase}</th>
                                <th>${t.productName}</th>
                                <th class="text-right">${t.damaged}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${phaseRows}
                        </tbody>
                    </table>
                </div>
            `;
        })
        .join('');
}


/* -------------------- MAIN FUNCTION -------------------- */
export async function generateWasteReport(
  input: WasteReportInput
): Promise<WasteReportOutput> {
  try {
    const { rawWasteLog, filters, clientTimezone, translations } = input;
    
    // Data is now pre-filtered on the client.
    const recordsToProcess = rawWasteLog.map(log => ({
      ...log,
      date: toDateSafe(log.date)!, // Ensure date is a Date object for sorting
    })).sort((a,b) => b.date.getTime() - a.date.getTime());

    const titleParts: string[] = [];
    if (filters.phase && filters.phase !== 'all') {
        titleParts.unshift(`Phase: ${filters.phase}`);
    }
    if (filters.startDate) {
        titleParts.push(`From: ${formatDateSafe(filters.startDate)}`);
    }
    if (filters.endDate) {
        titleParts.push(`To: ${formatDateSafe(filters.endDate)}`);
    }

    const filterTitle = titleParts.join(' | ');

    // Grouping logic
    const groupedByPhase = recordsToProcess.reduce((acc, record) => {
        const key = record.phaseName;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(record);
        return acc;
    }, {} as Record<string, WasteEntry[]>);

    const dataForReport = Object.keys(groupedByPhase)
        .sort()
        .map(phaseName => ({
            phaseName,
            data: groupedByPhase[phaseName],
        }));

    // HTML Generation
    const bodyContent = generateHtmlBody(dataForReport, translations);
    
    const reportHtml = getReportLayout({
        title: translations.title,
        subtitle: filterTitle,
        body: bodyContent,
        clientTimezone: clientTimezone,
    });

    return { reportContent: reportHtml };

  } catch (err: any) {
    console.error('Error generating waste report:', err);
    throw new Error(
      `Could not generate the waste report. Details: ${err.message}`
    );
  }
}
