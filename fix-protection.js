#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Map of file paths to their page names and titles
const pagesToProtect = {
  // Main pages
  'app/[locale]/(main)/dashboard/page.tsx': {
    pageName: 'dashboard',
    pageTitle: 'Dashboard'
  },
  
  // Catalogs
  'app/[locale]/(main)/catalogs/accounts/page.tsx': {
    pageName: 'catalogs.accounts',
    pageTitle: 'Accounts'
  },
  'app/[locale]/(main)/catalogs/customers/page.tsx': {
    pageName: 'catalogs.customers',
    pageTitle: 'Customers'
  },
  'app/[locale]/(main)/catalogs/material-types/page.tsx': {
    pageName: 'catalogs.materialTypes',
    pageTitle: 'Material Types'
  },
  'app/[locale]/(main)/catalogs/phases/page.tsx': {
    pageName: 'catalogs.phases',
    pageTitle: 'Phases'
  },
  'app/[locale]/(main)/catalogs/products/page.tsx': {
    pageName: 'catalogs.products',
    pageTitle: 'Products'
  },
  'app/[locale]/(main)/catalogs/raw-materials/page.tsx': {
    pageName: 'catalogs.rawMaterials',
    pageTitle: 'Raw Materials'
  },
  'app/[locale]/(main)/catalogs/scales/page.tsx': {
    pageName: 'catalogs.scales',
    pageTitle: 'Scales'
  },
  'app/[locale]/(main)/catalogs/vendors/page.tsx': {
    pageName: 'catalogs.vendors',
    pageTitle: 'Vendors'
  },
  
  // Operations
  'app/[locale]/(main)/expenses/page.tsx': {
    pageName: 'expenses',
    pageTitle: 'Expenses'
  },
  'app/[locale]/(main)/invoices/page.tsx': {
    pageName: 'invoices',
    pageTitle: 'Invoices'
  },
  'app/[locale]/(main)/production/page.tsx': {
    pageName: 'production',
    pageTitle: 'Production'
  },
  
  // Inventories
  'app/[locale]/(main)/inventories/products/page.tsx': {
    pageName: 'inventories.products',
    pageTitle: 'Products Inventory'
  },
  'app/[locale]/(main)/inventories/raw-materials/page.tsx': {
    pageName: 'inventories.rawMaterials',
    pageTitle: 'Raw Materials Inventory'
  },
  
  // Reports
  'app/[locale]/(main)/reports/access-log/page.tsx': {
    pageName: 'reports.accessLog',
    pageTitle: 'Access Log'
  },
  'app/[locale]/(main)/reports/customers/page.tsx': {
    pageName: 'reports.customers',
    pageTitle: 'Customer Reports'
  },
  'app/[locale]/(main)/reports/expenses/page.tsx': {
    pageName: 'reports.expenses',
    pageTitle: 'Expense Reports'
  },
  'app/[locale]/(main)/reports/intakes/page.tsx': {
    pageName: 'reports.intakes',
    pageTitle: 'Intake Reports'
  },
  'app/[locale]/(main)/reports/invoice-status/page.tsx': {
    pageName: 'reports.invoiceStatus',
    pageTitle: 'Invoice Status'
  },
  'app/[locale]/(main)/reports/production/page.tsx': {
    pageName: 'reports.production',
    pageTitle: 'Production Reports'
  },
  'app/[locale]/(main)/reports/products/page.tsx': {
    pageName: 'reports.products',
    pageTitle: 'Product Reports'
  },
  'app/[locale]/(main)/reports/profit-loss/page.tsx': {
    pageName: 'reports.profitLoss',
    pageTitle: 'P&L Reports'
  },
  'app/[locale]/(main)/reports/raw-materials/page.tsx': {
    pageName: 'reports.rawMaterials',
    pageTitle: 'Raw Material Reports'
  },
  'app/[locale]/(main)/reports/sales/page.tsx': {
    pageName: 'reports.sales',
    pageTitle: 'Sales Reports'
  },
  'app/[locale]/(main)/reports/vendors/page.tsx': {
    pageName: 'reports.vendors',
    pageTitle: 'Vendor Reports'
  },
  'app/[locale]/(main)/reports/waste/page.tsx': {
    pageName: 'reports.waste',
    pageTitle: 'Waste Reports'
  },
  'app/[locale]/(main)/reports/waste-analytics/page.tsx': {
    pageName: 'reports.wasteAnalytics',
    pageTitle: 'Waste Analytics'
  },
  
  // Waste
  'app/[locale]/(main)/waste/analytics/page.tsx': {
    pageName: 'waste.analytics',
    pageTitle: 'Waste Analytics'
  }
};

