# btrz-circuit-breaker

Wrapper around [circuit-breaker-js](https://www.npmjs.com/package/circuit-breaker-js) to return native Promises.

# Bump a new version

`npm version patch`

## Engines

io.js >= v2.0.1

## Wrapping a function that returns a Promise

    let configuration = { ... };
    let breaker = new CircuitBreaker(configuration);
    let fallback = function () { }; //might return a value or Promise
    let wrappedFn = breaker.wrapPromiseFunction(someAsyncFunction, fallback);

    let promise = wrappedFn(arg1, arg2 ...);

    promise.then ...

## Using the already wrapped HTTP transport

    // httpTransport should have a simple api(method, url, options)
    // request is a good example
    let wrappedTransport = breaker.wrapHttpTransport(httpTransport);
    let promise = wrappedTransport("post", "http://test", {postData: {data: 1}});

## Wrapping a [request](https://github.com/request/request)-like HTTP library

    let configuration = { ... };
    let breaker = new CircuitBreaker(configuration);
    let fallback = function () { }; //might return a value or Promise
    let httpTransport = require("request");
    let wrappedTransport = breaker.wrapPromiseFunction(httpTransport, fallback);

    let promise = wrappedTransport("GET", "http://test.com");
    // let promise = wrappedTransport("POST", "http://test.com", {postData: {data: 123}});
    // let promise = wrappedTransport(<method>, <uri>, <any options accepted by request.js>);

    promise.then ...
