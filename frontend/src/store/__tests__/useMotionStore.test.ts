import { describe, it, expect, beforeEach } from 'vitest';
import { useMotionStore } from '../useMotionStore';

describe('useMotionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMotionStore.setState({
      dirtyPageIds: new Set(),
    });
  });

  it('should track dirty states correctly', () => {
    useMotionStore.getState().setDirty('1');
    useMotionStore.getState().setDirty('3');

    expect(useMotionStore.getState().isDirty('1')).toBe(true);
    expect(useMotionStore.getState().isDirty('2')).toBe(false);
    expect(useMotionStore.getState().isDirty('3')).toBe(true);

    useMotionStore.getState().clearDirty('1');
    expect(useMotionStore.getState().isDirty('1')).toBe(false);
    expect(useMotionStore.getState().isDirty('3')).toBe(true);
  });
});
