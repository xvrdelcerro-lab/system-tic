'use server';

import { getReportLayout } from '@/lib/report-layout';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Product } from '@/lib/types';

// Scale translations for Spanish reports
const scaleTranslations: Record<string, string> = {
  'Kilo': 'Kilo',
  'Piece': 'Pieza',
  'Gallon': 'Galón',
  'Pound': 'Libra',
  'Liter': 'Litro'
};

const translateScale = (scale: string): string => {
  return scaleTranslations[scale] || scale;
};

function generateSingleProductHtml(product: Product, allRawMaterials: any[], translations: any) {
  const { name, category, salePrice, components, unitAmount, unitScale } = product;

  const productDetailsHtml = `
    <div class="section">
      <h2 style="border-left: none; padding-left: 0; font-size: 16px;">${name}</h2>
      <table>
        <tbody>
          <tr><th style="width: 150px;">${translations.headers.category}</th><td>${category}</td></tr>
          <tr><th>Escala</th><td>${(unitAmount && unitAmount !== 1) ? `${unitAmount} ` : ''}${translateScale(unitScale || 'Piece')}</td></tr>
          <tr><th>${translations.headers.price}</th><td>${formatCurrency(salePrice || 0)}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const bomHtml = (components && components.length > 0) ? `
    <div class="section">
      <h2>${translations.bom.title}</h2>
      <table>
        <thead>
          <tr>
            <th>${translations.bom.sku}</th>
            <th>${translations.bom.item}</th>
            <th>${translations.bom.vendor}</th>
            <th class="text-right">${translations.bom.quantity}</th>
            <th>${translations.bom.scale}</th>
          </tr>
        </thead>
        <tbody>
          ${components.map(comp => {
            const material = allRawMaterials.find(m => m.id === comp.rawMaterialId);
            return `
              <tr>
                <td class="font-mono">${material?.sku || ''}</td>
                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${material?.item || 'Unknown Material'}</strong></td>
                <td>${material?.vendorName || 'N/A'}</td>
                <td class="text-right">${formatNumber(comp.quantity)}</td>
                <td>${translateScale(material?.scale || '')}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : `<div class="section"><h2>${translations.bom.title}</h2><p>${translations.bom.noComponents}</p></div>`;

  return productDetailsHtml + bomHtml;
}

function generateAllProductsHtml(products: Product[], translations: any) {
  return `
    <div class="section">
        <table>
            <thead>
                <tr>
                    <th>${translations.headers.name}</th>
                    <th>Escala</th>
                    <th>${translations.headers.category}</th>
                    <th class="text-right">${translations.headers.price}</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(p => `
                    <tr>
                        <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${p.name}</strong></td>
                        <td>${(p.unitAmount && p.unitAmount !== 1) ? `${p.unitAmount} ` : ''}${translateScale(p.unitScale || 'Piece')}</td>
                        <td>${p.category || ''}</td>
                        <td class="text-right">${formatCurrency(p.salePrice || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
  `;
}


export async function generateCatalogReport(payload: {
  products: Product[];
  clientTimezone: string;
  translations: any;
  isSingle: boolean;
  allRawMaterials: any[];
}) {
  try {
    const { products, clientTimezone, translations, isSingle, allRawMaterials } = payload;

    if (products.length === 0) {
      return { success: false, error: translations.noProducts };
    }

    const bodyContent = isSingle
      ? generateSingleProductHtml(products[0], allRawMaterials, translations)
      : generateAllProductsHtml(products, translations);
    
    const subtitle = isSingle ? undefined : `${translations.totalLabel}: ${products.length}`;

    const finalHtml = getReportLayout({
        title: translations.title,
        subtitle: subtitle,
        body: bodyContent,
        clientTimezone: clientTimezone,
    });

    return { success: true, reportContent: finalHtml };
  } catch (error) {
    console.error("Error generating product catalog report:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: message })}` };
  }
}