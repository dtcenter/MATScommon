/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsDataUtils, matsTypes, matsCollections } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";

// utility to get the cadence for a particular model, so that the query function
// knows where to include null points for missing data.
const getModelCadence = async function (pool, dataSource, startDate, endDate) {
  let rows = [];
  let cycles;
  try {
    // this query should only return data if the model cadence is irregular.
    // otherwise, the cadence will be calculated later by the query function.
    let cycles_raw;
    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine  'queryDBTimeSeries' cannot itslef be async because the graph page needs to wait
            for its result, so we use an anomynous async() function here to wrap the queryCB call
            */
      const doc = await pool.getCb("MD:matsAux:COMMON:V01");
      const newModel = doc.standardizedModleList[dataSource];
      cycles_raw = doc.primaryModelOrders[newModel]
        ? doc.primaryModelOrders[newModel].cycleSecnds
        : undefined;
    } else {
      // we will default to mysql so old apps won't break
      rows = simplePoolQueryWrapSynchronous(
        pool,
        `select cycle_seconds ` +
          `from mats_common.primary_model_orders ` +
          `where model = ` +
          `(select new_model as display_text from mats_common.standardized_model_list where old_model = '${dataSource}');`
      );
      cycles_raw = rows[0].cycle_seconds
        ? JSON.parse(rows[0].cycle_seconds)
        : undefined;
    }
    const cycles_keys = cycles_raw ? Object.keys(cycles_raw).sort() : undefined;
    // there can be difference cadences for different time periods (each time period is a key in cycles_keys,
    // with the cadences for that period represented as values in cycles_raw), so this section identifies all
    // time periods relevant to the requested date range, and returns the union of their cadences.
    if (cycles_keys.length !== 0) {
      let newTime;
      let chosenStartTime;
      let chosenEndTime;
      let chosenStartIdx;
      let chosenEndIdx;
      let foundStart = false;
      let foundEnd = false;
      for (var ti = cycles_keys.length - 1; ti >= 0; ti--) {
        newTime = cycles_keys[ti];
        if (startDate >= Number(newTime) && !foundStart) {
          chosenStartTime = newTime;
          chosenStartIdx = ti;
          foundStart = true;
        }
        if (endDate >= Number(newTime) && !foundEnd) {
          chosenEndTime = newTime;
          chosenEndIdx = ti;
          foundEnd = true;
        }
        if (foundStart && foundEnd) {
          break;
        }
      }
      if (chosenStartTime !== undefined && chosenEndTime !== undefined) {
        if (Number(chosenStartTime) === Number(chosenEndTime)) {
          cycles = cycles_raw[chosenStartTime];
        } else if (chosenEndIdx - chosenStartIdx === 1) {
          const startCycles = cycles_raw[chosenStartTime];
          const endCycles = cycles_raw[chosenEndTime];
          cycles = _.union(startCycles, endCycles);
        } else {
          let middleCycles = [];
          let currCycles;
          for (ti = chosenStartIdx + 1; ti < chosenEndIdx; ti++) {
            currCycles = cycles_raw[cycles_keys[ti]];
            middleCycles = _.union(middleCycles, currCycles);
          }
          const startCycles = cycles_raw[chosenStartTime];
          const endCycles = cycles_raw[chosenEndTime];
          cycles = _.union(startCycles, endCycles, middleCycles);
        }
        cycles.sort(function (a, b) {
          return a - b;
        });
      }
    }
  } catch (e) {
    // ignore - just a safety check, don't want to exit if there isn't a cycles_per_model entry
    // if there isn't a cycles_per_model entry, it just means that the model has a regular cadence
  }
  if (cycles !== null && cycles !== undefined && cycles.length > 0) {
    for (let c = 0; c < cycles.length; c++) {
      cycles[c] = cycles[c] * 1000; // convert to milliseconds
    }
  } else {
    cycles = []; // regular cadence model--cycles will be calculated later by the query function
  }
  return cycles;
};

// utility for querying the DB
const simplePoolQueryWrapSynchronous = function (pool, statement) {
  /*
     simple synchronous query of statement to the specified pool.
     params :
     pool - a predefined db pool (usually defined in main.js). i.e. wfip2Pool = mysql.createPool(wfip2Settings);
     statement - String - a valid sql statement
     actions - queries database and will wait until query returns.
     return: rowset - an array of rows
     throws: error
     */
  if (Meteor.isServer) {
    const Future = require("fibers/future");
    const queryWrap = Future.wrap(function (pool, statement, callback) {
      pool.query(statement, function (err, rows) {
        return callback(err, rows);
      });
    });
    return queryWrap(pool, statement).wait();
  }
};

// utility for querying the DB via Python
const queryDBPython = function (pool, queryArray) {
  if (Meteor.isServer) {
    // send the query statement to the python query function
    const pyOptions = {
      mode: "text",
      pythonPath: Meteor.settings.private.PYTHON_PATH,
      pythonOptions: ["-u"], // get print results in real-time
      scriptPath:
        process.env.NODE_ENV === "development"
          ? `${process.env.PWD}/.meteor/local/build/programs/server/assets/packages/randyp_mats-common/public/python/`
          : `${process.env.PWD}/programs/server/assets/packages/randyp_mats-common/public/python/`,
      args: [
        "-h",
        pool.config.connectionConfig.host,
        "-P",
        pool.config.connectionConfig.port,
        "-u",
        pool.config.connectionConfig.user,
        "-p",
        pool.config.connectionConfig.password,
        "-d",
        pool.config.connectionConfig.database,
        "-t",
        Meteor.settings.public.mysql_wait_timeout
          ? Meteor.settings.public.mysql_wait_timeout
          : 300,
        "-q",
        JSON.stringify(queryArray),
      ],
    };
    const pyShell = require("python-shell");
    const Future = require("fibers/future");

    const future = new Future();
    let d = [];
    let error = "";
    let N0 = [];
    let N_times = [];

    pyShell.PythonShell.run("python_query_util.py", pyOptions)
      .then((results) => {
        // query callback - build the curve data from the results - or set an error
        if (results === undefined || results === "undefined") {
          error =
            "Error thrown by python_query_util.py. Please write down exactly how you produced this error, and submit a ticket at mats.gsl@noaa.gov.";
        } else {
          // get the data back from the query
          const parsedData = JSON.parse(results);
          d = parsedData.data;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
          error = parsedData.error;
        }
        // done waiting - have results
        future.return();
      })
      .catch((err) => {
        error = err.message;
        future.return();
      });

    // wait for future to finish
    future.wait();
    // check for nulls in output, since JSON only passes strings
    for (let idx = 0; idx < d.length; idx++) {
      for (let didx = 0; didx < d[idx].y.length; didx++) {
        if (d[idx].y[didx] === "null") {
          d[idx].y[didx] = null;
          if (d[idx].subVals.length > 0) {
            d[idx].subData[didx] = NaN;
            d[idx].subHeaders[didx] = NaN;
            d[idx].subVals[didx] = NaN;
            if (queryArray[idx].statLineType === "ctc") {
              d[idx].subHit[didx] = NaN;
              d[idx].subFa[didx] = NaN;
              d[idx].subMiss[didx] = NaN;
              d[idx].subCn[didx] = NaN;
            } else if (queryArray[idx].statLineType === "mode_pair") {
              d[idx].subInterest[didx] = NaN;
            } else if (queryArray[idx].statLineType === "mode_pair") {
              d[idx].n_forecast[didx] = 0;
              d[idx].n_matched[didx] = 0;
              d[idx].n_simple[didx] = 0;
              d[idx].n_total[didx] = 0;
            }
          }
          d[idx].subSecs[didx] = NaN;
          d[idx].subLevs[didx] = NaN;
        } else if (d[idx].x[didx] === "null") {
          d[idx].x[didx] = null;
          if (d[idx].subVals.length > 0) {
            d[idx].subData[didx] = NaN;
            d[idx].subHeaders[didx] = NaN;
            d[idx].subVals[didx] = NaN;
            if (queryArray[idx].statLineType === "ctc") {
              d[idx].subHit[didx] = NaN;
              d[idx].subFa[didx] = NaN;
              d[idx].subMiss[didx] = NaN;
              d[idx].subCn[didx] = NaN;
            } else if (queryArray[idx].statLineType === "mode_pair") {
              d[idx].subInterest[didx] = NaN;
            } else if (queryArray[idx].statLineType === "mode_pair") {
              d[idx].n_forecast[didx] = 0;
              d[idx].n_matched[didx] = 0;
              d[idx].n_simple[didx] = 0;
              d[idx].n_total[didx] = 0;
            }
          }
          d[idx].subSecs[didx] = NaN;
          d[idx].subLevs[didx] = NaN;
        }
      }
    }
    return {
      data: d,
      error,
      N0,
      N_times,
    };
  }
};

// this method queries the database for timeseries plots
const queryDBTimeSeriesMT = function (
  pool,
  rows,
  dataSource,
  forecastOffset,
  startDate,
  endDate,
  averageStr,
  statisticStr,
  validTimes,
  appParams,
  forceRegularCadence
) {
  if (Meteor.isServer) {
    // upper air is only verified at 00Z and 12Z, so you need to force irregular models to verify at that regular cadence
    let cycles = getModelCadence(pool, dataSource, startDate, endDate); // if irregular model cadence, get cycle times. If regular, get empty array.
    if (validTimes.length > 0 && validTimes !== matsTypes.InputTypes.unused) {
      if (typeof validTimes === "string" || validTimes instanceof String) {
        validTimes = validTimes.split(",");
      }
      let vtCycles = validTimes.map(function (x) {
        return (Number(x) - forecastOffset) * 3600 * 1000;
      }); // selecting validTimes makes the cadence irregular
      vtCycles = vtCycles.map(function (x) {
        return x < 0 ? x + 24 * 3600 * 1000 : x;
      }); // make sure no cycles are negative
      vtCycles = vtCycles.sort(function (a, b) {
        return Number(a) - Number(b);
      }); // sort 'em
      cycles = cycles.length > 0 ? _.intersection(cycles, vtCycles) : vtCycles; // if we already had cycles get the ones that correspond to valid times
    }
    const regular =
      forceRegularCadence ||
      averageStr !== "None" ||
      !(cycles !== null && cycles.length > 0); // If curves have averaging, the cadence is always regular, i.e. it's the cadence of the average

    var d = {
      // d will contain the curve data
      x: [],
      y: [],
      error_x: [],
      error_y: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subSquareDiffSum: [],
      subNSum: [],
      subObsModelDiffSum: [],
      subModelSum: [],
      subObsSum: [],
      subAbsSum: [],
      subData: [],
      subHeaders: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      glob_stats: {},
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    var error = "";
    var N0 = [];
    var N_times = [];
    let parsedData;

    if (rows === undefined || rows === null || rows.length === 0) {
      error = matsTypes.Messages.NO_DATA_FOUND;
    } else {
      parsedData = parseQueryDataXYCurve(
        rows,
        d,
        appParams,
        statisticStr,
        forecastOffset,
        cycles,
        regular
      );
      d = parsedData.d;
      N0 = parsedData.N0;
      N_times = parsedData.N_times;
    }
  }

  return {
    data: d,
    error,
    N0,
    N_times,
  };
};

// this method queries the database for timeseries plots
const queryDBTimeSeries = function (
  pool,
  statement,
  dataSource,
  forecastOffset,
  startDate,
  endDate,
  averageStr,
  statisticStr,
  validTimes,
  appParams,
  forceRegularCadence
) {
  if (Meteor.isServer) {
    // upper air is only verified at 00Z and 12Z, so you need to force irregular models to verify at that regular cadence
    let cycles = getModelCadence(pool, dataSource, startDate, endDate); // if irregular model cadence, get cycle times. If regular, get empty array.
    if (validTimes.length > 0 && validTimes !== matsTypes.InputTypes.unused) {
      if (typeof validTimes === "string" || validTimes instanceof String) {
        validTimes = validTimes.split(",");
      }
      let vtCycles = validTimes.map(function (x) {
        return (Number(x) - forecastOffset) * 3600 * 1000;
      }); // selecting validTimes makes the cadence irregular
      vtCycles = vtCycles.map(function (x) {
        return x < 0 ? x + 24 * 3600 * 1000 : x;
      }); // make sure no cycles are negative
      vtCycles = vtCycles.sort(function (a, b) {
        return Number(a) - Number(b);
      }); // sort 'em
      cycles = cycles.length > 0 ? _.intersection(cycles, vtCycles) : vtCycles; // if we already had cycles get the ones that correspond to valid times
    }
    const regular =
      forceRegularCadence ||
      averageStr !== "None" ||
      !(cycles !== null && cycles.length > 0); // If curves have averaging, the cadence is always regular, i.e. it's the cadence of the average

    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      error_x: [],
      error_y: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subSquareDiffSum: [],
      subNSum: [],
      subObsModelDiffSum: [],
      subModelSum: [],
      subObsSum: [],
      subAbsSum: [],
      subData: [],
      subHeaders: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      glob_stats: {},
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let N0 = [];
    let N_times = [];
    let parsedData;
    const Future = require("fibers/future");
    const dFuture = new Future();

    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBTimeSeries' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          parsedData = parseQueryDataXYCurve(
            rows,
            d,
            appParams,
            statisticStr,
            forecastOffset,
            cycles,
            regular
          );
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        dFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          parsedData = parseQueryDataXYCurve(
            rows,
            d,
            appParams,
            statisticStr,
            forecastOffset,
            cycles,
            regular
          );
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        // done waiting - have results
        dFuture.return();
      });
    }
    // wait for the future to finish - sort of like 'back to the future' ;)
    dFuture.wait();

    return {
      data: d,
      error,
      N0,
      N_times,
    };
  }
};

