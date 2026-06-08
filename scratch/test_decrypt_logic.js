const fs = require('fs');
const data = fs.readFileSync('./uploads/Weekly Connect/9aefa93b-6a89-49d6-88c3-af12d11021a3.bin');
const head = data.slice(0, 16).toString('utf8');

console.log('First 16 bytes as utf8:', JSON.stringify(head));
console.log('Starts with %PDF:', head.startsWith('%PDF'));
console.log('Starts with {:', head.startsWith('{'));
console.log('File size:', data.length);
console.log('Size % 16:', data.length % 16);

const isUnencrypted = head.startsWith('%PDF') || 
                      head.startsWith('{') || 
                      head.startsWith('PK\x03\x04') || 
                      head.startsWith('http') ||
                      head.startsWith('{\n') ||
                      head.startsWith('{"');
const sizeMismatched = (data.length % 16 !== 0);

console.log('');
console.log('serveDecryptedFile will think:');
console.log('  isUnencrypted:', isUnencrypted);
console.log('  sizeMismatched:', sizeMismatched);
console.log('  Action:', (isUnencrypted || sizeMismatched) ? 'STREAM RAW (BUG!)' : 'DECRYPT then stream');
