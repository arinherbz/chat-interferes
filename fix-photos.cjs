// Ariostore Photo Fix Script
// Run with: node fix-photos.js

const fs = require('fs');
const path = require('path');

console.log('🔧 Ariostore Photo Fix Script');
console.log('==============================\n');

// Step 1: Create uploads directory
console.log('📁 Step 1: Creating uploads directory...');
const uploadsDir = path.join(process.cwd(), 'uploads');
const productImagesDir = path.join(uploadsDir, 'product-images');
const tradeInsDir = path.join(uploadsDir, 'trade-ins');
const miscDir = path.join(uploadsDir, 'misc');

[uploadsDir, productImagesDir, tradeInsDir, miscDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   Created: ${dir}`);
  }
});
console.log('✅ Uploads directory ready\n');

// Step 2: Check database
console.log('📊 Step 2: Checking database...');
const dbFile = path.join(process.cwd(), '.data', 'dev.sqlite');

if (!fs.existsSync(dbFile)) {
  console.log('ℹ️  No database file yet. Will be created on first run.');
  console.log('✅ Database will be created with all tables\n');
} else {
  console.log('✅ Database file exists\n');
}

// Step 3: Verify directory permissions
console.log('🔐 Step 3: Testing write permissions...');
const testFile = path.join(uploadsDir, '.test_write');
try {
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('✅ Write permissions OK\n');
} catch (err) {
  console.log('❌ Cannot write to uploads folder!');
  console.log('   Fix: chmod 755 uploads\n');
  process.exit(1);
}

// Step 4: Summary
console.log('==============================');
console.log('✅ Fix Complete!');
console.log('==============================\n');
console.log('Next steps:');
console.log('1. Restart your server: npm run dev');
console.log('2. Login to admin panel');
console.log('3. Go to Products → Add Product');
console.log('4. Upload an image and check if it displays\n');
console.log('If images still don\'t show:');
console.log('- Check browser console (F12 → Console)');
console.log('- Look for 404 errors in Network tab (F12 → Network)');
console.log('- Try accessing image URL directly\n');
console.log('📁 Uploads folder: ' + uploadsDir);
console.log('📁 Database file: ' + dbFile);
console.log('\n🎉 Done!');
