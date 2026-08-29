
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

const defaultCustomers = [
  {
    name: 'Chic Boutique',
    address: '123 Fashion Ave',
    phone: '212-555-0101',
    city: 'New York, NY',
    website: 'https://www.chicboutique.com',
    contact: 'orders@chicboutique.com',
    joinDate: new Date('2023-01-15T00:00:00Z'),
  },
  {
    name: 'Modern Threads',
    address: '456 Style St',
    phone: '310-555-0102',
    city: 'Los Angeles, CA',
    website: 'https://www.modernthreads.com',
    contact: 'contact@modernthreads.com',
    joinDate: new Date('2023-03-22T00:00:00Z'),
  },
  {
    name: 'Urban Attire',
    address: '789 Design Blvd',
    phone: '312-555-0103',
    city: 'Chicago, IL',
    website: 'https://www.urbanattire.com',
    contact: 'support@urbanattire.com',
    joinDate: new Date('2023-05-10T00:00:00Z'),
  },
];

async function seedDefaultCustomers() {
  const customersCollection = adminDb.collection('customers');
  const snapshot = await customersCollection.limit(1).get();

  if (snapshot.empty) {
    const batch = adminDb.batch();
    defaultCustomers.forEach(customer => {
      const docRef = customersCollection.doc();
      batch.set(docRef, customer);
    });
    await batch.commit();
  }
}

// GET all customers
export async function GET() {
  try {
    await seedDefaultCustomers(); // Ensure defaults are seeded

    const snapshot = await adminDb.collection('customers').orderBy('name').get();
    const customers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            address: data.address || '',
            phone: data.phone || '',
            city: data.city || '',
            website: data.website || '',
            contact: data.contact || '',
            joinDate: data.joinDate?.toDate?.().toISOString() ?? '',
        } as Customer
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST a new customer
export async function POST(req: Request) {
  try {
    const { name, address, phone, city, website, email } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const newCustomerRef = adminDb.collection('customers').doc();
    const newCustomer = {
      name,
      address,
      phone,
      city,
      website: website || '',
      contact: email || name,
      joinDate: new Date(),
    };
    await newCustomerRef.set(newCustomer);

    return NextResponse.json({ id: newCustomerRef.id, ...newCustomer });
  } catch (error) {
    console.error('Failed to create customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// PUT (update) a customer
export async function PUT(req: Request) {
  try {
    const { id, name, address, phone, city, website, email } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
    }

    const customerRef = adminDb.collection('customers').doc(id);
    const updatedData = {
        name,
        address,
        phone,
        city,
        website: website || '',
        contact: email || name,
    };
    await customerRef.update(updatedData);

    return NextResponse.json({ id, ...updatedData });
  } catch (error) {
    console.error('Failed to update customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

// DELETE a customer
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await adminDb.collection('customers').doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
