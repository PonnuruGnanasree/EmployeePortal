const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('c:/Users/GnanaSreePonnuru/Documents/gantec/Employeeportal/data/database.sqlite');

console.log('--- public_documents ---');
const publicDocs = db.prepare('SELECT * FROM public_documents').all();
console.log(JSON.stringify(publicDocs, null, 2));

console.log('\n--- user_documents ---');
const userDocs = db.prepare('SELECT * FROM user_documents').all();
console.log(JSON.stringify(userDocs, null, 2));
