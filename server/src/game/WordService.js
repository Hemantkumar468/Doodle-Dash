import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Word } from '../models/Word.js';

const dataPath = fileURLToPath(new URL('../data/words.json', import.meta.url));
let bundled = [];
try {
  const parsed = JSON.parse(readFileSync(dataPath, 'utf8'));
  bundled = Array.isArray(parsed) ? parsed : Object.entries(parsed).flatMap(([category, words]) => words.map((text) => ({ text, category })));
} catch {
  bundled = [
    { text: 'cat', category: 'animals' }, { text: 'dog', category: 'animals' },
    { text: 'house', category: 'places' }, { text: 'pizza', category: 'food' },
    { text: 'bicycle', category: 'objects' }, { text: 'dancing', category: 'actions' }
  ];
}

const clean = (value) => String(value || '')
  .replace(/[<>\u0000-\u001F\u007F]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 40);

export class WordService {
  constructor({ random = Math.random } = {}) {
    this.random = random;
  }

  async pool() {
    if (mongoose.connection.readyState === 1) {
      try {
        const rows = await Word.find({}, { text: 1, _id: 0 }).lean();
        if (rows.length) return rows.map((row) => row.text);
      } catch {
        // Bundled words keep an active game healthy if Mongo briefly drops.
      }
    }
    return bundled.map((item) => item.text);
  }

  async choices({ count = 3, customWords = '', used = new Set(), mode = 'Normal' } = {}) {
    const custom = String(customWords).split(',').map(clean).filter((word) => word.length >= 2);
    const base = [...new Set([...(await this.pool()), ...custom].map(clean).filter(Boolean))]
      .filter((word) => !used.has(word.toLocaleLowerCase('en')));
    const source = base.length >= count ? base : [...new Set([...(await this.pool()), ...custom].map(clean).filter(Boolean))];
    const output = [];
    const available = [...source];
    while (output.length < count && available.length) {
      const index = Math.floor(this.random() * available.length);
      let word = available.splice(index, 1)[0];
      if (mode === 'Combination' && available.length) {
        const secondIndex = Math.floor(this.random() * available.length);
        word = `${word} ${available.splice(secondIndex, 1)[0]}`;
      }
      const normalized = word.toLocaleLowerCase('en');
      if (!used.has(normalized) && !output.some((item) => item.toLocaleLowerCase('en') === normalized)) output.push(word);
    }
    return output.length ? output : ['house'];
  }
}
