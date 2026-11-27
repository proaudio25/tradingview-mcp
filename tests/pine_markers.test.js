/**
 * Unit tests for classifyMarkers — splits Monaco editor markers into compile
 * errors vs warnings for pine_get_errors / pine_smart_compile.
 * No TradingView connection needed.
 *
 * Run: node --test tests/pine_markers.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMarkers } from '../src/core/pine.js';

const marker = (severity, line = 1) => ({ line, column: 1, message: `m${severity}`, severity });

describe('classifyMarkers', () => {
  it('treats only severity 8 as an error', () => {
    const r = classifyMarkers([marker(8, 3), marker(4, 5), marker(2), marker(1)]);
    assert.equal(r.has_errors, true);
    assert.equal(r.error_count, 1);
    assert.equal(r.warning_count, 3);
    assert.equal(r.errors[0].line, 3);
    assert.equal(r.errors[0].level, 'error');
    assert.deepEqual(r.warnings.map(w => w.level), ['warning', 'info', 'hint']);
  });

  it('warnings alone do not count as errors', () => {
    const r = classifyMarkers([marker(4), marker(4)]);
    assert.equal(r.has_errors, false);
    assert.equal(r.error_count, 0);
    assert.equal(r.warning_count, 2);
    assert.deepEqual(r.errors, []);
  });

  it('handles empty or missing marker lists', () => {
    for (const input of [[], null, undefined]) {
      const r = classifyMarkers(input);
      assert.equal(r.has_errors, false);
      assert.equal(r.error_count, 0);
      assert.equal(r.warning_count, 0);
    }
  });

  it('keeps original marker fields', () => {
    const r = classifyMarkers([{ line: 9, column: 4, message: 'Syntax error', severity: 8 }]);
    assert.deepEqual(r.errors[0], { line: 9, column: 4, message: 'Syntax error', severity: 8, level: 'error' });
  });
});
