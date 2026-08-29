import { type Vendor, type Customer, type Metric, type SalesData, type InventoryData, type ArrivalData, type Product, type Invoice, type MaterialType } from '@/lib/types';

export const vendors: Vendor[] = [];

export const customers: Customer[] = [];

export const metrics: Metric[] = [
    { name: "Pieces Made", value: 0, unit: 'pcs' },
    { name: "Raw Materials Used", value: 0, unit: "units" },
    { name: "Cost of Raw Materials Used", value: 0, unit: "$" },
    { name: "Pieces in Inventory", value: 0, unit: 'pcs' },
    { name: "Pieces Sold", value: 0, unit: 'pcs' },
    { name: "Total Revenue", value: 0, unit: "$" },
];

export const salesData: SalesData[] = [];

export const inventoryData: InventoryData[] = [];

export const arrivals: ArrivalData[] = [];

export const products: Product[] = [];

export const materialTypes: MaterialType[] = [];

export const invoices: Invoice[] = [];
