/**
 * Tests for compactStudyInputs in src/core/data.js.
 * data_get_study_values used to return each Pine study's full inputs,
 * including the encoded script source ('text'), which pushed the response
 * past 100KB on charts with a few custom indicators.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compactStudyInputs } from '../src/core/data.js';

describe('compactStudyInputs', () => {
  it('drops Pine source/metadata and flattens {v,f,t} wrappers', () => {
    const r = compactStudyInputs({
      text: 'bmI9Ks46_' + 'x'.repeat(30000),
      pineId: 'USER;0123456789abcdef0123456789abcdef',
      pineVersion: '13.0',
      pineFeatures: { v: '{"indicator":1}', f: true, t: 'text' },
      in_0: { v: 14, f: true, t: 'integer' },
      in_1: { v: 'close', f: true, t: 'source' },
      in_2: { v: true, f: true, t: 'bool' },
      __fast_calc: { v: false, f: true, t: 'bool' },
      __profile: { v: false, f: true, t: 'bool' },
    });
    assert.deepEqual(r, { in_0: 14, in_1: 'close', in_2: true });
  });

  it('keeps plain built-in inputs as-is', () => {
    assert.deepEqual(compactStudyInputs({ length: 20, col_prev_close: false }), { length: 20, col_prev_close: false });
  });

  it('drops long strings and non-scalar values', () => {
    const r = compactStudyInputs({ a: 'y'.repeat(65), b: { v: [1, 2] }, c: { nested: 1 }, d: 'ok' });
    assert.deepEqual(r, { d: 'ok' });
  });

  it('returns null for empty or missing inputs', () => {
    assert.equal(compactStudyInputs(null), null);
    assert.equal(compactStudyInputs({}), null);
    assert.equal(compactStudyInputs({ text: 'x' }), null);
  });
});
