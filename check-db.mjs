import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('✅ Database connected successfully!');
  console.log('');
  console.log('Tables found:');
  tables.forEach(t => console.log(`  • ${t.table_name}`));
  console.log('');
  
  // Check for our new tables
  const hasWebAuthn = tables.some(t => t.table_name === 'webauthn_credentials');
  const hasMediaAssets = tables.some(t => t.table_name === 'media_assets');
  
  console.log('Migration status:');
  console.log(`  webauthn_credentials: ${hasWebAuthn ? '✅ Created' : '❌ Missing'}`);
  console.log(`  media_assets: ${hasMediaAssets ? '✅ Created' : '❌ Missing'}`);
}

checkTables().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
