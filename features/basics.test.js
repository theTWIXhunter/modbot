const test = require('node:test');
const assert = require('node:assert/strict');

const setupBasics = require('./basics');

const INTERACTIVE_CHAT_ID = '1323219960134238249';
const RESTART_BOT_ID = '1552450528611532820';

function createClient() {
  const handlers = {};
  const client = {
    user: {
      setActivity() {}
    },
    once() {},
    on(event, handler) {
      handlers[event] = handler;
    }
  };

  setupBasics(client);

  return handlers.messageCreate;
}

function createMessage({
  content,
  timestamp,
  authorId = RESTART_BOT_ID,
  channelId = INTERACTIVE_CHAT_ID,
  authorBot = true,
  failDelete = false
}) {
  let deleteCalls = 0;
  const message = {
    content,
    createdTimestamp: timestamp,
    deleted: false,
    channel: { id: channelId },
    author: { id: authorId, bot: authorBot },
    member: null,
    mentions: { has: () => false },
    async reply() {},
    async delete() {
      deleteCalls += 1;
      if (failDelete) {
        throw new Error('Missing permissions');
      }
      this.deleted = true;
    }
  };

  return {
    message,
    getDeleteCalls: () => deleteCalls
  };
}

test('deletes start/intermediate/completion messages when restart finishes within 10 minutes', async () => {
  const handleMessage = createClient();
  const start = createMessage({ content: 'Daily restart started', timestamp: 1_000 });
  const inBetween = createMessage({ content: 'Some changing status text', timestamp: 2_000 });
  const completion = createMessage({ content: 'Restart completed', timestamp: 3_000 });

  await handleMessage(start.message);
  await handleMessage(inBetween.message);
  await handleMessage(completion.message);

  assert.equal(start.getDeleteCalls(), 1);
  assert.equal(inBetween.getDeleteCalls(), 1);
  assert.equal(completion.getDeleteCalls(), 1);
});

test('does not delete restart interval messages when completion is later than 10 minutes', async () => {
  const handleMessage = createClient();
  const start = createMessage({ content: 'Daily restart started', timestamp: 1_000 });
  const inBetween = createMessage({ content: 'Some changing status text', timestamp: 2_000 });
  const completion = createMessage({
    content: 'Restart completed',
    timestamp: 1_000 + (10 * 60 * 1000) + 1
  });

  await handleMessage(start.message);
  await handleMessage(inBetween.message);
  await handleMessage(completion.message);

  assert.equal(start.getDeleteCalls(), 0);
  assert.equal(inBetween.getDeleteCalls(), 0);
  assert.equal(completion.getDeleteCalls(), 0);
});

test('ignores unrelated messages that are not exact restart start/completion text', async () => {
  const handleMessage = createClient();
  const startLike = createMessage({ content: 'Daily restart started now', timestamp: 1_000 });
  const completion = createMessage({ content: 'Restart completed', timestamp: 2_000 });

  await handleMessage(startLike.message);
  await handleMessage(completion.message);

  assert.equal(startLike.getDeleteCalls(), 0);
  assert.equal(completion.getDeleteCalls(), 0);
});

test('ignores messages from other authors', async () => {
  const handleMessage = createClient();
  const foreignStart = createMessage({
    content: 'Daily restart started',
    timestamp: 1_000,
    authorId: '999999999999999999'
  });
  const botMessage = createMessage({ content: 'Some changing status text', timestamp: 2_000 });
  const completion = createMessage({ content: 'Restart completed', timestamp: 3_000 });

  await handleMessage(foreignStart.message);
  await handleMessage(botMessage.message);
  await handleMessage(completion.message);

  assert.equal(foreignStart.getDeleteCalls(), 0);
  assert.equal(botMessage.getDeleteCalls(), 0);
  assert.equal(completion.getDeleteCalls(), 0);
});

test('continues cleanup when deleting one restart message fails', async () => {
  const handleMessage = createClient();
  const start = createMessage({ content: 'Daily restart started', timestamp: 1_000, failDelete: true });
  const inBetween = createMessage({ content: 'Some changing status text', timestamp: 2_000 });
  const completion = createMessage({ content: 'Restart completed', timestamp: 3_000 });

  await handleMessage(start.message);
  await handleMessage(inBetween.message);
  await assert.doesNotReject(() => handleMessage(completion.message));

  assert.equal(start.getDeleteCalls(), 1);
  assert.equal(inBetween.getDeleteCalls(), 1);
  assert.equal(completion.getDeleteCalls(), 1);
});
