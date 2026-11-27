/**
 * Tests for pine save() in src/core/pine.js.
 * A new script's Ctrl+S opens a "Save Script" name dialog. The old code only
 * clicked an English "Save" button, so in the Korean UI ("저장") the dialog
 * stayed open while save() still reported success.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { save, isSaveLabel, isCancelLabel } from '../src/core/pine.js';

// Simulates the editor + save dialog. `dialogOnSave`: whether Ctrl+S opens the
// name dialog. `clickCloses`: whether clicking save in the dialog saves.
function mockEditor({ before, dialogOnSave, clickCloses = true, savedAs }) {
  const state = { script: before, dialogOpen: false, keys: [], clickedWith: undefined };
  const _deps = {
    ensurePineEditorOpen: async () => true,
    sleep: async () => {},
    getEditorScript: async () => state.script,
    getClient: async () => ({
      Input: {
        dispatchKeyEvent: async (e) => {
          state.keys.push(e.type);
          if (e.type === 'keyDown') {
            if (dialogOnSave) state.dialogOpen = true;
            else state.script = { ...state.script, version: String(Number(state.script.version) + 1) + '.0' };
          }
        },
      },
    }),
    evaluate: async (js) => {
      if (js.includes('/*focus-editor*/')) { state.focused = true; return true; }
      if (js.includes('/*save-dialog:find*/')) return state.dialogOpen ? { found: true, name: 'My Strat' } : { found: false };
      if (js.includes('/*save-dialog:click*/')) {
        const m = js.match(/var newName = (.*);/);
        state.clickedWith = JSON.parse(m[1]);
        if (clickCloses) { state.dialogOpen = false; state.script = savedAs; }
        return { found: true, name: state.clickedWith || 'My Strat', clicked: true };
      }
      throw new Error('unexpected evaluate');
    },
  };
  return { state, _deps };
}

const NEW = { name: '이름없는 스크립트', script_id: null, version: null, is_new_unsaved: true, is_draft: true, has_unsaved_changes: true };
const SAVED = { name: 'My Strat', script_id: 'USER;abc', version: '1.0', is_new_unsaved: false, is_draft: false, has_unsaved_changes: false };

describe('pine save()', () => {
  it('confirms the name dialog for a new script and reports saved_as', async () => {
    const { state, _deps } = mockEditor({ before: NEW, dialogOnSave: true, savedAs: SAVED });
    const r = await save({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.action, 'saved_new_script');
    assert.deepEqual(r.saved_as, { name: 'My Strat', script_id: 'USER;abc', version: '1.0' });
    assert.equal(state.clickedWith, null);
    assert.equal(state.focused, true);
    assert.deepEqual(state.keys, ['keyDown', 'keyUp']);
  });

  it('passes a custom name into the dialog', async () => {
    const { state, _deps } = mockEditor({ before: NEW, dialogOnSave: true, savedAs: { ...SAVED, name: 'Custom' } });
    const r = await save({ name: 'Custom', _deps });
    assert.equal(r.success, true);
    assert.equal(state.clickedWith, 'Custom');
    assert.equal(r.saved_as.name, 'Custom');
  });

  it('fails when the dialog stays open after clicking save', async () => {
    const { _deps } = mockEditor({ before: NEW, dialogOnSave: true, clickCloses: false });
    const r = await save({ _deps });
    assert.equal(r.success, false);
    assert.equal(r.action, 'save_dialog_still_open');
  });

  it('fails for a new script when no dialog appears', async () => {
    const { _deps } = mockEditor({ before: NEW, dialogOnSave: false });
    _deps.getClient = async () => ({ Input: { dispatchKeyEvent: async () => {} } });
    const r = await save({ _deps });
    assert.equal(r.success, false);
    assert.equal(r.action, 'save_dialog_not_found');
  });

  it('saves an existing script in place without touching a dialog', async () => {
    const { state, _deps } = mockEditor({ before: { ...SAVED, has_unsaved_changes: true }, dialogOnSave: false });
    const r = await save({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.action, 'saved');
    assert.equal(r.saved_to_script.script_id, 'USER;abc');
    assert.equal(r.saved_to_script.previous_version, '1.0');
    assert.equal(r.saved_to_script.version, '2.0');
    assert.equal(state.clickedWith, undefined);
  });
});

describe('save dialog labels', () => {
  it('matches save/cancel in several UI languages', () => {
    for (const t of ['Save', '저장', ' 保存 ', 'Speichern', 'Enregistrer']) assert.ok(isSaveLabel(t), t);
    for (const t of ['Cancel', '취소', 'キャンセル', 'Abbrechen']) assert.ok(isCancelLabel(t), t);
  });
  it('does not match editor buttons', () => {
    for (const t of ['Save and add to chart', '저장하고 차트에 추가', 'Update on chart', '']) assert.ok(!isSaveLabel(t), t);
  });
});
