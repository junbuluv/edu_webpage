export interface OwnableItem {
  id: string;
  createdBy: string;
}

/**
 * Split items into those the viewer may edit/delete vs. read-only.
 * `canEditAll` (admins) is precomputed by the caller from the role so this
 * helper stays alias-free and unit-testable. A non-admin may edit only the
 * rows they created.
 */
export function partitionByOwnership<T extends OwnableItem>(
  items: T[],
  viewer: { userId: string; canEditAll: boolean },
): { editable: T[]; readOnly: T[] } {
  const editable: T[] = [];
  const readOnly: T[] = [];
  for (const item of items) {
    if (viewer.canEditAll || item.createdBy === viewer.userId) {
      editable.push(item);
    } else {
      readOnly.push(item);
    }
  }
  return { editable, readOnly };
}
