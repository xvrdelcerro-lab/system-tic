
'use client';

import { useState, createContext, useContext, ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  doc,
  setDoc,
  increment,
  runTransaction,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  UnifiedEvent,
  ProductionEventSnapshot,
  Invoice,
  Arrival,
  WasteEventSnapshot,
  Phase,
} from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/components/providers/auth-provider';
import { toDateSafe } from '@/lib/date';
import { useProducts } from './use-products';
import { useInventory } from './use-inventory';

/* ───────────────── TYPES ───────────────── */

export type WipState = {
  id: string;
  productionId: string;
  productId: string;
  phaseId: string;
  toProduce: number;
};

export type WasteEntry = {
  id: string;
  productId: string;
  productName: string;
  phaseId: string;
  phaseName: string;
  damagedQuantity: number;
  date: Date;
};

export type SaleEntry = {
  id: string;
  productId: string;
  quantity: number;
  saleDate: Date;
};

export type ProductionRecord = UnifiedEvent & {
  id: string;
  createdAt: Date;
  snapshot: ProductionEventSnapshot;
};

export type WasteAnalyticRecord = UnifiedEvent & {
  id: string;
  createdAt: Date;
  snapshot: WasteEventSnapshot;
};

/* ───────────────── CONTEXT ───────────────── */

type ProductionContextType = {
  productionLog: ProductionRecord[];
  wip: WipState[];
  setWipForPhase: (
    productionId: string,
    productId: string,
    phaseId: string,
    toProduce: number
  ) => Promise<void>;
  recordAndAdvanceProduction: (
    productionId: string,
    productId: string,
    productName: string,
    currentPhase: Phase,
    nextPhase: Phase | null,
    produced: number,
    damaged: number,
    isFirstPhase: boolean
  ) => Promise<void>;
  wasteLog: WasteEntry[];
  wasteAnalyticsLog: WasteAnalyticRecord[];
  recordWasteAnalytics: (
    productId: string,
    productName: string,
    totalDamaged: number,
    materialsToDeduct: { materialId: string; quantity: number; materialName: string }[],
    notes?: string
  ) => Promise<void>;
  salesLog: SaleEntry[];
  addSaleEvent: (entry: Omit<SaleEntry, 'id'>) => Promise<void>;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<void>;
  intakes: Arrival[];
  addIntake: (intake: Omit<Arrival, 'id'>) => Promise<void>;
};

const ProductionContext = createContext<ProductionContextType | null>(null);

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used within ProductionProvider');
  return ctx;
}

/* ───────────────── PROVIDER ───────────────── */

