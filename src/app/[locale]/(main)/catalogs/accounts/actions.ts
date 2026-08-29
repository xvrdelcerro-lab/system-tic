
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getReportLayout } from '@/lib/report-layout';

async function getAccountsData() {
  const [categoriesSnap, accountsSnap] = await Promise.all([
    adminDb.collection('account_categories').orderBy('name').get(),
    adminDb.collection('accounts').orderBy('name').get()
  ]);

  const accounts = accountsSnap.docs.map(doc => doc.data() as { 
    name: string; 
    description: string; 
    type: string; 
    category: string 
  });
  return { accounts };
}

export async function generateAccountsReport(timezone: string, locale: string, translations: any) {
  try {
    const { accounts } = await getAccountsData();
    
    const grouped: Record<string, any[]> = {};
    accounts.forEach(acc => {
      const categoryName = acc.category || translations.uncategorizedLabel;
      if (!grouped[categoryName]) grouped[categoryName] = [];
      grouped[categoryName].push(acc);
    });
    
    const sortedCategories = Object.keys(grouped).sort();

    const bodyContent = sortedCategories.map(catName => {
        const categoryAccounts = grouped[catName];
        const translatedCategory = translations.DefaultData?.AccountCategories?.[catName] || catName;

        return `
          <div class="section">
            <h2>${translatedCategory} (${categoryAccounts.length})</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 30%;">${translations.nameHeader}</th>
                  <th>${translations.descriptionHeader}</th>
                  <th style="width: 15%;">${translations.typeHeader}</th>
                </tr>
              </thead>
              <tbody>
                ${categoryAccounts.map(a => {
                  const tName = translations.DefaultData?.Accounts?.[a.name]?.name || a.name;
                  const tDesc = translations.DefaultData?.Accounts?.[a.name]?.description || a.description || '—';
                  const tType = translations.DefaultData?.AccountTypes?.[a.type] || a.type;

                  return `
                    <tr>
                      <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${tName}</strong></td>
                      <td>${tDesc}</td>
                      <td>${tType}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

    const finalHtml = getReportLayout({
        title: translations.title,
        subtitle: `${translations.totalLabel}: ${accounts.length}`,
        body: bodyContent,
        clientTimezone: timezone,
    });
    
    return { success: true, reportContent: finalHtml };
  } catch (error: any) {
    console.error("Error generating accounts report: ", error);
    return { success: false, error: error.message };
  }
}
