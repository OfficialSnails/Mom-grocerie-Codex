import { describe, expect, it } from 'vitest';
import { selectPrimaryFlyersForCycle } from '../sources/flipp-adapter.js';

describe('selectPrimaryFlyersForCycle', () => {
  it('prefers the weekly Quebec flyer over brochures and other provinces', () => {
    const flyers = [
      {
        id: 1,
        merchant: 'IGA',
        name: 'Barbecue Brochure - QC',
        valid_from: '2026-06-04T00:00:00-04:00',
        valid_to: '2026-06-10T23:59:59-04:00',
      },
      {
        id: 2,
        merchant: 'IGA',
        name: 'Quebec - Circulaire Hebdomadaire',
        valid_from: '2026-06-04T00:00:00-04:00',
        valid_to: '2026-06-10T23:59:59-04:00',
      },
      {
        id: 3,
        merchant: 'Marches Tradition',
        name: 'Nouveau-Brunswick',
        valid_from: '2026-06-04T00:00:00-04:00',
        valid_to: '2026-06-10T23:59:59-04:00',
      },
      {
        id: 4,
        merchant: 'Marches Tradition',
        name: 'Quebec',
        valid_from: '2026-06-04T00:00:00-04:00',
        valid_to: '2026-06-10T23:59:59-04:00',
      },
    ];

    const selected = selectPrimaryFlyersForCycle(flyers as never[], new Date('2026-06-04T12:00:00-04:00'));

    expect(selected.map(flyer => flyer.id).sort((a, b) => a - b)).toEqual([2, 4]);
  });

  it('targets the upcoming Thursday cycle when run on Wednesday', () => {
    const flyers = [
      {
        id: 10,
        merchant: 'Maxi',
        name: 'Weekly Flyer - Valid Thursday, June 04 - Wednesday, June 10',
        valid_from: '2026-06-04T00:00:00-04:00',
        valid_to: '2026-06-10T23:59:59-04:00',
      },
      {
        id: 11,
        merchant: 'Maxi',
        name: 'Weekly Flyer - Valid Thursday, June 11 - Wednesday, June 17',
        valid_from: '2026-06-11T00:00:00-04:00',
        valid_to: '2026-06-17T23:59:59-04:00',
      },
    ];

    const selected = selectPrimaryFlyersForCycle(flyers as never[], new Date('2026-06-10T13:00:00-04:00'));

    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(11);
  });
});
