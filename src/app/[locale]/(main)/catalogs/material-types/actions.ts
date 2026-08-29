
'use server';

import { getReportLayout } from '@/lib/report-layout';

export async function generateCatalogReport(
  formData: FormData,
  dataToPrint: any[], // Use the translated data sent from the page
  clientTimezone: string,
  labels: {
    title: string;
    totalLabel: string;
    nameCol: string;
    descCol: string;
  },
  locale: string
) {
  try {
    const bodyContent = `
        <div class="section">
            <table>
              <thead>
                <tr>
                  <th>${labels.nameCol}</th>
                  <th>${labels.descCol}</th>
                </tr>
              </thead>
              <tbody>
                ${dataToPrint.map(m => `
                  <tr>
                    <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${m.name}</strong></td>
                    <td>${m.description || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
        </div>
    `;
    
    const html = getReportLayout({
      title: labels.title,
      subtitle: `${labels.totalLabel}: ${dataToPrint.length}`,
      body: bodyContent,
      clientTimezone: clientTimezone,
    });

    return { success: true, reportContent: html };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