// this method queries the database for specialty curves such as profiles, dieoffs, threshold plots, valid time plots, grid scale plots, and histograms
const queryDBSpecialtyCurve = function (pool, statement, appParams, statisticStr) {
  if (Meteor.isServer) {
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      error_x: [],
      error_y: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subSquareDiffSum: [],
      subNSum: [],
      subObsModelDiffSum: [],
      subModelSum: [],
      subObsSum: [],
      subAbsSum: [],
      subData: [],
      subHeaders: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      glob_stats: {},
      bin_stats: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let N0 = [];
    let N_times = [];
    let parsedData;
    const Future = require("fibers/future");
    const dFuture = new Future();

    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSpecialtyCurve' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          if (appParams.plotType !== matsTypes.PlotTypes.histogram) {
            parsedData = parseQueryDataXYCurve(
              rows,
              d,
              appParams,
              statisticStr,
              null,
              null,
              null
            );
          } else {
            parsedData = parseQueryDataHistogram(rows, d, appParams, statisticStr);
          }
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        dFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          if (appParams.plotType !== matsTypes.PlotTypes.histogram) {
            parsedData = parseQueryDataXYCurve(
              rows,
              d,
              appParams,
              statisticStr,
              null,
              null,
              null
            );
          } else {
            parsedData = parseQueryDataHistogram(rows, d, appParams, statisticStr);
          }
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        // done waiting - have results
        dFuture.return();
      });
    }
    // wait for the future to finish - sort of like 'back to the future' ;)
    dFuture.wait();

    return {
      data: d,
      error,
      N0,
      N_times,
    };
  }
};

// this method queries the database for performance diagrams
const queryDBPerformanceDiagram = function (pool, statement, appParams) {
  if (Meteor.isServer) {
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      binVals: [],
      oy_all: [],
      on_all: [],
      n: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subData: [],
      subHeaders: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
    };
    let error = "";
    let N0 = [];
    let N_times = [];
    let parsedData;
    const Future = require("fibers/future");
    const dFuture = new Future();

    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSPerformanceDiagram' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          parsedData = parseQueryDataPerformanceDiagram(rows, d, appParams);
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        dFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          parsedData = parseQueryDataPerformanceDiagram(rows, d, appParams);
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        // done waiting - have results
        dFuture.return();
      });
    }
    // wait for the future to finish - sort of like 'back to the future' ;)
    dFuture.wait();

    return {
      data: d,
      error,
      N0,
      N_times,
    };
  }
};

// this method queries the database for performance diagrams
const queryDBSimpleScatter = function (
  pool,
  statement,
  appParams,
  statisticXStr,
  statisticYStr
) {
  if (Meteor.isServer) {
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      binVals: [],
      subSquareDiffSumX: [],
      subNSumX: [],
      subObsModelDiffSumX: [],
      subModelSumX: [],
      subObsSumX: [],
      subAbsSumX: [],
      subSquareDiffSumY: [],
      subNSumY: [],
      subObsModelDiffSumY: [],
      subModelSumY: [],
      subObsSumY: [],
      subAbsSumY: [],
      subValsX: [],
      subValsY: [],
      subSecsX: [],
      subSecsY: [],
      subSecs: [],
      subLevsX: [],
      subLevsY: [],
      subLevs: [],
      stats: [],
      text: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let N0 = [];
    let N_times = [];
    let parsedData;
    const Future = require("fibers/future");
    const dFuture = new Future();

    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSPerformanceDiagram' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          parsedData = parseQueryDataSimpleScatter(
            rows,
            d,
            appParams,
            statisticXStr,
            statisticYStr
          );
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        dFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          parsedData = parseQueryDataSimpleScatter(
            rows,
            d,
            appParams,
            statisticXStr,
            statisticYStr
          );
          d = parsedData.d;
          N0 = parsedData.N0;
          N_times = parsedData.N_times;
        }
        // done waiting - have results
        dFuture.return();
      });
    }
    // wait for the future to finish - sort of like 'back to the future' ;)
    dFuture.wait();

    return {
      data: d,
      error,
      N0,
      N_times,
    };
  }
};

// this method queries the database for map plots
const queryDBMapScalar = function (
  pool,
  statement,
  dataSource,
  statistic,
  variable,
  varUnits,
  siteMap,
  appParams
) {
  if (Meteor.isServer) {
    // d will contain the curve data
    let d = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      color: [],
      stats: [],
      text: [],
    };
    let dLowest = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "",
    };
    let dLow = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "",
    };
    let dModerate = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "",
    };
    let dHigh = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "",
    };
    let dHighest = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "",
    };
    let valueLimits = {};

    let error = "";
    const Future = require("fibers/future");
    const pFuture = new Future();
    pool.query(statement, function (err, rows) {
      // query callback - build the curve data from the results - or set an error
      if (err !== undefined && err !== null) {
        error = err.message;
      } else if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else {
        let parsedData;
        parsedData = parseQueryDataMapScalar(
          rows,
          d,
          dLowest,
          dLow,
          dModerate,
          dHigh,
          dHighest,
          dataSource,
          siteMap,
          statistic,
          variable,
          varUnits,
          appParams
        );
        d = parsedData.d;
        dLowest = parsedData.dLowest;
        dLow = parsedData.dLow;
        dModerate = parsedData.dModerate;
        dHigh = parsedData.dHigh;
        dHighest = parsedData.dHighest;
        valueLimits = parsedData.valueLimits;
      }
      // done waiting - have results
      pFuture.return();
    });

    // wait for future to finish
    pFuture.wait();
    return {
      data: d,
      dataLowest: dLowest,
      dataLow: dLow,
      dataModerate: dModerate,
      dataHigh: dHigh,
      dataHighest: dHighest,
      valueLimits,
      error,
    };
  }
};

// this method queries the database for map plots in CTC apps
const queryDBMapCTC = function (
  pool,
  statement,
  dataSource,
  statistic,
  siteMap,
  appParams
) {
  if (Meteor.isServer) {
    // d will contain the curve data
    let d = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      color: [],
      stats: [],
      text: [],
    };
    // for skill scores <= 10%
    let dPurple = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(128,0,255)",
    };
    // for skill scores <= 20%
    let dPurpleBlue = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(64,0,255)",
    };
    // for skill scores <= 30%
    let dBlue = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(0,0,255)",
    };
    // for skill scores <= 40%
    let dBlueGreen = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(64,128,128)",
    };
    // for skill scores <= 50%
    let dGreen = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(128,255,0)",
    };
    // for skill scores <= 60%
    let dGreenYellow = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(160,224,0)",
    };
    // for skill scores <= 70%
    let dYellow = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(192,192,0)",
    };
    // for skill scores <= 80%
    let dOrange = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(255,128,0)",
    };
    // for skill scores <= 90%
    let dOrangeRed = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(255,64,0)",
    };
    // for skill scores <= 100%
    let dRed = {
      siteName: [],
      queryVal: [],
      lat: [],
      lon: [],
      stats: [],
      text: [],
      color: "rgb(255,0,0)",
    };
    let valueLimits = {};

    let error = "";
    let parsedData;
    const Future = require("fibers/future");
    const pFuture = new Future();
    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBMapCTC' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          parsedData = parseQueryDataMapCTC(
            rows,
            d,
            dPurple,
            dPurpleBlue,
            dBlue,
            dBlueGreen,
            dGreen,
            dGreenYellow,
            dYellow,
            dOrange,
            dOrangeRed,
            dRed,
            dataSource,
            siteMap,
            statistic,
            appParams
          );
          d = parsedData.d;
          dPurple = parsedData.dPurple;
          dPurpleBlue = parsedData.dPurpleBlue;
          dBlue = parsedData.dBlue;
          dBlueGreen = parsedData.dBlueGreen;
          dGreen = parsedData.dGreen;
          dGreenYellow = parsedData.dGreenYellow;
          dYellow = parsedData.dYellow;
          dOrange = parsedData.dOrange;
          dOrangeRed = parsedData.dOrangeRed;
          dRed = parsedData.dRed;
          valueLimits = parsedData.valueLimits;
        }
        pFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          parsedData = parseQueryDataMapCTC(
            rows,
            d,
            dPurple,
            dPurpleBlue,
            dBlue,
            dBlueGreen,
            dGreen,
            dGreenYellow,
            dYellow,
            dOrange,
            dOrangeRed,
            dRed,
            dataSource,
            siteMap,
            statistic,
            appParams
          );
          d = parsedData.d;
          dPurple = parsedData.dPurple;
          dPurpleBlue = parsedData.dPurpleBlue;
          dBlue = parsedData.dBlue;
          dBlueGreen = parsedData.dBlueGreen;
          dGreen = parsedData.dGreen;
          dGreenYellow = parsedData.dGreenYellow;
          dYellow = parsedData.dYellow;
          dOrange = parsedData.dOrange;
          dOrangeRed = parsedData.dOrangeRed;
          dRed = parsedData.dRed;
          valueLimits = parsedData.valueLimits;
        }
        // done waiting - have results
        pFuture.return();
      });
    }

    // wait for future to finish
    pFuture.wait();
    return {
      data: d,
      dataPurple: dPurple,
      dataPurpleBlue: dPurpleBlue,
      dataBlue: dBlue,
      dataBlueGreen: dBlueGreen,
      dataGreen: dGreen,
      dataGreenYellow: dGreenYellow,
      dataYellow: dYellow,
      dataOrange: dOrange,
      dataOrangeRed: dOrangeRed,
      dataRed: dRed,
      valueLimits,
      error,
    };
  }
};

// this method queries the database for contour plots
const queryDBContour = function (pool, statement, appParams, statisticStr) {
  if (Meteor.isServer) {
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      z: [],
      n: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subSquareDiffSum: [],
      subNSum: [],
      subObsModelDiffSum: [],
      subModelSum: [],
      subObsSum: [],
      subAbsSum: [],
      subData: [],
      subHeaders: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      text: [],
      xTextOutput: [],
      yTextOutput: [],
      zTextOutput: [],
      nTextOutput: [],
      hitTextOutput: [],
      faTextOutput: [],
      missTextOutput: [],
      cnTextOutput: [],
      squareDiffSumTextOutput: [],
      NSumTextOutput: [],
      obsModelDiffSumTextOutput: [],
      modelSumTextOutput: [],
      obsSumTextOutput: [],
      absSumTextOutput: [],
      minDateTextOutput: [],
      maxDateTextOutput: [],
      stdev: [],
      stats: [],
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      glob_stats: {},
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      zmin: Number.MAX_VALUE,
      zmax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let parsedData;
    const Future = require("fibers/future");
    const dFuture = new Future();

    if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBContour' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      (async () => {
        const rows = await pool.queryCB(statement);
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
          parsedData = parseQueryDataContour(rows, d, appParams, statisticStr);
          d = parsedData.d;
        }
        dFuture.return();
      })();
    } else {
      // if this app isn't couchbase, use mysql
      pool.query(statement, function (err, rows) {
        // query callback - build the curve data from the results - or set an error
        if (err !== undefined && err !== null) {
          error = err.message;
        } else if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else {
          parsedData = parseQueryDataContour(rows, d, appParams, statisticStr);
          d = parsedData.d;
        }
        // done waiting - have results
        dFuture.return();
      });
    }
    // wait for the future to finish - sort of like 'back to the future' ;)
    dFuture.wait();

    return {
      data: d,
      error,
    };
  }
};

