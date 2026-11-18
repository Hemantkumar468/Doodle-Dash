import { describe, expect, it } from 'vitest';
import { WordService } from '../src/game/WordService.js';

describe('WordService', () => {
  it('does not repeat an already-used combination', async () => {
    const service = new WordService({ random: () => 0 });
    service.pool = async () => ['cat', 'house', 'tree', 'boat'];

    const choices = await service.choices({
      count: 1,
      mode: 'Combination',
      used: new Set(['cat house'])
    });

    expect(choices).toEqual(['tree boat']);
  });
});
