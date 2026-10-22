import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isLocked: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  createCompletion: vi.fn(),
}));

vi.mock('../lib/repositories/profileDeletionRepository', () => ({
  isProfileDeletionInProgress: mocks.isLocked,
}));

vi.mock('../lib/repositories/reusableItemsRepository', () => ({
  getReusableItemsRepository: () => ({ getById: mocks.getById, update: mocks.update }),
}));

vi.mock('openai', () => ({
  AzureOpenAI: class {
    chat = { completions: { create: mocks.createCompletion } };
  },
}));

import { reusableItemsEnrichHandler } from './reusableItemsEnrich';

describe('reusableItemsEnrichHandler deletion guard', () => {
  const originalEndpoint = process.env['AZURE_OPENAI_ENDPOINT'];
  const originalApiKey = process.env['AZURE_OPENAI_API_KEY'];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['AZURE_OPENAI_ENDPOINT'] = 'https://example.invalid';
    process.env['AZURE_OPENAI_API_KEY'] = 'test-key';
    mocks.getById.mockResolvedValue({
      id: 'item-1',
      userId: 'user-1',
      name: 'Haferflocken',
      searchTerms: ['haferflocken'],
    });
    mocks.update.mockResolvedValue(null);
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: '["hafer"]' } }],
    });
  });

  it('does not load or enrich an item when deletion is already active', async () => {
    mocks.isLocked.mockResolvedValueOnce(true);

    await expect(reusableItemsEnrichHandler(
      { userId: 'user-1', itemId: 'item-1' },
      { log: vi.fn() } as never,
    )).rejects.toThrow('Profile deletion is in progress');

    expect(mocks.getById).not.toHaveBeenCalled();
    expect(mocks.createCompletion).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('processes work admitted before deletion without a post-work lease check', async () => {
    mocks.isLocked.mockResolvedValueOnce(false);

    await reusableItemsEnrichHandler(
      { userId: 'user-1', itemId: 'item-1' },
      { log: vi.fn() } as never,
    );

    expect(mocks.isLocked).toHaveBeenCalledOnce();
    expect(mocks.createCompletion).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith('user-1', 'item-1', expect.objectContaining({
      searchTermsEnriched: true,
    }));
  });

  afterAll(() => {
    if (originalEndpoint === undefined) delete process.env['AZURE_OPENAI_ENDPOINT'];
    else process.env['AZURE_OPENAI_ENDPOINT'] = originalEndpoint;
    if (originalApiKey === undefined) delete process.env['AZURE_OPENAI_API_KEY'];
    else process.env['AZURE_OPENAI_API_KEY'] = originalApiKey;
  });
});