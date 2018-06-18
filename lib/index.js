const redis = require('redis');
const commands = require('redis-commands');

const IS_PROMISIFIED = Symbol('is already promisified');

function promisifyRedisCommand (command) {
  return new Proxy(command, {
    apply (target, thisArg, argumentsList) {
      return new Promise((resolve, reject) => {
        Reflect.apply(target, thisArg, [ ...argumentsList, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        } ]);
      });
    }
  });
}

function promisifyMulti (multi) {
  return new Proxy(multi, {
    get (target, prop, receiver) {
      if (prop === IS_PROMISIFIED) {
        return true;
      }

      const original = Reflect.get(target, prop, receiver);

      if (prop === 'exec') {
        return promisifyRedisCommand(original);
      }

      return original;
    }
  });
}

function promisifyCreateClientCommand (command) {
  return new Proxy(command, {
    apply (target, thisArg, argumentsList) {
      return promisifyClient(Reflect.apply(target, thisArg, argumentsList));
    }
  });
}

function promisifyMultiCommand (command) {
  return new Proxy(command, {
    apply (target, thisArg, argumentsList) {
      return promisifyMulti(Reflect.apply(target, thisArg, argumentsList));
    }
  });
}

function promisifyClient (client) {
  return new Proxy(client, {
    get (target, prop, receiver) {
      if (prop === IS_PROMISIFIED) {
        return true;
      }

      const original = Reflect.get(target, prop, receiver);

      if (prop === 'duplicate') {
        return promisifyCreateClientCommand(original);
      }

      if (prop === 'multi' || prop === 'batch') {
        return promisifyMultiCommand(original);
      }

      if (commands.exists(prop)) {
        return promisifyRedisCommand(original);
      }

      return original;
    }
  });
}

function TYPE_ERROR (argumentName, expectedType, value) {
  return new TypeError(`The "${argumentName}" argument must be of type ${expectedType}. Received type ${typeof value}`);
}

function promisifyLibrary (library) {
  return new Proxy(library, {
    get (target, prop, receiver) {
      if (prop === IS_PROMISIFIED) {
        return true;
      }

      const original = Reflect.get(target, prop, receiver);

      if (prop === 'createClient') {
        return promisifyCreateClientCommand(original);
      }

      return original;
    }
  });
}

function redisPromisify (client) {
  if (!client) {
    throw TYPE_ERROR('client', redis.RedisClient.name, client);
  } if (client[IS_PROMISIFIED]) {
    return client;
  } else if (client === redis) {
    return promisifyLibrary(client);
  } else if (client instanceof redis.RedisClient) {
    return promisifyClient(client);
  } else if (client instanceof redis.Multi) {
    return promisifyMulti(client);
  } else {
    throw TYPE_ERROR('client', redis.RedisClient.name, client);
  }
}

module.exports = redisPromisify;
