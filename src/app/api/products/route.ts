
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

const defaultProducts = [
  {
    name: 'Classic T-Shirt',
    category: 'Apparel',
    salePrice: 25.00,
    components: [],
    quantity: 0,
    unitAmount: 1,
    unitScale: 'Piece'
  },
  {
    name: 'Denim Jeans',
    category: 'Apparel',
    salePrice: 75.00,
    components: [],
    quantity: 0,
    unitAmount: 1,
    unitScale: 'Piece'
  },
  {
    name: 'Baseball Cap',
    category: 'Accessories',
    salePrice: 15.00,
    components: [],
    quantity: 0,
    unitAmount: 1,
    unitScale: 'Piece'
  },
];

async function seedDefaultProducts() {
  const collectionRef = adminDb.collection('products');
  const snapshot = await collectionRef.limit(1).get();

  if (snapshot.empty) {
    const batch = adminDb.batch();
    defaultProducts.forEach(product => {
      const docRef = collectionRef.doc();
      batch.set(docRef, product);
    });
    await batch.commit();
  }
}

// GET all products
export async function GET() {
  try {
    await seedDefaultProducts();
    const snapshot = await adminDb.collection('products').orderBy('name').get();
    const products = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            name: data.name || '',
            category: data.category || '',
            salePrice: data.salePrice || 0,
            components: data.components || [],
            quantity: data.quantity || 0,
            unitAmount: data.unitAmount || 1,
            unitScale: data.unitScale || 'Piece',
        } as Product
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST a new product
export async function POST(req: Request) {
  try {
    const productData: Omit<Product, 'id'> = await req.json();
    if (!productData.name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const newProductRef = adminDb.collection('products').doc();
    // Ensure new products have a quantity and scale defaults
    const productWithDefaults = {
      ...productData,
      quantity: productData.quantity || 0,
      unitAmount: productData.unitAmount || 1,
      unitScale: productData.unitScale || 'Piece',
    };
    await newProductRef.set(productWithDefaults);

    return NextResponse.json({ id: newProductRef.id, ...productWithDefaults });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

// PUT to update a product
export async function PUT(req: Request) {
    try {
        const { id, ...dataToUpdate } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
        }
        
        const productRef = adminDb.collection('products').doc(id);
        await productRef.update(dataToUpdate);
        return NextResponse.json({ success: true, id, ...dataToUpdate });
    } catch (error) {
        console.error('Failed to update product:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

// DELETE a product
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('products').doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
