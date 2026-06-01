import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionByOwnership } from './archive-ownership.ts';

const items = [
  { id: 'a', createdBy: 'u1' },
  { id: 'b', createdBy: 'u2' },
  { id: 'c', createdBy: 'u1' },
];

test('non-admin sees only own rows as editable', () => {
  const { editable, readOnly } = partitionByOwnership(items, {
    userId: 'u1',
    canEditAll: false,
  });
  assert.deepEqual(
    editable.map((i) => i.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    readOnly.map((i) => i.id),
    ['b'],
  );
});

test('admin (canEditAll) sees everything editable', () => {
  const { editable, readOnly } = partitionByOwnership(items, {
    userId: 'whoever',
    canEditAll: true,
  });
  assert.equal(editable.length, 3);
  assert.equal(readOnly.length, 0);
});

test('empty input yields empty partitions', () => {
  const { editable, readOnly } = partitionByOwnership([], {
    userId: 'u1',
    canEditAll: false,
  });
  assert.deepEqual(editable, []);
  assert.deepEqual(readOnly, []);
});
