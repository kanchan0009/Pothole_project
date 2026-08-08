const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend', 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directoryPath);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
        if (line.includes('px-[20px]')) {
            return line
                .replace(/\bmax-w-7xl\b/g, 'w-full')
                .replace(/\bmax-w-5xl\b/g, 'w-full')
                .replace(/\bmax-w-3xl\b/g, 'w-full')
                .replace(/\bmax-w-2xl\b/g, 'w-full');
        }
        return line;
    });
    content = updatedLines.join('\n');

    // Also replace in Footer.tsx and others that might not have px-[20px] if it was missed, but I know it's there.

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
