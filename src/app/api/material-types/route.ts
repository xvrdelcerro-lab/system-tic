
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { MaterialType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const defaultMaterialTypes = [
  { name: 'Alloy', description: '' },
  { name: 'Aluminum', description: '' },
  { name: 'Article', description: '' },
  { name: 'Biomaterial', description: '' },
  { name: 'Board', description: '' },
  { name: 'Carbon Fiber', description: '' },
  { name: 'Ceramic', description: '' },
  { name: 'Clay', description: '' },
  { name: 'Combustible', description: '' },
  { name: 'Component', description: '' },
  { name: 'Composite', description: '' },
  { name: 'Copper', description: '' },
  { name: 'Fabric', description: '' },
  { name: 'Fiber', description: '' },
  { name: 'Fiberglass', description: '' },
  { name: 'Flour', description: '' },
  { name: 'Glass', description: '' },
  { name: 'Grain', description: '' },
  { name: 'Honey', description: '' },
  { name: 'Iron', description: '' },
  { name: 'Item', description: '' },
  { name: 'Jam', description: '' },
  { name: 'Jelly', description: '' },
  { name: 'Metal', description: '' },
  { name: 'Natural Leather', description: '' },
  { name: 'Natural Wood', description: '' },
  { name: 'Nylon', description: '' },
  { name: 'Object', description: '' },
  { name: 'Paper', description: '' },
  { name: 'Plastic', description: '' },
  { name: 'Plastics', description: '' },
  { name: 'Polyester', description: '' },
  { name: 'Polymer', description: '' },
  { name: 'Porcelain', description: '' },
  { name: 'Rubber', description: '' },
  { name: 'Salt', description: '' },
  { name: 'Semiconductor', description: '' },
  { name: 'Silicon', description: '' },
  { name: 'Steel', description: '' },
  { name: 'Sugar', description: '' },
  { name: 'Synthetic', description: '' },
  { name: 'Timber', description: '' },
  { name: 'Unit', description: '' },
  { name: 'Yeast', description: '' },
  
];

async function seedDefaultData() {
    const collectionRef = adminDb.collection('material_types');
    const batch = adminDb.batch();
    let hasChanges = false;
    
    const existingSnap = await collectionRef.get();
    
    // Safely get existing names, filtering out any invalid entries
    const existingNames = new Set(
        existingSnap.docs.map(doc => {
            const data = doc.data();
            return typeof data.name === 'string' ? data.name.toLowerCase() : null;
        }).filter(name => name !== null) as string[]
    );

    for (const materialType of defaultMaterialTypes) {
        if (!existingNames.has(materialType.name.toLowerCase())) {
            const docRef = collectionRef.doc();
            batch.set(docRef, materialType);
            hasChanges = true;
        }
    }
    if (hasChanges) {
        await batch.commit();
    }
}


// GET all material types
export async function GET() {
  try {
    await seedDefaultData(); // Ensure defaults are seeded
    const snapshot = await adminDb.collection('material_types').orderBy('name').get();
    const materialTypes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
        } as MaterialType;
    });
    return NextResponse.json(materialTypes);
  } catch (error) {
    console.error('Failed to fetch material types:', error);
    return NextResponse.json({ error: 'Failed to fetch material types' }, { status: 500 });
  }
}

// POST a new material type
export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existingSnap = await adminDb.collection('material_types').where('name', '==', data.name).limit(1).get();
    if (!existingSnap.empty) {
        return NextResponse.json({ error: `A material type named "${data.name}" already exists.` }, { status: 409 });
    }

    const newDocRef = adminDb.collection('material_types').doc();
    const newMaterialType = {
      name: data.name,
      description: data.description || '',
    };
    await newDocRef.set(newMaterialType);

    return NextResponse.json({ id: newDocRef.id, ...newMaterialType });
  } catch (error) {
    console.error('Failed to create material type:', error);
    return NextResponse.json({ error: 'Failed to create material type' }, { status: 500 });
  }
}

// PUT (update) a material type
export async function PUT(req: Request) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
    }
    const { id, ...updateData } = data;
    const docRef = adminDb.collection('material_types').doc(id);
    await docRef.update(updateData);

    return NextResponse.json({ id, ...updateData });
  } catch (error) {
    console.error('Failed to update material type:', error);
    return NextResponse.json({ error: 'Failed to update material type' }, { status: 500 });
  }
}

// DELETE a material type
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const docRef = adminDb.collection('material_types').doc(id);
    await docRef.delete();
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete material type:', error);
    let errorMsg = 'Failed to delete material type';
    if (error instanceof Error) {
        errorMsg = error.message;
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
