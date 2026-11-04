import { describe, expect, it } from 'vitest';
import { firstVerifiedWitnessId, verifiedFocusSignature } from './AtlasWitnessFocus';

const sourceRows = [
  { id: 'delivery:D1', kind: 'settled' },
  { id: 'delivery:D2', kind: 'critical' },
  { id: 'payment:P1', kind: 'uncertain' },
];

describe('witness-backed Atlas focus — never infer criticality', () => {
  it('focuses the first server-identified critical record only after live challenge', () => {
    expect(firstVerifiedWitnessId(sourceRows, 'challenge', true, true)).toBe('delivery:D2');
  });
  it('does not focus an unverified or pre-challenge record', () => {
    expect(firstVerifiedWitnessId(sourceRows, 'challenge', false, true)).toBeNull();
    expect(firstVerifiedWitnessId(sourceRows, 'review', true, true)).toBeNull();
    expect(firstVerifiedWitnessId(sourceRows, 'challenge', true, false)).toBeNull();
  });
  it('fails closed without a server-marked critical record', () => {
    expect(firstVerifiedWitnessId([{ id: 'delivery:D2', kind: 'uncertain' }], 'challenge', true, true)).toBeNull();
  });
  it('uses the actual IDs, never a hardcoded D2', () => {
    expect(firstVerifiedWitnessId([{ id: 'attendance:T-52', kind: 'critical' }], 'verify', true, true)).toBe('attendance:T-52');
  });
  it('does not focus records that lack IDs', () => {
    expect(firstVerifiedWitnessId([{ id: '', kind: 'critical' }], 'challenge', true, true)).toBeNull();
  });
  it('keeps the same signature across renders and challenge-to-verify', () => {
    const first = verifiedFocusSignature(sourceRows, 'challenge', true, true, 'result:1');
    expect(first).toBe(verifiedFocusSignature([...sourceRows], 'verify', true, true, 'result:1'));
  });
  it('recognises a genuinely new result with identical critical IDs', () => {
    expect(verifiedFocusSignature(sourceRows, 'challenge', true, true, 'result:1'))
      .not.toBe(verifiedFocusSignature(sourceRows, 'challenge', true, true, 'result:2'));
  });
  it('keeps the same signature for an unrelated settled-row change', () => {
    const before = verifiedFocusSignature(sourceRows, 'challenge', true, true, 'result:1');
    const after = verifiedFocusSignature([{ id: 'other', kind: 'settled' }, ...sourceRows], 'challenge', true, true, 'result:1');
    expect(after).toBe(before);
  });
  it('returns null before live success even if a cached critical record exists', () => {
    expect(verifiedFocusSignature(sourceRows, 'review', true, true, 'result:1')).toBeNull();
    expect(verifiedFocusSignature(sourceRows, 'challenge', false, true, 'result:1')).toBeNull();
  });
});
