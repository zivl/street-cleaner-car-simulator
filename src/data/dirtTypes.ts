export type DirtTypeId = 'leaves' | 'oil' | 'trash';

export interface DirtTypeDef {
  id: DirtTypeId;
  index: number;
  label: string;
  /** Higher = harder to remove. */
  toughness: number;
  /** Which upgrade multiplier helps most. */
  boostedBy: 'debris' | 'oil';
  /** Grime color painted on the road. */
  grime: string;
  /** Mini-map / radar blip color. */
  blip: string;
  /** Patch radius range in metres. */
  patchRadius: [number, number];
}

export const DIRT_TYPES: DirtTypeDef[] = [
  {
    id: 'leaves',
    index: 0,
    label: 'Leaves',
    toughness: 1,
    boostedBy: 'debris',
    grime: '#7a5a22',
    blip: '#f5a524',
    patchRadius: [2.2, 5.5],
  },
  {
    id: 'oil',
    index: 1,
    label: 'Oil',
    toughness: 3.4,
    boostedBy: 'oil',
    grime: '#0b0b10',
    blip: '#b86bff',
    patchRadius: [1.4, 3.4],
  },
  {
    id: 'trash',
    index: 2,
    label: 'Trash',
    toughness: 1.6,
    boostedBy: 'debris',
    grime: '#5b5446',
    blip: '#ff4d6d',
    patchRadius: [1.8, 4.2],
  },
];

export const DIRT_BY_INDEX = DIRT_TYPES;
