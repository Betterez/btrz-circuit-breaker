# btrz-circuit-breaker

Wrapper around [circuit-breaker-js](https://www.npmjs.com/package/circuit-breaker-js) to return native Promises.

## Engines

io.js >= v2.0.1

## Basic usage

    let configuration = { ... };
    let breaker = new CircuitBreaker();
    let fallback = function () { }; //might be an async function
    let wrappedFn = breaker.wrap(someAsyncFunction, fallback);
    
    let promise = wrappedFn(arg1, arg2 ...);
    
    promise.then ...
