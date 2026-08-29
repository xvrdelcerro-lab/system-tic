import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Account } from '@/hooks/use-accounts';

export const dynamic = 'force-dynamic';

// GET all accounts
export async function GET() {
  try {
    const snapshot = await adminDb.collection('accounts').orderBy('name').get();
    const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            description: data.description,
            type: data.type,
            category: data.category,
        } as Account;
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST a new account
export async function POST(req: Request) {
  try {
    const accountData: Omit<Account, 'id'> = await req.json();
    if (!accountData.name || !accountData.category) {
      return NextResponse.json({ error: 'Account name and category are required' }, { status: 400 });
    }

    const newAccountRef = adminDb.collection('accounts').doc();
    await newAccountRef.set(accountData);

    return NextResponse.json({ id: newAccountRef.id, ...accountData });
  } catch (error) {
    console.error('Failed to create account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// PUT to update an account
export async function PUT(req: Request) {
    try {
        const { id, ...dataToUpdate } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
        }
        
        const accountRef = adminDb.collection('accounts').doc(id);
        await accountRef.update(dataToUpdate);
        return NextResponse.json({ success: true, id, ...dataToUpdate });
    } catch (error) {
        console.error('Failed to update account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

// DELETE an account
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('accounts').doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
