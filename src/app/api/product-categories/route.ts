
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProductCategory } from '@/hooks/use-product-categories';

export const dynamic = 'force-dynamic';

const defaultProductCategories = ['Apparel', 'Accessories', 'Services'];

async function seedDefaultData() {
    const collectionRef = adminDb.collection('product_categories');
    const batch = adminDb.batch();
    let hasChanges = false;

    for (const categoryName of defaultProductCategories) {
        const existingSnap = await collectionRef.where('name', '==', categoryName).limit(1).get();
        if (existingSnap.empty) {
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
    const snapshot = await adminDb.collection('product_categories').orderBy('name').get();
    const categories = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name
        } as ProductCategory
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to fetch product categories:', error);
    return NextResponse.json({ error: 'Failed to fetch product categories' }, { status: 500 });
  }
}

// POST a new category
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    const existing = await adminDb.collection('product_categories').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: 'Category with this name already exists' }, { status: 409 });
    }
    const newDocRef = adminDb.collection('product_categories').doc();
    await newDocRef.set({ name });
    return NextResponse.json({ id: newDocRef.id, name });
  } catch (error) {
    console.error('Failed to create product category:', error);
    return NextResponse.json({ error: 'Failed to create product category' }, { status: 500 });
  }
}

// PUT to update a category
export async function PUT(req: Request) {
    try {
        const { id, name } = await req.json();
        if (!id || !name) {
            return NextResponse.json({ error: 'ID and new name are required' }, { status: 400 });
        }
        
        const docRef = adminDb.collection('product_categories').doc(id);
        const docSnap = await docRef.get();
        if(!docSnap.exists) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

        const oldName = docSnap.data()?.name;
        if(oldName === name) return NextResponse.json({ id, name }); // no change

        // Update category name
        await docRef.update({ name });

        // Update all products that use the old category name
        const productsRef = adminDb.collection('products');
        const querySnapshot = await productsRef.where('category', '==', oldName).get();
        const batch = adminDb.batch();
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { category: name });
        });
        await batch.commit();

        return NextResponse.json({ id, name });
    } catch (error) {
        console.error('Failed to update product category:', error);
        return NextResponse.json({ error: 'Failed to update product category' }, { status: 500 });
    }
}


// DELETE a category
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const productsRef = adminDb.collection('products');
    const docRef = adminDb.collection('product_categories').doc(id);
    const docSnap = await docRef.get();

    if(!docSnap.exists) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    
    const categoryName = docSnap.data()?.name;
    const querySnapshot = await productsRef.where('category', '==', categoryName).limit(1).get();
    
    if(!querySnapshot.empty) {
        return NextResponse.json({ error: `Cannot delete category "${categoryName}" as it is currently in use.` }, { status: 400 });
    }

    await docRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete product category:', error);
    return NextResponse.json({ error: 'Failed to delete product category' }, { status: 500 });
  }
}
