const fs = require('fs');

const source = 'f:\\MotiBuddy1\\Desktop logo.png';
const dest = 'f:\\MotiBuddy1\\src-tauri\\icons\\icon.png';

try {
  fs.copyFileSync(source, dest);
  console.log('Icon copied successfully!');
} catch (err) {
  console.error('Error copying icon:', err);
}
