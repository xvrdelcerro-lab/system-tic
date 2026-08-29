
'use client';

import { formatCurrency } from '@/lib/utils';
import React from 'react';

type InvoiceTemplateProps = {
    customer: { name: string; address?: string; phone?: string; email?: string; };
    invoiceType: 'proforma' | 'invoice';
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    lineItems: { description: string; quantity: number; price: number; }[];
    discount?: number;
    tax?: number;
    notes?: string;
    translations: {
        invoiceNumber: string;
        issued: string;
        due: string;
        billTo: string;
        description: string;
        quantity: string;
        unitPrice: string;
        totalHeader: string;
        subtotal: string;
        discount: string;
        tax: string;
        grandTotal: string;
        notes: string;
    };
};

export function InvoiceTemplate(props: InvoiceTemplateProps) {
    const {
        customer,
        invoiceType,
        invoiceNumber,
        invoiceDate,
        dueDate,
        lineItems,
        discount = 0,
        tax = 0,
        notes,
        translations
    } = props;
    
    const subtotal = lineItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const discountAmount = discount;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = subtotalAfterDiscount * (tax / 100);
    const total = subtotalAfterDiscount + taxAmount;
    const generatedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                
                @page {
                    size: letter;
                    margin: 0.75in;
                }

                body {
                    font-family: 'Inter', sans-serif;
                    color: #1a202c;
                    background-color: #f7fafc;
                }
                
                .invoice-container {
                    background-color: white;
                    padding: 2.5rem;
                    margin: auto;
                    max-width: 800px;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #3560AD;
                    padding-bottom: 1rem;
                }
                
                .company-details h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #3560AD;
                    margin: 0;
                }

                .invoice-title-section {
                    text-align: right;
                }

                .invoice-type {
                    font-size: 2rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #3560AD;
                    margin: 0;
                }

                .generation-date {
                    font-size: 0.8rem;
                    color: #718096;
                    margin-top: 4px;
                }
                
                .meta-and-customer-grid {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 2rem;
                }
                
                .invoice-meta div {
                    font-size: 0.875rem;
                    margin-bottom: 0.5rem;
                }
                
                .invoice-meta strong {
                    color: #4a5568;
                    font-weight: 500;
                    display: inline-block;
                    width: 110px;
                }
                
                .customer-details {
                    text-align: right;
                }
                
                .customer-details h3 {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #718096;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.5rem;
                }

                .customer-details p {
                    font-size: 0.875rem;
                    line-height: 1.4;
                    margin: 0;
                }

                .customer-name {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }
                
                .line-items-table {
                    width: 100%;
                    margin-top: 2.5rem;
                    border-collapse: collapse;
                }
                
                .line-items-table th, .line-items-table td {
                    padding: 0.8rem 1rem;
                    text-align: left;
                    font-size: 0.875rem;
                }
                
                .line-items-table thead {
                    background-color: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .line-items-table th {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #4a5568;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .line-items-table tbody tr {
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .line-items-table .text-right {
                    text-align: right;
                }

                .totals-section {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 1.5rem;
                }
                
                .totals-table {
                    width: 100%;
                    max-width: 300px;
                }

                .totals-table td {
                    padding: 0.6rem 1rem;
                    font-size: 0.875rem;
                }

                .totals-table tr.grand-total td {
                    font-size: 1.25rem;
                    font-weight: 700;
                    padding-top: 1rem;
                    border-top: 2px solid #2d3748;
                }
                
                .footer-notes {
                    margin-top: 2.5rem;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 1.5rem;
                }

                .footer-notes h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .footer-notes p {
                    font-size: 0.875rem;
                    color: #718096;
                }
                `}
            </style>
            <div className="invoice-container">
                <header className="header">
                    <div className="company-details">
                        <h2>System@ic</h2>
                    </div>
                    <div className="invoice-title-section">
                        <h1 className="invoice-type">{invoiceType}</h1>
                        <p className="generation-date">{generatedAt}</p>
                    </div>
                </header>

                <main>
                    <div className="meta-and-customer-grid">
                        <div className="invoice-meta">
                            <div><strong>{translations.invoiceNumber}</strong> <span>{invoiceNumber}</span></div>
                            <div><strong>{translations.issued}</strong> <span>{invoiceDate}</span></div>
                            <div><strong>{translations.due}</strong> <span>{dueDate}</span></div>
                        </div>

                        <div className="customer-details">
                            <h3>{translations.billTo}</h3>
                            <p className="customer-name">{customer.name}</p>
                            {customer.address && <p>{customer.address}</p>}
                             <p>
                                {customer.email && <span>{customer.email}</span>}
                                {customer.email && customer.phone && <span> &middot; </span>}
                                {customer.phone && <span>{customer.phone}</span>}
                            </p>
                        </div>
                    </div>
                    

                    <table className="line-items-table">
                        <thead>
                            <tr>
                                <th>{translations.description}</th>
                                <th className="text-right">{translations.quantity}</th>
                                <th className="text-right">{translations.unitPrice}</th>
                                <th className="text-right">{translations.totalHeader}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.description}</td>
                                    <td className="text-right">{item.quantity}</td>
                                    <td className="text-right">{formatCurrency(item.price)}</td>
                                    <td className="text-right">{formatCurrency(item.quantity * item.price)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="totals-section">
                        <table className="totals-table">
                            <tbody>
                                <tr>
                                    <td>{translations.subtotal}</td>
                                    <td className="text-right">{formatCurrency(subtotal)}</td>
                                </tr>
                                {discount > 0 && (
                                    <tr>
                                        <td>{translations.discount}</td>
                                        <td className="text-right">- {formatCurrency(discountAmount)}</td>
                                    </tr>
                                )}
                                {tax > 0 && (
                                    <tr>
                                        <td>{translations.tax} ({tax}%)</td>
                                        <td className="text-right">{formatCurrency(taxAmount)}</td>
                                    </tr>
                                )}
                                <tr className="grand-total">
                                    <td>{translations.grandTotal}</td>
                                    <td className="text-right">{formatCurrency(total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    {notes && (
                        <div className="footer-notes">
                            <h4>{translations.notes}</h4>
                            <p>{notes}</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