// this method parses the returned query data for xy curves
const parseQueryDataXYCurve = function (
  rows,
  d,
  appParams,
  statisticStr,
  forecastOffset,
  cycles,
  regular
) {
  /*
        var d = {   // d will contain the curve data
            x: [],
            y: [],
            error_x: [],
            error_y: [],
            subHit: [],
            subFa: [],
            subMiss: [],
            subCn: [],
            subSquareDiffSum: [],
            subNSum: [],
            subObsModelDiffSum: [],
            subModelSum: [],
            subObsSum: [],
            subAbsSum: [],
            subData: [],
            subHeaders: [],
            subVals: [],
            subSecs: [],
            subLevs: [],
            stats: [],
            text: [],
            glob_stats: {},
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            sum: 0
        };
    */
  const { plotType } = appParams;
  const { hasLevels } = appParams;
  const completenessQCParam = Number(appParams.completeness) / 100;
  const outlierQCParam =
    appParams.outliers !== "all" ? Number(appParams.outliers) : appParams.outliers;

  let isCTC = false;
  let isScalar = false;
  const { hideGaps } = appParams;

  // initialize local variables
  const N0 = [];
  const N_times = [];
  const curveIndependentVars = [];
  const curveStats = [];
  const subHit = [];
  const subFa = [];
  const subMiss = [];
  const subCn = [];
  const subSquareDiffSum = [];
  const subNSum = [];
  const subObsModelDiffSum = [];
  const subModelSum = [];
  const subObsSum = [];
  const subAbsSum = [];
  const subVals = [];
  const subSecs = [];
  const subLevs = [];
  let time_interval;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var independentVar;
    switch (plotType) {
      case matsTypes.PlotTypes.validtime:
        independentVar = Number(rows[rowIndex].hr_of_day);
        break;
      case matsTypes.PlotTypes.gridscale:
        independentVar = Number(rows[rowIndex].gridscale);
        break;
      case matsTypes.PlotTypes.gridscaleProb:
        independentVar = Number(rows[rowIndex].binValue);
        break;
      case matsTypes.PlotTypes.profile:
        independentVar = Number(rows[rowIndex].avVal.toString().replace("P", ""));
        break;
      case matsTypes.PlotTypes.timeSeries:
        // default the time interval to an hour. It won't matter since it won't be used unless there's more than one data point.
        time_interval =
          rows.length > 1 ? Number(rows[1].avtime) - Number(rows[0].avtime) : 3600;
        independentVar = Number(rows[rowIndex].avtime) * 1000;
        break;
      case matsTypes.PlotTypes.dailyModelCycle:
        independentVar = Number(rows[rowIndex].avtime) * 1000;
        break;
      case matsTypes.PlotTypes.dieoff:
        independentVar = Number(rows[rowIndex].fcst_lead);
        break;
      case matsTypes.PlotTypes.threshold:
        independentVar = Number(rows[rowIndex].thresh);
        break;
      default:
        independentVar = Number(rows[rowIndex].avtime);
    }
    var stat;
    if (rows[rowIndex].stat === undefined && rows[rowIndex].hit !== undefined) {
      // this is a contingency table plot
      isCTC = true;
      const hit = Number(rows[rowIndex].hit);
      const fa = Number(rows[rowIndex].fa);
      const miss = Number(rows[rowIndex].miss);
      const cn = Number(rows[rowIndex].cn);
      const n = rows[rowIndex].sub_data.toString().split(",").length;
      if (hit + fa + miss + cn > 0) {
        stat = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, n, statisticStr);
        stat = isNaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else if (
      rows[rowIndex].stat === undefined &&
      rows[rowIndex].square_diff_sum !== undefined
    ) {
      // this is a scalar partial sums plot
      isScalar = true;
      const squareDiffSum = Number(rows[rowIndex].square_diff_sum);
      const NSum = Number(rows[rowIndex].N_sum);
      const obsModelDiffSum = Number(rows[rowIndex].obs_model_diff_sum);
      const modelSum = Number(rows[rowIndex].model_sum);
      const obsSum = Number(rows[rowIndex].obs_sum);
      const absSum = Number(rows[rowIndex].abs_sum);
      if (NSum > 0) {
        stat = matsDataUtils.calculateStatScalar(
          squareDiffSum,
          NSum,
          obsModelDiffSum,
          modelSum,
          obsSum,
          absSum,
          statisticStr
        );
        stat = isNaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else {
      // not a contingency table plot or a scalar partial sums plot
      stat = rows[rowIndex].stat === "NULL" ? null : rows[rowIndex].stat;
    }
    N0.push(rows[rowIndex].N0); // number of values that go into a point on the graph
    N_times.push(rows[rowIndex].N_times); // number of times that go into a point on the graph

    if (plotType === matsTypes.PlotTypes.timeSeries) {
      // Find the minimum time_interval to be sure we don't accidentally go past the next data point.
      if (rowIndex < rows.length - 1) {
        const time_diff =
          Number(rows[rowIndex + 1].avtime) - Number(rows[rowIndex].avtime);
        if (time_diff < time_interval) {
          time_interval = time_diff;
        }
      }
    }

    // store sub values that will later be used for calculating error bar statistics.
    let sub_hit = [];
    let sub_fa = [];
    let sub_miss = [];
    let sub_cn = [];
    let sub_square_diff_sum = [];
    let sub_N_sum = [];
    let sub_obs_model_diff_sum = [];
    let sub_model_sum = [];
    let sub_obs_sum = [];
    let sub_abs_sum = [];
    let sub_values = [];
    let sub_secs = [];
    let sub_levs = [];
    let sub_stdev = 0;
    let sub_mean = 0;
    let sd_limit = 0;
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          if (isCTC) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_hit.push(Number(curr_sub_data[2]));
              sub_fa.push(Number(curr_sub_data[3]));
              sub_miss.push(Number(curr_sub_data[4]));
              sub_cn.push(Number(curr_sub_data[5]));
              sub_values.push(
                matsDataUtils.calculateStatCTC(
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  curr_sub_data.length,
                  statisticStr
                )
              );
            } else {
              sub_hit.push(Number(curr_sub_data[1]));
              sub_fa.push(Number(curr_sub_data[2]));
              sub_miss.push(Number(curr_sub_data[3]));
              sub_cn.push(Number(curr_sub_data[4]));
              sub_values.push(
                matsDataUtils.calculateStatCTC(
                  Number(curr_sub_data[1]),
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  curr_sub_data.length,
                  statisticStr
                )
              );
            }
          } else if (isScalar) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_square_diff_sum.push(Number(curr_sub_data[2]));
              sub_N_sum.push(Number(curr_sub_data[3]));
              sub_obs_model_diff_sum.push(Number(curr_sub_data[4]));
              sub_model_sum.push(Number(curr_sub_data[5]));
              sub_obs_sum.push(Number(curr_sub_data[6]));
              sub_abs_sum.push(Number(curr_sub_data[7]));
              sub_values.push(
                matsDataUtils.calculateStatScalar(
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  Number(curr_sub_data[6]),
                  Number(curr_sub_data[7]),
                  statisticStr
                )
              );
            } else {
              sub_square_diff_sum.push(Number(curr_sub_data[1]));
              sub_N_sum.push(Number(curr_sub_data[2]));
              sub_obs_model_diff_sum.push(Number(curr_sub_data[3]));
              sub_model_sum.push(Number(curr_sub_data[4]));
              sub_obs_sum.push(Number(curr_sub_data[5]));
              sub_abs_sum.push(Number(curr_sub_data[6]));
              sub_values.push(
                matsDataUtils.calculateStatScalar(
                  Number(curr_sub_data[1]),
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  Number(curr_sub_data[6]),
                  statisticStr
                )
              );
            }
          } else {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_values.push(Number(curr_sub_data[2]));
            } else {
              sub_values.push(Number(curr_sub_data[1]));
            }
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          sub_stdev = matsDataUtils.stdev(sub_values);
          sub_mean = matsDataUtils.average(sub_values);
          sd_limit = outlierQCParam * sub_stdev;
          for (let svIdx = sub_values.length - 1; svIdx >= 0; svIdx--) {
            if (Math.abs(sub_values[svIdx] - sub_mean) > sd_limit) {
              if (isCTC) {
                sub_hit.splice(svIdx, 1);
                sub_fa.splice(svIdx, 1);
                sub_miss.splice(svIdx, 1);
                sub_cn.splice(svIdx, 1);
              } else if (isScalar) {
                sub_square_diff_sum.splice(svIdx, 1);
                sub_N_sum.splice(svIdx, 1);
                sub_obs_model_diff_sum.splice(svIdx, 1);
                sub_model_sum.splice(svIdx, 1);
                sub_obs_sum.splice(svIdx, 1);
                sub_abs_sum.splice(svIdx, 1);
              }
              sub_values.splice(svIdx, 1);
              sub_secs.splice(svIdx, 1);
              if (hasLevels) {
                sub_levs.splice(svIdx, 1);
              }
            }
          }
        }
        if (isCTC) {
          const hit = matsDataUtils.sum(sub_hit);
          const fa = matsDataUtils.sum(sub_fa);
          const miss = matsDataUtils.sum(sub_miss);
          const cn = matsDataUtils.sum(sub_cn);
          stat = matsDataUtils.calculateStatCTC(
            hit,
            fa,
            miss,
            cn,
            sub_hit.length,
            statisticStr
          );
        } else if (isScalar) {
          const squareDiffSum = matsDataUtils.sum(sub_square_diff_sum);
          const NSum = matsDataUtils.sum(sub_N_sum);
          const obsModelDiffSum = matsDataUtils.sum(sub_obs_model_diff_sum);
          const modelSum = matsDataUtils.sum(sub_model_sum);
          const obsSum = matsDataUtils.sum(sub_obs_sum);
          const absSum = matsDataUtils.sum(sub_abs_sum);
          stat = matsDataUtils.calculateStatScalar(
            squareDiffSum,
            NSum,
            obsModelDiffSum,
            modelSum,
            obsSum,
            absSum,
            statisticStr
          );
        } else if (statisticStr.toLowerCase().includes("count")) {
          stat = matsDataUtils.sum(sub_values);
        } else {
          stat = matsDataUtils.average(sub_values);
        }
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataXYCurve. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      if (isCTC) {
        sub_hit = NaN;
        sub_fa = NaN;
        sub_miss = NaN;
        sub_cn = NaN;
      } else if (isScalar) {
        sub_square_diff_sum = NaN;
        sub_N_sum = NaN;
        sub_obs_model_diff_sum = NaN;
        sub_model_sum = NaN;
        sub_obs_sum = NaN;
        sub_abs_sum = NaN;
        sub_values = NaN;
      }
      sub_values = NaN;
      sub_secs = NaN;
      if (hasLevels) {
        sub_levs = NaN;
      }
    }

    // deal with missing forecast cycles for dailyModelCycle plot type
    if (
      plotType === matsTypes.PlotTypes.dailyModelCycle &&
      rowIndex > 0 &&
      Number(independentVar) - Number(rows[rowIndex - 1].avtime * 1000) >
        3600 * 24 * 1000 &&
      !hideGaps
    ) {
      const cycles_missing =
        Math.ceil(
          (Number(independentVar) - Number(rows[rowIndex - 1].avtime * 1000)) /
            (3600 * 24 * 1000)
        ) - 1;
      const offsetFromMidnight = Math.floor(
        (Number(independentVar) % (24 * 3600 * 1000)) / (3600 * 1000)
      );
      for (var missingIdx = cycles_missing; missingIdx > 0; missingIdx--) {
        curveIndependentVars.push(
          independentVar -
            3600 * 24 * 1000 * missingIdx -
            3600 * offsetFromMidnight * 1000
        );
        curveStats.push(null);
        if (isCTC) {
          subHit.push(NaN);
          subFa.push(NaN);
          subMiss.push(NaN);
          subCn.push(NaN);
          subSquareDiffSum.push([]);
          subNSum.push([]);
          subObsModelDiffSum.push([]);
          subModelSum.push([]);
          subObsSum.push([]);
          subAbsSum.push([]);
        } else if (isScalar) {
          subHit.push([]);
          subFa.push([]);
          subMiss.push([]);
          subCn.push([]);
          subSquareDiffSum.push(NaN);
          subNSum.push(NaN);
          subObsModelDiffSum.push(NaN);
          subModelSum.push(NaN);
          subObsSum.push(NaN);
          subAbsSum.push(NaN);
        } else {
          subHit.push([]);
          subFa.push([]);
          subMiss.push([]);
          subCn.push([]);
          subSquareDiffSum.push([]);
          subNSum.push([]);
          subObsModelDiffSum.push([]);
          subModelSum.push([]);
          subObsSum.push([]);
          subAbsSum.push([]);
        }
        subVals.push(NaN);
        subSecs.push(NaN);
        if (hasLevels) {
          subLevs.push(NaN);
        }
      }
    }
    curveIndependentVars.push(independentVar);
    curveStats.push(stat);
    subHit.push(sub_hit);
    subFa.push(sub_fa);
    subMiss.push(sub_miss);
    subCn.push(sub_cn);
    subSquareDiffSum.push(sub_square_diff_sum);
    subNSum.push(sub_N_sum);
    subObsModelDiffSum.push(sub_obs_model_diff_sum);
    subModelSum.push(sub_model_sum);
    subObsSum.push(sub_obs_sum);
    subAbsSum.push(sub_abs_sum);
    subVals.push(sub_values);
    subSecs.push(sub_secs);
    if (hasLevels) {
      subLevs.push(sub_levs);
    }
  }

  const N0_max = Math.max(...N0);
  const N_times_max = Math.max(...N_times);
  let sum = 0;
  let indVarMin = Number.MAX_VALUE;
  let indVarMax = -1 * Number.MAX_VALUE;
  let depVarMin = Number.MAX_VALUE;
  let depVarMax = -1 * Number.MAX_VALUE;
  let d_idx;

  for (d_idx = 0; d_idx < curveIndependentVars.length; d_idx++) {
    const this_N0 = N0[d_idx];
    const this_N_times = N_times[d_idx];
    // Make sure that we don't have any points with a smaller completeness value than specified by the user.
    if (
      curveStats[d_idx] === null ||
      this_N_times < completenessQCParam * N_times_max
    ) {
      if (!hideGaps) {
        if (plotType === matsTypes.PlotTypes.profile) {
          // profile has the stat first, and then the independent var. The others have independent var and then stat.
          // this is in the pattern of x-plotted-variable, y-plotted-variable.
          d.x.push(null);
          d.y.push(curveIndependentVars[d_idx]);
          d.error_x.push(null); // placeholder
        } else {
          d.x.push(curveIndependentVars[d_idx]);
          d.y.push(null);
          d.error_y.push(null); // placeholder
        }
        d.subHit.push(NaN);
        d.subFa.push(NaN);
        d.subMiss.push(NaN);
        d.subCn.push(NaN);
        d.subSquareDiffSum.push(NaN);
        d.subNSum.push(NaN);
        d.subObsModelDiffSum.push(NaN);
        d.subModelSum.push(NaN);
        d.subObsSum.push(NaN);
        d.subAbsSum.push(NaN);
        d.subVals.push(NaN);
        d.subSecs.push(NaN);
        if (hasLevels) {
          d.subLevs.push(NaN);
        }
      }
    } else {
      // there's valid data at this point, so store it
      sum += curveStats[d_idx];
      if (plotType === matsTypes.PlotTypes.profile) {
        // profile has the stat first, and then the independent var. The others have independent var and then stat.
        // this is in the pattern of x-plotted-variable, y-plotted-variable.
        d.x.push(curveStats[d_idx]);
        d.y.push(curveIndependentVars[d_idx]);
        d.error_x.push(null); // placeholder
      } else {
        d.x.push(curveIndependentVars[d_idx]);
        d.y.push(curveStats[d_idx]);
        d.error_y.push(null); // placeholder
      }
      d.subHit.push(subHit[d_idx]);
      d.subFa.push(subFa[d_idx]);
      d.subMiss.push(subMiss[d_idx]);
      d.subCn.push(subCn[d_idx]);
      d.subSquareDiffSum.push(subSquareDiffSum[d_idx]);
      d.subNSum.push(subNSum[d_idx]);
      d.subObsModelDiffSum.push(subObsModelDiffSum[d_idx]);
      d.subModelSum.push(subModelSum[d_idx]);
      d.subObsSum.push(subObsSum[d_idx]);
      d.subAbsSum.push(subAbsSum[d_idx]);
      d.subVals.push(subVals[d_idx]);
      d.subSecs.push(subSecs[d_idx]);
      if (hasLevels) {
        d.subLevs.push(subLevs[d_idx]);
      }
      indVarMin =
        curveIndependentVars[d_idx] < indVarMin
          ? curveIndependentVars[d_idx]
          : indVarMin;
      indVarMax =
        curveIndependentVars[d_idx] > indVarMax
          ? curveIndependentVars[d_idx]
          : indVarMax;
      depVarMin = curveStats[d_idx] < depVarMin ? curveStats[d_idx] : depVarMin;
      depVarMax = curveStats[d_idx] > depVarMax ? curveStats[d_idx] : depVarMax;
    }
  }

  // add in any missing times in the time series
  if (plotType === matsTypes.PlotTypes.timeSeries && !hideGaps) {
    time_interval *= 1000;
    const dayInMilliSeconds = 24 * 3600 * 1000;
    let lowerIndependentVar;
    let upperIndependentVar;
    let newTime;
    let thisCadence;
    let numberOfDaysBack;
    for (d_idx = curveIndependentVars.length - 2; d_idx >= 0; d_idx--) {
      lowerIndependentVar = curveIndependentVars[d_idx];
      upperIndependentVar = curveIndependentVars[d_idx + 1];
      const cycles_missing =
        Math.ceil(
          (Number(upperIndependentVar) - Number(lowerIndependentVar)) / time_interval
        ) - 1;
      for (missingIdx = cycles_missing; missingIdx > 0; missingIdx--) {
        newTime = lowerIndependentVar + missingIdx * time_interval;
        if (!regular) {
          // if it's not a regular model, we only want to add a null point if this is an init time that should have had a forecast.
          thisCadence = newTime % dayInMilliSeconds; // current hour of day (valid time)
          if (Number(thisCadence) - Number(forecastOffset) * 3600 * 1000 < 0) {
            // check to see if cycle time was on a previous day -- if so, need to wrap around 00Z to get current hour of day (cycle time)
            numberOfDaysBack = Math.ceil(
              (-1 * (Number(thisCadence) - Number(forecastOffset) * 3600 * 1000)) /
                dayInMilliSeconds
            );
            thisCadence =
              Number(thisCadence) -
              Number(forecastOffset) * 3600 * 1000 +
              numberOfDaysBack * dayInMilliSeconds; // current hour of day (cycle time)
          } else {
            thisCadence = Number(thisCadence) - Number(forecastOffset) * 3600 * 1000; // current hour of day (cycle time)
          }
          if (cycles.indexOf(thisCadence) !== -1) {
            matsDataUtils.addNullPoint(
              d,
              d_idx + 1,
              matsTypes.PlotTypes.timeSeries,
              "x",
              newTime,
              "y",
              isCTC,
              isScalar,
              hasLevels
            );
          }
        } else {
          matsDataUtils.addNullPoint(
            d,
            d_idx + 1,
            matsTypes.PlotTypes.timeSeries,
            "x",
            newTime,
            "y",
            isCTC,
            isScalar,
            hasLevels
          );
        }
      }
    }
  }

  if (plotType === matsTypes.PlotTypes.profile) {
    d.xmin = depVarMin;
    d.xmax = depVarMax;
    d.ymin = indVarMin;
    d.ymax = indVarMax;
  } else {
    d.xmin = indVarMin;
    d.xmax = indVarMax;
    d.ymin = depVarMin;
    d.ymax = depVarMax;
  }

  d.sum = sum;

  return {
    d,
    N0,
    N_times,
  };
};

