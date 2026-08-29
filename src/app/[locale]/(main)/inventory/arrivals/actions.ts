
'use server';

import { getReportLayout } from '@/lib/report-layout';
import { formatNumber } from '@/lib/utils';
import { formatDateSafe } from '@/lib/date';

// This is the data that will be passed from the client
type EnrichedIntake = {
    id: string;
    materialName: string;
    vendorName: string;
    quantity: number;
    scale?: string;
    date: string | Date;
    materialType: string;
};

function generateHtmlBody(records: EnrichedIntake[], t: any): string {
    const groupedByType = records.reduce((acc, record) => {
        const type = record.materialType || t.uncategorized;
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(record);
        return acc;
    }, {} as Record<string, EnrichedIntake[]>);

    if (Object.keys(groupedByType).length === 0) {
        return `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${t.noRecords}</p>`;
    }

    return Object.keys(groupedByType).sort().map(type => {
        const typeRecords = groupedByType[type];
        
        const groupedByMaterial = typeRecords.reduce((acc, record) => {
            const material = record.materialName;
            if (!acc[material]) {
                acc[material] = [];
            }
            acc[material].push(record);
            return acc;
        }, {} as Record<string, EnrichedIntake[]>);

        const materialTables = Object.keys(groupedByMaterial).sort().map(materialName => {
            const materialRecords = groupedByMaterial[materialName];
            const materialTotal = materialRecords.reduce((sum, r) => sum + r.quantity, 0);
            const scale = materialRecords[0]?.scale || '';

            return `
                <div style="margin-bottom: 20px; page-break-inside: avoid;">
                    <h3 style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #374151; border-left: 4px solid #3560AD; padding-left: 10px;">${materialName}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>${t.table.date}</th>
                                <th>${t.table.vendor}</th>
                                <th class="text-right">${t.table.quantity}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${materialRecords.map(rec => `
                                <tr>
                                    <td>${formatDateSafe(rec.date)}</td>
                                    <td>${rec.vendorName}</td>
                                    <td class="text-right">${formatNumber(rec.quantity)} ${rec.scale || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2" class="text-right"><strong>${t.itemTotal}</strong></td>
                                <td class="text-right">${formatNumber(materialTotal)} ${scale}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }).join('');

        return `
            <div class="section">
                <h2>${type}</h2>
                ${materialTables}
            </div>
        `;
    }).join('');
}


export async function generateIntakesReport(
    records: EnrichedIntake[], 
    filterTitle: string, 
    clientTimezone: string,
    translations: any
) {
  try {
    const t = translations;
    const body = generateHtmlBody(records, t);
    const finalHtml = getReportLayout({
        title: t.title,
        subtitle: filterTitle,
        body,
        clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating intakes report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
