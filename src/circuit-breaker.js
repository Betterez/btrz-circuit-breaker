"use strict";

let CircuitBreaker = require("circuit-breaker-js");

class BzCircuitBreaker {

  constructor (options) {
    options = options || {};
    this._circuitBreaker = new CircuitBreaker(options);
  }

  wrap (fn, fallback) {
    let circuitBreaker = this._circuitBreaker;

    return function () {
      let args = arguments;
      let _this = this;
      return new Promise(function (resolve, reject) {

        circuitBreaker.run(
          function (success, failed) {
            var promise = fn.apply(_this, args);
            promise
            .then(resolve, reject);
            promise
            .then(success, failed);
          },
          function () {
            return fallback ? resolve(fallback.apply(_this, args)) : reject();
          }
        );
      });
    };
  }

}

module.exports = BzCircuitBreaker;