// this method parses the returned query data for performance diagrams
const parseQueryDataPerformanceDiagram = function (rows, d, appParams) {
  /*
        var d = {   // d will contain the curve data
            x: [],
            y: [],
            binVals: [],
            oy_all: [],
            on_all: [],
            n: [],
            subHit: [],
            subFa: [],
            subMiss: [],
            subCn: [],
            subData: [],
            subHeaders: [],
            subVals: [],
            subSecs: [],
            subLevs: [],
            stats: [],
            text: [],
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
        };
    */

  const { hasLevels } = appParams;

  // initialize local variables
  const N0 = [];
  const N_times = [];
  const successes = [];
  const pods = [];
  const binVals = [];
  const oy_all = [];
  const on_all = [];
  const subHit = [];
  const subFa = [];
  const subMiss = [];
  const subCn = [];
  const subVals = [];
  const subSecs = [];
  const subLevs = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const binVal = Number(rows[rowIndex].binVal);
    var pod;
    var success;
    var oy;
    var on;
    if (rows[rowIndex].pod !== undefined && rows[rowIndex].far !== undefined) {
      pod = rows[rowIndex].pod === "NULL" ? null : Number(rows[rowIndex].pod);
      success = rows[rowIndex].far === "NULL" ? null : 1 - Number(rows[rowIndex].far);
      oy = rows[rowIndex].oy === "NULL" ? null : Number(rows[rowIndex].oy_all);
      on = rows[rowIndex].on === "NULL" ? null : Number(rows[rowIndex].on_all);
    } else {
      pod = null;
      success = null;
      oy = null;
      on = null;
    }
    N0.push(rows[rowIndex].N0); // number of values that go into a point on the graph
    N_times.push(rows[rowIndex].N_times); // number of times that go into a point on the graph
    successes.push(success);
    pods.push(pod);
    binVals.push(binVal);
    oy_all.push(oy);
    on_all.push(on);

    let sub_hit = [];
    let sub_fa = [];
    let sub_miss = [];
    let sub_cn = [];
    const sub_values = [];
    let sub_secs = [];
    let sub_levs = [];
    if (
      pod !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          sub_secs.push(Number(curr_sub_data[0]));
          if (hasLevels) {
            if (!isNaN(Number(curr_sub_data[1]))) {
              sub_levs.push(Number(curr_sub_data[1]));
            } else {
              sub_levs.push(curr_sub_data[1]);
            }
            sub_hit.push(Number(curr_sub_data[2]));
            sub_fa.push(Number(curr_sub_data[3]));
            sub_miss.push(Number(curr_sub_data[4]));
            sub_cn.push(Number(curr_sub_data[5]));
            // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
            sub_values.push(0);
          } else {
            sub_hit.push(Number(curr_sub_data[1]));
            sub_fa.push(Number(curr_sub_data[2]));
            sub_miss.push(Number(curr_sub_data[3]));
            sub_cn.push(Number(curr_sub_data[4]));
            // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
            sub_values.push(0);
          }
        }
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataPerformanceDiagram. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      sub_hit = NaN;
      sub_fa = NaN;
      sub_miss = NaN;
      sub_cn = NaN;
      sub_secs = NaN;
      if (hasLevels) {
        sub_levs = NaN;
      }
    }
    subHit.push(sub_hit);
    subFa.push(sub_fa);
    subMiss.push(sub_miss);
    subCn.push(sub_cn);
    subVals.push(sub_values);
    subSecs.push(sub_secs);
    if (hasLevels) {
      subLevs.push(sub_levs);
    }
  }

  d.x = successes;
  d.y = pods;
  d.binVals = binVals;
  d.oy_all = oy_all;
  d.on_all = on_all;
  d.subHit = subHit;
  d.subFa = subFa;
  d.subMiss = subMiss;
  d.subCn = subCn;
  d.subVals = subVals;
  d.subSecs = subSecs;
  d.subLevs = subLevs;
  d.n = N0;

  let successMin = Number.MAX_VALUE;
  let successMax = -1 * Number.MAX_VALUE;
  let podMin = Number.MAX_VALUE;
  let podMax = -1 * Number.MAX_VALUE;

  for (let d_idx = 0; d_idx < binVals.length; d_idx++) {
    successMin =
      successes[d_idx] !== null && successes[d_idx] < successMin
        ? successes[d_idx]
        : successMin;
    successMax =
      successes[d_idx] !== null && successes[d_idx] > successMax
        ? successes[d_idx]
        : successMax;
    podMin = podMin[d_idx] !== null && pods[d_idx] < podMin ? pods[d_idx] : podMin;
    podMax = podMin[d_idx] !== null && pods[d_idx] > podMax ? pods[d_idx] : podMax;
  }

  d.xmin = successMin;
  d.xmax = successMax;
  d.ymin = podMin;
  d.ymax = podMax;

  return {
    d,
    N0,
    N_times,
  };
};

