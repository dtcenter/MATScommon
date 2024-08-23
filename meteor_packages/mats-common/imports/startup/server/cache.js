/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";

/* eslint-disable global-require */

let getResult;
let storeResult;
let clear;
let expireKey;

if (Meteor.isServer) {
  const Results = require("node-file-cache").create({
    file: "fileCache",
    life: 8 * 3600,
  });
  getResult = function (key) {
    // console.log('asked to get result from cache for key:', key);
    const result = Results.get(key);
    return result === null ? undefined : result;
  };
  storeResult = function (key, result) {
    // console.log('asked to set result in cache for app: ',process.env.PWD, ' key:', key);
    Results.set(key, result);
    // console.log('set result in cache for app: ', process.env.PWD, 'key:', key);
  };
  clear = function () {
    // console.log('asked to clear result cache');
    Results.clear();
  };
  expireKey = function (key) {
    // console.log('asked to clear result cache for key ', key);
    Results.expire(key);
  };
}

// eslint-disable-next-line no-undef
export default matsCache = {
  getResult,
  storeResult,
  clear,
  expireKey,
};
