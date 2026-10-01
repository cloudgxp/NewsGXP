import assert from 'node:assert/strict';
import test from 'node:test';
import { feedService } from '../src/services/feedService';

test('feedService topic grouping and taxonomy', () => {
  const topics = feedService.getAllTopics();
  assert.deepEqual(topics, ['AI', 'Technology', 'Gaming', 'Anime']);

  const aiProviders = feedService.getProvidersByTopic('AI');
  assert.equal(aiProviders.length, 2);
  assert.deepEqual(aiProviders.map((p) => p.id), ['openai', 'claude']);

  const techProviders = feedService.getProvidersByTopic('Technology');
  assert.equal(techProviders.length, 2);
  assert.deepEqual(techProviders.map((p) => p.id), ['google', 'microsoft-skills']);

  const gamingProviders = feedService.getProvidersByTopic('Gaming');
  assert.equal(gamingProviders.length, 3);
  assert.deepEqual(gamingProviders.map((p) => p.id), ['playstation', 'nintendo', 'xbox']);

  const animeProviders = feedService.getProvidersByTopic('Anime');
  assert.equal(animeProviders.length, 1);
  assert.deepEqual(animeProviders.map((p) => p.id), ['crunchyroll']);
});

test('topic follow and unfollow simulation', () => {
  let followed: string[] = [];

  // 1. Follow entire AI topic
  const aiIds = feedService.getProviderIdsForTopic('AI');
  followed = [...followed, ...aiIds.filter((id) => !followed.includes(id))];
  assert.deepEqual(followed, ['openai', 'claude']);

  // 2. Follow 1 provider from Anime
  followed.push('crunchyroll');
  assert.deepEqual(followed, ['openai', 'claude', 'crunchyroll']);

  // 3. Unfollow 1 provider from AI
  followed = followed.filter((id) => id !== 'claude');
  assert.deepEqual(followed, ['openai', 'crunchyroll']);

  // Check partial topic status
  const aiFollowed = aiIds.filter((id) => followed.includes(id));
  assert.equal(aiFollowed.length, 1);
  assert.ok(aiFollowed.length < aiIds.length, 'AI is partially followed');

  // 4. Re-follow entire AI topic
  followed = [...followed, ...aiIds.filter((id) => !followed.includes(id))];
  assert.deepEqual(followed.sort(), ['claude', 'crunchyroll', 'openai']);

  // 5. Unfollow entire AI topic
  followed = followed.filter((id) => !aiIds.includes(id));
  assert.deepEqual(followed, ['crunchyroll']);
});