// this method parses the returned query data for simple scatter plots
const parseQueryDataSimpleScatter = function (
  rows,
  d,
  appParams,
  statisticXStr,
  statisticYStr
) {
  /*
        var d = {   // d will contain the curve data
            x: [],
            y: [],
            binVals: [],
            subSquareDiffSumX: [],
            subNSumX: [],
            subObsModelDiffSumX: [],
            subModelSumX: [],
            subObsSumX: [],
            subAbsSumX: [],
            subValsX: [],
            subSquareDiffSumY: [],
            subNSumY: [],
            subObsModelDiffSumY: [],
            subModelSumY: [],
            subObsSumY: [],
            subAbsSumY: [],
            subValsY: [],
            subSecs: [],
            subLevs: [],
            stats: [],
            text: [],
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            sum: 0
        };
    */

  const { hasLevels } = appParams;

  // initialize local variables
  const N0 = [];
  const N_times = [];
  const xStats = [];
  const yStats = [];
  const binVals = [];
  const subSquareDiffSumX = [];
  const subNSumX = [];
  const subObsModelDiffSumX = [];
  const subModelSumX = [];
  const subObsSumX = [];
  const subAbsSumX = [];
  const subSquareDiffSumY = [];
  const subNSumY = [];
  const subObsModelDiffSumY = [];
  const subModelSumY = [];
  const subObsSumY = [];
  const subAbsSumY = [];
  const subValsX = [];
  const subValsY = [];
  const subSecs = [];
  const subLevs = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const binVal = Number(rows[rowIndex].binVal);
    var xStat;
    var yStat;
    if (
      rows[rowIndex].square_diff_sumX !== undefined &&
      rows[rowIndex].square_diff_sumY !== undefined
    ) {
      // this is a scalar partial sums plot
      const squareDiffSumX = Number(rows[rowIndex].square_diff_sumX);
      const NSumX = Number(rows[rowIndex].N_sumX);
      const obsModelDiffSumX = Number(rows[rowIndex].obs_model_diff_sumX);
      const modelSumX = Number(rows[rowIndex].model_sumX);
      const obsSumX = Number(rows[rowIndex].obs_sumX);
      const absSumX = Number(rows[rowIndex].abs_sumX);
      const squareDiffSumY = Number(rows[rowIndex].square_diff_sumY);
      const NSumY = Number(rows[rowIndex].N_sumY);
      const obsModelDiffSumY = Number(rows[rowIndex].obs_model_diff_sumY);
      const modelSumY = Number(rows[rowIndex].model_sumY);
      const obsSumY = Number(rows[rowIndex].obs_sumY);
      const absSumY = Number(rows[rowIndex].abs_sumY);
      if (NSumX > 0 && NSumY > 0) {
        xStat = matsDataUtils.calculateStatScalar(
          squareDiffSumX,
          NSumX,
          obsModelDiffSumX,
          modelSumX,
          obsSumX,
          absSumX,
          statisticXStr
        );
        xStat = isNaN(Number(xStat)) ? null : xStat;
        yStat = matsDataUtils.calculateStatScalar(
          squareDiffSumY,
          NSumY,
          obsModelDiffSumY,
          modelSumY,
          obsSumY,
          absSumY,
          statisticYStr
        );
        yStat = isNaN(Number(yStat)) ? null : yStat;
      } else {
        xStat = null;
        yStat = null;
      }
    }
    N0.push(rows[rowIndex].N0); // number of values that go into a point on the graph
    N_times.push(rows[rowIndex].N_times); // number of times that go into a point on the graph
    binVals.push(binVal);

    let sub_square_diff_sumX = [];
    let sub_N_sumX = [];
    let sub_obs_model_diff_sumX = [];
    let sub_model_sumX = [];
    let sub_obs_sumX = [];
    let sub_abs_sumX = [];
    let sub_valuesX = [];
    let sub_square_diff_sumY = [];
    let sub_N_sumY = [];
    let sub_obs_model_diff_sumY = [];
    let sub_model_sumY = [];
    let sub_obs_sumY = [];
    let sub_abs_sumY = [];
    let sub_valuesY = [];
    let sub_secs = [];
    let sub_levs = [];
    if (
      xStat !== null &&
      yStat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          sub_secs.push(Number(curr_sub_data[0]));
          if (hasLevels) {
            if (!isNaN(Number(curr_sub_data[1]))) {
              sub_levs.push(Number(curr_sub_data[1]));
            } else {
              sub_levs.push(curr_sub_data[1]);
            }
            sub_square_diff_sumX.push(Number(curr_sub_data[2]));
            sub_N_sumX.push(Number(curr_sub_data[3]));
            sub_obs_model_diff_sumX.push(Number(curr_sub_data[4]));
            sub_model_sumX.push(Number(curr_sub_data[5]));
            sub_obs_sumX.push(Number(curr_sub_data[6]));
            sub_abs_sumX.push(Number(curr_sub_data[7]));
            sub_valuesX.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                Number(curr_sub_data[5]),
                Number(curr_sub_data[6]),
                Number(curr_sub_data[7]),
                statisticXStr
              )
            );
            sub_square_diff_sumY.push(Number(curr_sub_data[8]));
            sub_N_sumY.push(Number(curr_sub_data[9]));
            sub_obs_model_diff_sumY.push(Number(curr_sub_data[10]));
            sub_model_sumY.push(Number(curr_sub_data[11]));
            sub_obs_sumY.push(Number(curr_sub_data[12]));
            sub_abs_sumY.push(Number(curr_sub_data[13]));
            sub_valuesY.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[8]),
                Number(curr_sub_data[9]),
                Number(curr_sub_data[10]),
                Number(curr_sub_data[11]),
                Number(curr_sub_data[12]),
                Number(curr_sub_data[13]),
                statisticYStr
              )
            );
          } else {
            sub_square_diff_sumX.push(Number(curr_sub_data[1]));
            sub_N_sumX.push(Number(curr_sub_data[2]));
            sub_obs_model_diff_sumX.push(Number(curr_sub_data[3]));
            sub_model_sumX.push(Number(curr_sub_data[4]));
            sub_obs_sumX.push(Number(curr_sub_data[5]));
            sub_abs_sumX.push(Number(curr_sub_data[6]));
            sub_valuesX.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[1]),
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                Number(curr_sub_data[5]),
                Number(curr_sub_data[6]),
                statisticXStr
              )
            );
            sub_square_diff_sumY.push(Number(curr_sub_data[7]));
            sub_N_sumY.push(Number(curr_sub_data[8]));
            sub_obs_model_diff_sumY.push(Number(curr_sub_data[9]));
            sub_model_sumY.push(Number(curr_sub_data[10]));
            sub_obs_sumY.push(Number(curr_sub_data[11]));
            sub_abs_sumY.push(Number(curr_sub_data[12]));
            sub_valuesY.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[7]),
                Number(curr_sub_data[8]),
                Number(curr_sub_data[9]),
                Number(curr_sub_data[10]),
                Number(curr_sub_data[11]),
                Number(curr_sub_data[12]),
                statisticXStr
              )
            );
          }
        }
        const squareDiffSumX = matsDataUtils.sum(sub_square_diff_sumX);
        const NSumX = matsDataUtils.sum(sub_N_sumX);
        const obsModelDiffSumX = matsDataUtils.sum(sub_obs_model_diff_sumX);
        const modelSumX = matsDataUtils.sum(sub_model_sumX);
        const obsSumX = matsDataUtils.sum(sub_obs_sumX);
        const absSumX = matsDataUtils.sum(sub_abs_sumX);
        xStat = matsDataUtils.calculateStatScalar(
          squareDiffSumX,
          NSumX,
          obsModelDiffSumX,
          modelSumX,
          obsSumX,
          absSumX,
          statisticXStr
        );
        const squareDiffSumY = matsDataUtils.sum(sub_square_diff_sumY);
        const NSumY = matsDataUtils.sum(sub_N_sumY);
        const obsModelDiffSumY = matsDataUtils.sum(sub_obs_model_diff_sumY);
        const modelSumY = matsDataUtils.sum(sub_model_sumY);
        const obsSumY = matsDataUtils.sum(sub_obs_sumY);
        const absSumY = matsDataUtils.sum(sub_abs_sumY);
        yStat = matsDataUtils.calculateStatScalar(
          squareDiffSumY,
          NSumY,
          obsModelDiffSumY,
          modelSumY,
          obsSumY,
          absSumY,
          statisticYStr
        );
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataXYCurve. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      sub_square_diff_sumX = NaN;
      sub_N_sumX = NaN;
      sub_obs_model_diff_sumX = NaN;
      sub_model_sumX = NaN;
      sub_obs_sumX = NaN;
      sub_abs_sumX = NaN;
      sub_valuesX = NaN;
      sub_square_diff_sumY = NaN;
      sub_N_sumY = NaN;
      sub_obs_model_diff_sumY = NaN;
      sub_model_sumY = NaN;
      sub_obs_sumY = NaN;
      sub_abs_sumY = NaN;
      sub_valuesY = NaN;
      sub_secs = NaN;
      if (hasLevels) {
        sub_levs = NaN;
      }
    }

    xStats.push(xStat);
    yStats.push(yStat);
    subSquareDiffSumX.push(sub_square_diff_sumX);
    subNSumX.push(sub_N_sumX);
    subObsModelDiffSumX.push(sub_obs_model_diff_sumX);
    subModelSumX.push(sub_model_sumX);
    subObsSumX.push(sub_obs_sumX);
    subAbsSumX.push(sub_abs_sumX);
    subValsX.push(sub_valuesX);
    subSquareDiffSumY.push(sub_square_diff_sumY);
    subNSumY.push(sub_N_sumY);
    subObsModelDiffSumY.push(sub_obs_model_diff_sumY);
    subModelSumY.push(sub_model_sumY);
    subObsSumY.push(sub_obs_sumY);
    subAbsSumY.push(sub_abs_sumY);
    subValsY.push(sub_valuesY);
    subSecs.push(sub_secs);
    if (hasLevels) {
      subLevs.push(sub_levs);
    }
  }

  d.x = xStats;
  d.y = yStats;
  d.binVals = binVals;
  d.subSquareDiffSumX = subSquareDiffSumX;
  d.subNSumX = subNSumX;
  d.subObsModelDiffSumX = subObsModelDiffSumX;
  d.subModelSumX = subModelSumX;
  d.subObsSumX = subObsSumX;
  d.subAbsSumX = subAbsSumX;
  d.subValsX = subValsX;
  d.subSquareDiffSumY = subSquareDiffSumY;
  d.subNSumY = subNSumY;
  d.subObsModelDiffSumY = subObsModelDiffSumY;
  d.subModelSumY = subModelSumY;
  d.subObsSumY = subObsSumY;
  d.subAbsSumY = subAbsSumY;
  d.subValsY = subValsY;
  d.subSecs = subSecs;
  d.subLevs = subLevs;
  d.n = N0;

  let xmin = Number.MAX_VALUE;
  let xmax = -1 * Number.MAX_VALUE;
  let ymin = Number.MAX_VALUE;
  let ymax = -1 * Number.MAX_VALUE;

  for (let d_idx = 0; d_idx < binVals.length; d_idx++) {
    xmin = xStats[d_idx] !== null && xStats[d_idx] < xmin ? xStats[d_idx] : xmin;
    xmax = xStats[d_idx] !== null && xStats[d_idx] > xmax ? xStats[d_idx] : xmax;
    ymin = yStats[d_idx] !== null && yStats[d_idx] < ymin ? yStats[d_idx] : ymin;
    ymax = yStats[d_idx] !== null && yStats[d_idx] > ymax ? yStats[d_idx] : ymax;
  }

  d.xmin = xmin;
  d.xmax = xmax;
  d.ymin = ymin;
  d.ymax = ymax;

  return {
    d,
    N0,
    N_times,
  };
};

