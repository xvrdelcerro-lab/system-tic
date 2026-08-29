
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { toDateSafe } from '@/lib/date';

export const dynamic = 'force-dynamic';

// GET all expenses
export async function GET() {
  try {
    const snapshot = await adminDb.collection('expenses').orderBy('date', 'desc').get();
    const expenses = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        description: data.description || '',
        amount: data.amount || 0,
        category: data.category || '',
        date: data.date?.toDate?.().toISOString() ?? '',
        notes: data.notes || '',
      };
    });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST a new expense
export async function POST(req: Request) {
  try {
    const { description, amount, category, date, notes } = await req.json();
    if (!description || amount === undefined || !category || !date) {
      return NextResponse.json({ error: 'Description, amount, category, and date are required' }, { status: 400 });
    }

    const newExpenseRef = adminDb.collection('expenses').doc();
    const newExpense = {
      description,
      amount: Number(amount),
      category,
      date: toDateSafe(date),
      notes: notes || '',
      createdAt: new Date(),
    };
    await newExpenseRef.set(newExpense);

    return NextResponse.json({ id: newExpenseRef.id, ...newExpense });
  } catch (error) {
    console.error('Failed to create expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// DELETE an expense
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('expenses').doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
