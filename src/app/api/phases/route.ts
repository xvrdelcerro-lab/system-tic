
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Phase } from '@/lib/types';

export const dynamic = 'force-dynamic';

const defaultPhases = [
  { name: 'Processing', description: 'Initial processing of raw materials.', order: 1, isDefault: false },
  { name: 'Assembly/Fabrication', description: 'Assembling components into the final product.', order: 2, isDefault: false },
  { name: 'Quality Control & Testing', description: 'Ensuring the product meets quality standards.', order: 3, isDefault: false },
  { name: 'Packaging', description: 'Preparing the product for shipment.', order: 4, isDefault: true },
];

async function seedDefaultPhases() {
  const collectionRef = adminDb.collection('phases');
  
  const batch = adminDb.batch();
  let hasChanges = false;

  for (const phase of defaultPhases) {
    const existingSnap = await collectionRef.where('name', '==', phase.name).limit(1).get();
    if (existingSnap.empty) {
      const docRef = collectionRef.doc();
      batch.set(docRef, phase);
      hasChanges = true;
    } else {
      const doc = existingSnap.docs[0];
      if (doc.data().isDefault !== phase.isDefault) {
        batch.update(doc.ref, { isDefault: phase.isDefault });
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    await batch.commit();
  }
}

// GET all phases
export async function GET() {
  try {
    await seedDefaultPhases();
    const snapshot = await adminDb.collection('phases').orderBy('order').get();
    const phases = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            order: data.order || 0,
            isDefault: data.isDefault || false,
        } as Phase;
    });
    return NextResponse.json(phases);
  } catch (error) {
    console.error('Failed to fetch phases:', error);
    return NextResponse.json({ error: 'Failed to fetch phases' }, { status: 500 });
  }
}

// POST a new phase
export async function POST(req: Request) {
  try {
    const { name, description } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Phase name is required' }, { status: 400 });
    }

    const phasesCollection = adminDb.collection('phases');

    const newPhase = await adminDb.runTransaction(async (transaction) => {
      const packagingQuery = phasesCollection.where('isDefault', '==', true).limit(1);
      const packagingSnap = await transaction.get(packagingQuery);
      
      let newPhaseOrder: number;

      if (packagingSnap.empty) {
        const lastPhaseQuery = phasesCollection.orderBy('order', 'desc').limit(1);
        const lastPhaseSnap = await transaction.get(lastPhaseQuery);
        newPhaseOrder = lastPhaseSnap.empty ? 1 : lastPhaseSnap.docs[0].data().order + 1;
      } else {
        const packagingPhaseOrder = packagingSnap.docs[0].data().order;
        newPhaseOrder = packagingPhaseOrder;

        const phasesToUpdateQuery = phasesCollection.where('order', '>=', packagingPhaseOrder);
        const phasesToUpdateSnap = await transaction.get(phasesToUpdateQuery);
        
        phasesToUpdateSnap.forEach(doc => {
          const currentOrder = doc.data().order;
          transaction.update(doc.ref, { order: currentOrder + 1 });
        });
      }

      const newPhaseRef = phasesCollection.doc();
      const newPhaseData = {
        name,
        description: description || '',
        order: newPhaseOrder,
        isDefault: false,
      };
      transaction.set(newPhaseRef, newPhaseData);

      return { id: newPhaseRef.id, ...newPhaseData };
    });
    
    return NextResponse.json(newPhase);

  } catch (error) {
    console.error('Failed to create phase:', error);
    return NextResponse.json({ error: 'Failed to create phase' }, { status: 500 });
  }
}

// PUT (update) a phase
export async function PUT(req: Request) {
  try {
    const { id, ...dataToUpdate } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
    }
    const phaseRef = adminDb.collection('phases').doc(id);

    const doc = await phaseRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Phase not found' }, { status: 404 });
    }
    if (doc.data()?.isDefault) {
      return NextResponse.json({ error: 'Default phases cannot be edited.' }, { status: 400 });
    }
    
    await phaseRef.update(dataToUpdate);
    return NextResponse.json({ success: true, id, ...dataToUpdate });
  } catch (error) {
    console.error('Failed to update phase:', error);
    return NextResponse.json({ error: 'Failed to update phase' }, { status: 500 });
  }
}

// DELETE a phase
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idToDelete = searchParams.get('id');

    if (!idToDelete) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const phasesCollection = adminDb.collection('phases');
    
    await adminDb.runTransaction(async (transaction) => {
        const phaseToDeleteRef = phasesCollection.doc(idToDelete);
        const phaseToDeleteDoc = await transaction.get(phaseToDeleteRef);

        if (!phaseToDeleteDoc.exists) {
            throw new Error('Phase not found');
        }
        if (phaseToDeleteDoc.data()?.isDefault) {
            throw new Error('Default phases cannot be deleted.');
        }

        const deletedOrder = phaseToDeleteDoc.data()?.order;

        // Delete the document
        transaction.delete(phaseToDeleteRef);

        // Get all documents with a higher order
        const subsequentPhasesQuery = phasesCollection.where('order', '>', deletedOrder);
        const subsequentPhasesSnap = await transaction.get(subsequentPhasesQuery);

        // Decrement their order
        subsequentPhasesSnap.forEach(doc => {
            const newOrder = doc.data().order - 1;
            transaction.update(doc.ref, { order: newOrder });
        });
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete phase:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to delete phase: ${message}` }, { status: 500 });
  }
}
