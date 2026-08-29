
'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Invoice } from '@/lib/types';
import { formatDateSafe } from '@/lib/date';
import { format } from 'date-fns';

export async function generateInvoiceAction(invoiceData: any, existingInvoiceNumbers: string[]) {
  try {
    // Server-side validation for duplicate invoice number
    if (existingInvoiceNumbers.some(num => num.toLowerCase() === invoiceData.invoiceNumber.toLowerCase())) {
      throw new Error(`An invoice with the number "${invoiceData.invoiceNumber}" already exists.`);
    }

    const customerSnap = await adminDb.collection('customers').doc(invoiceData.customerId).get();
    if (!customerSnap.exists) {
      throw new Error('Customer not found');
    }
    const customerData = customerSnap.data();

    // Create a plain customer object to avoid serialization issues
    const customer = {
        name: customerData?.name || 'N/A',
        address: customerData?.address || '',
        phone: customerData?.phone || '',
        email: customerData?.contact || '', // The 'contact' field is used for email
    };

    const fullInvoiceData = {
      ...invoiceData,
      customer,
      invoiceDate: formatDateSafe(invoiceData.invoiceDate),
      dueDate: formatDateSafe(invoiceData.dueDate),
    };
    
    // The component on the client side will handle the HTML generation.
    // This action now primarily serves for data validation and returning sold items.
    
    // Only return soldItems if it's a final invoice
    const soldItems = invoiceData.invoiceType === 'invoice' ? invoiceData.lineItems : [];

    return { success: true, soldItems, validatedData: fullInvoiceData };
  } catch (error) {
    console.error('Error in invoice action:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to process invoice: ${errorMessage}` };
  }
}

export async function getInvoiceReportData(formData: FormData, allInvoices: Invoice[]) {
  try {
    const invoiceId = formData.get('invoiceId') as string;

    if (invoiceId === 'all') {
      throw new Error("Generating a report for all invoices is not supported in this format. Please select a single invoice.");
    }
    
    const invoice = allInvoices.find((v) => v.id === invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    const customerSnap = await adminDb.collection('customers').doc(invoice.customerId).get();
    if (!customerSnap.exists) {
      throw new Error(`Customer with ID ${invoice.customerId} not found for this invoice.`);
    }

    const customer = customerSnap.data();

    // Ensure dates are consistently formatted using the safe formatter
    const formattedInvoice = {
      ...invoice,
      customer: {
        name: customer?.name,
        address: customer?.address,
        phone: customer?.phone,
        email: customer?.contact,
      },
      invoiceType: 'invoice', // Assuming reports are for final invoices
      invoiceDate: formatDateSafe(invoice.invoiceDate),
      dueDate: formatDateSafe(invoice.dueDate),
    };

    return { success: true, reportData: formattedInvoice };
  } catch (error) {
    console.error('Error getting invoice report data:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: errorMessage };
  }
}
