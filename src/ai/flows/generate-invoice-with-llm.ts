
'use server';
/**
 * @fileOverview This file is deprecated. Invoice generation is now handled by a client-side React component.
 * This flow is no longer in use and can be removed in a future cleanup.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CustomerSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  price: z.number(),
});

const InvoiceInputSchema = z.object({
  customer: CustomerSchema,
  invoiceType: z.enum(['proforma', 'invoice']),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  lineItems: z.array(LineItemSchema),
  discount: z.number().optional(),
  tax: z.number().optional().describe('The tax rate as a percentage.'),
  notes: z.string().optional(),
});
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

const InvoiceOutputSchema = z.object({
  invoiceHtml: z.string().describe('The generated invoice content as a full HTML document.'),
});
export type InvoiceOutput = z.infer<typeof InvoiceOutputSchema>;

export async function generateInvoice(input: InvoiceInput): Promise<InvoiceOutput> {
  // This flow is deprecated. Returning a placeholder.
  return Promise.resolve({ invoiceHtml: "<html><body>Deprecated flow.</body></html>" });
}