// this method parses the returned query data for maps
const parseQueryDataMapScalar = function (
  rows,
  d,
  dLowest,
  dLow,
  dModerate,
  dHigh,
  dHighest,
  dataSource,
  siteMap,
  statistic,
  variable,
  varUnits,
  appParams
) {
  const { hasLevels } = appParams;
  let highLimit = 10;
  let lowLimit = -10;
  const outlierQCParam =
    appParams.outliers !== "all" ? Number(appParams.outliers) : appParams.outliers;

  // determine which colormap will be used for this plot
  let colorLowest = "";
  let colorLow = "";
  let colorModerate = "";
  let colorHigh = "";
  let colorHighest = "";
  if (statistic.includes("Bias")) {
    if (variable.includes("RH") || variable.toLowerCase().includes("dewpoint")) {
      colorLowest = "rgb(140,81,00)";
      colorLow = "rgb(191,129,45)";
      colorModerate = "rgb(125,125,125)";
      colorHigh = "rgb(53,151,143)";
      colorHighest = "rgb(1,102,95)";
    } else if (variable.toLowerCase().includes("temp")) {
      colorLowest = "rgb(24,28,247)";
      colorLow = "rgb(67,147,195)";
      colorModerate = "rgb(125,125,125)";
      colorHigh = "rgb(255,120,86)";
      colorHighest = "rgb(216,21,47)";
    } else {
      colorLowest = "rgb(0,134,0)";
      colorLow = "rgb(80,255,80)";
      colorModerate = "rgb(125,125,125)";
      colorHigh = "rgb(255,80,255)";
      colorHighest = "rgb(134,0,134)";
    }
  } else {
    colorLowest = "rgb(125,125,125)";
    colorLow = "rgb(196,179,139)";
    colorModerate = "rgb(243,164,96)";
    colorHigh = "rgb(210,105,30)";
    colorHighest = "rgb(237,0,0)";
  }
  dLowest.color = colorLowest;
  dLow.color = colorLow;
  dModerate.color = colorModerate;
  dHigh.color = colorHigh;
  dHighest.color = colorHighest;

  let queryVal;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const site = rows[rowIndex].sta_id;
    const squareDiffSum = Number(rows[rowIndex].square_diff_sum);
    const NSum = Number(rows[rowIndex].N_sum);
    const obsModelDiffSum = Number(rows[rowIndex].obs_model_diff_sum);
    const modelSum = Number(rows[rowIndex].model_sum);
    const obsSum = Number(rows[rowIndex].obs_sum);
    const absSum = Number(rows[rowIndex].abs_sum);
    if (NSum > 0) {
      queryVal = matsDataUtils.calculateStatScalar(
        squareDiffSum,
        NSum,
        obsModelDiffSum,
        modelSum,
        obsSum,
        absSum,
        `${statistic}_${variable}`
      );
      queryVal = isNaN(Number(queryVal)) ? null : queryVal;
    } else {
      queryVal = null;
    }
    // store sub values to test them for stdev.
    const sub_square_diff_sum = [];
    const sub_N_sum = [];
    const sub_obs_model_diff_sum = [];
    const sub_model_sum = [];
    const sub_obs_sum = [];
    const sub_abs_sum = [];
    const sub_values = [];
    const sub_secs = [];
    const sub_levs = [];
    let sub_stdev = 0;
    let sub_mean = 0;
    let sd_limit = 0;
    if (
      queryVal !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          sub_secs.push(Number(curr_sub_data[0]));
          if (hasLevels) {
            if (!isNaN(Number(curr_sub_data[1]))) {
              sub_levs.push(Number(curr_sub_data[1]));
            } else {
              sub_levs.push(curr_sub_data[1]);
            }
            sub_square_diff_sum.push(Number(curr_sub_data[2]));
            sub_N_sum.push(Number(curr_sub_data[3]));
            sub_obs_model_diff_sum.push(Number(curr_sub_data[4]));
            sub_model_sum.push(Number(curr_sub_data[5]));
            sub_obs_sum.push(Number(curr_sub_data[6]));
            sub_abs_sum.push(Number(curr_sub_data[7]));
            sub_values.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                Number(curr_sub_data[5]),
                Number(curr_sub_data[6]),
                Number(curr_sub_data[7]),
                `${statistic}_${variable}`
              )
            );
          } else {
            sub_square_diff_sum.push(Number(curr_sub_data[1]));
            sub_N_sum.push(Number(curr_sub_data[2]));
            sub_obs_model_diff_sum.push(Number(curr_sub_data[3]));
            sub_model_sum.push(Number(curr_sub_data[4]));
            sub_obs_sum.push(Number(curr_sub_data[5]));
            sub_abs_sum.push(Number(curr_sub_data[6]));
            sub_values.push(
              matsDataUtils.calculateStatScalar(
                Number(curr_sub_data[1]),
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                Number(curr_sub_data[5]),
                Number(curr_sub_data[6]),
                `${statistic}_${variable}`
              )
            );
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          sub_stdev = matsDataUtils.stdev(sub_values);
          sub_mean = matsDataUtils.average(sub_values);
          sd_limit = outlierQCParam * sub_stdev;
          for (let svIdx = sub_values.length - 1; svIdx >= 0; svIdx--) {
            if (Math.abs(sub_values[svIdx] - sub_mean) > sd_limit) {
              sub_square_diff_sum.splice(svIdx, 1);
              sub_N_sum.splice(svIdx, 1);
              sub_obs_model_diff_sum.splice(svIdx, 1);
              sub_model_sum.splice(svIdx, 1);
              sub_obs_sum.splice(svIdx, 1);
              sub_abs_sum.splice(svIdx, 1);
              sub_values.splice(svIdx, 1);
              sub_secs.splice(svIdx, 1);
              if (hasLevels) {
                sub_levs.splice(svIdx, 1);
              }
            }
          }
        }
        const squareDiffSum = matsDataUtils.sum(sub_square_diff_sum);
        const NSum = matsDataUtils.sum(sub_N_sum);
        const obsModelDiffSum = matsDataUtils.sum(sub_obs_model_diff_sum);
        const modelSum = matsDataUtils.sum(sub_model_sum);
        const obsSum = matsDataUtils.sum(sub_obs_sum);
        const absSum = matsDataUtils.sum(sub_abs_sum);
        queryVal = matsDataUtils.calculateStatScalar(
          squareDiffSum,
          NSum,
          obsModelDiffSum,
          modelSum,
          obsSum,
          absSum,
          `${statistic}_${variable}`
        );
        queryVal = isNaN(Number(queryVal)) ? null : queryVal;
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataMapScalar. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
      d.queryVal.push(queryVal);
      d.stats.push({
        N_times: rows[rowIndex].N_times,
        min_time: rows[rowIndex].min_secs,
        max_time: rows[rowIndex].max_secs,
      });

      const thisSite = siteMap.find((obj) => obj.options.id === site);

      const tooltips =
        `${thisSite.origName}<br>${variable} ${statistic}<br>` +
        `model: ${dataSource}<br>` +
        `stat: ${queryVal} ${varUnits}<br>` +
        `n: ${rows[rowIndex].N0}`;
      d.text.push(tooltips);
      d.siteName.push(thisSite.origName);
      d.lat.push(thisSite.point[0]);
      d.lon.push(thisSite.point[1]);
      d.color.push("rgb(125,125,125)"); // dummy
    }
  }

  // get range of values for colorscale, eliminating the highest and lowest as outliers
  let filteredValues = d.queryVal.filter((x) => x);
  filteredValues = filteredValues.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  highLimit = filteredValues[Math.floor(filteredValues.length * 0.98)];
  lowLimit = filteredValues[Math.floor(filteredValues.length * 0.02)];

  const maxValue =
    Math.abs(highLimit) > Math.abs(lowLimit) ? Math.abs(highLimit) : Math.abs(lowLimit);
  if (statistic === "Bias (Model - Obs)") {
    // bias colorscale needs to be symmetrical around 0
    highLimit = maxValue;
    lowLimit = -1 * maxValue;
  }

  // get stdev threshold at which to exclude entire points
  const all_mean = matsDataUtils.average(filteredValues);
  const all_stdev = matsDataUtils.stdev(filteredValues);
  let all_sd_limit;
  if (outlierQCParam !== "all") {
    all_sd_limit = outlierQCParam * all_stdev;
  }

  for (let didx = d.queryVal.length - 1; didx >= 0; didx--) {
    queryVal = d.queryVal[didx];
    if (outlierQCParam !== "all" && Math.abs(queryVal - all_mean) > all_sd_limit) {
      // this point is too far from the mean. Exclude it.
      d.queryVal.splice(didx, 1);
      d.stats.splice(didx, 1);
      d.text.splice(didx, 1);
      d.siteName.splice(didx, 1);
      d.lat.splice(didx, 1);
      d.lon.splice(didx, 1);
      d.color.splice(didx, 1);
      continue;
    }
    var textMarker;
    if (variable.includes("2m") || variable.includes("10m")) {
      textMarker = queryVal === null ? "" : queryVal.toFixed(0);
    } else {
      textMarker = queryVal === null ? "" : queryVal.toFixed(1);
    }
    // sort the data by the color it will appear on the map
    if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.2) {
      d.color[didx] = colorLowest;
      dLowest.siteName.push(d.siteName[didx]);
      dLowest.queryVal.push(queryVal);
      dLowest.text.push(textMarker);
      dLowest.lat.push(d.lat[didx]);
      dLowest.lon.push(d.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.4) {
      d.color[didx] = colorLow;
      dLow.siteName.push(d.siteName[didx]);
      dLow.queryVal.push(queryVal);
      dLow.text.push(textMarker);
      dLow.lat.push(d.lat[didx]);
      dLow.lon.push(d.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.6) {
      d.color[didx] = colorModerate;
      dModerate.siteName.push(d.siteName[didx]);
      dModerate.queryVal.push(queryVal);
      dModerate.text.push(textMarker);
      dModerate.lat.push(d.lat[didx]);
      dModerate.lon.push(d.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.8) {
      d.color[didx] = colorHigh;
      dHigh.siteName.push(d.siteName[didx]);
      dHigh.queryVal.push(queryVal);
      dHigh.text.push(textMarker);
      dHigh.lat.push(d.lat[didx]);
      dHigh.lon.push(d.lon[didx]);
    } else {
      d.color[didx] = colorHighest;
      dHighest.siteName.push(d.siteName[didx]);
      dHighest.queryVal.push(queryVal);
      dHighest.text.push(textMarker);
      dHighest.lat.push(d.lat[didx]);
      dHighest.lon.push(d.lon[didx]);
    }
  } // end of loop row
  return {
    d,
    dLowest,
    dLow,
    dModerate,
    dHigh,
    dHighest,
    valueLimits: {
      maxValue,
      highLimit,
      lowLimit,
    },
  };
};

// this method parses the returned query data for maps in CTC apps
const parseQueryDataMapCTC = function (
  rows,
  d,
  dPurple,
  dPurpleBlue,
  dBlue,
  dBlueGreen,
  dGreen,
  dGreenYellow,
  dYellow,
  dOrange,
  dOrangeRed,
  dRed,
  dataSource,
  siteMap,
  statistic,
  appParams
) {
  const { hasLevels } = appParams;
  let highLimit = 100;
  let lowLimit = -100;
  const outlierQCParam =
    appParams.outliers !== "all" ? Number(appParams.outliers) : appParams.outliers;

  let queryVal;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const site = rows[rowIndex].sta_id;
    const hit = Number(rows[rowIndex].hit);
    const fa = Number(rows[rowIndex].fa);
    const miss = Number(rows[rowIndex].miss);
    const cn = Number(rows[rowIndex].cn);
    const n = rows[rowIndex].N_times;
    if (hit + fa + miss + cn > 0) {
      queryVal = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, n, statistic);
      queryVal = isNaN(Number(queryVal)) ? null : queryVal;
      switch (statistic) {
        case "TSS (True Skill Score)":
        case "HSS (Heidke Skill Score)":
          lowLimit = -100;
          highLimit = 100;
          break;
        case "PODy (POD of value < threshold)":
        case "PODy (POD of value > threshold)":
        case "PODn (POD of value > threshold)":
        case "PODn (POD of value < threshold)":
        case "FAR (False Alarm Ratio)":
        case "CSI (Critical Success Index)":
          lowLimit = 0;
          highLimit = 100;
          break;
        case "Bias (forecast/actual)":
          lowLimit = 0;
          highLimit = 2;
          break;
        case "ETS (Equitable Threat Score)":
          lowLimit = -100 / 3;
          highLimit = 100;
          break;
        case "Ratio Nlow / Ntot ((hit + miss)/(hit + miss + fa + cn))":
        case "Ratio Nhigh / Ntot ((hit + miss)/(hit + miss + fa + cn))":
        case "Ratio Nlow / Ntot ((fa + cn)/(hit + miss + fa + cn))":
        case "Ratio Nhigh / Ntot ((fa + cn)/(hit + miss + fa + cn))":
          lowLimit = 0;
          highLimit = 1;
          break;
      }
    } else {
      queryVal = null;
    }

    // store sub values to test them for stdev.
    const sub_hit = [];
    const sub_fa = [];
    const sub_miss = [];
    const sub_cn = [];
    const sub_values = [];
    const sub_secs = [];
    const sub_levs = [];
    let sub_stdev = 0;
    let sub_mean = 0;
    let sd_limit = 0;
    if (
      queryVal !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          sub_secs.push(Number(curr_sub_data[0]));
          if (hasLevels) {
            if (!isNaN(Number(curr_sub_data[1]))) {
              sub_levs.push(Number(curr_sub_data[1]));
            } else {
              sub_levs.push(curr_sub_data[1]);
            }
            sub_hit.push(Number(curr_sub_data[2]));
            sub_fa.push(Number(curr_sub_data[3]));
            sub_miss.push(Number(curr_sub_data[4]));
            sub_cn.push(Number(curr_sub_data[5]));
            sub_values.push(
              matsDataUtils.calculateStatCTC(
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                Number(curr_sub_data[5]),
                curr_sub_data.length,
                statistic
              )
            );
          } else {
            sub_hit.push(Number(curr_sub_data[1]));
            sub_fa.push(Number(curr_sub_data[2]));
            sub_miss.push(Number(curr_sub_data[3]));
            sub_cn.push(Number(curr_sub_data[4]));
            sub_values.push(
              matsDataUtils.calculateStatCTC(
                Number(curr_sub_data[1]),
                Number(curr_sub_data[2]),
                Number(curr_sub_data[3]),
                Number(curr_sub_data[4]),
                curr_sub_data.length,
                statistic
              )
            );
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          sub_stdev = matsDataUtils.stdev(sub_values);
          sub_mean = matsDataUtils.average(sub_values);
          sd_limit = outlierQCParam * sub_stdev;
          for (let svIdx = sub_values.length - 1; svIdx >= 0; svIdx--) {
            if (Math.abs(sub_values[svIdx] - sub_mean) > sd_limit) {
              sub_hit.splice(svIdx, 1);
              sub_fa.splice(svIdx, 1);
              sub_miss.splice(svIdx, 1);
              sub_cn.splice(svIdx, 1);
              sub_values.splice(svIdx, 1);
              sub_secs.splice(svIdx, 1);
              if (hasLevels) {
                sub_levs.splice(svIdx, 1);
              }
            }
          }
        }
        const hit = matsDataUtils.sum(sub_hit);
        const fa = matsDataUtils.sum(sub_fa);
        const miss = matsDataUtils.sum(sub_miss);
        const cn = matsDataUtils.sum(sub_cn);
        queryVal = matsDataUtils.calculateStatCTC(
          hit,
          fa,
          miss,
          cn,
          sub_hit.length,
          statistic
        );
        queryVal = isNaN(Number(queryVal)) ? null : queryVal;
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataMapCTC. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
      d.queryVal.push(queryVal);
      d.stats.push({
        N_times: rows[rowIndex].N_times,
        min_time: rows[rowIndex].min_secs,
        max_time: rows[rowIndex].max_secs,
        hit: rows[rowIndex].hit,
        fa: rows[rowIndex].fa,
        miss: rows[rowIndex].miss,
        cn: rows[rowIndex].cn,
      });

      let thisSite;
      if (appParams.isCouchbase) {
        thisSite = siteMap.find((obj) => obj.name === site);
      } else {
        thisSite = siteMap.find((obj) => obj.options.id === site);
      }

      const tooltips =
        `${thisSite.origName}<br>` +
        `model: ${dataSource}<br>${statistic}: ${queryVal}<br>` +
        `n: ${rows[rowIndex].N_times}<br>` +
        `hits: ${rows[rowIndex].hit}<br>` +
        `false alarms: ${rows[rowIndex].fa}<br>` +
        `misses: ${rows[rowIndex].miss}<br>` +
        `correct nulls: ${rows[rowIndex].cn}`;
      d.text.push(tooltips);
      d.siteName.push(thisSite.origName);
      d.lat.push(thisSite.point[0]);
      d.lon.push(thisSite.point[1]);

      // sort the data by the color it will appear on the map
      const textMarker = queryVal === null ? "" : queryVal.toFixed(0);
      if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.1) {
        d.color.push("rgb(128,0,255)");
        dPurple.siteName.push(thisSite.origName);
        dPurple.queryVal.push(queryVal);
        dPurple.text.push(textMarker);
        dPurple.lat.push(thisSite.point[0]);
        dPurple.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.2) {
        d.color.push("rgb(64,0,255)");
        dPurpleBlue.siteName.push(thisSite.origName);
        dPurpleBlue.queryVal.push(queryVal);
        dPurpleBlue.text.push(textMarker);
        dPurpleBlue.lat.push(thisSite.point[0]);
        dPurpleBlue.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.3) {
        d.color.push("rgb(0,0,255)");
        dBlue.siteName.push(thisSite.origName);
        dBlue.queryVal.push(queryVal);
        dBlue.text.push(textMarker);
        dBlue.lat.push(thisSite.point[0]);
        dBlue.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.4) {
        d.color.push("rgb(64,128,128)");
        dBlueGreen.siteName.push(thisSite.origName);
        dBlueGreen.queryVal.push(queryVal);
        dBlueGreen.text.push(textMarker);
        dBlueGreen.lat.push(thisSite.point[0]);
        dBlueGreen.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.5) {
        d.color.push("rgb(128,255,0)");
        dGreen.siteName.push(thisSite.origName);
        dGreen.queryVal.push(queryVal);
        dGreen.text.push(textMarker);
        dGreen.lat.push(thisSite.point[0]);
        dGreen.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.6) {
        d.color.push("rgb(160,224,0)");
        dGreenYellow.siteName.push(thisSite.origName);
        dGreenYellow.queryVal.push(queryVal);
        dGreenYellow.text.push(textMarker);
        dGreenYellow.lat.push(thisSite.point[0]);
        dGreenYellow.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.7) {
        d.color.push("rgb(192,192,0)");
        dYellow.siteName.push(thisSite.origName);
        dYellow.queryVal.push(queryVal);
        dYellow.text.push(textMarker);
        dYellow.lat.push(thisSite.point[0]);
        dYellow.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.8) {
        d.color.push("rgb(255,128,0)");
        dOrange.siteName.push(thisSite.origName);
        dOrange.queryVal.push(queryVal);
        dOrange.text.push(textMarker);
        dOrange.lat.push(thisSite.point[0]);
        dOrange.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.9) {
        d.color.push("rgb(255,64,0)");
        dOrangeRed.siteName.push(thisSite.origName);
        dOrangeRed.queryVal.push(queryVal);
        dOrangeRed.text.push(textMarker);
        dOrangeRed.lat.push(thisSite.point[0]);
        dOrangeRed.lon.push(thisSite.point[1]);
      } else {
        d.color.push("rgb(255,0,0)");
        dRed.siteName.push(thisSite.origName);
        dRed.queryVal.push(queryVal);
        dRed.text.push(textMarker);
        dRed.lat.push(thisSite.point[0]);
        dRed.lon.push(thisSite.point[1]);
      }
    }
  } // end of loop row

  return {
    d,
    dPurple,
    dPurpleBlue,
    dBlue,
    dBlueGreen,
    dGreen,
    dGreenYellow,
    dYellow,
    dOrange,
    dOrangeRed,
    dRed,
    valueLimits: {
      maxValue: highLimit,
      highLimit,
      lowLimit,
    },
  };
};

