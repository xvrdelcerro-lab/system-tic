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
    
    const lines = content.split('\n');
    let useClientIndex = -1;
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
       const trimmed = lines[i].trim();
       if (trimmed === "'use client';" || trimmed === '"use client";' || trimmed === "'use client'" || trimmed === '"use client"') {
           useClientIndex = i;
           break;
       }
    }
    
    if (useClientIndex > 0) {
        const useClientLine = lines.splice(useClientIndex, 1)[0];
        lines.unshift(useClientLine);
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log('Fixed use client directive in', filePath);
    }
  }
});
