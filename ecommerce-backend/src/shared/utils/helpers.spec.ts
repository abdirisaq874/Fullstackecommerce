import { Types } from 'mongoose';
import { idsEqual } from './helpers';

describe('idsEqual', () => {
  const hex = '507f1f77bcf86cd799439011';

  it('matches two equal hex strings', () => {
    expect(idsEqual(hex, hex)).toBe(true);
  });

  it('matches an ObjectId against its string form (either order)', () => {
    const oid = new Types.ObjectId(hex);
    expect(idsEqual(oid, hex)).toBe(true);
    expect(idsEqual(hex, oid)).toBe(true);
  });

  it('matches two ObjectId instances of the same value', () => {
    expect(idsEqual(new Types.ObjectId(hex), new Types.ObjectId(hex))).toBe(true);
  });

  it('does not match different ids', () => {
    expect(idsEqual(hex, '507f1f77bcf86cd799439099')).toBe(false);
  });

  it('returns false when either side is null/undefined', () => {
    expect(idsEqual(null, hex)).toBe(false);
    expect(idsEqual(hex, undefined)).toBe(false);
    expect(idsEqual(null, null)).toBe(false);
  });
});
