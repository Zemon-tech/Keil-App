import { describe, it, expect, beforeEach } from 'vitest';
import { useMotionStore } from '../useMotionStore';

describe('useMotionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMotionStore.setState({
      pages: [],
      dirtyPageIds: new Set(),
    });
  });

  it('should hydrate pages and check change-detection keys including position and parent_id', () => {
    const pages = [
      { id: '1', title: 'Page 1', updated_at: '2026-05-31T00:00:00Z', parent_id: null, position: 0 } as any,
      { id: '2', title: 'Page 2', updated_at: '2026-05-31T00:00:00Z', parent_id: null, position: 1 } as any,
    ];

    useMotionStore.getState().hydratePages(pages);
    expect(useMotionStore.getState().pages).toHaveLength(2);

    // Call hydratePages with identical items (should be ignored by guard)
    useMotionStore.getState().hydratePages([...pages]);

    // Update parent_id of Page 2 (should bypass guard and hydrate)
    const reparentedPages = [
      { id: '1', title: 'Page 1', updated_at: '2026-05-31T00:00:00Z', parent_id: null, position: 0 } as any,
      { id: '2', title: 'Page 2', updated_at: '2026-05-31T00:00:00Z', parent_id: '1', position: 1 } as any,
    ];
    useMotionStore.getState().hydratePages(reparentedPages);
    expect(useMotionStore.getState().pages[1].parent_id).toBe('1');

    // Update position of Page 2 (should bypass guard and hydrate)
    const reorderedPages = [
      { id: '1', title: 'Page 1', updated_at: '2026-05-31T00:00:00Z', parent_id: null, position: 0 } as any,
      { id: '2', title: 'Page 2', updated_at: '2026-05-31T00:00:00Z', parent_id: '1', position: 2 } as any,
    ];
    useMotionStore.getState().hydratePages(reorderedPages);
    expect(useMotionStore.getState().pages[1].position).toBe(2);
  });

  it('should recursively remove pages and descendants', () => {
    // Tree: 1 (root) -> 2 (child) -> 3 (grandchild)
    const pages = [
      { id: '1', title: 'Root', parent_id: null } as any,
      { id: '2', title: 'Child', parent_id: '1' } as any,
      { id: '3', title: 'Grandchild', parent_id: '2' } as any,
      { id: '4', title: 'Other Root', parent_id: null } as any,
    ];

    useMotionStore.getState().hydratePages(pages);
    useMotionStore.getState().setDirty('1');
    useMotionStore.getState().setDirty('3');
    useMotionStore.getState().setDirty('4');

    expect(useMotionStore.getState().pages).toHaveLength(4);
    expect(useMotionStore.getState().isDirty('1')).toBe(true);
    expect(useMotionStore.getState().isDirty('3')).toBe(true);

    // Recursively delete '1' (should remove 1, 2, 3 but leave 4)
    useMotionStore.getState().removePageLocally('1');

    const nextPages = useMotionStore.getState().pages;
    expect(nextPages).toHaveLength(1);
    expect(nextPages[0].id).toBe('4');

    // Verify dirty states are cleared for descendants
    expect(useMotionStore.getState().isDirty('1')).toBe(false);
    expect(useMotionStore.getState().isDirty('3')).toBe(false);
    expect(useMotionStore.getState().isDirty('4')).toBe(true);
  });
});
