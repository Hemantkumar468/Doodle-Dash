import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Word } from '../models/Word.js';

const path = fileURLToPath(new URL('../data/words.json', import.meta.url));

async function seed() {
  const categories = JSON.parse(readFileSync(path, 'utf8'));
  const words = Object.entries(categories).flatMap(([category, values]) => values.map((text) => ({ text, category })));
  await connectDatabase();
  await Word.bulkWrite(words.map((word) => ({
    updateOne: { filter: { text: word.text }, update: { $set: word }, upsert: true }
  })));
  console.log(`Seeded ${words.length} words.`);
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error(`Seed failed: ${error.message}`);
  await disconnectDatabase();
  process.exitCode = 1;
});
