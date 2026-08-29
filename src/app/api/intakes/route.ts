
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Arrival } from '@/lib/types';
import { toDateSafe } from '@/lib/date';

export const dynamic = 'force-dynamic';

const defaultIntakes = [
  { materialId: 'FW-COT-01', quantity: 10000, date: new Date('2023-02-10T00:00:00Z'), scale: 'Meters'},
  { materialId: 'BE-BTN-05', quantity: 2500, date: new Date('2023-04-18T00:00:00Z'), scale: 'Units' },
  { materialId: 'ZZ-ZIP-10', quantity: 500, date: new Date('2023-06-01T00:00:00Z'), scale: 'Units' }
];

async function seedDefaultData() {
    const collectionRef = adminDb.collection('intakes');
    const snapshot = await collectionRef.limit(1).get();

    if (snapshot.empty) {
        const batch = adminDb.batch();
        defaultIntakes.forEach(intake => {
            const docRef = collectionRef.doc();
            batch.set(docRef, intake);
        });
        await batch.commit();
    }
}

// GET all intakes
export async function GET() {
  try {
    await seedDefaultData();
    const snapshot = await adminDb.collection('intakes').orderBy('date', 'desc').get();
    const intakes = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            materialId: data.materialId || '',
            quantity: data.quantity || 0,
            scale: data.scale || '',
            date: data.date?.toDate?.().toISOString() ?? '',
        } as Arrival
    });
    return NextResponse.json(intakes);
  } catch (error) {
    console.error('Failed to fetch intakes:', error);
    return NextResponse.json({ error: 'Failed to fetch intakes' }, { status: 500 });
  }
}

// POST a new intake
export async function POST(req: Request) {
    try {
      const intakeData: Omit<Arrival, 'id'> = await req.json();
      const newIntakeRef = adminDb.collection('intakes').doc();
      
      const newIntake = {
        ...intakeData,
        date: toDateSafe(intakeData.date)
      };

      await newIntakeRef.set(newIntake);
  
      return NextResponse.json({ id: newIntakeRef.id, ...newIntake });
    } catch (error) {
      console.error('Failed to create intake:', error);
      return NextResponse.json({ error: 'Failed to create intake' }, { status: 500 });
    }
}
