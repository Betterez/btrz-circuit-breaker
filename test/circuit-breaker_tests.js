/*jshint expr: true*/
"use strict";

describe("CircuitBreaker", function () {

  let sinon = require("sinon"),
      chai = require("chai"),
      chaiAsPromised = require("chai-as-promised");
  chai.use(chaiAsPromised);
  let expect = chai.expect;

  let CircuitBreaker = require("../src/circuit-breaker");

  it("should pass configuration to underlying circuit breaker", function () {
    let breaker = new CircuitBreaker({windowDuration: 123});
    expect(breaker._circuitBreaker.windowDuration).to.equal(123);
  });
  
  describe("#wrapHttpTransport()", function () {
  
    let makeFakeRequestLib = function (error, response, body) {
      response = response || {statusCode: 200};
      let fakeRequestLib = function (params, callback) {
        setTimeout(function() { callback(error, response, body); }, 10);
      };
      fakeRequestLib.initParams = function (uri, options, callback) {
        let params = options || {};
        params.uri = uri;
        params.callback = callback;
        return params;
      };
      return fakeRequestLib;
    };

    it("should wrap http call transparently", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib();
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");
      
      let asserts = function () {
        expect(spy.calledOnce).to.be.true;
        expect(spy.firstCall.args[0].method).to.equal("get");
        expect(spy.firstCall.args[0].uri).to.equal("http://test");
        done();
      };

      expect(promise).to.eventually.deep.equal({data: 123}).and.notify(asserts);
    });

    it("should wrap http call with params transparently", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib();
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("post", "http://test", {postData: {data: 1}});
      
      let asserts = function () {
        expect(spy.calledOnce).to.be.true;
        expect(spy.firstCall.args[0].method).to.equal("post");
        expect(spy.firstCall.args[0].uri).to.equal("http://test");
        expect(spy.firstCall.args[0].postData).to.deep.equal({data: 1});
        done();
      };

      expect(promise).to.eventually.deep.equal({data: 123}).and.notify(asserts);
    });

    it("should not parse JSON response body", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, null, "{\"data\": 123}");
      let wrappedTransport = breaker.wrapHttpTransport(requestLib);
      let promise = wrappedTransport("post", "http://test", {postData: "bodybody"});

      expect(promise).to.eventually.deep.equal({data: 123}).and.notify(done);
    });

    it("should not parse if response body is not JSON", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, null, "bodybody");
      let wrappedTransport = breaker.wrapHttpTransport(requestLib);
      let promise = wrappedTransport("post", "http://test", {postData: "bodybody"});

      expect(promise).to.eventually.equal("bodybody").and.notify(done);
    });

    it("should wrap error http call transparently", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(new Error("anerror!"));
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      expect(promise).to.eventually.be.rejectedWith("anerror!").and.notify(done);
    });

    it("should wrap http call with response with error code transparently", function (done) {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 400, statusMessage: "stahp"});
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      expect(promise).to.eventually.be.rejectedWith("400: stahp").and.notify(done);
    });

    it("should reject with the status code of the response when it fails", function () {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 500, statusMessage: "error"}, JSON.stringify({
        code: 'ERROR_CODE',
        message: 'An Error message'
      }));
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      return promise
        .catch((error) => {
          expect(error.status).to.be.equal(500);
        });
    });

    it("should reject with the code of the body when it fails", function () {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 500, statusMessage: "error"}, JSON.stringify({
        code: 'ERROR_CODE',
        message: 'An Error message'
      }));
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      return promise
        .catch((error) => {
          expect(error.code).to.be.equal('ERROR_CODE');
        });
    });

    it("should reject with the right message when it fails and the body is parseable", function () {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 500, statusMessage: "error"}, JSON.stringify({
        code: 'ERROR_CODE',
        message: 'An Error message'
      }));
      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      return promise
        .catch((error) => {
          expect(error.message).to.be.equal('500: An Error message');
        });
    });

    it("should reject with the wright message when it fails and the body is not parseable", function () {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 500, statusMessage: "error"},
        "non-parseable body");

      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      return promise
          .catch((error) => {
          expect(error.message).to.be.equal('500: non-parseable body');
      });
    });

    it("should reject with the right message when it fails and the body was already parsed by some middleware", function () {
      let breaker = new CircuitBreaker();
      let requestLib = makeFakeRequestLib(null, {statusCode: 500, statusMessage: "error"}, {
        code: 'ERROR_CODE',
        message: 'An Error message'
      });

      let spy = sinon.spy(requestLib);
      let wrappedTransport = breaker.wrapHttpTransport(spy);
      let promise = wrappedTransport("get", "http://test");

      return promise
        .catch((error) => {
          expect(error.message).to.be.equal('500: An Error message');
          expect(error.code).to.be.equal('ERROR_CODE');
        });
    });

    it("should wrap error http call, rejecting after several attempts", function (done) {
      const breaker = new CircuitBreaker();
      const requestLib = makeFakeRequestLib(new Error("anerror!"));
      const spy = sinon.spy(requestLib);
      const wrappedTransport = breaker.wrapHttpTransport(spy);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedTransport("get", "http://test")
            .catch(() => {
            });
        }, i * 10);
      }

      setTimeout(function() { 
        wrappedTransport("get", "http://test")
          .catch((e) => {
            expect(e.message).to.be.eql("CIRCUIT_BREAKER_TRIPPED_NO_FALLBACK");
            done();
          });
      }, 120);
    });

    it("should wrap error http call, executing fallback after several attempts", function (done) {
      const breaker = new CircuitBreaker();
      const requestLib = makeFakeRequestLib(new Error("anerror!"));
      const spy = sinon.spy(requestLib);
      const fallback = function () { return "this is the fallback"; };
      const wrappedTransport = breaker.wrapHttpTransport(spy, fallback);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedTransport("get", "http://test")
            .catch(() => {
            });          
        }, i * 10);
      }

      setTimeout(function() { 
        const promise = wrappedTransport("get", "http://test");
        expect(promise).to.eventually.equal("this is the fallback").and.notify(done);
      }, 120);
    });

    it("should wrap error code response http call, rejecting after several attempts", function (done) {
      const breaker = new CircuitBreaker();
      const requestLib = makeFakeRequestLib(null, {statusCode: 400, statusMessage: "stahp"});
      const spy = sinon.spy(requestLib);
      const wrappedTransport = breaker.wrapHttpTransport(spy);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedTransport("get", "http://test")
            .catch(() => {
            });          
        }, i * 10);
      }

      setTimeout(function() { 
        wrappedTransport("get", "http://test")
          .catch((e) => {
            expect(e.message).to.be.eql("400: stahp");
            done();
          })        
      }, 120);
    });

    it("should wrap error code response http call, executing fallback after several attempts", function (done) {
      const breaker = new CircuitBreaker();
      const requestLib = makeFakeRequestLib(null, {statusCode: 501, statusMessage: "stahp"});
      const spy = sinon.spy(requestLib);
      const fallback = function () { return "this is the fallback"; };
      const wrappedTransport = breaker.wrapHttpTransport(spy, fallback);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedTransport("get", "http://test")
            .catch(() => {
            });                  
        }, i * 10);
      }

      setTimeout(function() { 
        const promise = wrappedTransport("get", "http://test");
        expect(promise).to.eventually.equal("this is the fallback").and.notify(done);
      }, 120);
    });

  });

  describe("#wrapPromiseFunction()", function () {

    let asyncFunction = function (arg) {
      return new Promise(function (resolve) {
        setTimeout(function() { resolve("123" + arg); }, 10);
      });
    };

    let asyncFailingFunction = function (arg) {
      return new Promise(function (resolve, reject) {
        setTimeout(function() { reject("err" + arg); }, 10);
      });
    };

    it("should wrap asynchronous function transparently", function (done) {
      let breaker = new CircuitBreaker();
      let wrappedFn = breaker.wrapPromiseFunction(asyncFunction);
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
      service.fn = breaker.wrapPromiseFunction(service.fn);
      let promise = service.fn("test");
      expect(promise).to.eventually.equal("sometest").and.notify(done);
    });

    it("should wrap failing async function rejecting after several attempts", function (done) {
      let breaker = new CircuitBreaker();
      let wrappedFn = breaker.wrapPromiseFunction(asyncFailingFunction);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedFn("test")
          .catch((e) => {})
        }, i * 10);
      }

      setTimeout(function() { 
        let promise = wrappedFn("test");
        expect(promise).to.be.rejected.and.notify(done);
      }, 120);
    });

    it("should resolve to fallback after several attempts", function (done) {
      let breaker = new CircuitBreaker();
      let fallback = asyncFunction;
      let wrappedFn = breaker.wrapPromiseFunction(asyncFailingFunction, fallback);

      for (var i = 0; i < 10; i++) {
        setTimeout(function() { 
          wrappedFn("test")
            .catch((e) => {});
         }, i * 10);
      }

      setTimeout(function() {
        let promise = wrappedFn("this time fallback!");
        expect(promise).to.eventually.equal("123this time fallback!").and.notify(done);
      }, 120);
    });

  });

});
