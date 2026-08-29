
"use server";

import { formatCurrency } from "@/lib/utils";
import { getReportLayout } from '@/lib/report-layout';

export async function generateVendorsReport(payload: {
  vendors: any[],
  clientTimezone: string,
  translations: any,
  isSingle: boolean,
  locale: string,
  tData: any
}) {
  try {
    const t = payload.translations;
    const tData = payload.tData;
    
    const singleVendorBody = (vendor: any, t: any, tData: any) => {
        // KPIs
        const items = vendor.items || [];
        const totalItems = items.length;
        const avgPrice = items.length > 0 ? items.reduce((sum, i) => sum + (i.price || 0), 0) / items.length : 0;
        const minPrice = items.length > 0 ? Math.min(...items.map(i => i.price || 0)) : 0;
        const maxPrice = items.length > 0 ? Math.max(...items.map(i => i.price || 0)) : 0;
        const uniqueTypes = [...new Set(items.map(i => i.type))];
        const numTypes = uniqueTypes.length;

        // Pie chart data for material types
        const typeCounts = items.reduce((acc: Record<string, number>, item: any) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {});
        const pieColors = ["#3560AD", "#F59E42", "#16A34A", "#DC2626", "#FACC15", "#6366F1", "#F472B6", "#14B8A6"];
        const pieData = Object.entries(typeCounts);
        const pieTotal = items.length;
        // Pie chart SVG
        let pieChart = '';
        if (pieData.length > 0 && pieTotal > 0) {
          let currentAngle = 0;
          const radius = 40;
          const cx = 50, cy = 50;
          pieChart = '<svg width="110" height="110" viewBox="0 0 100 100">';
          pieData.forEach(([type, count], idx) => {
            const value = count as number;
            const angle = (value / pieTotal) * 360;
            const largeArc = angle > 180 ? 1 : 0;
            const x1 = cx + radius * Math.cos(Math.PI * (currentAngle - 90) / 180);
            const y1 = cy + radius * Math.sin(Math.PI * (currentAngle - 90) / 180);
            currentAngle += angle;
            const x2 = cx + radius * Math.cos(Math.PI * (currentAngle - 90) / 180);
            const y2 = cy + radius * Math.sin(Math.PI * (currentAngle - 90) / 180);
            pieChart += `<path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z" fill="${pieColors[idx % pieColors.length]}" stroke="#fff" stroke-width="1"/>`;
          });
          pieChart += '</svg>';
        }

        const kpiSection = `
          <div class="section" style="display: flex; gap: 32px; align-items: center; margin-bottom: 18px;">
            <div>
              <div style="font-size: 13px; font-weight: bold; color: #3560AD; margin-bottom: 8px;">Key Metrics</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px;">
                <div>Total Items</div><div><strong>${totalItems}</strong></div>
                <div>Material Types</div><div><strong>${numTypes}</strong></div>
                <div>Avg. Price</div><div><strong>${formatCurrency(avgPrice)}</strong></div>
                <div>Min Price</div><div><strong>${formatCurrency(minPrice)}</strong></div>
                <div>Max Price</div><div><strong>${formatCurrency(maxPrice)}</strong></div>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">Items by Material Type</div>
              ${pieChart}
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; justify-content: center;">
                ${pieData.map(([type], idx) => `<span style="display:inline-block;width:10px;height:10px;background:${pieColors[idx % pieColors.length]};border-radius:2px;margin-right:4px;"></span><span style="font-size:10px;">${tData.MaterialTypesData[type] || type}</span>`).join('<span style="width:8px;"></span>')}
              </div>
            </div>
          </div>
        `;

        const contactInfoSection = `
          <div class="section">
            <h2>${t.contactInfo}</h2>
            <table>
                <tbody>
                    <tr><th style="width: 150px;">Contact Person</th><td>${vendor.contactPerson || '—'}</td></tr>
                    <tr><th>Email</th><td>${vendor.email || '—'}</td></tr>
                    <tr><th>Phone</th><td>${vendor.phone || '—'}</td></tr>
                </tbody>
            </table>
          </div>
        `;

        const itemsSection = `
          <div class="section">
            <h2>${t.itemsSupplied}</h2>
            <table>
              <thead>
                <tr>
                  <th>${t.headers.sku}</th>
                  <th>${t.headers.item}</th>
                  <th>${t.headers.type}</th>
                  <th class="text-right">${t.headers.price}</th>
                  <th class="text-right">${t.headers.scale}</th>
                </tr>
              </thead>
              <tbody>
                ${vendor.items && vendor.items.length > 0 ? vendor.items.map((item: any) => `
                  <tr>
                    <td class="font-mono">${item.sku}</td>
                    <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${item.item}</strong></td>
                    <td>${tData.MaterialTypesData[item.type] || item.type}</td>
                    <td class="text-right">${formatCurrency(item.price)}</td>
                    <td class="text-right">${tData.scaleNames[item.scale] || item.scale}</td>
                  </tr>
                `).join('') : `<tr><td colspan="5" style="text-align: center; padding: 1rem;">${t.noItems}</td></tr>`}
              </tbody>
            </table>
          </div>
        `;
        return kpiSection + contactInfoSection + itemsSection;
    };

    const allVendorsBody = (vendors: any[]) => `
      <div class="section">
        <table>
          <thead>
            <tr>
              <th>${t.headers.name}</th>
              <th>${t.headers.contactPerson}</th>
              <th>${t.headers.email}</th>
              <th>${t.headers.phone}</th>
            </tr>
          </thead>
          <tbody>
            ${vendors.map((v: any) => `
              <tr>
                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${v.name}</strong></td>
                <td>${v.contactPerson || '—'}</td>
                <td>${v.email || '—'}</td>
                <td>${v.phone || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const bodyContent = payload.isSingle
      ? singleVendorBody(payload.vendors[0], t, tData)
      : allVendorsBody(payload.vendors);

    const html = getReportLayout({
        title: payload.isSingle ? t.singleTitle.replace('{name}', payload.vendors[0].name) : t.allTitle,
        subtitle: payload.isSingle ? '' : `${payload.vendors.length} vendors`,
        body: bodyContent,
        clientTimezone: payload.clientTimezone,
    });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `Critical failure in vendor report generation: ${message}` };
  }
}
