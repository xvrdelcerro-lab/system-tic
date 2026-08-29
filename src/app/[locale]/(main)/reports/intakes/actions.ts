'use server';

import { format } from 'date-fns';
import { formatNumber } from '@/lib/utils';
import { getReportLayout } from '@/lib/report-layout';

export type EnrichedIntake = {
    date: string;
    materialName: string;
    vendorName: string;
    quantity: number;
    scale: string;
}

export async function generateIntakesReport(
  records: EnrichedIntake[],
  filterTitle: string,
  clientTimezone: string,
  translations: {
    title: string;
    table: {
      date: string;
      material: string;
      vendor: string;
      quantity: string;
    },
    noRecords: string;
  }
) {
  try {
    const groupedByVendor = records.reduce((acc, record) => {
        const vendorName = record.vendorName || 'Unknown Vendor';
        if (!acc[vendorName]) {
          acc[vendorName] = [];
        }
        acc[vendorName].push(record);
        return acc;
      }, {} as Record<string, EnrichedIntake[]>);

      const bodyContent = Object.keys(groupedByVendor).sort().map(vendorName => {
        const vendorRecords = groupedByVendor[vendorName];
        const sortedRecords = vendorRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return `
          <div class="section">
            <h2>${vendorName}</h2>
            <table>
                <thead>
                    <tr>
                        <th>${translations.table.date}</th>
                        <th>${translations.table.material}</th>
                        <th class="text-right">${translations.table.quantity}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedRecords.map(rec => `
                        <tr>
                            <td>${format(new Date(rec.date), 'MMM-dd-yy')}</td>
                            <td><strong>${rec.materialName}</strong></td>
                            <td class="text-right">${formatNumber(rec.quantity)} ${rec.scale}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
          </div>
        `;
      }).join('');


    const finalHtml = getReportLayout({
        title: translations.title,
        subtitle: filterTitle,
        body: bodyContent.length > 0 ? bodyContent : `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${translations.noRecords}</p>`,
        clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error('Error generating intakes report:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: errorMessage })}` };
  }
}
