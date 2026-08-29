
'use server';

import { z } from 'zod';
import type { MaterialType } from '@/lib/data';
import { format } from 'date-fns';
import { toDateSafe } from '@/lib/date';
import { getReportLayout } from '@/lib/report-layout';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getTranslator } from 'next-intl/server';

type TFunction = (key: string, values?: Record<string, any>) => string;


/* =====================
   REPORT TYPES
   ===================== */
const reportTypeSchema = z.enum([
  'Customers',
  'Material Types',
  'Phases',
  'Products',
  'Raw Materials',
  'Scales',
  'Vendors'
]);

/* =====================
   CUSTOMERS
   ===================== */
function generateSingleCustomerHtml(customer: any, tReports: TFunction) {
  const { name, contact, address, city, phone, website, joinDate } = customer;
  const date = toDateSafe(joinDate);
  return `
    <div class="section">
      <h2>${name}</h2>
      <table>
        <tbody>
          <tr><th style="width: 150px;">${tReports('customers.headers.name')}</th><td>${name}</td></tr>
          <tr><th>${tReports('customers.headers.email')}</th><td>${contact || ''}</td></tr>
          <tr><th>${tReports('customers.headers.phone')}</th><td>${phone || ''}</td></tr>
          <tr><th>${tReports('customers.headers.address')}</th><td>${address || ''}, ${city || ''}</td></tr>
          <tr><th>${tReports('customers.headers.website')}</th><td>${website || ''}</td></tr>
          <tr><th>${tReports('customers.headers.joinDate')}</th><td>${date ? format(date, 'PPP') : 'N/A'}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function generateCustomersHtml(customers: any[], tReports: TFunction) {
  return `
    <div class="section">
      <h2>${tReports('customers.allTitle')}</h2>
      <table>
        <thead>
          <tr>
            <th>${tReports('customers.headers.name')}</th>
            <th>${tReports('customers.headers.email')}</th>
            <th>${tReports('customers.headers.phone')}</th>
            <th>${tReports('customers.headers.city')}</th>
            <th>${tReports('customers.headers.joinDate')}</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.contact || ''}</td>
              <td>${c.phone || ''}</td>
              <td>${c.city || ''}</td>
              <td>${c.joinDate ? format(toDateSafe(c.joinDate)!, 'PPP') : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* =====================
   VENDORS
   ===================== */
function generateSingleVendorHtml(vendor: any, tReports: TFunction, tData: TFunction) {
  const { name, contactPerson, email, phone, items } = vendor;
  return `
    <div class="section">
      <h2>${name}</h2>
      <p style="margin-bottom: 1rem; color: #6b7280;">${contactPerson || ''} &middot; ${email || ''} &middot; ${phone || ''}</p>
      <table>
        <thead>
          <tr>
            <th>${tReports('vendors.headers.sku')}</th>
            <th>${tReports('vendors.headers.item')}</th>
            <th>${tReports('vendors.headers.type')}</th>
            <th style="text-align: right;">${tReports('vendors.headers.price')}</th>
          </tr>
        </thead>
        <tbody>
          ${items && items.length > 0 ? items.map((item: any) => {
            const itemType = item.type || 'N/A';
            const itemScale = item.scale || 'N/A';
            const translatedType = tData(`MaterialTypesData.${itemType}`, {}, { default: itemType });
            const translatedScale = tData(`scaleNames.${itemScale}`, {}, { default: itemScale });
            return `
              <tr>
                <td>${item.sku}</td>
                <td>${item.item}</td>
                <td>${translatedType}</td>
                <td style="text-align: right;">${formatCurrency(item.price)} / ${translatedScale}</td>
              </tr>
            `
          }).join('') : `
            <tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 1rem;">${tReports('vendors.noItems')}</td></tr>
          `}
        </tbody>
      </table>
    </div>
  `;
}

function generateVendorsHtml(vendors: any[], tReports: TFunction) {
  return `
    <div class="section">
      <h2>${tReports('vendors.allTitle')}</h2>
      <table>
        <thead>
          <tr>
            <th>${tReports('vendors.headers.name')}</th>
            <th>${tReports('vendors.headers.contactPerson')}</th>
            <th>${tReports('vendors.headers.email')}</th>
            <th>${tReports('vendors.headers.phone')}</th>
            <th>${tReports('vendors.headers.items')}</th>
          </tr>
        </thead>
        <tbody>
          ${vendors.map(v => `
            <tr>
              <td style="vertical-align: top;">${v.name}</td>
              <td style="vertical-align: top;">${v.contactPerson || ''}</td>
              <td style="vertical-align: top;">${v.email || ''}</td>
              <td style="vertical-align: top;">${v.phone || ''}</td>
              <td>
                ${v.items && v.items.length > 0 ? `
                  <ul style="margin: 0; padding: 0; list-style: none;">
                    ${v.items.map((item: any) => `<li>- ${item.item}</li>`).join('')}
                  </ul>
                ` : tReports('vendors.noItems')}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* =====================
   PRODUCTS
   ===================== */
function generateProductsHtml(products: any[], tReports: TFunction) {
  return `
    <div class="section">
      <h2>${tReports('products.allTitle')}</h2>
      <table>
        <thead>
          <tr>
            <th>${tReports('products.headers.name')}</th>
            <th>${tReports('products.headers.category')}</th>
            <th style="text-align: right;">${tReports('products.headers.salePrice')}</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.name}</td>
              <td>${p.category || ''}</td>
              <td style="text-align: right;">${formatCurrency(p.salePrice || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* =====================
   RAW MATERIALS
   ===================== */
function generateRawMaterialsHtml(items: any[], tReports: TFunction) {
    return `
      <div class="section">
        <h2>${tReports('rawMaterials.allTitle')}</h2>
        <table>
          <thead>
            <tr>
              <th>${tReports('rawMaterials.headers.sku')}</th>
              <th>${tReports('rawMaterials.headers.item')}</th>
              <th>${tReports('rawMaterials.headers.vendor')}</th>
              <th>${tReports('rawMaterials.headers.price')}</th>
              <th>${tReports('rawMaterials.headers.scale')}</th>
              <th>${tReports('rawMaterials.headers.inStock')}</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.sku}</td>
                <td>${item.item}</td>
                <td>${item.vendorName}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.scale}</td>
                <td>${formatNumber(item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
}

/* =====================
   SCALES
   ===================== */
function generateScalesHtml(scalesByType: { type: string; scales: any[] }[], tReports: TFunction, tData: TFunction) {
  if (scalesByType.length === 0) {
    return `<p style="text-align: center; color: #6b7280;">${tReports('scales.noScales')}</p>`;
  }
  return scalesByType.map(group => `
    <div class="section">
      <h2>${tData(`ScaleTypes.${group.type}`, {}, { default: group.type })} (${group.scales.length} scales)</h2>
      <table>
        <thead>
          <tr>
            <th>${tReports('scales.headers.name')}</th>
          </tr>
        </thead>
        <tbody>
          ${group.scales.map((scale: any) => `
            <tr>
              <td>${tData(`scaleNames.${scale.name}`, {}, { default: scale.name })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

/* =====================
   PHASES
   ===================== */
function generatePhasesHtml(phases: any[], tReports: TFunction) {
    return `
      <div class="section">
        <h2>${tReports('phases.allTitle')}</h2>
        <table>
          <thead>
            <tr>
              <th>${tReports('phases.headers.order')}</th>
              <th>${tReports('phases.headers.name')}</th>
              <th>${tReports('phases.headers.description')}</th>
            </tr>
          </thead>
          <tbody>
            ${phases.map(p => `
              <tr>
                <td>${p.order}</td>
                <td>${p.name}</td>
                <td>${p.description || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
}

/* =====================
   MATERIAL TYPES
   ===================== */
function generateMaterialTypesHtml(items: any[], tMaterialTypesPage: TFunction, tData: TFunction) {
  if (!items || items.length === 0) {
    return '<p style="text-align: center; color: #6b7280;">No material types found to generate a report.</p>';
  }
  return `
    <div class="section">
      <h2>Material Types</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const name = tData(`MaterialTypesData.${item.name}`, {}, {default: item.name});
            return `
            <tr>
              <td>${name}</td>
              <td>${item.description || ''}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;
}


/* =====================
   MAIN EXPORT
   ===================== */
export async function generateCatalogReport(
  formData: FormData,
  allData: any[],
  clientTimezone: string,
  materialTypes: MaterialType[] = [],
  locale: string = 'en'
) {
  try {
    const tReports = await getTranslator(locale, 'CatalogReports');
    const tData = await getTranslator(locale, 'DefaultData');
    const tMaterialTypesPage = await getTranslator(locale, 'MaterialTypesPage');

    const catalogType = reportTypeSchema.parse(formData.get('catalogType'));
    const itemId = formData.get('itemId') as string;

    let title = '';
    let body = '';

    if (catalogType === 'Customers') {
      if (itemId && itemId !== 'all') {
        const customer = allData.find(c => c.id === itemId);
        if (!customer) {
          return { success: false, error: "Customer not found." };
        }
        title = tReports('customers.singleTitle', {name: customer.name});
        body = generateSingleCustomerHtml(customer, tReports);
      } else {
        title = tReports('customers.allTitle');
        body = generateCustomersHtml(allData, tReports);
      }
    }

    else if (catalogType === 'Phases') {
      if (itemId && itemId !== 'all') {
        const phase = allData.find(c => c.id === itemId);
        if (!phase) {
          return { success: false, error: "Phase not found." };
        }
        title = tReports('phases.singleTitle', {name: phase.name});
        body = generatePhasesHtml([phase], tReports);
      } else {
        title = tReports('phases.allTitle');
        const sortedPhases = [...allData].sort((a,b) => a.order - b.order);
        body = generatePhasesHtml(sortedPhases, tReports);
      }
    }

    else if (catalogType === 'Vendors') {
      if (itemId && itemId !== 'all') {
        const vendor = allData.find(v => v.id === itemId);
        if (!vendor) return { success: false, error: "Vendor not found." };
        title = tReports('vendors.singleTitle', {name: vendor.name});
        body = generateSingleVendorHtml(vendor, tReports, tData);
      } else {
        title = tReports('vendors.allTitle');
        body = generateVendorsHtml(allData, tReports);
      }
    }

    else if (catalogType === 'Products') {
      if (itemId && itemId !== 'all') {
        const item = allData.find(i => i.id === itemId);
        if (!item) return { success: false, error: "Item not found." };
        title = tReports('products.singleTitle', {name: item.name});
        body = generateProductsHtml([item], tReports);
      } else {
        title = tReports('products.allTitle');
        body = generateProductsHtml(allData, tReports);
      }
    }

    else if (catalogType === 'Raw Materials') {
      if (itemId && itemId !== 'all') {
          const item = allData.find(i => i.id === itemId);
          if (!item) return { success: false, error: "Item not found." };
          title = tReports('rawMaterials.singleTitle', {name: item.item});
          body = generateRawMaterialsHtml([item], tReports);
      } else {
          title = tReports('rawMaterials.allTitle');
          body = generateRawMaterialsHtml(allData, tReports);
      }
    }

    else if (catalogType === 'Scales') {
      title = tReports('scales.title');
      
      const grouped = allData.reduce((acc, scale) => {
          const type = scale.type || tReports('scales.uncategorized');
          if (!acc[type]) {
              acc[type] = [];
          }
          acc[type].push(scale);
          return acc;
      }, {} as Record<string, any[]>);
      
      const scalesByType = Object.keys(grouped).map(type => ({
          type,
          scales: grouped[type].sort((a: any, b: any) => a.name.localeCompare(b.name)),
      })).sort((a, b) => a.type.localeCompare(b.type));

      body = generateScalesHtml(scalesByType, tReports, tData);
    }

    else if (catalogType === 'Material Types') {
      if (itemId && itemId !== 'all') {
        const item = allData.find(i => i.id === itemId);
        if (!item) return { success: false, error: "Material Type not found." };
        title = tMaterialTypesPage('report.singleTitle', {name: tData(`MaterialTypesData.${item.name}`, {}, {default: item.name})});
        body = generateMaterialTypesHtml([item], tMaterialTypesPage, tData);
      } else {
        title = tMaterialTypesPage('report.allTitle');
        body = generateMaterialTypesHtml(allData, tMaterialTypesPage, tData);
      }
    }

    else {
      return {
        success: false,
        error: `${catalogType} report not implemented yet`
      };
    }

    const html = getReportLayout({ title, body, clientTimezone, includePrintScript: false });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error("Error generating catalog report:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `{t('ReportErrors.failedToGenerateWithReason', { reason: message })}` };
  }
}
