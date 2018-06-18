# promisify-redis

[![Build Status](https://travis-ci.org/Janpot/promisify-redis.svg?branch=master)](https://travis-ci.org/Janpot/promisify-redis)

Native promises for [redis](https://www.npmjs.com/package/redis).

## Features

- Native promises
- Supports `multi` and `batch`
- Doesn't mutate the library

## Usage

Wrap the wole library:

```js
const redisPromisify = require('promisify-redis');
const redis = redisPromisify(require('redis'));

const client = redis.createClient();

async function doSomething() {
  await client.set('foo', 'bar');
  return client.get('foo');
}
```

Or wrap just a single client

```js
const redisPromisify = require('promisify-redis');
const redis = require('redis');

const client = redisPromisify(redis.createClient());
```

## Multi

`.exec()` will return a promise:

```js
await client.multi()
  .set('foo', 'bar')
  .get('foo')
  .exec();
```

## Duplicate

`.duplicate()` only supports the synchronous version of the original library. It is still synchronous and will return a promisified client.
