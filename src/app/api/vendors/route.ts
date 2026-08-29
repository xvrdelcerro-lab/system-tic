
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Vendor } from '@/lib/types';
import { toDateSafe } from '@/lib/date';

export const dynamic = 'force-dynamic';

const defaultVendors = [
  {
    name: 'Fabric World',
    contactPerson: 'John Fibers',
    email: 'contact@fabricworld.com',
    phone: '555-0101',
    address: '101 Textile Rd',
    country: 'USA',
    joinDate: new Date('2023-02-10T00:00:00Z'),
    items: [
      {
        sku: 'FW-COT-01',
        item: 'Premium Cotton',
        price: 12.50,
        scale: 'Meters',
        type: 'Fabric',
        quantity: 10000,
      }
    ],
  },
  {
    name: 'Button Emporium',
    contactPerson: 'Jane Snap',
    email: 'sales@buttonemporium.co',
    phone: '555-0102',
    address: '202 Fastener Ave',
    country: 'USA',
    joinDate: new Date('2023-04-18T00:00:00Z'),
    items: [
      {
        sku: 'BE-BTN-05',
        item: 'Classic Wooden Buttons',
        price: 0.15,
        scale: 'Units',
        type: 'Plastic',
        quantity: 2500,
      }
    ],
  },
  {
    name: 'Zipper Zone',
    contactPerson: 'Gary Zip',
    email: 'gary@zipper.zone',
    phone: '555-0103',
    address: '303 Closure Blvd',
    country: 'Canada',
    joinDate: new Date('2023-06-01T00:00:00Z'),
    items: [
      {
        sku: 'ZZ-ZIP-10',
        item: 'Heavy Duty Brass Zippers',
        price: 1.20,
        scale: 'Units',
        type: 'Metal',
        quantity: 500,
      }
    ],
  },
];

async function seedDefaultVendors() {
  const collectionRef = adminDb.collection('vendors');
  const snapshot = await collectionRef.limit(1).get();

  if (snapshot.empty) {
    const batch = adminDb.batch();
    defaultVendors.forEach(vendor => {
      const docRef = collectionRef.doc();
      batch.set(docRef, vendor);
    });
    await batch.commit();
  }
}

// GET all vendors
export async function GET() {
  try {
    await seedDefaultVendors();
    const snapshot = await adminDb.collection('vendors').orderBy('name').get();
    const vendors = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            name: data.name || '',
            contactPerson: data.contactPerson || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            country: data.country || '',
            items: data.items || [],
            joinDate: data.joinDate?.toDate?.().toISOString() ?? '',
        } as Vendor;
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Failed to fetch vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

// POST a new vendor
export async function POST(req: Request) {
  try {
    const { name, email, phone, address, contactPerson, country, items } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const newVendorRef = adminDb.collection('vendors').doc();
    
    const sanitizedItems = (items && Array.isArray(items)) ? items.map((item: any) => ({
        item: item.item || '',
        price: Number(item.price) || 0,
        scale: item.scale || '',
        sku: item.sku || '',
        quantity: 0,
        type: item.type || '',
    })) : [];

    const newVendor = {
      name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      contactPerson: contactPerson || '',
      country: country || '',
      joinDate: new Date(),
      items: sanitizedItems,
    };
    await newVendorRef.set(newVendor);

    return NextResponse.json({ id: newVendorRef.id, ...newVendor });
  } catch (error) {
    console.error('Failed to create vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

// PUT (update) a vendor
export async function PUT(req: Request) {
  try {
    const { id, ...dataToUpdate } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required for update' }, { status: 400 });
    }

    // Sanitize items array to ensure no undefined values are sent to Firestore
    if (dataToUpdate.items && Array.isArray(dataToUpdate.items)) {
        dataToUpdate.items = dataToUpdate.items.map((item: any) => ({
            sku: item.sku || '',
            type: item.type || '',
            item: item.item || '',
            price: Number(item.price) || 0,
            scale: item.scale || '',
            quantity: Number(item.quantity) || 0,
        }));
    }

    const vendorRef = adminDb.collection('vendors').doc(id);
    await vendorRef.update(dataToUpdate);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to update vendor:', error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

// DELETE a vendor
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('vendors').doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete vendor:', error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}
