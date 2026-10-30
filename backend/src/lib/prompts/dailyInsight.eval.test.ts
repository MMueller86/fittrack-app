import { mkdir, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AzureOpenAI } from 'openai';
import { __setOpenAiClientForTests, generateDailyInsight } from '../openai';
import { getAzureOpenAiApiVersion } from '../azureOpenAiConfig';
import { DAILY_INSIGHT_PROMPT_FINGERPRINT, DAILY_INSIGHT_PROMPT_VERSION } from './dailyInsightPrompt';
import { DAILY_INSIGHT_EVAL_FIXTURES } from './dailyInsight.eval.fixtures';

const TESTED_PROMPT_VERSION = 'v30';

it('daily insight prompt version matches fixture expectations', () => {
  expect(DAILY_INSIGHT_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];
const evaluationStatus = hasCredentials ? 'VERIFIED' : 'UNVERIFIED';

afterEach(() => __setOpenAiClientForTests(null));

const UNSUPPORTED_GREETING_EMOJI = /[🏆🏅🥇🥈🥉🎉🥳💪🔥📈📉]/u;
const SINGLE_EMOJI = /^(?:\p{Extended_Pictographic}\uFE0F?[\p{Emoji_Modifier}]?(?:\u200D\p{Extended_Pictographic}\uFE0F?[\p{Emoji_Modifier}]?)*|\p{Regional_Indicator}{2})$/u;

function hasValidGreeting(greeting: string | undefined, displayName: string): boolean {
  if (greeting == null) return false;
  const prefix = `Hallo, ${displayName}! `;
  if (!greeting.startsWith(prefix)) return false;

  const emoji = greeting.slice(prefix.length);
  return SINGLE_EMOJI.test(emoji)
    && !UNSUPPORTED_GREETING_EMOJI.test(emoji);
}

describe('daily insight compact-output rubric', () => {
  it('accepts a time-neutral greeting with the exact name and one friendly emoji', () => {
    expect(hasValidGreeting('Hallo, Sportler! 👋', 'Sportler')).toBe(true);
    expect(hasValidGreeting('Hallo, Mia-Luise! 😊', 'Mia-Luise')).toBe(true);
  });

  it.each([
    ['time-of-day wording', 'Guten Morgen, Sportler! 👋'],
    ['a changed name', 'Hallo, Andere! 👋'],
    ['multiple emoji', 'Hallo, Sportler! 👋 🙂'],
    ['an unsupported achievement emoji', 'Hallo, Sportler! 🏆'],
    ['extra text after the emoji', 'Hallo, Sportler! 👋 Bleib dran.'],
  ])('rejects greeting with %s', (_description, greeting) => {
    expect(hasValidGreeting(greeting, 'Sportler')).toBe(false);
  });
});

// Live evaluation checks structure and supplied numbers only; wording quality is reviewed manually from the saved artifacts.
describe('dailyInsight: live prompt evaluation', () => {
  it.each(DAILY_INSIGHT_EVAL_FIXTURES)(`[${evaluationStatus}] [$id] $description`, async (fixture) => {
    if (!hasCredentials) return;

    const liveClient = new AzureOpenAI({
      endpoint: process.env['AZURE_OPENAI_ENDPOINT']!,
      apiKey: process.env['AZURE_OPENAI_API_KEY']!,
      apiVersion: getAzureOpenAiApiVersion(),
    });
    let providerAttempt = 0;
    const create = vi.fn(async (...args: Parameters<typeof liveClient.chat.completions.create>) => {
      providerAttempt += 1;
      const completion = await liveClient.chat.completions.create(...args);
      if ('choices' in completion) {
        await mkdir('output', { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await writeFile(`output/daily-insight-${DAILY_INSIGHT_PROMPT_VERSION}-${fixture.id}-${timestamp}-attempt-${providerAttempt}.json`, JSON.stringify({
          fixtureId: fixture.id,
          providerAttempt,
          promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
          promptFingerprint: DAILY_INSIGHT_PROMPT_FINGERPRINT,
          finishReason: completion.choices[0]?.finish_reason,
          content: completion.choices[0]?.message.content,
        }, null, 2));
      }
      return completion;
    });
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);

    const result = await generateDailyInsight(fixture.input);

    expect(create.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(create.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.intent).toBe(fixture.intent);
    expect(result.response.title.length).toBeGreaterThan(0);
    expect(result.response.title.length).toBeLessThanOrEqual(40);
    expect(result.response.summary.length).toBeGreaterThan(0);
    expect(result.response.summary.length).toBeLessThanOrEqual(5_000);
    const greeting = result.response.greeting ?? '';
    const shortInsight = result.response.shortInsight ?? '';
    expect(hasValidGreeting(greeting, fixture.input.displayName)).toBe(true);
    expect(greeting.length).toBeLessThanOrEqual(120);
    expect(shortInsight.length).toBeGreaterThan(0);
    expect(shortInsight.length).toBeLessThanOrEqual(240);
    expect(result.response).not.toHaveProperty('cta');
    expect(result.response).not.toHaveProperty('ctaTarget');

    if (fixture.expectNullActionFields) {
      expect(result.response.recommendation).toBeUndefined();
    }
  }, 60_000);
});