function fixProtection(filePath, pageName, pageTitle) {
  const fullPath = path.join(process.cwd(), 'src', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Step 1: Remove old usePermissions import if it exists
  const oldImportPattern = /import\s*{\s*usePermissions\s*}\s*from\s*['"]@\/hooks\/use-permissions['"];\s*\n/g;
  if (oldImportPattern.test(content)) {
    content = content.replace(oldImportPattern, '');
    modified = true;
  }
  
  // Step 2: Add ProtectedPage import if not present
  const protectedPageImport = "import { ProtectedPage } from '@/components/protected-page';";
  if (!content.includes(protectedPageImport)) {
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith("import {")) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, protectedPageImport);
      content = lines.join('\n');
      modified = true;
    }
  }
  
  // Step 3: Remove old permission check code from inside the function
  // Remove: const { hasAccess, loading: permissionLoading } = usePermissions();
  const oldHookPattern = /const\s*{\s*hasAccess,\s*loading:\s*permissionLoading\s*}\s*=\s*usePermissions\(\);\s*\n/g;
  if (oldHookPattern.test(content)) {
    content = content.replace(oldHookPattern, '');
    modified = true;
  }
  
  // Step 4: Remove old permission loading check
  // Remove entire if (permissionLoading) { return ... } block
  const loadingCheckPattern = /if\s*\(permissionLoading\)\s*{\s*return\s*<div>Loading\.\.\.<\/div>;\s*}\s*\n*/g;
  if (loadingCheckPattern.test(content)) {
    content = content.replace(loadingCheckPattern, '');
    modified = true;
  }
  
  // Step 5: Remove old hasAccess check with ProtectedPage wrapper (the broken one)
  // This is the pattern where ProtectedPage was incorrectly wrapped around Access Denied
  const brokenPattern = new RegExp(
    `if\\s*\\(!hasAccess\\(['"]${pageName.replace('.', '\\.')}['"]\\)\\)\\s*{[\\s\\S]*?<ProtectedPage[\\s\\S]*?<\\/ProtectedPage>[\\s\\S]*?}\\s*\\n*`,
    'g'
  );
  if (brokenPattern.test(content)) {
    content = content.replace(brokenPattern, '');
    modified = true;
  }
  
  // Step 6: Find the main return statement and wrap it
  const functionMatch = content.match(/export default function \w+\([^)]*\)\s*{/);
  if (!functionMatch) {
    console.log(`❌ Could not find export default function in: ${filePath}`);
    return false;
  }
  
  const functionStart = functionMatch.index + functionMatch[0].length;
  const afterFunction = content.substring(functionStart);
  
  // Find the LAST return statement (the main one)
  const returnMatches = [];
  const returnPattern = /\breturn\s*\(/g;
  let match;
  while ((match = returnPattern.exec(afterFunction)) !== null) {
    returnMatches.push(match);
  }
  
  if (returnMatches.length === 0) {
    console.log(`❌ Could not find return statement in: ${filePath}`);
    return false;
  }
  
  // Use the LAST return (main return)
  const lastReturnMatch = returnMatches[returnMatches.length - 1];
  const returnIndex = functionStart + lastReturnMatch.index + lastReturnMatch[0].length;
  
  // Check if already wrapped
  const afterReturn = content.substring(returnIndex, returnIndex + 200);
  if (afterReturn.trim().startsWith('<ProtectedPage')) {
    console.log(`✅ Already correctly protected: ${filePath}`);
    return true;
  }
  
  // Find the matching closing for this return
  let depth = 1;
  let closingIndex = -1;
  
  for (let i = returnIndex; i < content.length; i++) {
    if (content[i] === '(') depth++;
    if (content[i] === ')') {
      depth--;
      if (depth === 0) {
        closingIndex = i;
        break;
      }
    }
  }
  
  if (closingIndex === -1) {
    console.log(`❌ Could not find closing parenthesis in: ${filePath}`);
    return false;
  }
  
  // Get the content between return ( and )
  const returnContent = content.substring(returnIndex, closingIndex).trim();
  
  // Wrap the content
  const wrappedContent = `
    <ProtectedPage pageName="${pageName}" pageTitle="${pageTitle}">
${returnContent}
    </ProtectedPage>
  `;
  
  // Reconstruct the file
  const newContent = 
    content.substring(0, returnIndex) + 
    wrappedContent + 
    content.substring(closingIndex);
  
  // Write the file
  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`✅ Fixed protection: ${filePath}`);
  return true;
}

// Main execution
console.log('🔧 Fixing page protection (removing old code)...\n');

let successCount = 0;
let failCount = 0;

for (const [filePath, config] of Object.entries(pagesToProtect)) {
  const success = fixProtection(filePath, config.pageName, config.pageTitle);
  if (success) {
    successCount++;
  } else {
    failCount++;
  }
}

console.log('\n📊 Summary:');
console.log(`✅ Successfully fixed: ${successCount} pages`);
console.log(`❌ Failed: ${failCount} pages`);
console.log('\n✨ Done! Old permission code removed and pages properly protected.');