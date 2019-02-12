(function (){
  'use strict';
  const {Tracer, BatchRecorder, ExplicitContext, jsonEncoder: {JSON_V1}} = require('zipkin');
  const {HttpLogger} = require('zipkin-transport-http');
  const wrapRequest = require('zipkin-instrumentation-request');
  const request = require('request');
  
  const ctxImpl = new ExplicitContext();
  
  const tracer = new Tracer({
    ctxImpl: ctxImpl,
    recorder: new BatchRecorder({
      logger: new HttpLogger({
        endpoint: 'http://zipkin.istio-system.svc.cluster.local:9411/api/v1/spans',
        jsonEncoder: JSON_V1
      })
    }),
    localServiceName: 'front-end'
  });

  const remoteServiceName = 'catalogue'; // name of remote application

  const zipkinRequest = wrapRequest(request, {tracer, remoteServiceName});
  const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

  var express   = require("express")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()

    
  app.use(zipkinMiddleware({tracer}));
  
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', [
      'Origin', 'Accept', 'X-Requested-With', 'X-B3-TraceId',
      'X-B3-ParentSpanId', 'X-B3-SpanId', 'X-B3-Sampled'
    ].join(', '));
    next();
  });

  app.get("/catalogue/images*", function (req, res, next) {
    var url = endpoints.catalogueUrl + req.url.toString();
    zipkinRequest.get(url)
        .on('error', function(e) { next(e); })
        .pipe(res);
  });

  app.get("/catalogue*", function (req, res, next) {
    helpers.simpleHttpRequest(endpoints.catalogueUrl + req.url.toString(), res, next, {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36'
      }
    );
  });

  app.get("/tags", function(req, res, next) {
    helpers.simpleHttpRequest(endpoints.tagsUrl, res, next, {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36'
      });
  });

  module.exports = app;
}());
