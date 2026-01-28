import fs from 'fs';
import path from 'path';
import pool from '../config/database';

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('[Migration] Starting migrations...');
    
    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      console.log(`[Migration] Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`[Migration] Completed: ${file}`);
    }
    
    console.log('[Migration] All migrations completed successfully!');
  } catch (error) {
    console.error('[Migration] Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
