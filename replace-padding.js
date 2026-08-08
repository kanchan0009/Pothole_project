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

    // Replace px-4 ... sm:px-6
    content = content.replace(/px-4(.*?)sm:px-6/g, (match, p1) => {
        return `px-[20px]${p1.trimEnd()}`;
    });

    // Replace px-4 in lines with mx-auto, <section, <main, <header, <footer, <nav
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
        if (
            line.includes('mx-auto') ||
            line.includes('<section') ||
            line.includes('<main') ||
            line.includes('<header') ||
            line.includes('<footer') ||
            line.includes('<nav') ||
            line.includes('max-w-') ||
            line.includes('border-t border-white/40 bg-white/90') // special case for navbar mobile menu
        ) {
            return line.replace(/\bpx-4\b/g, 'px-[20px]');
        }
        return line;
    });
    content = updatedLines.join('\n');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
