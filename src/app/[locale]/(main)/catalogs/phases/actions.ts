
'use server';

import { getReportLayout } from '@/lib/report-layout';

export async function generateCatalogReport(
  formData: FormData,
  dataToPrint: any[],
  clientTimezone: string,
  labels: any,
  locale: string
) {
  try {
    const bodyContent = `
      <div class="section">
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">${labels.orderCol || 'Order'}</th>
              <th>${labels.nameCol || 'Name'}</th>
              <th>${labels.descCol || 'Description'}</th>
            </tr>
          </thead>
          <tbody>
            ${dataToPrint.map((item) => `
              <tr>
                <td>${item.order}</td>
                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${item.name || ''}</strong></td>
                <td>${item.description || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const reportHtml = getReportLayout({
        title: labels.title,
        subtitle: `${labels.totalLabel}: ${dataToPrint.length}`,
        body: bodyContent,
        clientTimezone: clientTimezone,
    });

    return { 
      success: true, 
      reportContent: reportHtml
    };

  } catch (error) {
    console.error("Server Action Error:", error);
    const message = error instanceof Error ? error.message : "Action execution failed";
    return { success: false, error: message };
  }
}
