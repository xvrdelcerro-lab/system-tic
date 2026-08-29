
export type Organization = {
  id: string;
  name: string;
  subscriptionStatus: "trial" | "active" | "past_due" | "expired"
  subscriptionPlan: "free" | "monthly" | "yearly"
  subscriptionEndsAt: Date
};

export type Vendor = {
  id: string;
  name: string;
  joinDate: string;
  email?: string;
  contactPerson?: string;
  address?: string;
  country?: string;
  phone?: string;
  organizationId?: string;
  items: { 
    item: string; 
    price: number; 
    scale: string;
    sku: string;
    quantity: number;
    type: string;
  }[];
};

export type Customer = {
  id: string;
  name: string;
  joinDate: string;
  contact: string;
  organizationId?: string;
  phone?: string;
  address?: string;
  city?: string;
  website?: string;
};

export type RawMaterialComponent = {
  rawMaterialId: string; // Corresponds to the id from allRawMaterials (`${vendor.id}-${item.sku}`)
  quantity: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  salePrice: number;
  components: RawMaterialComponent[];
  organizationId?: string;
  quantity?: number;
  unitAmount?: number;
  unitScale?: string;
};

export type Phase = {
  id: string;
  name: string;
  description: string;
  order: number;
  isDefault?: boolean;
  organizationId?: string;
};

export type MaterialType = {
  id: string;
  name: string;
  description: string;
  organizationId?: string;
};

export type Scale = {
  id: string;
  name: string;
  type: string;
  organizationId?: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  notes?: string;
};

export type Metric = {
  name: string;
  value: number;
  change?: string;
  changeType?: 'positive' | 'negative';
  unit?: string;
};

export type SalesData = {
  month: string;
  sales: number;
  expenses: number;
};

export type InventoryData = {
  name: string;
  value: number;
};

export type Arrival = {
  id: string;
  materialId: string;
  quantity: number;
  date: Date;
  scale?: string;
  organizationId?: string;
};

export type ArrivalData = {
  materialId: string;
  quantity: number;
  date: string; // Changed from Date to string;
  scale?: string;
  organizationId?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: Date | string;
  dueDate: Date | string;
  lineItems: {
    productId: string;
    description: string;
    quantity: number;
    price: number;
  }[];
  discount?: number;
  tax?: number;
  notes?: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  organizationId?: string;
  createdAt?: number;
  invoiceType?: 'proforma' | 'invoice';
};

// Unified Logging Types
export type ProductionEventSnapshot = {
  phaseId: string;
  phaseName: string;
  piecesToProduce: number;
  goodQuantity: number;
  damagedQuantity: number;
  unitAmount?: number;
  unitScale?: string;
};

export type WasteEventSnapshot = {
  totalDamaged: number;
  recordedMaterials: {
    materialId: string;
    materialName: string;
    quantity: number;
    cost: number;
  }[];
  totalCost: number;
  notes?: string;
};

export type UnifiedEvent = {
  id?: string;
  type: 'production' | 'waste';
  createdAt: any; // Firestore ServerTimestamp or client-side Date
  createdBy?: string; // Optional userId
  productId: string;
  productName: string;
  organizationId?: string; // Should be optional on the base type
  snapshot: ProductionEventSnapshot | WasteEventSnapshot;
  version: 'v1';
};

export type UserProfile = {
    uid: string;
    email: string | null;
    displayName: string | null;
    organizationId: string;
};
