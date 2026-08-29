
"use server";

import { getReportLayout } from '@/lib/report-layout';
import { format } from 'date-fns';
import type { Customer } from '@/lib/types';
import { toDateSafe } from '@/lib/date';
import { adminDb } from '@/lib/firebase-admin';

function generateSingleCustomerHtml(customer: Customer, t: any) {
  const { name, joinDate, contact, phone, address, city, website } = customer;
  const joinDateObj = toDateSafe(joinDate);
  return `
    <div class="section">
        <h2>${name}</h2>
        <table>
            <tbody>
                <tr><th style="width: 150px;">${t.nameLabel}</th><td>${name}</td></tr>
                <tr><th>${t.emailLabel}</th><td>${contact || '—'}</td></tr>
                <tr><th>${t.phoneLabel}</th><td>${phone || '—'}</td></tr>
                <tr><th>${t.addressLabel}</th><td>${address || '—'}, ${city || ''}</td></tr>
                <tr><th>${t.websiteLabel}</th><td>${website || '—'}</td></tr>
                <tr><th>${t.joinDateLabel}</th><td>${joinDateObj ? format(joinDateObj, 'PPP') : 'N/A'}</td></tr>
            </tbody>
        </table>
    </div>
  `;
}

function generateAllCustomersHtml(allCustomers: Customer[], t: any) {
    const bodyContent = `
        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th>${t.nameLabel}</th>
                        <th>${t.emailLabel}</th>
                        <th>${t.phoneLabel}</th>
                        <th>${t.cityLabel}</th>
                        <th>${t.joinDateLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCustomers.map(customer => {
                        const joinDateObj = toDateSafe(customer.joinDate);
                        return `
                        <tr>
                            <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${customer.name}</strong></td>
                            <td>${customer.contact || '—'}</td>
                            <td>${customer.phone || '—'}</td>
                            <td>${customer.city || '—'}</td>
                            <td>${joinDateObj ? format(joinDateObj, 'PPP') : 'N/A'}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
    return bodyContent;
}


export async function generateCustomersReport(payload: { 
  customerId: string,
  clientTimezone: string, 
  translations: any,
  isSingle: boolean,
  title: string
}) {
  try {
    const { customerId, clientTimezone, translations, isSingle, title } = payload;
    const t = translations;

    let customersToReport: Customer[] = [];
    if (isSingle) {
        const customerDoc = await adminDb.collection('customers').doc(customerId).get();
        if (customerDoc.exists) {
            const data = customerDoc.data()!;
            customersToReport.push({ 
              id: customerDoc.id, 
              name: data.name,
              contact: data.contact,
              joinDate: data.joinDate?.toDate?.().toISOString() ?? new Date().toISOString(),
              address: data.address,
              phone: data.phone,
              city: data.city,
              website: data.website
            });
        }
    } else {
        const customersSnap = await adminDb.collection('customers').orderBy('name').get();
        customersToReport = customersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                address: data.address || '',
                phone: data.phone || '',
                city: data.city || '',
                website: data.website || '',
                contact: data.contact || '',
                joinDate: data.joinDate?.toDate?.().toISOString() ?? '',
            } as Customer;
        });
    }

    if (customersToReport.length === 0) {
        return { success: false, error: "No customer data found." };
    }

    const bodyContent = isSingle 
      ? generateSingleCustomerHtml(customersToReport[0], t) 
      : generateAllCustomersHtml(customersToReport, t);
    
    const subtitle = isSingle ? '' : `${t.totalLabel}: ${customersToReport.length}`;

    const html = getReportLayout({
        title,
        subtitle,
        body: bodyContent,
        clientTimezone: clientTimezone,
        includePrintScript: true,
    });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Critical failure in report generation." };
  }
}
