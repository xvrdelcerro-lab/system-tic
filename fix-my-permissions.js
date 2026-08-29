const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(path.join(__dirname, 'src', 'app', '[locale]', '(main)'), function(filePath) {
  if (filePath.endsWith('page.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('permissionLoading') && !content.includes('usePermissions()')) {
        // Add import
        if (!content.includes("from '@/hooks/use-permissions'")) {
            content = "import { usePermissions } from '@/hooks/use-permissions';\n" + content;
        }
        
        // Find the component declaration
        const componentMatch = content.match(/export default function\s+\w+\([^)]*\)\s*\{/);
        if (componentMatch) {
            const insertIndex = componentMatch.index + componentMatch[0].length;
            const insertString = "\n  const { hasAccess, loading: permissionLoading } = usePermissions();";
            content = content.substring(0, insertIndex) + insertString + content.substring(insertIndex);
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
    }
  }
});
console.log('Complete!');
