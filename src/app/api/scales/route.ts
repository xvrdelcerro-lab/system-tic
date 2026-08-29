
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const defaultScales = [
  { name: 'Grams', type: 'Weight' },
  { name: 'Kilograms', type: 'Weight' },
  { name: 'Liters', type: 'Volume' },
  { name: 'Meters', type: 'Length' },
  { name: 'Units', type: 'Units' },
  { name: 'Fluid ounce', type: 'Volume' },
  { name: 'Foot', type: 'Length' },
  { name: 'Gallon', type: 'Volume' },
  { name: 'Inch', type: 'Length' },
  { name: 'Kilo', type: 'Weight' },
  { name: 'Liter', type: 'Volume' },
  { name: 'Meter', type: 'Length' },
  { name: 'Ounce', type: 'Weight' },
  { name: 'Piece', type: 'Units' },
  { name: 'Yard', type: 'Length' }
];

async function seedDefaultScales() {
    const collectionRef = adminDb.collection('scales');
    
    const snapshot = await collectionRef.get();
    const existingNames = new Set(snapshot.docs.map(doc => doc.data().name));
    const batch = adminDb.batch();
    let hasChanges = false;

    defaultScales.forEach(scale => {
        if (!existingNames.has(scale.name)) {
            const docRef = collectionRef.doc();
            batch.set(docRef, { ...scale, createdAt: new Date(), updatedAt: new Date() });
            hasChanges = true;
        }
    });

    if (hasChanges) {
        await batch.commit();
    }
}

export async function GET() {
  try {
    await seedDefaultScales();
    const snapshot = await adminDb.collection('scales').orderBy('name').get();
    const scales = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        type: data.type || '',
      }
    });
    return NextResponse.json(scales);
  } catch (error) {
    console.error('Failed to fetch scales:', error);
    return NextResponse.json({ error: 'Failed to fetch scales' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, type } = await req.json();
    if (!name || name.trim() === '' || !type || type.trim() === '') {
      return NextResponse.json({ error: 'Scale name and type are required' }, { status: 400 });
    }

    const newScaleRef = adminDb.collection('scales').doc();
    const newScale = {
      name: name.trim(),
      type: type.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await newScaleRef.set(newScale);

    return NextResponse.json({ id: newScaleRef.id, ...newScale });
  } catch (error) {
    console.error('Failed to create scale:', error);
    return NextResponse.json({ error: 'Failed to create scale' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name, type } = await req.json();
    if (!id || !name || name.trim() === '' || !type || type.trim() === '') {
      return NextResponse.json({ error: 'ID, name and type are required' }, { status: 400 });
    }

    const scaleRef = adminDb.collection('scales').doc(id);
    await scaleRef.update({ name: name.trim(), type: type.trim(), updatedAt: new Date() });

    return NextResponse.json({ id, name: name.trim(), type: type.trim() });
  } catch (error) {
    console.error('Failed to update scale:', error);
    return NextResponse.json({ error: 'Failed to update scale' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('scales').doc(id).delete();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete scale:', error);
    return NextResponse.json({ error: 'Failed to delete scale' }, { status: 500 });
  }
}
