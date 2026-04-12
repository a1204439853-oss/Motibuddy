const fs = require('fs');
const path = require('path');

const source = 'f:\\MotiBuddy1\\Background of the main page.webp';
const dest = 'f:\\MotiBuddy1\\public\\main_bg.webp';

try {
  fs.copyFileSync(source, dest);
  console.log('Background image copied successfully!');
} catch (err) {
  console.error('Error copying file:', err);
}
