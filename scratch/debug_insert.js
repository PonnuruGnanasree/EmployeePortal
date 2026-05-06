const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
try {
  const stmt = db.prepare('INSERT INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(
    "b62fa9f2-c3ca-4ae0-bd25-e67b91ede232",
    "gnana",
    "gnana@gantecusa.com",
    "",
    "employee",
    4
  );
  console.log('Success!');
} catch (e) {
  console.error(e.message);
}
db.close();
