
"use server";

import { getReportLayout } from "@/lib/report-layout";

export async function generateScalesReport(payload: { 
  scalesByType: { type: string, scales: any[] }[], 
  clientTimezone: string, 
  translations: any,
}) {
  try {
    const t = payload.translations;
    
    const bodyContent = payload.scalesByType.map(group => `
      <div class="section">
        <h2>${group.type} (${group.scales.length})</h2>
        <table>
          <thead>
            <tr>
              <th>${t.headers.name}</th>
            </tr>
          </thead>
          <tbody>
            ${group.scales.map((scale: any) => `
              <tr>
                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${scale.name}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const html = getReportLayout({
        title: t.title,
        body: bodyContent,
        clientTimezone: payload.clientTimezone,
    });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Critical failure in scales report generation." };
  }
}
