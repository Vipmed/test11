const fs = require('fs');
const glob = require('glob'); // wait, glob might not be installed, use fs.readdirSync
const dir = './src/components/admin';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  const path = dir + '/' + file;
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(path, content, 'utf8');
}
console.log('Done!');
