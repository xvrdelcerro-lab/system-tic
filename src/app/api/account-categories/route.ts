
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { AccountCategory } from '@/hooks/use-accounts';

export const dynamic = 'force-dynamic';

const defaultChartOfAccounts = [
  {
    category: 'People Costs',
    accounts: [
      { name: 'Salaries', description: 'Employee salaries.', type: 'Expense' },
      { name: 'Wages', description: 'Hourly employee wages.', type: 'Expense' },
      { name: 'Contractor Fees', description: 'Fees for independent contractors.', type: 'Expense' },
      { name: 'Employee Benefits', description: 'Health, retirement, etc.', type: 'Expense' },
      { name: 'Payroll Taxes', description: 'Employer portion of payroll taxes.', type: 'Expense' },
    ],
  },
  {
    category: 'Location Costs',
    accounts: [
        { name: 'Rent', description: 'Office or facility rent.', type: 'Expense' },
        { name: 'Mortgage Interest', description: 'Interest on property mortgage.', type: 'Expense' },
        { name: 'Property Taxes', description: 'Taxes on real estate.', type: 'Expense' },
        { name: 'Utilities', description: 'Electricity, water, internet, phone.', type: 'Expense' },
    ],
  },
  {
    category: 'Marketing & Sales',
    accounts: [
        { name: 'Advertising', description: 'Online and offline advertising costs.', type: 'Expense' },
        { name: 'Website Costs', description: 'Hosting, domains, themes, plugins.', type: 'Expense' },
        { name: 'Promotional Materials', description: 'Brochures, flyers, swag.', type: 'Expense' },
        { name: 'Business Travel', description: 'Flights, hotels, meals for business purposes.', type: 'Expense' },
    ],
  },
  {
      category: 'Professional Services',
      accounts: [
          { name: 'Accountant Fees', description: 'Fees for accounting and bookkeeping.', type: 'Expense' },
          { name: 'Legal Fees', description: 'Fees for legal services.', type: 'Expense' },
          { name: 'Consultants', description: 'Fees for specialized consultants.', type: 'Expense' },
      ]
  },
  {
      category: 'Operations & Admin',
      accounts: [
          { name: 'Office Supplies', description: 'Pens, paper, ink, etc.', type: 'Expense' },
          { name: 'Equipment', description: 'Computers, printers, machinery.', type: 'Expense' },
          { name: 'Software Subscriptions', description: 'SaaS and software licenses.', type: 'Expense' },
          { name: 'Bank Fees', description: 'Monthly service charges, transaction fees.', type: 'Expense' },
          { name: 'Licenses & Permits', description: 'Business licenses and permits.', type: 'Expense' },
          { name: 'Insurance', description: 'Business liability, property insurance.', type: 'Expense' },
      ]
  },
  {
      category: 'Cost of Goods Sold (COGS)',
      accounts: [
          { name: 'Raw Materials', description: 'Direct cost of materials for production.', type: 'Expense' },
          { name: 'Direct Labor', description: 'Wages for production staff.', type: 'Expense' },
      ]
  },
  {
      category: 'Income',
      accounts: [
          { name: 'Sales Revenue', description: 'Revenue from sales of goods.', type: 'Income' },
          { name: 'Service Revenue', description: 'Revenue from services rendered.', type: 'Income' },
      ]
  }
];

async function seedDefaultData() {
  const categoriesCollection = adminDb.collection('account_categories');
  const accountsCollection = adminDb.collection('accounts');
  const batch = adminDb.batch();

  // Fetch all existing category and account names to avoid duplicates
  const [existingCategoriesSnap, existingAccountsSnap] = await Promise.all([
    categoriesCollection.get(),
    accountsCollection.get(),
  ]);
  const existingCategoryNames = new Set(existingCategoriesSnap.docs.map(doc => doc.data().name));
  const existingAccountNames = new Set(existingAccountsSnap.docs.map(doc => doc.data().name));

  for (const group of defaultChartOfAccounts) {
    // Add category if it doesn't exist
    if (!existingCategoryNames.has(group.category)) {
      const categoryRef = categoriesCollection.doc();
      batch.set(categoryRef, { name: group.category });
    }

    // Add accounts if they don't exist
    for (const account of group.accounts) {
      if (!existingAccountNames.has(account.name)) {
        const accountRef = accountsCollection.doc();
        batch.set(accountRef, { ...account, category: group.category });
      }
    }
  }

  await batch.commit();
}


// GET all categories
export async function GET() {
  try {
    await seedDefaultData(); // Ensure defaults are seeded

    const snapshot = await adminDb.collection('account_categories').orderBy('name').get();
    const categories = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
        } as AccountCategory;
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to fetch account categories:', error);
    return NextResponse.json({ error: 'Failed to fetch account categories' }, { status: 500 });
  }
}

// POST a new category
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const existing = await adminDb.collection('account_categories').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: 'Category with this name already exists' }, { status: 409 });
    }

    const newCategoryRef = adminDb.collection('account_categories').doc();
    const newCategory = { name };
    await newCategoryRef.set(newCategory);

    return NextResponse.json({ id: newCategoryRef.id, ...newCategory });
  } catch (error) {
    console.error('Failed to create account category:', error);
    return NextResponse.json({ error: 'Failed to create account category' }, { status: 500 });
  }
}

// PUT to update a category and its accounts
export async function PUT(req: Request) {
  try {
    const { id, name } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and new name are required' }, { status: 400 });
    }

    const categoryRef = adminDb.collection('account_categories').doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const oldName = categoryDoc.data()?.name;

    if (oldName === name) {
      return NextResponse.json({ id, name }); // No change needed
    }

    // Use a transaction to ensure both updates succeed or fail together
    await adminDb.runTransaction(async (transaction) => {
      // 1. Update the category document name
      transaction.update(categoryRef, { name });

      // 2. Find all accounts using the old category name
      const accountsQuery = adminDb.collection('accounts').where('category', '==', oldName);
      const accountsSnapshot = await transaction.get(accountsQuery);

      // 3. Update each of those accounts to use the new category name
      accountsSnapshot.docs.forEach(doc => {
        transaction.update(doc.ref, { category: name });
      });
    });

    return NextResponse.json({ id, name });
  } catch (error) {
    console.error('Failed to update account category:', error);
    return NextResponse.json({ error: 'Failed to update account category' }, { status: 500 });
  }
}


// DELETE a category
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const categoryRef = adminDb.collection('account_categories').doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryName = categoryDoc.data()?.name;

    const accountsInCategory = await adminDb.collection('accounts').where('category', '==', categoryName).get();
    if (!accountsInCategory.empty) {
        return NextResponse.json({ error: 'Cannot delete category with associated accounts. You must delete all accounts in this category first.' }, { status: 400 });
    }

    await categoryRef.delete();
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete account category:', error);
    return NextResponse.json({ error: 'Failed to delete account category' }, { status: 500 });
  }
}
