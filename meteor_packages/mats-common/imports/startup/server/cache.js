/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";

/* eslint-disable global-require */

let getResult;
let storeResult;
let clear;
let removeKey;

if (Meteor.isServer) {
  // eslint-disable-next-line import/no-unresolved
  import Cache from "file-system-cache";

  const Results = Cache({
    basePath: "./.cache", // (optional) Path where cache files are stored (default).
    ttl: 8 * 3600, // (optional) A time-to-live (in secs) on how long an item remains cached.
  });
  getResult = async function (key) {
    // console.log('asked to get result from cache for key:', key);
    const result = await Results.get(key);
    return result === null ? undefined : result;
  };
  storeResult = async function (key, result) {
    // console.log('asked to set result in cache for app: ',process.env.PWD, ' key:', key);
    await Results.set(key, result);
    // console.log('set result in cache for app: ', process.env.PWD, 'key:', key);
  };
  clear = async function () {
    // console.log('asked to clear result cache');
    await Results.clear();
  };
  removeKey = async function (key) {
    // console.log('asked to clear result cache for key ', key);
    await Results.remove(key);
  };
}

// eslint-disable-next-line no-undef
export default matsCache = {
  getResult,
  storeResult,
  clear,
  removeKey,
};
