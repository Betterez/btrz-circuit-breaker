"use strict";

let _ = require("lodash"),
  CircuitBreaker = require("circuit-breaker-js");

function initParams(uri, options, callback) {
  if (typeof options === "function") {
    callback = options;
  }

  let params = {};
  if (typeof options === "object") {
    _.assign(params, options, {uri: uri});
  } else if (typeof uri === "string") {
    _.assign(params, {uri: uri});
  } else {
    _.assign(params, uri);
  }

  params.callback = callback;
  return params;
}

class BzCircuitBreaker {

  constructor (options) {
    options = options || {};
    this._circuitBreaker = new CircuitBreaker(options);
  }

  wrapHttpTransport (transport, fallback) {
    let circuitBreaker = this._circuitBreaker;

    // expose transport signature (request.js like), but without callback
    return function (method, uri, options) {

      // return native Promise
      return new Promise(function (resolve, reject) {

        // run transport call inside circuitBreaker
        circuitBreaker.run(function (success, failed) {

          // call transport as usual, with a callback that notifies circuitBreaker and Promise
          let callback = function (error, response, body) {
            if (error) {
              failed(error);
              reject(error);
            } else if (response.statusCode >= 400) {
              //TODO: improve error thrown
              let errorResponse = new Error (`${response.statusCode}: ${response.statusMessage}`);
              failed(errorResponse);
              reject(errorResponse);
            } else {
              success();
              let parsedBody;
              try {
                parsedBody = JSON.parse(body);
              }
              catch (e) {
                parsedBody = body;
              }
              finally {
                resolve(parsedBody);
              }
            }
          };
          let params = initParams(uri, options, callback);
          params.method = method;
          return transport(params, params.callback);

        },
        function () {
          //TODO: pass some data available to the fallback function
          return (fallback && typeof(fallback) === "function") ? resolve(fallback()) : reject();
        });

      });
    };

  }

  wrapPromiseFunction (fn, fallback) {
    let circuitBreaker = this._circuitBreaker;

    return function () {
      let args = arguments;
      let _this = this;
      return new Promise(function (resolve, reject) {

        circuitBreaker.run(
          function (success, failed) {
            var promise = fn.apply(_this, args);
            promise.then(resolve, reject);
            promise.then(success, failed);
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
