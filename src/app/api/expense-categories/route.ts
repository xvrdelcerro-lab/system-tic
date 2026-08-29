
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const defaultCategories = [
    'Rent', 'Utilities', 'Salaries', 'Marketing', 'Office Supplies', 'Travel', 'Software', 'Legal Fees'
];

async function seedDefaultData() {
    const collectionRef = adminDb.collection('expense_categories');
    const batch = adminDb.batch();
    let hasChanges = false;
    
    const existingSnap = await collectionRef.get();
    const existingNames = new Set(existingSnap.docs.map(doc => doc.data().name.toLowerCase()));

    for (const categoryName of defaultCategories) {
        if (!existingNames.has(categoryName.toLowerCase())) {
            const docRef = collectionRef.doc();
            batch.set(docRef, { name: categoryName });
            hasChanges = true;
        }
    }
    if (hasChanges) {
        await batch.commit();
    }
}

// GET all categories
export async function GET() {
  try {
    await seedDefaultData();
    const snapshot = await adminDb.collection('expense_categories').orderBy('name').get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to fetch expense categories:', error);
    return NextResponse.json({ error: 'Failed to fetch expense categories' }, { status: 500 });
  }
}

// POST a new category
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    const existing = await adminDb.collection('expense_categories').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: 'Category with this name already exists' }, { status: 409 });
    }
    const newDocRef = adminDb.collection('expense_categories').doc();
    await newDocRef.set({ name });
    return NextResponse.json({ id: newDocRef.id, name });
  } catch (error) {
    console.error('Failed to create expense category:', error);
    return NextResponse.json({ error: 'Failed to create expense category' }, { status: 500 });
  }
}

// DELETE a category
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    
    // Check if any expenses are using this category
    const docRef = adminDb.collection('expense_categories').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    const categoryName = docSnap.data()?.name;
    const expensesUsingCategory = await adminDb.collection('expenses').where('category', '==', categoryName).limit(1).get();
    if (!expensesUsingCategory.empty) {
        return NextResponse.json({ error: `Cannot delete category "${categoryName}" as it is currently in use.` }, { status: 400 });
    }

    await docRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete expense category:', error);
    return NextResponse.json({ error: 'Failed to delete expense category' }, { status: 500 });
  }
}
