const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');

try {
  console.log("Checking structure of support_tickets:");
  const supportCols = db.prepare("PRAGMA table_info(support_tickets);").all();
  console.log(supportCols.map(c => `${c.name} (${c.type})`).join(', '));

  const supportCount = db.prepare("SELECT COUNT(*) AS count FROM support_tickets;").get().count;
  console.log(`Total Support Tickets: ${supportCount}`);

  console.log("\nChecking structure of hr_queries:");
  const hrCols = db.prepare("PRAGMA table_info(hr_queries);").all();
  console.log(hrCols.map(c => `${c.name} (${c.type})`).join(', '));

  const hrCount = db.prepare("SELECT COUNT(*) AS count FROM hr_queries;").get().count;
  console.log(`Total HR Inquiries: ${hrCount}`);

} catch (err) {
  console.error("Database query failed:", err.message);
} finally {
  db.close();
}
