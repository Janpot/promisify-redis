/* eslint-env mocha */

const redis = require('redis');
const redisPromisify = require('..');
const { assert } = require('chai');
const sinon = require('sinon');

describe('redis-promisify', () => {
  const sandbox = sinon.createSandbox();
  let clients = [];

  function registerClient (client) {
    clients = [ ...clients, client ];
    return client;
  }

  function createClient (redisLib, ...args) {
    return registerClient(redisLib.createClient(...args));
  }

  beforeEach(done => {
    const client = createClient(redis);
    client.flushall(done);
  });

  afterEach(() => {
    const result = Promise.all(clients.map(client => {
      const endPromise = new Promise(resolve => client.on('end', resolve));
      client.quit();
      return endPromise;
    }));
    clients = [];
    return result;
  });

  afterEach(() => sandbox.restore());

  it('should run a redis command', async () => {
    const client = redisPromisify(createClient(redis));
    await client.set('hello', 'world');
    const result = await client.get('hello');
    assert.strictEqual(result, 'world');
  });

  it('should reject on failing command', async () => {
    const client = redisPromisify(createClient(redis));
    try {
      await client.set('hello');
    } catch (err) {
      assert.instanceOf(err, Error);
      assert.propertyVal(err, 'message', 'ERR wrong number of arguments for \'set\' command');
      return;
    }
    throw new Error('must throw');
  });

  it('should be idempotent', async () => {
    const client = redisPromisify(redisPromisify(createClient(redis)));
    await client.set('hello', 'world');
    const result = await client.get('hello');
    assert.strictEqual(result, 'world');
  });

  it('should duplicate', async () => {
    const originalClient = registerClient(redis.createClient());
    const client = redisPromisify(originalClient).duplicate();
    registerClient(client);
    await client.set('hello', 'world');
    const result = await client.get('hello');
    assert.strictEqual(result, 'world');
  });

  it('should pass options on duplicate', async () => {
    const originalClient = registerClient(redis.createClient());
    const spy = sandbox.spy(originalClient, 'duplicate');
    const clientOptions = { db: 5 };
    const client = redisPromisify(originalClient).duplicate(clientOptions);
    registerClient(client);
    assert.strictEqual(clientOptions, spy.getCall(0).args[0]);
  });

  it('should do multi', async () => {
    const client = redisPromisify(createClient(redis));
    const result = await client.multi()
      .set('hello', 'world')
      .get('hello')
      .exec();
    assert.strictEqual(result[0], 'OK');
    assert.strictEqual(result[1], 'world');
  });

  it('should do batch', async () => {
    const client = redisPromisify(createClient(redis));
    const result = await client.batch()
      .set('hello', 'world')
      .get('hello')
      .exec();
    assert.strictEqual(result[0], 'OK');
    assert.strictEqual(result[1], 'world');
  });

  it('should promisify multi object', async () => {
    const client = createClient(redis);
    const result = await redisPromisify(client.multi())
      .set('hello', 'world')
      .get('hello')
      .exec();
    assert.strictEqual(result[0], 'OK');
    assert.strictEqual(result[1], 'world');
  });

  it('shouldn\'t fail on double promisified multi', async () => {
    const client = redisPromisify(createClient(redis));
    const result = await redisPromisify(client.multi())
      .set('hello', 'world')
      .get('hello')
      .exec();
    assert.strictEqual(result[0], 'OK');
    assert.strictEqual(result[1], 'world');
  });

  it('shouldn\' alter the commands besides promisifying', async () => {
    const client = createClient(redis);
    const promisifiedClient = redisPromisify(client);
    assert.strictEqual(client.set.name, promisifiedClient.set.name);
    assert.strictEqual(client.duplicate.name, promisifiedClient.duplicate.name);
    assert.strictEqual(client.multi.name, promisifiedClient.multi.name);
    assert.strictEqual(client.multi().exec.name, promisifiedClient.multi().exec.name);
  });

  it('should error on non-promisifiable targets', async () => {
    try {
      redisPromisify(7);
    } catch (err) {
      assert.instanceOf(err, TypeError);
      assert.propertyVal(err, 'message', 'The "client" argument must be of type RedisClient. Received type number');
      return;
    }
    throw new Error('must throw');
  });

  it('should error on undefined targets', async () => {
    try {
      redisPromisify();
    } catch (err) {
      assert.propertyVal(err, 'message', 'The "client" argument must be of type RedisClient. Received type undefined');
      assert.instanceOf(err, TypeError);
      return;
    }
    throw new Error('must throw');
  });

  it('should still do pub/sub', async () => {
    const client1 = redisPromisify(createClient(redis));
    const client2 = redisPromisify(createClient(redis));
    const result = new Promise(resolve => {
      client1.once('message', (channel, message) => resolve({ channel, message }));
    });
    await client1.subscribe('foo');
    await client2.publish('foo', 'bar');
    const { channel, message } = await result;
    assert.strictEqual(channel, 'foo');
    assert.strictEqual(message, 'bar');
  });

  it('should promisify the library', async () => {
    const promisifiedRedis = redisPromisify(redis);
    const client = createClient(promisifiedRedis);
    await client.set('hello', 'world');
    const result = await client.get('hello');
    assert.strictEqual(result, 'world');
  });

  it('shouldn\'t promisify the library twice', async () => {
    const promisifiedRedis = redisPromisify(redis);
    assert.strictEqual(promisifiedRedis, redisPromisify(promisifiedRedis));
  });

  it('should pass client options', async () => {
    const promisifiedRedis = redisPromisify(redis);
    const spy = sandbox.spy(redis, 'createClient');
    const clientOptions = { db: 6 };
    createClient(promisifiedRedis, clientOptions);
    assert.strictEqual(clientOptions, spy.getCall(0).args[0]);
  });

  it('should pass through library properties', async () => {
    assert.strictEqual(redisPromisify(redis).addCommand, redis.addCommand);
  });
});
