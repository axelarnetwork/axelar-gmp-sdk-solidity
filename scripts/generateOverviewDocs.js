'use strict';

const fs = require('fs');
const path = require('path');

function generateIndexMarkdown(dir, outputFile, topLevelDir = 'docs') {
    let content = '# Docs\n\n';

    // List all Markdown files in the directory under "Contracts"
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md') && file !== 'index.md');

    if (files.length > 0) {
        content += '## Contracts\n';
        files.forEach((file) => {
            const title = path.parse(file).name;
            content += `- [${title}](${file})\n`;
        });
    }

    // List all subdirectories under "Directories"
    const subdirs = fs.readdirSync(dir).filter((subdir) => fs.statSync(path.join(dir, subdir)).isDirectory());

    if (subdirs.length > 0) {
        content += '\n## Directories\n';
        subdirs.forEach((subdir) => {
            const childDir = path.join(dir, subdir);
            const childOutput = path.join(childDir, 'index.md');
            generateIndexMarkdown(childDir, childOutput, topLevelDir);
            content += `- [${subdir}](${subdir}/index.md)\n`;
        });
    }

    // Check if README.md exists at the top level and append its contents
    const readmePath = path.join(__dirname, '..', 'README.md');

    if (fs.existsSync(readmePath) && dir === topLevelDir) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        content += `\n\n${readmeContent}`;
    }

    fs.writeFileSync(outputFile, content);
    console.log(`Generated ${outputFile}`);
}

if (require.main === module) {
    const parentDir = 'docs';
    const parentOutput = path.join(parentDir, 'index.md');
    generateIndexMarkdown(parentDir, parentOutput, parentDir);
}

module.exports = {
    generateIndexMarkdown,
};
