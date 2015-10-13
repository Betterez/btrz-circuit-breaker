/*jshint expr: true*/
"use strict";

describe("CircuitBreaker", function () {

  let chai = require("chai"),
      chaiAsPromised = require("chai-as-promised");
  chai.use(chaiAsPromised);
  let expect = chai.expect;

  let CircuitBreaker = require("../src/circuit-breaker");

  let asyncFunction = function (arg) {
    return new Promise(function (resolve) {
      setTimeout(function() { resolve("123" + arg); }, 1000);
    });
  };

  let asyncFailingFunction = function (arg) {
    return new Promise(function (resolve, reject) {
      setTimeout(function() { reject("err" + arg); }, 10);
    });
  };

  it("should wrap asynchronous function transparently", function (done) {
    let breaker = new CircuitBreaker();
    let wrappedFn = breaker.wrap(asyncFunction);
    let promise = wrappedFn("test");
    expect(promise).to.eventually.equal("123test").and.notify(done);
  });

  it("should wrap asynchronous function transparently applying 'this' and arguments", function (done) {
    let breaker = new CircuitBreaker();
    let service = {
      something: "some",
      fn: function (arg) {
        let something = this.something;
        return new Promise(function (resolve, reject) {
          setTimeout(function() { resolve(something + arg); }, 1000);
        });
      }
    };
    service.fn = breaker.wrap(service.fn);
    let promise = service.fn("test");
    expect(promise).to.eventually.equal("sometest").and.notify(done);
  });

  it("should wrap failing async function rejecting after several attempts", function (done) {
    let breaker = new CircuitBreaker();
    let wrappedFn = breaker.wrap(asyncFailingFunction);

    for (var i = 0; i < 10; i++) {
      setTimeout(function() { wrappedFn("test"); }, i * 10);
    }

    setTimeout(function() { 
      let promise = wrappedFn("test");
      expect(promise).to.be.rejected.and.notify(done);
    }, 120);
  });

  it("should resolve to fallback after several attempts", function (done) {
    let breaker = new CircuitBreaker();
    let fallback = asyncFunction;
    let wrappedFn = breaker.wrap(asyncFailingFunction, fallback);

    for (var i = 0; i < 10; i++) {
      setTimeout(function() { wrappedFn("test"); }, i * 10);
    }

    setTimeout(function() {
      let promise = wrappedFn("this time fallback!");
      expect(promise).to.eventually.equal("123this time fallback!").and.notify(done);
    }, 120);
  });

  it("should pass configuration to underlying circuit breaker", function () {
    let breaker = new CircuitBreaker({windowDuration: 123});
    expect(breaker._circuitBreaker.windowDuration).to.equal(123);
  });
  
});