// this method parses the returned query data for histograms
const parseQueryDataHistogram = function (rows, d, appParams, statisticStr) {
  /*
        var d = {   // d will contain the curve data
            x: [],
            y: [],
            error_x: [],
            error_y: [],
            subHit: [],
            subFa: [],
            subMiss: [],
            subCn: [],
            subSquareDiffSum: [],
            subNSum: [],
            subObsModelDiffSum: [],
            subModelSum: [],
            subObsSum: [],
            subAbsSum: [],
            subData: [],
            subHeaders: [],
            subVals: [],
            subSecs: [],
            subLevs: [],
            stats: [],
            text: [],
            glob_stats: {},
            bin_stats: [],
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            sum: 0
        };
    */
  const { hasLevels } = appParams;
  let isCTC = false;
  let isScalar = false;

  // these arrays hold all the sub values and seconds (and levels) until they are sorted into bins
  const curveSubStatsRaw = [];
  const curveSubSecsRaw = [];
  const curveSubLevsRaw = [];

  // parse the data returned from the query
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var stat;
    if (rows[rowIndex].stat === undefined && rows[rowIndex].hit !== undefined) {
      // this is a contingency table plot
      isCTC = true;
      const hit = Number(rows[rowIndex].hit);
      const fa = Number(rows[rowIndex].fa);
      const miss = Number(rows[rowIndex].miss);
      const cn = Number(rows[rowIndex].cn);
      const n = rows[rowIndex].sub_data.toString().split(",").length;
      if (hit + fa + miss + cn > 0) {
        stat = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, n, statisticStr);
        stat = isNaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else if (
      rows[rowIndex].stat === undefined &&
      rows[rowIndex].square_diff_sum !== undefined
    ) {
      // this is a scalar partial sums plot
      isScalar = true;
      const squareDiffSum = Number(rows[rowIndex].square_diff_sum);
      const NSum = Number(rows[rowIndex].N_sum);
      const obsModelDiffSum = Number(rows[rowIndex].obs_model_diff_sum);
      const modelSum = Number(rows[rowIndex].model_sum);
      const obsSum = Number(rows[rowIndex].obs_sum);
      const absSum = Number(rows[rowIndex].abs_sum);
      if (NSum > 0) {
        stat = matsDataUtils.calculateStatScalar(
          squareDiffSum,
          NSum,
          obsModelDiffSum,
          modelSum,
          obsSum,
          absSum,
          statisticStr
        );
        stat = isNaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else {
      // not a contingency table plot or a scalar partial sums plot
      stat = rows[rowIndex].stat === "NULL" ? null : rows[rowIndex].stat;
    }
    const sub_stats = [];
    const sub_secs = [];
    const sub_levs = [];
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          if (isCTC) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_stats.push(
                matsDataUtils.calculateStatCTC(
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  1,
                  statisticStr
                )
              );
            } else {
              sub_stats.push(
                matsDataUtils.calculateStatCTC(
                  Number(curr_sub_data[1]),
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  1,
                  statisticStr
                )
              );
            }
          } else if (isScalar) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_stats.push(
                matsDataUtils.calculateStatScalar(
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  Number(curr_sub_data[6]),
                  Number(curr_sub_data[7]),
                  statisticStr
                )
              );
            } else {
              sub_stats.push(
                matsDataUtils.calculateStatScalar(
                  Number(curr_sub_data[1]),
                  Number(curr_sub_data[2]),
                  Number(curr_sub_data[3]),
                  Number(curr_sub_data[4]),
                  Number(curr_sub_data[5]),
                  Number(curr_sub_data[6]),
                  statisticStr
                )
              );
            }
          } else {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_stats.push(Number(curr_sub_data[2]));
            } else {
              sub_stats.push(Number(curr_sub_data[1]));
            }
          }
        }
        curveSubStatsRaw.push(sub_stats);
        curveSubSecsRaw.push(sub_secs);
        curveSubLevsRaw.push(sub_levs);
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataHistogram. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    }
  }

  // we don't have bins yet, so we want all of the data in one array
  const subVals = [].concat.apply([], curveSubStatsRaw);
  const subSecs = [].concat.apply([], curveSubSecsRaw);
  let subLevs;
  if (hasLevels) {
    subLevs = [].concat.apply([], curveSubLevsRaw);
  }

  d.subVals = subVals;
  d.subSecs = subSecs;
  d.subLevs = subLevs;

  return {
    d,
    N0: subVals.length,
    N_times: subSecs.length,
  };
};

