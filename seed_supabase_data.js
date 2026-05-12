const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const holidaysData = [
  { date: '2026-01-01', name: 'New Year', type: 'Company Holiday' },
  { date: '2026-01-15', name: 'Pongal', type: 'Company Holiday' },
  { date: '2026-01-26', name: 'Republic Day', type: 'Company Holiday' },
  { date: '2026-03-20', name: 'Eid al-Fitr', type: 'Company Holiday' },
  { date: '2026-05-01', name: 'Labour Day', type: 'Company Holiday' },
  { date: '2026-08-15', name: 'Independence Day', type: 'Company Holiday' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', type: 'Company Holiday' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'Company Holiday' },
  { date: '2026-10-20', name: 'Dussehra', type: 'Company Holiday' },
  { date: '2026-11-09', name: 'Deepavali', type: 'Company Holiday' },
  { date: '2026-12-25', name: 'Christmas', type: 'Company Holiday' },
  { date: '2026-01-14', name: 'Pongal', type: 'Floating Holiday Option' },
  { date: '2026-03-04', name: 'Holi', type: 'Floating Holiday Option' },
  { date: '2026-03-19', name: 'Chaitra Sukladi / Gudi Padava / Ugadi / Cheti Chand', type: 'Floating Holiday Option' },
  { date: '2026-04-03', name: 'Good Friday', type: 'Floating Holiday Option' },
  { date: '2026-04-14', name: 'Vaisakhi / Vishu / Meshadi', type: 'Floating Holiday Option' },
  { date: '2026-05-27', name: 'Eid al-Adha', type: 'Floating Holiday Option' },
  { date: '2026-08-26', name: 'Onam', type: 'Floating Holiday Option' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'Floating Holiday Option' }
];

const certificationsData = [
  { name: 'Microsoft Azure Solutions Architect Expert', category: 'High-Impact' },
  { name: 'Microsoft Azure Administrator Associate', category: 'High-Impact' },
  { name: 'Power Platform Developer Associate', category: 'High-Impact' },
  { name: 'Power Platform Solutions Architect Expert', category: 'High-Impact' },
  { name: 'Azure Fabric Analytics Engineer Associate', category: 'High-Impact' },
  { name: 'Azure Fabric Data Engineer Associate', category: 'High-Impact' },
  { name: 'Az 900 Azure Fundamentals', category: 'High-Impact' },
  { name: 'Databricks Certifications', category: 'High-Impact' },
  { name: 'ServiceNow Certifications', category: 'High-Impact' }
];

async function seedData() {
  console.log('🚀 Seeding Supabase data...');

  // Seed Holidays
  const { error: hError } = await supabase.from('holidays').insert(holidaysData);
  if (hError) console.error('❌ Error seeding holidays:', hError.message);
  else console.log('✅ Holidays seeded successfully');

  // Seed Certifications
  const { error: cError } = await supabase.from('certifications').insert(certificationsData);
  if (cError) console.error('❌ Error seeding certifications:', cError.message);
  else console.log('✅ Certifications seeded successfully');

  console.log('🏁 Done.');
}

seedData();
