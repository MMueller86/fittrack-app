import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCosmos: vi.fn(),
  isLocked: vi.fn(),
  enqueueEnrichment: vi.fn(),
}));

vi.mock('../lib/cosmos', () => ({ getCosmos: mocks.getCosmos }));
vi.mock('../lib/repositories/profileDeletionRepository', () => ({
  isProfileDeletionInProgress: mocks.isLocked,
}));
vi.mock('../lib/queueClient', () => ({ enqueueEnrichment: mocks.enqueueEnrichment }));

import { reusableItemsEnrichSchedulerHandler } from './reusableItemsEnrichScheduler';

describe('reusableItemsEnrichSchedulerHandler deletion guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['COSMOS_ENDPOINT'] = 'https://example.invalid';
    process.env['COSMOS_KEY'] = 'test-key';
    const fetchAll = vi.fn().mockResolvedValue({
      resources: [
        { userId: 'deleting-user', id: 'item-1' },
        { userId: 'active-user', id: 'item-2' },
      ],
    });
    mocks.getCosmos.mockResolvedValue({
      containers: {
        reusableMealItems: {
          items: { query: vi.fn().mockReturnValue({ fetchAll }) },
        },
      },
    });
    mocks.isLocked.mockImplementation(async (userId: string) => userId === 'deleting-user');
  });

  it('does not enqueue items for users with an active deletion lease', async () => {
    await reusableItemsEnrichSchedulerHandler(undefined, { log: vi.fn() } as never);

    expect(mocks.isLocked).toHaveBeenCalledWith('deleting-user');
    expect(mocks.isLocked).toHaveBeenCalledWith('active-user');
    expect(mocks.enqueueEnrichment).toHaveBeenCalledOnce();
    expect(mocks.enqueueEnrichment).toHaveBeenCalledWith('active-user', 'item-2', expect.anything());
  });
});