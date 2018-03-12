# Async Scope

Async Scope is a library built on the relatively new Node feature Async Hooks. It provides a key-value store that follows simple scoping rules across async boundaries. What that means is if you have a function that spawns an async coputation that operates outside of the lexical scope of the invoking function you can share data between the two functions. The idea being that a child async context has access to all of the data defined in parent async contexts, but not to the data defined in child contexts.

Let's look at a convoluted example:

```typescript
import { asyncScope } from 'async-scope'

setTimeout(() => {
  function childFunction() {
    asyncScope.get<number>('foo') // returns 6
  }

  function parentFunction() {
    asyncScope.set('foo', 6)
    setTimeout(() => {
      childFunction()
    }, 1000)
  }

  parentFunction()
}, 500)
```

Think about this in terms of building a service framework where you have a server receiving HTTP requests and clients sending out HTTP requests. There is data on incoming HTTP headers that needs to be propagated to all clients (tracing, authentication, other company/user specific data). A library could set the desired values to the Async Scope store and client libraries could read that data without the service/application developers having to take any responsibility for passing data from server to client.

## Usage

```sh
$ npm install --save async-scope
```

### Basic KV Store API

The Async Scope store supports three operations: `get`, `set` and `delete`.

#### `set`

Sets a value to be read by the current scope or any child scope.

```typescript
import { asyncScope } from 'async-scope'

asyncScope.set('foo', 5)
```

#### `get`

Read a value from the current scope or any parent scope. It works like the prototype chain. It will return the first value matching the given key it finds by searching the chain (closest parent with matching key).

```typescript
import { asyncScope } from 'async-scope'

asyncScope.get('foo')
```

#### `delete`

Remove the given key from the current scope. This is a recursive delete. If there is more than one matching key in the current scope chain then all will be deleted.

```typescript
import { asyncScope } from 'async-scope'

asyncScope.delete('foo')
```

### Debugging API

These are methods for inspecting the async scope when things aren't behaving as expected.

#### `lineage`

Return an array representing the lineage of the current scope. Each scope has a unique id. This lists, in order, the parents of the current scope. The current scope is the first element in the array, the next is the immediate parent and so on.

```typescript
import { asyncScope } from 'async-scope'

console.log(asyncScope.lineage())
```

## Contributing

For more information about contributing new features and bug fixes, see our [Contribution Guidelines](https://github.com/creditkarma/CONTRIBUTING.md).
External contributors must sign Contributor License Agreement (CLA)

## License

This project is licensed under [Apache License Version 2.0](./LICENSE)
