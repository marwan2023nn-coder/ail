// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const bindingsPath = path.join(__dirname, '..', 'node_modules', 'bindings', 'bindings.js');

if (fs.existsSync(bindingsPath)) {
    console.log('Applying fix to node_modules/bindings/bindings.js...');
    let content = fs.readFileSync(bindingsPath, 'utf8');

    const searchString1 = 'if (fileName.indexOf(fileSchema) === 0)';
    const replaceString1 = 'if (fileName && fileName.indexOf(fileSchema) === 0)';
    const searchString2 = 'if (fileName.indexOf(path.sep) !== -1)';
    const replaceString2 = 'if (fileName && fileName.indexOf(path.sep) !== -1)';

    let modified = false;
    if (content.includes(searchString1)) {
        content = content.replace(new RegExp(escapeRegExp(searchString1), 'g'), replaceString1);
        modified = true;
    }
    if (content.includes(searchString2)) {
        content = content.replace(new RegExp(escapeRegExp(searchString2), 'g'), replaceString2);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(bindingsPath, content);
        console.log('Fix applied successfully.');
    } else if (content.includes(replaceString1) || content.includes(replaceString2)) {
        console.log('Fix already applied or partial fix found.');
    } else {
        console.warn('Could not find the target lines in bindings.js. The file structure might be different.');
    }
} else {
    console.error('bindings.js not found in node_modules.');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
