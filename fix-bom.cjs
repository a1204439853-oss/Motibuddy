const fs = require('fs');
const path = 'f:\\MotiBuddy1\\src-tauri\\tauri.conf.json';
let content = fs.readFileSync(path);
// Remove BOM if present
if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    content = content.slice(3);
}
fs.writeFileSync(path, content);
console.log('BOM removed');
