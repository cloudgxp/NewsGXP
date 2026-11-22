import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feedService,
  TOPIC_ORDER,
  DEFAULT_FOLLOWED_PROVIDERS,
} from '../src/services/feedService';
import { ALLOWED_FEEDS } from '../src/config/feeds';
import { PROVIDER_META } from '../worker/ingest';

test('feedService topic grouping and 32 verified AI/Tech sources', () => {
  const topics = feedService.getAllTopics();
  assert.deepEqual(topics, [...TOPIC_ORDER]);
  assert.deepEqual(topics, [
    'Frontier Labs',
    'Cloud & Engineering',
    'Hardware & Edge',
    'Generative Media',
  ]);

  const frontierLabs = feedService.getProvidersByTopic('Frontier Labs');
  assert.equal(frontierLabs.length, 9);
  assert.deepEqual(
    frontierLabs.map((p) => p.id),
    [
      'openai',
      'openai-research',
      'anthropic',
      'google-ai',
      'google-gemini',
      'google-deepmind',
      'meta-ai',
      'mistral',
      'cohere',
    ]
  );

  const cloudEng = feedService.getProvidersByTopic('Cloud & Engineering');
  assert.equal(cloudEng.length, 11);
  assert.deepEqual(
    cloudEng.map((p) => p.id),
    [
      'google',
      'google-developers',
      'microsoft-ai',
      'azure-foundry',
      'microsoft-skills',
      'aws-genai',
      'aws-ml',
      'github-blog',
      'github-changelog',
      'huggingface',
      'perplexity',
    ]
  );

  const hardwareEdge = feedService.getProvidersByTopic('Hardware & Edge');
  assert.equal(hardwareEdge.length, 4);
  assert.deepEqual(
    hardwareEdge.map((p) => p.id),
    ['nvidia-genai', 'nvidia-developer', 'amd-blogs', 'apple-intelligence']
  );

  const genMedia = feedService.getProvidersByTopic('Generative Media');
  assert.equal(genMedia.length, 8);
  assert.deepEqual(
    genMedia.map((p) => p.id),
    [
      'stability-ai',
      'runway-news',
      'pika-blog',
      'luma-news',
      'elevenlabs-product',
      'elevenlabs-research',
      'suno-blog',
      'suno-release-notes',
    ]
  );

  // Verify Gaming, Anime, xAI, Claude Blog, and Midjourney are removed
  assert.equal(feedService.getProvidersByTopic('Gaming').length, 0);
  assert.equal(feedService.getProvidersByTopic('Anime').length, 0);
  for (const removedId of [
    'crunchyroll',
    'playstation',
    'nintendo',
    'xbox',
    'xai',
    'claude',
    'midjourney',
  ]) {
    assert.equal(feedService.getProvider(removedId), undefined);
    assert.equal(ALLOWED_FEEDS[removedId], undefined);
    assert.equal(PROVIDER_META[removedId], undefined);
  }
});

test('feedService, ALLOWED_FEEDS, and worker PROVIDER_META stay in 1-to-1 sync', () => {
  const providerIds = feedService.getAllProviders().map((p) => p.id).sort();
  const allowedIds = Object.keys(ALLOWED_FEEDS).sort();
  const workerMetaIds = Object.keys(PROVIDER_META).sort();

  assert.equal(providerIds.length, 32);
  assert.deepEqual(providerIds, allowedIds);
  assert.deepEqual(providerIds, workerMetaIds);

  for (const p of feedService.getAllProviders()) {
    assert.equal(
      PROVIDER_META[p.id].topic,
      p.topic,
      `Topic mismatch for provider "${p.id}"`
    );
  }

  assert.ok(DEFAULT_FOLLOWED_PROVIDERS.length > 0);
  for (const defaultId of DEFAULT_FOLLOWED_PROVIDERS) {
    assert.ok(feedService.getProvider(defaultId), `Default provider "${defaultId}" must exist`);
  }
});

test('topic follow and unfollow simulation', () => {
  let followed: string[] = [];

  const labIds = feedService.getProviderIdsForTopic('Frontier Labs');
  followed = [...followed, ...labIds.filter((id) => !followed.includes(id))];
  assert.equal(followed.length, 9);

  followed.push('huggingface');
  assert.equal(followed.length, 10);

  followed = followed.filter((id) => id !== 'anthropic');
  assert.equal(followed.length, 9);
  assert.ok(!followed.includes('anthropic'));

  followed = [...followed, ...labIds.filter((id) => !followed.includes(id))];
  assert.equal(followed.length, 10);
  assert.ok(followed.includes('anthropic'));

  followed = followed.filter((id) => !labIds.includes(id));
  assert.deepEqual(followed, ['huggingface']);
});