export function ProductionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { products } = useProducts();
  const { allItems } = useInventory();

  const [productionLog, setProductionLog] = useState<ProductionRecord[]>([]);
  const [wip, setWip] = useState<WipState[]>([]);
  const [wasteLog, setWasteLog] = useState<WasteEntry[]>([]);
  const [wasteAnalyticsLog, setWasteAnalyticsLog] = useState<WasteAnalyticRecord[]>([]);
  const [salesLog, setSalesLog] = useState<SaleEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [intakes, setIntakes] = useState<Arrival[]>([]);

  /* ───────────── LISTENERS ───────────── */

  const listen = (
    coll: string,
    onData: (docs: any[]) => void,
    orderField?: string
  ) => {
    if (!user) return () => {};
    const collRef = collection(db, coll);
    const q = orderField ? query(collRef, orderBy(orderField, 'desc')) : collRef;

    return onSnapshot(
      q,
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {
        const permissionError = new FirestorePermissionError({
          path: collRef.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    );
  };

  useEffect(() => {
    if (!user) {
      setProductionLog([]);
      setWip([]);
      setWasteLog([]);
      setWasteAnalyticsLog([]);
      setSalesLog([]);
      setInvoices([]);
      setIntakes([]);
      return;
    }
    
    const unsubProduction = listen(
      'production_events',
      docs => {
        const prod = docs.map(d => ({
          ...d,
          createdAt: d.createdAt?.toDate?.() || new Date(),
        }));
        setProductionLog(prod);
      },
      'createdAt'
    );

    const unsubWasteEntries = listen(
      'waste_entries',
      docs => setWasteLog(
        docs.map(d => ({
          ...d,
          date: d.date?.toDate?.() || new Date(),
        }))
      ),
      'date'
    );

    const unsubWip = listen('production_phase_state', docs =>
      setWip(
        docs.map(d => ({
          id: d.id,
          productionId: String(d.productionId ?? ''),
          productId: String(d.productId ?? ''),
          phaseId: String(d.phaseId ?? ''),
          toProduce: Number(d.toProduce) || 0,
        }))
      )
    );

    const unsubWasteAnalytics = listen(
      'waste_analytics',
      docs =>
        setWasteAnalyticsLog(
          docs.map(d => ({
            ...d,
            createdAt: d.createdAt?.toDate?.() || new Date(),
          }))
        ),
      'createdAt'
    );

    const unsubSales = listen(
      'sales_events',
      docs =>
        setSalesLog(
          docs.map(d => ({
            ...d,
            saleDate: d.saleDate?.toDate?.() || new Date(),
          }))
        ),
      'saleDate'
    );

    const unsubInvoices = listen(
      'invoices',
      docs =>
        setInvoices(
          docs.map(d => ({
            ...d,
            createdAt: toDateSafe(d.createdAt),
            invoiceDate: d.invoiceDate?.toDate?.() || d.invoiceDate,
            dueDate: d.dueDate?.toDate?.() || d.dueDate,
          }))
        ),
      'createdAt'
    );

    const unsubIntakes = listen(
      'intakes',
      docs =>
        setIntakes(
          docs.map(d => ({
            ...d,
            date: d.date?.toDate?.() || new Date(),
          }))
        ),
      'date'
    );

    return () => {
      unsubProduction();
      unsubWasteEntries();
      unsubWip();
      unsubWasteAnalytics();
      unsubSales();
      unsubInvoices();
      unsubIntakes();
    };
  }, [user]);

  /* ───────────── WRITES ───────────── */

  const setWipForPhase = useCallback(
    async (productionId, productId, phaseId, toProduce) => {
      const id = `${productionId}_${phaseId}`;
      await setDoc(
        doc(db, 'production_phase_state', id),
        { productionId, productId, phaseId, toProduce: Number(toProduce) || 0 },
        { merge: true }
      );
    },
    []
  );

  const recordAndAdvanceProduction = useCallback(
    async (
      productionId: string,
      productId: string,
      productName: string,
      currentPhase: Phase,
      nextPhase: Phase | null,
      produced: number,
      damaged: number,
      isFirstPhase: boolean
    ) => {
      if (produced + damaged <= 0) {
        throw new Error('Produced or damaged quantity must be greater than 0.');
      }
      
      const isPackingPhase = currentPhase.name.toLowerCase() === 'packaging';

      await runTransaction(db, async (transaction) => {
        // =================================================
        // STEP 1: All reads
        // =================================================
        
        const product = products.find(p => p.id === productId);
        let vendorReads: Map<string, { ref: any }> | null = null;
        let vendorDocs: any[] | null = null;

        if (isPackingPhase && product && product.components && product.components.length > 0 && produced > 0) {
            vendorReads = new Map();
            for (const component of product.components) {
                const material = allItems.find(m => m.id === component.rawMaterialId);
                if (material && !vendorReads.has(material.vendorId)) {
                    vendorReads.set(material.vendorId, { ref: doc(db, 'vendors', material.vendorId) });
                }
            }
            if (vendorReads.size > 0) {
              vendorDocs = await Promise.all(Array.from(vendorReads.values()).map(v => transaction.get(v.ref)));
            }
        }
        
        const isFinalPhase = !nextPhase || isPackingPhase;
        const productRef = isFinalPhase && produced > 0 ? doc(db, 'products', productId) : null;
        const productDoc = productRef ? await transaction.get(productRef) : null;

        // =================================================
        // STEP 2: Logic and validation
        // =================================================

        const vendorUpdates: Map<string, any[]> = new Map();

        if (isPackingPhase && product && product.components && product.components.length > 0 && produced > 0 && vendorReads && vendorDocs) {
            const vendorDataMap: Map<string, any> = new Map();
            Array.from(vendorReads.keys()).forEach((vendorId, index) => {
                const vendorDoc = vendorDocs![index];
                if (!vendorDoc.exists()) throw new Error(`Vendor with ID ${vendorId} not found.`);
                vendorDataMap.set(vendorId, vendorDoc.data());
            });

            for (const [vendorId, data] of vendorDataMap.entries()) {
                vendorUpdates.set(vendorId, [...data.items]);
            }
            
            for (const component of product.components) {
                const requiredQty = component.quantity * produced;
                const material = allItems.find(m => m.id === component.rawMaterialId);
                if (!material) throw new Error(`Raw material for component ID ${component.rawMaterialId} not found in inventory.`);
                
                const updatedItems = vendorUpdates.get(material.vendorId);
                if (!updatedItems) throw new Error(`Vendor data not found for ${material.vendorName}.`);
                
                const itemIndex = updatedItems.findIndex(i => i.sku === material.sku);
                if (itemIndex === -1) throw new Error(`SKU ${material.sku} not found for vendor ${material.vendorName}.`);
                
                const currentStock = updatedItems[itemIndex].quantity || 0;
                if (currentStock < requiredQty) {
                    throw new Error(`Not enough stock for ${material.item}. Required: ${requiredQty}, Available: ${currentStock}.`);
                }
                updatedItems[itemIndex].quantity -= requiredQty;
            }
        }

        let newFinishedProductQuantity: number | null = null;
        if (isFinalPhase && produced > 0 && productDoc) {
            const currentQuantity = productDoc.data()?.quantity || 0;
            newFinishedProductQuantity = currentQuantity + produced;
        }

        // =================================================
        // STEP 3: All writes
        // =================================================

        if (vendorUpdates.size > 0 && vendorReads) {
          for (const vendorId of vendorUpdates.keys()) {
              const vendorRef = vendorReads.get(vendorId)!.ref;
              transaction.update(vendorRef, { items: vendorUpdates.get(vendorId) });
          }
        }
        
        const productionEventRef = doc(collection(db, 'production_events'));
        const snapshot: ProductionEventSnapshot = {
          phaseId: currentPhase.id,
          phaseName: currentPhase.name,
          piecesToProduce: produced + damaged,
          goodQuantity: produced,
          damagedQuantity: damaged,
          unitAmount: product?.unitAmount,
          unitScale: product?.unitScale,
      };
      
        transaction.set(productionEventRef, {
            type: 'production',
            version: 'v1',
            createdAt: serverTimestamp(),
            productId,
            productName,
            snapshot,
        });

        if (damaged > 0) {
            const wasteRef = doc(collection(db, 'waste_entries'));
            transaction.set(wasteRef, {
                productId,
                productName,
                phaseId: currentPhase.id,
                phaseName: currentPhase.name,
                damagedQuantity: damaged,
                date: serverTimestamp(),
            });
        }
        
        if (productRef && newFinishedProductQuantity !== null) {
            transaction.update(productRef, { quantity: newFinishedProductQuantity });
        }
      });
    },
    [products, allItems]
  );
  
  const recordWasteAnalytics = useCallback(async (
    productId: string,
    productName: string,
    totalDamaged: number,
    materialsToDeduct: { materialId: string; quantity: number; materialName: string }[],
    notes?: string
  ) => {
    await runTransaction(db, async (transaction) => {
        // 1. READS
        const vendorIds = new Set<string>();
        for (const deduction of materialsToDeduct) {
            const materialDetails = allItems.find(m => m.id === deduction.materialId);
            if (materialDetails) {
                vendorIds.add(materialDetails.vendorId);
            }
        }

        const vendorRefs = Array.from(vendorIds).map(id => doc(db, 'vendors', id));
        const vendorDocs = vendorRefs.length > 0 ? await Promise.all(vendorRefs.map(ref => transaction.get(ref))) : [];
        
        const wasteLogQuery = query(collection(db, 'waste_entries'), where('productId', '==', productId));
        const wasteLogSnap = await getDocs(wasteLogQuery); // Read within transaction for consistency

        // 2. VALIDATION & LOGIC
        const vendorDataMap = new Map<string, any>();
        vendorDocs.forEach((doc, i) => {
            if (!doc.exists()) throw new Error(`Vendor with ID ${vendorRefs[i].id} not found.`);
            vendorDataMap.set(vendorRefs[i].id, doc.data());
        });

        const vendorUpdates = new Map<string, any[]>();
        for (const deduction of materialsToDeduct) {
            const materialDetails = allItems.find(m => m.id === deduction.materialId);
            if (!materialDetails) throw new Error(`Material ${deduction.materialName} not found in inventory.`);
            if (!vendorUpdates.has(materialDetails.vendorId)) {
                vendorUpdates.set(materialDetails.vendorId, [...vendorDataMap.get(materialDetails.vendorId).items]);
            }
            
            const updatedItems = vendorUpdates.get(materialDetails.vendorId)!;
            const itemIndex = updatedItems.findIndex(i => i.sku === materialDetails.sku);

            if (itemIndex === -1) throw new Error(`SKU ${materialDetails.sku} not found for vendor ${materialDetails.vendorName}.`);
            
            const currentStock = updatedItems[itemIndex].quantity || 0;
            if (currentStock < deduction.quantity) {
                throw new Error(`Not enough stock for ${materialDetails.item}. Required: ${deduction.quantity}, Available: ${currentStock}.`);
            }
            updatedItems[itemIndex].quantity -= deduction.quantity;
        }

        // 3. WRITES
        for (const [vendorId, items] of vendorUpdates.entries()) {
            const vendorRef = doc(db, 'vendors', vendorId);
            transaction.update(vendorRef, { items });
        }

        const analyticsRef = doc(collection(db, 'waste_analytics'));
        const recordedMaterials = materialsToDeduct.map(mat => {
            const material = allItems.find(m => m.id === mat.materialId);
            return {
                materialId: mat.materialId,
                materialName: mat.materialName,
                quantity: mat.quantity,
                cost: (material?.price || 0) * mat.quantity,
            }
        });
        const totalCost = recordedMaterials.reduce((acc, mat) => acc + mat.cost, 0);

        transaction.set(analyticsRef, {
            type: 'waste',
            version: 'v1',
            createdAt: serverTimestamp(),
            productId,
            productName,
            snapshot: {
                totalDamaged,
                recordedMaterials,
                totalCost,
                notes,
            }
        });

        wasteLogSnap.forEach(doc => {
            transaction.delete(doc.ref);
        });
    });
  }, [allItems]);

  const addInvoice = useCallback(
    async (invoiceData: Omit<Invoice, 'id'>) => {
        const batch = writeBatch(db);

        const invoiceRef = doc(collection(db, 'invoices'));
        batch.set(invoiceRef, { ...invoiceData, createdAt: serverTimestamp() });

        if (invoiceData.invoiceType === 'invoice') {
            invoiceData.lineItems.forEach(item => {
                const productRef = doc(db, 'products', item.productId);
                batch.update(productRef, { quantity: increment(-item.quantity) });

                const saleEventRef = doc(collection(db, 'sales_events'));
                const saleDate = toDateSafe(invoiceData.invoiceDate) || toDateSafe(invoiceData.createdAt) || new Date();
                batch.set(saleEventRef, {
                    productId: item.productId,
                    quantity: item.quantity,
                    saleDate: saleDate,
                });
            });
        }
        await batch.commit();
    },
    []
  );

  const value = useMemo(
    () => ({
      productionLog,
      wip,
      setWipForPhase,
      recordAndAdvanceProduction,
      wasteLog,
      wasteAnalyticsLog,
      recordWasteAnalytics,
      salesLog,
      addSaleEvent: async (e: Omit<SaleEntry, "id">) => addDoc(collection(db, 'sales_events'), e),
      invoices,
      addInvoice,
      intakes,
      addIntake: async (i: Omit<Arrival, "id">) => addDoc(collection(db, 'intakes'), i),
    }),
    [productionLog, wip, setWipForPhase, recordAndAdvanceProduction, wasteLog, wasteAnalyticsLog, salesLog, invoices, addInvoice, intakes, recordWasteAnalytics]
  );

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}
