
"use server";

import { formatCurrency, formatNumber } from "@/lib/utils";
import { getReportLayout } from "@/lib/report-layout";

function generateSingleRawMaterialHtml(item: any, t: any) {
  const { sku, item: itemName, vendorName, price, scale, quantity, type } = item;
  return `
    <div class="section">
      <h2 style="border-left: 4px solid #3560AD; padding-left: 10px;">${itemName}</h2>
      <table>
        <tbody>
          <tr><th style="width: 150px;">${t.headers.sku}</th><td class="font-mono">${sku}</td></tr>
          <tr><th>${t.headers.item}</th><td>${itemName}</td></tr>
          <tr><th>${t.headers.vendor}</th><td>${vendorName}</td></tr>
          <tr><th>${t.headers.price}</th><td>${formatCurrency(price)}</td></tr>
          <tr><th>${t.headers.scale}</th><td>${scale}</td></tr>
          <tr><th>${t.headers.inStock}</th><td>${formatNumber(quantity)}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function generateAllRawMaterialsHtml(items: any[], t: any) {
    return `
        <div class="section">
            <table>
                <thead>
                <tr>
                    <th>${t.headers.sku}</th>
                    <th>${t.headers.item}</th>
                    <th>${t.headers.vendor}</th>
                    <th class="text-right">${t.headers.price}</th>
                    <th>${t.headers.scale}</th>
                    <th class="text-right">${t.headers.inStock}</th>
                </tr>
                </thead>
                <tbody>
                ${items.map(item => `
                    <tr>
                    <td class="font-mono">${item.sku}</td>
                    <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${item.item}</strong></td>
                    <td>${item.vendorName}</td>
                    <td class="text-right">${formatCurrency(item.price)}</td>
                    <td>${item.scale}</td>
                    <td class="text-right">${formatNumber(item.quantity)}</td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export async function generateRawMaterialsReport(payload: { 
  items: any[], 
  clientTimezone: string, 
  translations: any,
  isSingle: boolean 
}) {
  try {
    const t = payload.translations;
    
    const bodyContent = payload.isSingle && payload.items.length > 0
      ? generateSingleRawMaterialHtml(payload.items[0], t)
      : generateAllRawMaterialsHtml(payload.items, t);

    const title = payload.isSingle && payload.items.length > 0 && payload.items[0]
        ? t.singleTitle.replace('{itemName}', payload.items[0]?.item) 
        : t.allTitle;

    let subtitle: string | undefined;
    if (!payload.isSingle) {
        const totalItems = payload.items.length;
        if (t.totalLabel) {
            subtitle = `${t.totalLabel}: ${formatNumber(totalItems)}`;
        }
    }

    const html = getReportLayout({
        title,
        subtitle,
        body: bodyContent,
        clientTimezone: payload.clientTimezone,
    });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Critical failure in raw materials report generation." };
  }
}