// this method parses the returned query data for contour plots
const parseQueryDataContour = function (rows, d, appParams, statisticStr) {
  /*
        var d = {   // d will contain the curve data
            x: [],
            y: [],
            z: [],
            n: [],
            subHit: [],
            subFa: [],
            subMiss: [],
            subCn: [],
            subSquareDiffSum: [],
            subNSum: [],
            subObsModelDiffSum: [],
            subModelSum: [],
            subObsSum: [],
            subAbsSum: [],
            subData: [],
            subHeaders: [],
            subVals: [],
            subSecs: [],
            subLevs: [],
            text: [],
            xTextOutput: [],
            yTextOutput: [],
            zTextOutput: [],
            nTextOutput: [],
            hitTextOutput: [],
            faTextOutput: [],
            missTextOutput: [],
            cnTextOutput: [],
            squareDiffSumTextOutput: [],
            NSumTextOutput: [],
            obsModelDiffSumTextOutput: [],
            modelSumTextOutput: [],
            obsSumTextOutput: [],
            absSumTextOutput: [],
            minDateTextOutput: [],
            maxDateTextOutput: [],
            stdev: [],
            stats: [],
            glob_stats: {},
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            zmin: Number.MAX_VALUE,
            zmax: Number.MIN_VALUE,
            sum: 0
        };
    */
  const { hasLevels } = appParams;
  let isCTC = false;
  let isScalar = false;

  // initialize local variables
  const curveStatLookup = {};
  const curveStdevLookup = {};
  const curveNLookup = {};
  const curveSubHitLookup = {};
  const curveSubFaLookup = {};
  const curveSubMissLookup = {};
  const curveSubCnLookup = {};
  const curveSubSquareDiffSumLookup = {};
  const curveSubNSumLookup = {};
  const curveSubObsModelDiffSumLookup = {};
  const curveSubModelSumLookup = {};
  const curveSubObsSumLookup = {};
  const curveSubAbsSumLookup = {};
  const curveSubValLookup = {};
  const curveSubSecLookup = {};
  const curveSubLevLookup = {};

  // get all the data out of the query array
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const rowXVal = rows[rowIndex].xVal;
    const rowYVal = rows[rowIndex].yVal;
    const statKey = `${rowXVal.toString()}_${rowYVal.toString()}`;
    let stat = null;
    let hit = null;
    let fa = null;
    let miss = null;
    let cn = null;
    let n =
      rows[rowIndex].sub_data !== undefined && rows[rowIndex].sub_data !== null
        ? rows[rowIndex].sub_data.toString().split(",").length
        : 0;
    let squareDiffSum = null;
    let NSum = null;
    let obsModelDiffSum = null;
    let modelSum = null;
    let obsSum = null;
    let absSum = null;
    let stdev = null;
    if (rows[rowIndex].stat === undefined && rows[rowIndex].hit !== undefined) {
      // this is a contingency table plot
      isCTC = true;
      hit = Number(rows[rowIndex].hit);
      fa = Number(rows[rowIndex].fa);
      miss = Number(rows[rowIndex].miss);
      cn = Number(rows[rowIndex].cn);
      if (hit + fa + miss + cn > 0) {
        stat = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, n, statisticStr);
        stat = isNaN(Number(stat)) ? null : stat;
      }
    } else if (
      rows[rowIndex].stat === undefined &&
      rows[rowIndex].square_diff_sum !== undefined
    ) {
      // this is a scalar partial sums plot
      isScalar = true;
      squareDiffSum = Number(rows[rowIndex].square_diff_sum);
      NSum = Number(rows[rowIndex].N_sum);
      obsModelDiffSum = Number(rows[rowIndex].obs_model_diff_sum);
      modelSum = Number(rows[rowIndex].model_sum);
      obsSum = Number(rows[rowIndex].obs_sum);
      absSum = Number(rows[rowIndex].abs_sum);
      if (NSum > 0) {
        stat = matsDataUtils.calculateStatScalar(
          squareDiffSum,
          NSum,
          obsModelDiffSum,
          modelSum,
          obsSum,
          absSum,
          statisticStr
        );
        stat = isNaN(Number(stat)) ? null : stat;
        const variable = statisticStr.split("_")[1];
        stdev = matsDataUtils.calculateStatScalar(
          squareDiffSum,
          NSum,
          obsModelDiffSum,
          modelSum,
          obsSum,
          absSum,
          `Std deviation_${variable}`
        );
      }
    } else {
      // not a contingency table plot
      stat = rows[rowIndex].stat === "NULL" ? null : rows[rowIndex].stat;
      stdev = rows[rowIndex].stdev !== undefined ? rows[rowIndex].stdev : null;
    }
    let minDate = rows[rowIndex].min_secs;
    let maxDate = rows[rowIndex].max_secs;
    if (stat === undefined || stat === null) {
      stat = null;
      stdev = 0;
      n = 0;
      minDate = null;
      maxDate = null;
    }
    let sub_hit = [];
    let sub_fa = [];
    let sub_miss = [];
    let sub_cn = [];
    let sub_square_diff_sum = [];
    let sub_N_sum = [];
    let sub_obs_model_diff_sum = [];
    let sub_model_sum = [];
    let sub_obs_sum = [];
    let sub_abs_sum = [];
    let sub_values = [];
    let sub_secs = [];
    let sub_levs = [];
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const sub_data = rows[rowIndex].sub_data.toString().split(",");
        var curr_sub_data;
        for (let sd_idx = 0; sd_idx < sub_data.length; sd_idx++) {
          curr_sub_data = sub_data[sd_idx].split(";");
          if (isCTC) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_hit.push(Number(curr_sub_data[2]));
              sub_fa.push(Number(curr_sub_data[3]));
              sub_miss.push(Number(curr_sub_data[4]));
              sub_cn.push(Number(curr_sub_data[5]));
            } else {
              sub_hit.push(Number(curr_sub_data[1]));
              sub_fa.push(Number(curr_sub_data[2]));
              sub_miss.push(Number(curr_sub_data[3]));
              sub_cn.push(Number(curr_sub_data[4]));
            }
          } else if (isScalar) {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_square_diff_sum.push(Number(curr_sub_data[2]));
              sub_N_sum.push(Number(curr_sub_data[3]));
              sub_obs_model_diff_sum.push(Number(curr_sub_data[4]));
              sub_model_sum.push(Number(curr_sub_data[5]));
              sub_obs_sum.push(Number(curr_sub_data[6]));
              sub_abs_sum.push(Number(curr_sub_data[7]));
            } else {
              sub_square_diff_sum.push(Number(curr_sub_data[1]));
              sub_N_sum.push(Number(curr_sub_data[2]));
              sub_obs_model_diff_sum.push(Number(curr_sub_data[3]));
              sub_model_sum.push(Number(curr_sub_data[4]));
              sub_obs_sum.push(Number(curr_sub_data[5]));
              sub_abs_sum.push(Number(curr_sub_data[6]));
            }
          } else {
            sub_secs.push(Number(curr_sub_data[0]));
            if (hasLevels) {
              if (!isNaN(Number(curr_sub_data[1]))) {
                sub_levs.push(Number(curr_sub_data[1]));
              } else {
                sub_levs.push(curr_sub_data[1]);
              }
              sub_values.push(Number(curr_sub_data[2]));
            } else {
              sub_values.push(Number(curr_sub_data[1]));
            }
          }
        }
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataContour. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      if (isCTC) {
        sub_hit = NaN;
        sub_fa = NaN;
        sub_miss = NaN;
        sub_cn = NaN;
      } else if (isScalar) {
        sub_square_diff_sum = NaN;
        sub_N_sum = NaN;
        sub_obs_model_diff_sum = NaN;
        sub_model_sum = NaN;
        sub_obs_sum = NaN;
        sub_abs_sum = NaN;
      } else {
        sub_values = NaN;
      }
      sub_secs = NaN;
      if (hasLevels) {
        sub_levs = NaN;
      }
    }
    // store flat arrays of all the parsed data, used by the text output and for some calculations later
    d.xTextOutput.push(Number(rowXVal));
    d.yTextOutput.push(Number(rowYVal));
    d.zTextOutput.push(stat);
    d.nTextOutput.push(n);
    d.hitTextOutput.push(hit);
    d.faTextOutput.push(fa);
    d.missTextOutput.push(miss);
    d.cnTextOutput.push(cn);
    d.squareDiffSumTextOutput.push(squareDiffSum);
    d.NSumTextOutput.push(NSum);
    d.obsModelDiffSumTextOutput.push(obsModelDiffSum);
    d.modelSumTextOutput.push(modelSum);
    d.obsSumTextOutput.push(obsSum);
    d.absSumTextOutput.push(absSum);
    d.minDateTextOutput.push(minDate);
    d.maxDateTextOutput.push(maxDate);
    curveStatLookup[statKey] = stat;
    curveStdevLookup[statKey] = stdev;
    curveNLookup[statKey] = n;
    if (isCTC) {
      curveSubHitLookup[statKey] = sub_hit;
      curveSubFaLookup[statKey] = sub_fa;
      curveSubMissLookup[statKey] = sub_miss;
      curveSubCnLookup[statKey] = sub_cn;
    } else if (isScalar) {
      curveSubSquareDiffSumLookup[statKey] = sub_square_diff_sum;
      curveSubNSumLookup[statKey] = sub_N_sum;
      curveSubObsModelDiffSumLookup[statKey] = sub_obs_model_diff_sum;
      curveSubModelSumLookup[statKey] = sub_model_sum;
      curveSubObsSumLookup[statKey] = sub_obs_sum;
      curveSubAbsSumLookup[statKey] = sub_abs_sum;
    } else {
      curveSubValLookup[statKey] = sub_values;
    }
    curveSubSecLookup[statKey] = sub_secs;
    if (hasLevels) {
      curveSubLevLookup[statKey] = sub_levs;
    }
  }

  // get the unique x and y values and sort the stats into the 2D z array accordingly
  d.x = matsDataUtils.arrayUnique(d.xTextOutput).sort(function (a, b) {
    return a - b;
  });
  d.y = matsDataUtils.arrayUnique(d.yTextOutput).sort(function (a, b) {
    return a - b;
  });
  let i;
  let j;
  let currX;
  let currY;
  let currStat;
  let currStdev;
  let currN;
  let currSubHit;
  let currSubFa;
  let currSubMiss;
  let currSubCn;
  let currSubSquareDiffSum;
  let currSubNSum;
  let currSubObsModelDiffSum;
  let currSubModelSum;
  let currSubObsSum;
  let currSubAbsSum;
  let currSubVal;
  let currSubSec;
  let currSubLev;
  let currStatKey;
  let currYStatArray;
  let currYStdevArray;
  let currYNArray;
  let currYSubHitArray;
  let currYSubFaArray;
  let currYSubMissArray;
  let currYSubCnArray;
  let currYSubSquareDiffSumArray;
  let currYSubNSumArray;
  let currYSubObsModelDiffSumArray;
  let currYSubModelSumArray;
  let currYSubObsSumArray;
  let currYSubAbsSumArray;
  let currYSubValArray;
  let currYSubSecArray;
  let currYSubLevArray;
  let sum = 0;
  let nPoints = 0;
  let zmin = Number.MAX_VALUE;
  let zmax = -1 * Number.MAX_VALUE;

  for (j = 0; j < d.y.length; j++) {
    currY = d.y[j];
    currYStatArray = [];
    currYStdevArray = [];
    currYNArray = [];
    if (isCTC) {
      currYSubHitArray = [];
      currYSubFaArray = [];
      currYSubMissArray = [];
      currYSubCnArray = [];
    } else if (isScalar) {
      currYSubSquareDiffSumArray = [];
      currYSubNSumArray = [];
      currYSubObsModelDiffSumArray = [];
      currYSubModelSumArray = [];
      currYSubObsSumArray = [];
      currYSubAbsSumArray = [];
    } else {
      currYSubValArray = [];
    }
    currYSubSecArray = [];
    if (hasLevels) {
      currYSubLevArray = [];
    }
    for (i = 0; i < d.x.length; i++) {
      currX = d.x[i];
      currStatKey = `${currX.toString()}_${currY.toString()}`;
      currStat = curveStatLookup[currStatKey];
      currStdev = curveStdevLookup[currStatKey];
      currN = curveNLookup[currStatKey];
      if (isCTC) {
        currSubHit = curveSubHitLookup[currStatKey];
        currSubFa = curveSubFaLookup[currStatKey];
        currSubMiss = curveSubMissLookup[currStatKey];
        currSubCn = curveSubCnLookup[currStatKey];
      } else if (isScalar) {
        currSubSquareDiffSum = curveSubSquareDiffSumLookup[currStatKey];
        currSubNSum = curveSubNSumLookup[currStatKey];
        currSubObsModelDiffSum = curveSubObsModelDiffSumLookup[currStatKey];
        currSubModelSum = curveSubModelSumLookup[currStatKey];
        currSubObsSum = curveSubObsSumLookup[currStatKey];
        currSubAbsSum = curveSubAbsSumLookup[currStatKey];
      } else {
        currSubVal = curveSubValLookup[currStatKey];
      }
      currSubSec = curveSubSecLookup[currStatKey];
      if (hasLevels) {
        currSubLev = curveSubLevLookup[currStatKey];
      }
      if (currStat === undefined) {
        currYStatArray.push(null);
        currYStdevArray.push(null);
        currYNArray.push(0);
        if (isCTC) {
          currYSubHitArray.push(null);
          currYSubFaArray.push(null);
          currYSubMissArray.push(null);
          currYSubCnArray.push(null);
        } else if (isScalar) {
          currYSubSquareDiffSumArray.push(null);
          currYSubNSumArray.push(null);
          currYSubObsModelDiffSumArray.push(null);
          currYSubModelSumArray.push(null);
          currYSubObsSumArray.push(null);
          currYSubAbsSumArray.push(null);
        } else {
          currYSubValArray.push(null);
        }
        currYSubSecArray.push(null);
        if (hasLevels) {
          currYSubLevArray.push(null);
        }
      } else {
        sum += currStat;
        nPoints += 1;
        currYStatArray.push(currStat);
        currYStdevArray.push(currStdev);
        currYNArray.push(currN);
        if (isCTC) {
          currYSubHitArray.push(currSubHit);
          currYSubFaArray.push(currSubFa);
          currYSubMissArray.push(currSubMiss);
          currYSubCnArray.push(currSubCn);
        } else if (isScalar) {
          currYSubSquareDiffSumArray.push(currSubSquareDiffSum);
          currYSubNSumArray.push(currSubNSum);
          currYSubObsModelDiffSumArray.push(currSubObsModelDiffSum);
          currYSubModelSumArray.push(currSubModelSum);
          currYSubObsSumArray.push(currSubObsSum);
          currYSubAbsSumArray.push(currSubAbsSum);
        } else {
          currYSubValArray.push(currSubVal);
        }
        currYSubSecArray.push(currSubSec);
        if (hasLevels) {
          currYSubLevArray.push(currSubLev);
        }
        zmin = currStat < zmin ? currStat : zmin;
        zmax = currStat > zmax ? currStat : zmax;
      }
    }
    d.z.push(currYStatArray);
    d.stdev.push(currYStdevArray);
    d.n.push(currYNArray);
    if (isCTC) {
      d.subHit.push(currYSubHitArray);
      d.subFa.push(currYSubFaArray);
      d.subMiss.push(currYSubMissArray);
      d.subCn.push(currYSubCnArray);
    } else if (isScalar) {
      d.subSquareDiffSum.push(currYSubSquareDiffSumArray);
      d.subNSum.push(currYSubNSumArray);
      d.subObsModelDiffSum.push(currYSubObsModelDiffSumArray);
      d.subModelSum.push(currYSubModelSumArray);
      d.subObsSum.push(currYSubObsSumArray);
      d.subAbsSum.push(currYSubAbsSumArray);
    } else {
      d.subVals.push(currYSubValArray);
    }
    d.subSecs.push(currYSubSecArray);
    if (hasLevels) {
      d.subLevs.push(currYSubLevArray);
    }
  }

  // calculate statistics
  d.xmin = d.x[0];
  d.xmax = d.x[d.x.length - 1];
  d.ymin = d.y[0];
  d.ymax = d.y[d.y.length - 1];
  d.zmin = zmin;
  d.zmax = zmax;
  d.sum = sum;

  const filteredMinDate = d.minDateTextOutput.filter((t) => t);
  const filteredMaxDate = d.maxDateTextOutput.filter((t) => t);
  d.glob_stats.mean = sum / nPoints;
  d.glob_stats.minDate = Math.min(...filteredMinDate);
  d.glob_stats.maxDate = Math.max(...filteredMaxDate);
  d.glob_stats.n = nPoints;

  return {
    d,
  };
};

export default matsDataQueryUtils = {
  simplePoolQueryWrapSynchronous,
  queryDBPython,
  queryDBTimeSeriesMT,
  queryDBTimeSeries,
  queryDBSpecialtyCurve,
  queryDBPerformanceDiagram,
  queryDBSimpleScatter,
  queryDBMapScalar,
  queryDBMapCTC,
  queryDBContour,
};
