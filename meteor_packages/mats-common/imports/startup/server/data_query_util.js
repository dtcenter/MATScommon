/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsDataUtils,
  matsTypes,
  matsCollections,
  matsMethods,
} from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";
import { _ } from "meteor/underscore";

/* global Assets */
/* eslint-disable global-require */
/* eslint-disable no-console */

// utility for querying the DB
const queryMySQL = async function (pool, statement) {
  if (Meteor.isServer) {
    const results = await pool.query(statement);
    return results[0];
  }
  return null;
};

// utility to get the cadence for a particular model, so that the query function
// knows where to include null points for missing data.
const getModelCadence = async function (pool, dataSource, startDate, endDate) {
  let rows = [];
  let cycles;
  try {
    // this query should only return data if the model cadence is irregular.
    // otherwise, the cadence will be calculated later by the query function.
    let cyclesRaw;
    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine  'queryDBTimeSeries' cannot itslef be async because the graph page needs to wait
            for its result, so we use an anomynous async() function here to wrap the queryCB call
            */
      const doc = await pool.getCb("MD:matsAux:COMMON:V01");
      const newModel = doc.standardizedModleList[dataSource];
      cyclesRaw = doc.primaryModelOrders[newModel]
        ? doc.primaryModelOrders[newModel].cycleSecnds
        : undefined;
    } else {
      // we will default to mysql so old apps won't break
      rows = await queryMySQL(
        pool,
        `select cycle_seconds ` +
          `from mats_common.primary_model_orders ` +
          `where model = ` +
          `(select new_model as display_text from mats_common.standardized_model_list where old_model = '${dataSource}');`
      );
      cyclesRaw = rows[0].cycle_seconds ? JSON.parse(rows[0].cycle_seconds) : undefined;
    }
    const cyclesKeys = cyclesRaw ? Object.keys(cyclesRaw).sort() : undefined;
    // there can be difference cadences for different time periods (each time period is a key in cycles_keys,
    // with the cadences for that period represented as values in cycles_raw), so this section identifies all
    // time periods relevant to the requested date range, and returns the union of their cadences.
    if (cyclesKeys.length !== 0) {
      let newTime;
      let chosenStartTime;
      let chosenEndTime;
      let chosenStartIdx;
      let chosenEndIdx;
      let foundStart = false;
      let foundEnd = false;
      for (let ti = cyclesKeys.length - 1; ti >= 0; ti -= 1) {
        newTime = cyclesKeys[ti];
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
          cycles = cyclesRaw[chosenStartTime];
        } else if (chosenEndIdx - chosenStartIdx === 1) {
          const startCycles = cyclesRaw[chosenStartTime];
          const endCycles = cyclesRaw[chosenEndTime];
          cycles = _.union(startCycles, endCycles);
        } else {
          let middleCycles = [];
          let currCycles;
          for (let ti = chosenStartIdx + 1; ti < chosenEndIdx; ti += 1) {
            currCycles = cyclesRaw[cyclesKeys[ti]];
            middleCycles = _.union(middleCycles, currCycles);
          }
          const startCycles = cyclesRaw[chosenStartTime];
          const endCycles = cyclesRaw[chosenEndTime];
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
    for (let c = 0; c < cycles.length; c += 1) {
      cycles[c] *= 1000; // convert to milliseconds
    }
  } else {
    cycles = []; // regular cadence model--cycles will be calculated later by the query function
  }
  return cycles;
};

// get stations in a predefined region
const getStationsInCouchbaseRegion = async function (pool, region) {
  if (Meteor.isServer) {
    let statement = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_stations_for_region.sql"
    );
    statement = statement.replace(/{{vxREGION}}/g, region);
    const sitesList = await pool.queryCB(pool.trfmSQLForDbTarget(statement));
    return sitesList;
  }
  return null;
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

    let d = [];
    let error = "";
    let n0 = [];
    let nTimes = [];

    const pyShell = require("python-shell");
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
          n0 = parsedData.n0;
          nTimes = parsedData.nTimes;
          error = parsedData.error;

          // check for nulls in output, since JSON only passes strings
          for (let idx = 0; idx < d.length; idx += 1) {
            for (let didx = 0; didx < d[idx].y.length; didx += 1) {
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
                  } else if (queryArray[idx].statLineType === "mode_single") {
                    d[idx].nForecast[didx] = 0;
                    d[idx].nMatched[didx] = 0;
                    d[idx].nSimple[didx] = 0;
                    d[idx].nTotal[didx] = 0;
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
                  } else if (queryArray[idx].statLineType === "mode_single") {
                    d[idx].nForecast[didx] = 0;
                    d[idx].nMatched[didx] = 0;
                    d[idx].nSimple[didx] = 0;
                    d[idx].nTotal[didx] = 0;
                  }
                }
                d[idx].subSecs[didx] = NaN;
                d[idx].subLevs[didx] = NaN;
              }
            }
          }
        }
        return {
          data: d,
          error,
          n0,
          nTimes,
        };
      })
      .catch((err) => {
        error = err.message;
        return {
          data: d,
          error,
          n0,
          nTimes,
        };
      });
  }
  return null;
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
  let returnD = d;
  const { plotType } = appParams;
  const { hasLevels } = appParams;
  const completenessQCParam = Number(appParams.completeness) / 100;
  const outlierQCParam =
    appParams.outliers !== "all" ? Number(appParams.outliers) : appParams.outliers;

  let isCTC = false;
  let isScalar = false;
  const { hideGaps } = appParams;

  // initialize local variables
  const n0 = [];
  const nTimes = [];
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
  let timeInterval;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let independentVar;
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
        timeInterval =
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
    let stat;
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else {
      // not a contingency table plot or a scalar partial sums plot
      stat = rows[rowIndex].stat === "NULL" ? null : rows[rowIndex].stat;
    }
    n0.push(rows[rowIndex].n0); // number of values that go into a point on the graph
    nTimes.push(rows[rowIndex].nTimes); // number of times that go into a point on the graph

    if (plotType === matsTypes.PlotTypes.timeSeries) {
      // Find the minimum time_interval to be sure we don't accidentally go past the next data point.
      if (rowIndex < rows.length - 1) {
        const timeDiff =
          Number(rows[rowIndex + 1].avtime) - Number(rows[rowIndex].avtime);
        if (timeDiff < timeInterval) {
          timeInterval = timeDiff;
        }
      }
    }

    // store sub values that will later be used for calculating error bar statistics.
    let thisSubHit = [];
    let thisSubFa = [];
    let thisSubMiss = [];
    let thisSubCn = [];
    let thisSubSquareDiffSum = [];
    let thisSubNSum = [];
    let thisSubObsModelDiffSum = [];
    let thisSubModelSum = [];
    let thisSumObsSum = [];
    let thisSumAbsSum = [];
    let thisSubValues = [];
    let thisSubSecs = [];
    let thisSubLevs = [];
    let thisSubStdev = 0;
    let thisSubMean = 0;
    let sdLimit = 0;
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          if (isCTC) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubHit.push(Number(currSubData[2]));
              thisSubFa.push(Number(currSubData[3]));
              thisSubMiss.push(Number(currSubData[4]));
              thisSubCn.push(Number(currSubData[5]));
              thisSubValues.push(
                matsDataUtils.calculateStatCTC(
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  currSubData.length,
                  statisticStr
                )
              );
            } else {
              thisSubHit.push(Number(currSubData[1]));
              thisSubFa.push(Number(currSubData[2]));
              thisSubMiss.push(Number(currSubData[3]));
              thisSubCn.push(Number(currSubData[4]));
              thisSubValues.push(
                matsDataUtils.calculateStatCTC(
                  Number(currSubData[1]),
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  currSubData.length,
                  statisticStr
                )
              );
            }
          } else if (isScalar) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubSquareDiffSum.push(Number(currSubData[2]));
              thisSubNSum.push(Number(currSubData[3]));
              thisSubObsModelDiffSum.push(Number(currSubData[4]));
              thisSubModelSum.push(Number(currSubData[5]));
              thisSumObsSum.push(Number(currSubData[6]));
              thisSumAbsSum.push(Number(currSubData[7]));
              thisSubValues.push(
                matsDataUtils.calculateStatScalar(
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  Number(currSubData[6]),
                  Number(currSubData[7]),
                  statisticStr
                )
              );
            } else {
              thisSubSquareDiffSum.push(Number(currSubData[1]));
              thisSubNSum.push(Number(currSubData[2]));
              thisSubObsModelDiffSum.push(Number(currSubData[3]));
              thisSubModelSum.push(Number(currSubData[4]));
              thisSumObsSum.push(Number(currSubData[5]));
              thisSumAbsSum.push(Number(currSubData[6]));
              thisSubValues.push(
                matsDataUtils.calculateStatScalar(
                  Number(currSubData[1]),
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  Number(currSubData[6]),
                  statisticStr
                )
              );
            }
          } else {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubValues.push(Number(currSubData[2]));
            } else {
              thisSubValues.push(Number(currSubData[1]));
            }
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          thisSubStdev = matsDataUtils.stdev(thisSubValues);
          thisSubMean = matsDataUtils.average(thisSubValues);
          sdLimit = outlierQCParam * thisSubStdev;
          for (let svIdx = thisSubValues.length - 1; svIdx >= 0; svIdx -= 1) {
            if (Math.abs(thisSubValues[svIdx] - thisSubMean) > sdLimit) {
              if (isCTC) {
                thisSubHit.splice(svIdx, 1);
                thisSubFa.splice(svIdx, 1);
                thisSubMiss.splice(svIdx, 1);
                thisSubCn.splice(svIdx, 1);
              } else if (isScalar) {
                thisSubSquareDiffSum.splice(svIdx, 1);
                thisSubNSum.splice(svIdx, 1);
                thisSubObsModelDiffSum.splice(svIdx, 1);
                thisSubModelSum.splice(svIdx, 1);
                thisSumObsSum.splice(svIdx, 1);
                thisSumAbsSum.splice(svIdx, 1);
              }
              thisSubValues.splice(svIdx, 1);
              thisSubSecs.splice(svIdx, 1);
              if (hasLevels) {
                thisSubLevs.splice(svIdx, 1);
              }
            }
          }
        }
        if (isCTC) {
          const hit = matsDataUtils.sum(thisSubHit);
          const fa = matsDataUtils.sum(thisSubFa);
          const miss = matsDataUtils.sum(thisSubMiss);
          const cn = matsDataUtils.sum(thisSubCn);
          stat = matsDataUtils.calculateStatCTC(
            hit,
            fa,
            miss,
            cn,
            thisSubHit.length,
            statisticStr
          );
        } else if (isScalar) {
          const squareDiffSum = matsDataUtils.sum(thisSubSquareDiffSum);
          const NSum = matsDataUtils.sum(thisSubNSum);
          const obsModelDiffSum = matsDataUtils.sum(thisSubObsModelDiffSum);
          const modelSum = matsDataUtils.sum(thisSubModelSum);
          const obsSum = matsDataUtils.sum(thisSumObsSum);
          const absSum = matsDataUtils.sum(thisSumAbsSum);
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
          stat = matsDataUtils.sum(thisSubValues);
        } else {
          stat = matsDataUtils.average(thisSubValues);
        }
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataXYCurve. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      if (isCTC) {
        thisSubHit = NaN;
        thisSubFa = NaN;
        thisSubMiss = NaN;
        thisSubCn = NaN;
      } else if (isScalar) {
        thisSubSquareDiffSum = NaN;
        thisSubNSum = NaN;
        thisSubObsModelDiffSum = NaN;
        thisSubModelSum = NaN;
        thisSumObsSum = NaN;
        thisSumAbsSum = NaN;
        thisSubValues = NaN;
      }
      thisSubValues = NaN;
      thisSubSecs = NaN;
      if (hasLevels) {
        thisSubLevs = NaN;
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
      const cyclesMissing =
        Math.ceil(
          (Number(independentVar) - Number(rows[rowIndex - 1].avtime * 1000)) /
            (3600 * 24 * 1000)
        ) - 1;
      const offsetFromMidnight = Math.floor(
        (Number(independentVar) % (24 * 3600 * 1000)) / (3600 * 1000)
      );
      for (let missingIdx = cyclesMissing; missingIdx > 0; missingIdx -= 1) {
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
    subHit.push(thisSubHit);
    subFa.push(thisSubFa);
    subMiss.push(thisSubMiss);
    subCn.push(thisSubCn);
    subSquareDiffSum.push(thisSubSquareDiffSum);
    subNSum.push(thisSubNSum);
    subObsModelDiffSum.push(thisSubObsModelDiffSum);
    subModelSum.push(thisSubModelSum);
    subObsSum.push(thisSumObsSum);
    subAbsSum.push(thisSumAbsSum);
    subVals.push(thisSubValues);
    subSecs.push(thisSubSecs);
    if (hasLevels) {
      subLevs.push(thisSubLevs);
    }
  }

  const nTimesMax = Math.max(...nTimes);
  let sum = 0;
  let indVarMin = Number.MAX_VALUE;
  let indVarMax = -1 * Number.MAX_VALUE;
  let depVarMin = Number.MAX_VALUE;
  let depVarMax = -1 * Number.MAX_VALUE;
  let dIdx;

  for (dIdx = 0; dIdx < curveIndependentVars.length; dIdx += 1) {
    const thisNTimes = nTimes[dIdx];
    // Make sure that we don't have any points with a smaller completeness value than specified by the user.
    if (curveStats[dIdx] === null || thisNTimes < completenessQCParam * nTimesMax) {
      if (!hideGaps) {
        if (plotType === matsTypes.PlotTypes.profile) {
          // profile has the stat first, and then the independent var. The others have independent var and then stat.
          // this is in the pattern of x-plotted-variable, y-plotted-variable.
          returnD.x.push(null);
          returnD.y.push(curveIndependentVars[dIdx]);
          returnD.error_x.push(null); // placeholder
        } else {
          returnD.x.push(curveIndependentVars[dIdx]);
          returnD.y.push(null);
          returnD.error_y.push(null); // placeholder
        }
        returnD.subHit.push(NaN);
        returnD.subFa.push(NaN);
        returnD.subMiss.push(NaN);
        returnD.subCn.push(NaN);
        returnD.subSquareDiffSum.push(NaN);
        returnD.subNSum.push(NaN);
        returnD.subObsModelDiffSum.push(NaN);
        returnD.subModelSum.push(NaN);
        returnD.subObsSum.push(NaN);
        returnD.subAbsSum.push(NaN);
        returnD.subVals.push(NaN);
        returnD.subSecs.push(NaN);
        if (hasLevels) {
          returnD.subLevs.push(NaN);
        }
      }
    } else {
      // there's valid data at this point, so store it
      sum += curveStats[dIdx];
      if (plotType === matsTypes.PlotTypes.profile) {
        // profile has the stat first, and then the independent var. The others have independent var and then stat.
        // this is in the pattern of x-plotted-variable, y-plotted-variable.
        returnD.x.push(curveStats[dIdx]);
        returnD.y.push(curveIndependentVars[dIdx]);
        returnD.error_x.push(null); // placeholder
      } else {
        returnD.x.push(curveIndependentVars[dIdx]);
        returnD.y.push(curveStats[dIdx]);
        returnD.error_y.push(null); // placeholder
      }
      returnD.subHit.push(subHit[dIdx]);
      returnD.subFa.push(subFa[dIdx]);
      returnD.subMiss.push(subMiss[dIdx]);
      returnD.subCn.push(subCn[dIdx]);
      returnD.subSquareDiffSum.push(subSquareDiffSum[dIdx]);
      returnD.subNSum.push(subNSum[dIdx]);
      returnD.subObsModelDiffSum.push(subObsModelDiffSum[dIdx]);
      returnD.subModelSum.push(subModelSum[dIdx]);
      returnD.subObsSum.push(subObsSum[dIdx]);
      returnD.subAbsSum.push(subAbsSum[dIdx]);
      returnD.subVals.push(subVals[dIdx]);
      returnD.subSecs.push(subSecs[dIdx]);
      if (hasLevels) {
        returnD.subLevs.push(subLevs[dIdx]);
      }
      indVarMin =
        curveIndependentVars[dIdx] < indVarMin ? curveIndependentVars[dIdx] : indVarMin;
      indVarMax =
        curveIndependentVars[dIdx] > indVarMax ? curveIndependentVars[dIdx] : indVarMax;
      depVarMin = curveStats[dIdx] < depVarMin ? curveStats[dIdx] : depVarMin;
      depVarMax = curveStats[dIdx] > depVarMax ? curveStats[dIdx] : depVarMax;
    }
  }

  // add in any missing times in the time series
  if (plotType === matsTypes.PlotTypes.timeSeries && !hideGaps) {
    timeInterval *= 1000;
    const dayInMilliSeconds = 24 * 3600 * 1000;
    let lowerIndependentVar;
    let upperIndependentVar;
    let newTime;
    let thisCadence;
    let numberOfDaysBack;
    for (dIdx = curveIndependentVars.length - 2; dIdx >= 0; dIdx -= 1) {
      lowerIndependentVar = curveIndependentVars[dIdx];
      upperIndependentVar = curveIndependentVars[dIdx + 1];
      const cyclesMissing =
        Math.ceil(
          (Number(upperIndependentVar) - Number(lowerIndependentVar)) / timeInterval
        ) - 1;
      for (let missingIdx = cyclesMissing; missingIdx > 0; missingIdx -= 1) {
        newTime = lowerIndependentVar + missingIdx * timeInterval;
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
            returnD = matsDataUtils.addNullPoint(
              returnD,
              dIdx + 1,
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
          returnD = matsDataUtils.addNullPoint(
            returnD,
            dIdx + 1,
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
    returnD.xmin = depVarMin;
    returnD.xmax = depVarMax;
    returnD.ymin = indVarMin;
    returnD.ymax = indVarMax;
  } else {
    returnD.xmin = indVarMin;
    returnD.xmax = indVarMax;
    returnD.ymin = depVarMin;
    returnD.ymax = depVarMax;
  }

  returnD.sum = sum;

  return {
    d: returnD,
    n0,
    nTimes,
  };
};

// this method parses the returned query data for performance diagrams
const parseQueryDataReliability = function (rows, d, appParams, kernel) {
  /*
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      binVals: [],
      hitCount: [],
      fcstCount: [],
      fcstRawCount: [],
      sample_climo: 0,
      n: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subData: [],
      subHeaders: [],
      subRelHit: [],
      subRelRawCount: [],
      subRelCount: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
    };
    */

  const returnD = d;
  const { hasLevels } = appParams;

  // initialize local variables
  const binVals = [];
  const hitCounts = [];
  const fcstCounts = [];
  const fcstRawCounts = [];
  const observedFreqs = [];
  let totalForecastCount = 0;
  const subRelCount = [];
  const subRelRawCount = [];
  const subRelHit = [];
  const subVals = [];
  const subSecs = [];
  const subLevs = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (
      Number(rows[rowIndex].kernel) === 0 &&
      rows[rowIndex].rawfcstcount !== undefined &&
      rows[rowIndex].rawfcstcount !== "NULL"
    ) {
      totalForecastCount += Number(rows[rowIndex].rawfcstcount);
      let subRawCounts = []; // actually raw counts but I'm re-using fields
      // parse the sub-data
      if (rows[rowIndex].sub_data !== undefined && rows[rowIndex].sub_data !== null) {
        try {
          const subData = rows[rowIndex].sub_data.toString().split(",");
          let currSubData;
          for (let sdIdx = 0; sdIdx < subData.length; sdIdx += 1) {
            currSubData = subData[sdIdx].split(";");
            if (hasLevels) {
              subRawCounts.push(Number(currSubData[3]));
            } else {
              subRawCounts.push(Number(currSubData[2]));
            }
          }
        } catch (e) {
          // this is an error produced by a bug in the query function, not an error returned by the mysql database
          e.message = `Error in parseQueryDataReliability. The expected fields don't seem to be present in the results cache: ${e.message}`;
          throw new Error(e.message);
        }
      } else {
        subRawCounts = NaN;
      }
      subRelRawCount.push(subRawCounts);
    }
    if (Number(rows[rowIndex].kernel) === Number(kernel)) {
      const binVal = Number(rows[rowIndex].binValue);
      let hitCount;
      let fcstCount;
      let observedFreq;
      if (
        rows[rowIndex].fcstcount !== undefined &&
        rows[rowIndex].hitcount !== undefined
      ) {
        hitCount =
          rows[rowIndex].hitcount === "NULL" ? null : Number(rows[rowIndex].hitcount);
        fcstCount =
          rows[rowIndex].fcstcount === "NULL" ? null : Number(rows[rowIndex].fcstcount);
        observedFreq = hitCount / fcstCount;
      } else {
        hitCount = null;
        fcstCount = null;
      }
      binVals.push(binVal);
      hitCounts.push(hitCount);
      fcstCounts.push(fcstCount);
      observedFreqs.push(observedFreq);

      let thisSubRelHit = [];
      let subRelCounts = [];
      const thisSubValues = [];
      let thisSubSecs = [];
      let thisSubLevs = [];
      if (
        hitCount !== null &&
        rows[rowIndex].sub_data !== undefined &&
        rows[rowIndex].sub_data !== null
      ) {
        // parse the sub-data
        try {
          const thisSubData = rows[rowIndex].sub_data.toString().split(",");
          let currSubData;
          for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
            currSubData = thisSubData[sdIdx].split(";");
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              subRelCounts.push(Number(currSubData[2]));
              thisSubRelHit.push(Number(currSubData[4]));
              // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
              thisSubValues.push(0);
            } else {
              subRelCounts.push(Number(currSubData[1]));
              thisSubRelHit.push(Number(currSubData[3]));
              // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
              thisSubValues.push(0);
            }
          }
        } catch (e) {
          // this is an error produced by a bug in the query function, not an error returned by the mysql database
          e.message = `Error in parseQueryDataReliability. The expected fields don't seem to be present in the results cache: ${e.message}`;
          throw new Error(e.message);
        }
      } else {
        subRelCounts = NaN;
        thisSubRelHit = NaN;
        thisSubSecs = NaN;
        if (hasLevels) {
          thisSubLevs = NaN;
        }
      }
      subRelCount.push(subRelCounts);
      subRelHit.push(thisSubRelHit);
      subVals.push(thisSubValues);
      subSecs.push(thisSubSecs);
      if (hasLevels) {
        subLevs.push(thisSubLevs);
      }
    }
  }

  const sampleClimo = matsDataUtils.sum(hitCounts) / totalForecastCount;

  returnD.x =
    binVals[binVals.length - 1] === 100
      ? binVals.map((bin) => bin / 100)
      : binVals.map((bin) => bin / 10);
  returnD.y = observedFreqs;
  returnD.binVals = binVals;
  returnD.hitCount = hitCounts;
  returnD.fcstCount = fcstCounts;
  returnD.fcstRawCount = fcstRawCounts;
  returnD.sample_climo = sampleClimo;
  returnD.subRelHit = subRelHit;
  returnD.subRelCount = subRelCount;
  returnD.subRelRawCount = subRelRawCount;
  returnD.subVals = subVals;
  returnD.subSecs = subSecs;
  returnD.subLevs = subLevs;

  let xMin = Number.MAX_VALUE;
  let xMax = -1 * Number.MAX_VALUE;
  let yMin = Number.MAX_VALUE;
  let yMax = -1 * Number.MAX_VALUE;

  for (let didx = 0; didx < binVals.length; didx += 1) {
    xMin = returnD.x[didx] !== null && returnD.x[didx] < xMin ? returnD.x[didx] : xMin;
    xMax = returnD.x[didx] !== null && returnD.x[didx] > xMax ? returnD.x[didx] : xMax;
    yMin = returnD.y[didx] !== null && returnD.y[didx] < yMin ? returnD.y[didx] : yMin;
    yMax = returnD.y[didx] !== null && returnD.y[didx] > yMax ? returnD.y[didx] : yMax;
  }

  returnD.xmin = xMin;
  returnD.xmax = xMax;
  returnD.ymin = yMin;
  returnD.ymax = yMax;
  return {
    d: returnD,
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

  const returnD = d;
  const { hasLevels } = appParams;

  // initialize local variables
  const n0 = [];
  const nTimes = [];
  const successes = [];
  const pods = [];
  const binVals = [];
  const oyAll = [];
  const onAll = [];
  const subHit = [];
  const subFa = [];
  const subMiss = [];
  const subCn = [];
  const subVals = [];
  const subSecs = [];
  const subLevs = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const binVal = Number(rows[rowIndex].binVal);
    let pod;
    let success;
    let oy;
    let on;
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
    n0.push(rows[rowIndex].n0); // number of values that go into a point on the graph
    nTimes.push(rows[rowIndex].nTimes); // number of times that go into a point on the graph
    successes.push(success);
    pods.push(pod);
    binVals.push(binVal);
    oyAll.push(oy);
    onAll.push(on);

    let thisSubHit = [];
    let thisSubFa = [];
    let thisSubMiss = [];
    let thisSubCn = [];
    const thisSubValues = [];
    let thisSubSecs = [];
    let thisSubLevs = [];
    if (
      pod !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          thisSubSecs.push(Number(currSubData[0]));
          if (hasLevels) {
            if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
              thisSubLevs.push(Number(currSubData[1]));
            } else {
              thisSubLevs.push(currSubData[1]);
            }
            thisSubHit.push(Number(currSubData[2]));
            thisSubFa.push(Number(currSubData[3]));
            thisSubMiss.push(Number(currSubData[4]));
            thisSubCn.push(Number(currSubData[5]));
            // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
            thisSubValues.push(0);
          } else {
            thisSubHit.push(Number(currSubData[1]));
            thisSubFa.push(Number(currSubData[2]));
            thisSubMiss.push(Number(currSubData[3]));
            thisSubCn.push(Number(currSubData[4]));
            // this is a dummy to fit the expectations of common functions that xy line curves have a populated sub_values array. It isn't used for anything.
            thisSubValues.push(0);
          }
        }
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataPerformanceDiagram. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    } else {
      thisSubHit = NaN;
      thisSubFa = NaN;
      thisSubMiss = NaN;
      thisSubCn = NaN;
      thisSubSecs = NaN;
      if (hasLevels) {
        thisSubLevs = NaN;
      }
    }
    subHit.push(thisSubHit);
    subFa.push(thisSubFa);
    subMiss.push(thisSubMiss);
    subCn.push(thisSubCn);
    subVals.push(thisSubValues);
    subSecs.push(thisSubSecs);
    if (hasLevels) {
      subLevs.push(thisSubLevs);
    }
  }

  returnD.x = successes;
  returnD.y = pods;
  returnD.binVals = binVals;
  returnD.oy_all = oyAll;
  returnD.on_all = onAll;
  returnD.subHit = subHit;
  returnD.subFa = subFa;
  returnD.subMiss = subMiss;
  returnD.subCn = subCn;
  returnD.subVals = subVals;
  returnD.subSecs = subSecs;
  returnD.subLevs = subLevs;
  returnD.n = n0;

  let successMin = Number.MAX_VALUE;
  let successMax = -1 * Number.MAX_VALUE;
  let podMin = Number.MAX_VALUE;
  let podMax = -1 * Number.MAX_VALUE;

  for (let dIdx = 0; dIdx < binVals.length; dIdx += 1) {
    successMin =
      successes[dIdx] !== null && successes[dIdx] < successMin
        ? successes[dIdx]
        : successMin;
    successMax =
      successes[dIdx] !== null && successes[dIdx] > successMax
        ? successes[dIdx]
        : successMax;
    podMin = podMin[dIdx] !== null && pods[dIdx] < podMin ? pods[dIdx] : podMin;
    podMax = podMin[dIdx] !== null && pods[dIdx] > podMax ? pods[dIdx] : podMax;
  }

  returnD.xmin = successMin;
  returnD.xmax = successMax;
  returnD.ymin = podMin;
  returnD.ymax = podMax;

  return {
    d: returnD,
    n0,
    nTimes,
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

  const returnD = d;
  const { hasLevels } = appParams;

  // initialize local variables
  const n0 = [];
  const nTimes = [];
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
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const binVal = Number(rows[rowIndex].binVal);
    let xStat;
    let yStat;
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
        xStat = matsMethods.isThisANaN(Number(xStat)) ? null : xStat;
        yStat = matsDataUtils.calculateStatScalar(
          squareDiffSumY,
          NSumY,
          obsModelDiffSumY,
          modelSumY,
          obsSumY,
          absSumY,
          statisticYStr
        );
        yStat = matsMethods.isThisANaN(Number(yStat)) ? null : yStat;
      } else {
        xStat = null;
        yStat = null;
      }
    }
    n0.push(rows[rowIndex].n0); // number of values that go into a point on the graph
    nTimes.push(rows[rowIndex].nTimes); // number of times that go into a point on the graph
    binVals.push(binVal);

    let thisSubSquareDiffSumX = [];
    let thisSubNSumX = [];
    let thisSubObsModelDiffSumX = [];
    let thisSubModelSumX = [];
    let thisSubObsSumX = [];
    let thisSubAbsSumX = [];
    let thisSubValuesX = [];
    let thisSubSquareDiffSumY = [];
    let thisSubNSumY = [];
    let thisSubObsModelDiffSumY = [];
    let thisSubModelSumY = [];
    let thisSubObsSumY = [];
    let thisSubAbsSumY = [];
    let thisSubValuesY = [];
    let thisSubSecs = [];
    let thisSubLevs = [];
    if (
      xStat !== null &&
      yStat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          thisSubSecs.push(Number(currSubData[0]));
          if (hasLevels) {
            if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
              thisSubLevs.push(Number(currSubData[1]));
            } else {
              thisSubLevs.push(currSubData[1]);
            }
            thisSubSquareDiffSumX.push(Number(currSubData[2]));
            thisSubNSumX.push(Number(currSubData[3]));
            thisSubObsModelDiffSumX.push(Number(currSubData[4]));
            thisSubModelSumX.push(Number(currSubData[5]));
            thisSubObsSumX.push(Number(currSubData[6]));
            thisSubAbsSumX.push(Number(currSubData[7]));
            thisSubValuesX.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                Number(currSubData[5]),
                Number(currSubData[6]),
                Number(currSubData[7]),
                statisticXStr
              )
            );
            thisSubSquareDiffSumY.push(Number(currSubData[8]));
            thisSubNSumY.push(Number(currSubData[9]));
            thisSubObsModelDiffSumY.push(Number(currSubData[10]));
            thisSubModelSumY.push(Number(currSubData[11]));
            thisSubObsSumY.push(Number(currSubData[12]));
            thisSubAbsSumY.push(Number(currSubData[13]));
            thisSubValuesY.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[8]),
                Number(currSubData[9]),
                Number(currSubData[10]),
                Number(currSubData[11]),
                Number(currSubData[12]),
                Number(currSubData[13]),
                statisticYStr
              )
            );
          } else {
            thisSubSquareDiffSumX.push(Number(currSubData[1]));
            thisSubNSumX.push(Number(currSubData[2]));
            thisSubObsModelDiffSumX.push(Number(currSubData[3]));
            thisSubModelSumX.push(Number(currSubData[4]));
            thisSubObsSumX.push(Number(currSubData[5]));
            thisSubAbsSumX.push(Number(currSubData[6]));
            thisSubValuesX.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[1]),
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                Number(currSubData[5]),
                Number(currSubData[6]),
                statisticXStr
              )
            );
            thisSubSquareDiffSumY.push(Number(currSubData[7]));
            thisSubNSumY.push(Number(currSubData[8]));
            thisSubObsModelDiffSumY.push(Number(currSubData[9]));
            thisSubModelSumY.push(Number(currSubData[10]));
            thisSubObsSumY.push(Number(currSubData[11]));
            thisSubAbsSumY.push(Number(currSubData[12]));
            thisSubValuesY.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[7]),
                Number(currSubData[8]),
                Number(currSubData[9]),
                Number(currSubData[10]),
                Number(currSubData[11]),
                Number(currSubData[12]),
                statisticXStr
              )
            );
          }
        }
        const squareDiffSumX = matsDataUtils.sum(thisSubSquareDiffSumX);
        const NSumX = matsDataUtils.sum(thisSubNSumX);
        const obsModelDiffSumX = matsDataUtils.sum(thisSubObsModelDiffSumX);
        const modelSumX = matsDataUtils.sum(thisSubModelSumX);
        const obsSumX = matsDataUtils.sum(thisSubObsSumX);
        const absSumX = matsDataUtils.sum(thisSubAbsSumX);
        xStat = matsDataUtils.calculateStatScalar(
          squareDiffSumX,
          NSumX,
          obsModelDiffSumX,
          modelSumX,
          obsSumX,
          absSumX,
          statisticXStr
        );
        const squareDiffSumY = matsDataUtils.sum(thisSubSquareDiffSumY);
        const NSumY = matsDataUtils.sum(thisSubNSumY);
        const obsModelDiffSumY = matsDataUtils.sum(thisSubObsModelDiffSumY);
        const modelSumY = matsDataUtils.sum(thisSubModelSumY);
        const obsSumY = matsDataUtils.sum(thisSubObsSumY);
        const absSumY = matsDataUtils.sum(thisSubAbsSumY);
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
      thisSubSquareDiffSumX = NaN;
      thisSubNSumX = NaN;
      thisSubObsModelDiffSumX = NaN;
      thisSubModelSumX = NaN;
      thisSubObsSumX = NaN;
      thisSubAbsSumX = NaN;
      thisSubValuesX = NaN;
      thisSubSquareDiffSumY = NaN;
      thisSubNSumY = NaN;
      thisSubObsModelDiffSumY = NaN;
      thisSubModelSumY = NaN;
      thisSubObsSumY = NaN;
      thisSubAbsSumY = NaN;
      thisSubValuesY = NaN;
      thisSubSecs = NaN;
      if (hasLevels) {
        thisSubLevs = NaN;
      }
    }

    xStats.push(xStat);
    yStats.push(yStat);
    subSquareDiffSumX.push(thisSubSquareDiffSumX);
    subNSumX.push(thisSubNSumX);
    subObsModelDiffSumX.push(thisSubObsModelDiffSumX);
    subModelSumX.push(thisSubModelSumX);
    subObsSumX.push(thisSubObsSumX);
    subAbsSumX.push(thisSubAbsSumX);
    subValsX.push(thisSubValuesX);
    subSquareDiffSumY.push(thisSubSquareDiffSumY);
    subNSumY.push(thisSubNSumY);
    subObsModelDiffSumY.push(thisSubObsModelDiffSumY);
    subModelSumY.push(thisSubModelSumY);
    subObsSumY.push(thisSubObsSumY);
    subAbsSumY.push(thisSubAbsSumY);
    subValsY.push(thisSubValuesY);
    subSecs.push(thisSubSecs);
    if (hasLevels) {
      subLevs.push(thisSubLevs);
    }
  }

  returnD.x = xStats;
  returnD.y = yStats;
  returnD.binVals = binVals;
  returnD.subSquareDiffSumX = subSquareDiffSumX;
  returnD.subNSumX = subNSumX;
  returnD.subObsModelDiffSumX = subObsModelDiffSumX;
  returnD.subModelSumX = subModelSumX;
  returnD.subObsSumX = subObsSumX;
  returnD.subAbsSumX = subAbsSumX;
  returnD.subValsX = subValsX;
  returnD.subSquareDiffSumY = subSquareDiffSumY;
  returnD.subNSumY = subNSumY;
  returnD.subObsModelDiffSumY = subObsModelDiffSumY;
  returnD.subModelSumY = subModelSumY;
  returnD.subObsSumY = subObsSumY;
  returnD.subAbsSumY = subAbsSumY;
  returnD.subValsY = subValsY;
  returnD.subSecs = subSecs;
  returnD.subLevs = subLevs;
  returnD.n = n0;

  let xmin = Number.MAX_VALUE;
  let xmax = -1 * Number.MAX_VALUE;
  let ymin = Number.MAX_VALUE;
  let ymax = -1 * Number.MAX_VALUE;

  for (let dIdx = 0; dIdx < binVals.length; dIdx += 1) {
    xmin = xStats[dIdx] !== null && xStats[dIdx] < xmin ? xStats[dIdx] : xmin;
    xmax = xStats[dIdx] !== null && xStats[dIdx] > xmax ? xStats[dIdx] : xmax;
    ymin = yStats[dIdx] !== null && yStats[dIdx] < ymin ? yStats[dIdx] : ymin;
    ymax = yStats[dIdx] !== null && yStats[dIdx] > ymax ? yStats[dIdx] : ymax;
  }

  returnD.xmin = xmin;
  returnD.xmax = xmax;
  returnD.ymin = ymin;
  returnD.ymax = ymax;

  return {
    d: returnD,
    n0,
    nTimes,
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
  appParams,
  plotParams,
  isCouchbase
) {
  const returnD = d;
  const returnDLowest = dLowest;
  const returnDLow = dLow;
  const returnDModerate = dModerate;
  const returnDHigh = dHigh;
  const returnDHighest = dHighest;

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
    if (
      variable.toLowerCase().includes("rh") ||
      variable.toLowerCase().includes("relative humidity") ||
      variable.toLowerCase().includes("dewpoint") ||
      variable.toLowerCase().includes("dpt") ||
      variable.toLowerCase().includes("td")
    ) {
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
  returnDLowest.color = colorLowest;
  returnDLow.color = colorLow;
  returnDModerate.color = colorModerate;
  returnDHigh.color = colorHigh;
  returnDHighest.color = colorHighest;

  let queryVal;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
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
      queryVal = matsMethods.isThisANaN(Number(queryVal)) ? null : queryVal;
    } else {
      queryVal = null;
    }
    // store sub values to test them for stdev.
    const thisSubSquareDiffSum = [];
    const thisSubNSum = [];
    const thisSubObsModelDiffSum = [];
    const thisSubModelSum = [];
    const thisSubObsSum = [];
    const thisSubAbsSum = [];
    const thisSubValues = [];
    const thisSubSecs = [];
    const thisSubLevs = [];
    let thisSubStdev = 0;
    let thisSubMean = 0;
    let sdLimit = 0;
    if (
      queryVal !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          thisSubSecs.push(Number(currSubData[0]));
          if (hasLevels) {
            if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
              thisSubLevs.push(Number(currSubData[1]));
            } else {
              thisSubLevs.push(currSubData[1]);
            }
            thisSubSquareDiffSum.push(Number(currSubData[2]));
            thisSubNSum.push(Number(currSubData[3]));
            thisSubObsModelDiffSum.push(Number(currSubData[4]));
            thisSubModelSum.push(Number(currSubData[5]));
            thisSubObsSum.push(Number(currSubData[6]));
            thisSubAbsSum.push(Number(currSubData[7]));
            thisSubValues.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                Number(currSubData[5]),
                Number(currSubData[6]),
                Number(currSubData[7]),
                `${statistic}_${variable}`
              )
            );
          } else {
            thisSubSquareDiffSum.push(Number(currSubData[1]));
            thisSubNSum.push(Number(currSubData[2]));
            thisSubObsModelDiffSum.push(Number(currSubData[3]));
            thisSubModelSum.push(Number(currSubData[4]));
            thisSubObsSum.push(Number(currSubData[5]));
            thisSubAbsSum.push(Number(currSubData[6]));
            thisSubValues.push(
              matsDataUtils.calculateStatScalar(
                Number(currSubData[1]),
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                Number(currSubData[5]),
                Number(currSubData[6]),
                `${statistic}_${variable}`
              )
            );
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          thisSubStdev = matsDataUtils.stdev(thisSubValues);
          thisSubMean = matsDataUtils.average(thisSubValues);
          sdLimit = outlierQCParam * thisSubStdev;
          for (let svIdx = thisSubValues.length - 1; svIdx >= 0; svIdx -= 1) {
            if (Math.abs(thisSubValues[svIdx] - thisSubMean) > sdLimit) {
              thisSubSquareDiffSum.splice(svIdx, 1);
              thisSubNSum.splice(svIdx, 1);
              thisSubObsModelDiffSum.splice(svIdx, 1);
              thisSubModelSum.splice(svIdx, 1);
              thisSubObsSum.splice(svIdx, 1);
              thisSubAbsSum.splice(svIdx, 1);
              thisSubValues.splice(svIdx, 1);
              thisSubSecs.splice(svIdx, 1);
              if (hasLevels) {
                thisSubLevs.splice(svIdx, 1);
              }
            }
          }
        }
        const squareDiffSumSum = matsDataUtils.sum(thisSubSquareDiffSum);
        const NSumSum = matsDataUtils.sum(thisSubNSum);
        const obsModelDiffSumSum = matsDataUtils.sum(thisSubObsModelDiffSum);
        const modelSumSum = matsDataUtils.sum(thisSubModelSum);
        const obsSumSum = matsDataUtils.sum(thisSubObsSum);
        const absSumSum = matsDataUtils.sum(thisSubAbsSum);
        queryVal = matsDataUtils.calculateStatScalar(
          squareDiffSumSum,
          NSumSum,
          obsModelDiffSumSum,
          modelSumSum,
          obsSumSum,
          absSumSum,
          `${statistic}_${variable}`
        );
        queryVal = matsMethods.isThisANaN(Number(queryVal)) ? null : queryVal;
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataMapScalar. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
      returnD.queryVal.push(queryVal);
      returnD.stats.push({
        nTimes: rows[rowIndex].nTimes,
        min_time: rows[rowIndex].min_secs,
        max_time: rows[rowIndex].max_secs,
      });

      let thisSite;
      if (isCouchbase) {
        thisSite = siteMap.find((obj) => obj.name === site);
      } else {
        thisSite = siteMap.find((obj) => obj.options.id === site);
      }

      const tooltips =
        `${thisSite.origName}<br>${variable} ${statistic}<br>` +
        `model: ${dataSource}<br>` +
        `stat: ${queryVal} ${varUnits}<br>` +
        `n: ${rows[rowIndex].n0}`;
      returnD.text.push(tooltips);
      returnD.siteName.push(thisSite.origName);
      returnD.lat.push(thisSite.point[0]);
      returnD.lon.push(thisSite.point[1]);
      returnD.color.push("rgb(125,125,125)"); // dummy
    }
  }
  // get stdev threshold at which to exclude entire points
  let filteredValues = returnD.queryVal.filter((x) => x || x === 0);
  const allMean = matsDataUtils.average(filteredValues);
  const allStdev = matsDataUtils.stdev(filteredValues);
  let allSdLimit;
  if (outlierQCParam !== "all") {
    allSdLimit = outlierQCParam * allStdev;
  }

  for (let didx = returnD.queryVal.length - 1; didx >= 0; didx -= 1) {
    queryVal = returnD.queryVal[didx];
    if (outlierQCParam !== "all" && Math.abs(queryVal - allMean) > allSdLimit) {
      // this point is too far from the mean. Exclude it.
      returnD.queryVal.splice(didx, 1);
      returnD.stats.splice(didx, 1);
      returnD.text.splice(didx, 1);
      returnD.siteName.splice(didx, 1);
      returnD.lat.splice(didx, 1);
      returnD.lon.splice(didx, 1);
      returnD.color.splice(didx, 1);
    }
  }

  // get range of values for colorscale, eliminating the highest and lowest as outliers
  filteredValues = returnD.queryVal.filter((x) => x || x === 0);
  filteredValues = filteredValues.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  const limitType = plotParams["map-range-controls"];
  if (limitType === undefined || limitType === "Default range") {
    highLimit = filteredValues[Math.floor(filteredValues.length * 0.98)];
    lowLimit = filteredValues[Math.floor(filteredValues.length * 0.02)];
  } else {
    highLimit = Number(plotParams["map-high-limit"]);
    lowLimit = Number(plotParams["map-low-limit"]);
  }

  const maxValue =
    Math.abs(highLimit) > Math.abs(lowLimit) ? Math.abs(highLimit) : Math.abs(lowLimit);
  if (statistic === "Bias (Model - Obs)") {
    // bias colorscale needs to be symmetrical around 0
    highLimit = maxValue;
    lowLimit = -1 * maxValue;
  }

  for (let didx = 0; didx < returnD.queryVal.length - 1; didx += 1) {
    queryVal = returnD.queryVal[didx];
    let textMarker;
    if (variable.includes("2m") || variable.includes("10m")) {
      textMarker = queryVal === null ? "" : queryVal.toFixed(0);
    } else {
      textMarker = queryVal === null ? "" : queryVal.toFixed(1);
    }
    // sort the data by the color it will appear on the map
    if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.2) {
      returnD.color[didx] = colorLowest;
      returnDLowest.siteName.push(returnD.siteName[didx]);
      returnDLowest.queryVal.push(queryVal);
      returnDLowest.text.push(textMarker);
      returnDLowest.lat.push(returnD.lat[didx]);
      returnDLowest.lon.push(returnD.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.4) {
      returnD.color[didx] = colorLow;
      returnDLow.siteName.push(returnD.siteName[didx]);
      returnDLow.queryVal.push(queryVal);
      returnDLow.text.push(textMarker);
      returnDLow.lat.push(returnD.lat[didx]);
      returnDLow.lon.push(returnD.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.6) {
      returnD.color[didx] = colorModerate;
      returnDModerate.siteName.push(returnD.siteName[didx]);
      returnDModerate.queryVal.push(queryVal);
      returnDModerate.text.push(textMarker);
      returnDModerate.lat.push(returnD.lat[didx]);
      returnDModerate.lon.push(returnD.lon[didx]);
    } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.8) {
      returnD.color[didx] = colorHigh;
      returnDHigh.siteName.push(returnD.siteName[didx]);
      returnDHigh.queryVal.push(queryVal);
      returnDHigh.text.push(textMarker);
      returnDHigh.lat.push(returnD.lat[didx]);
      returnDHigh.lon.push(returnD.lon[didx]);
    } else {
      returnD.color[didx] = colorHighest;
      returnDHighest.siteName.push(returnD.siteName[didx]);
      returnDHighest.queryVal.push(queryVal);
      returnDHighest.text.push(textMarker);
      returnDHighest.lat.push(returnD.lat[didx]);
      returnDHighest.lon.push(returnD.lon[didx]);
    }
  } // end of loop row

  return {
    d: returnD,
    dLowest: returnDLowest,
    dLow: returnDLow,
    dModerate: returnDModerate,
    dHigh: returnDHigh,
    dHighest: returnDHighest,
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
  appParams,
  isCouchbase
) {
  const returnD = d;
  const returnDPurple = dPurple;
  const returnDPurpleBlue = dPurpleBlue;
  const returnDBlue = dBlue;
  const returnDBlueGreen = dBlueGreen;
  const returnDGreen = dGreen;
  const returnDGreenYellow = dGreenYellow;
  const returnDYellow = dYellow;
  const returnDOrange = dOrange;
  const returnDOrangeRed = dOrangeRed;
  const returnDRed = dRed;

  const { hasLevels } = appParams;
  let highLimit = 100;
  let lowLimit = -100;
  const outlierQCParam =
    appParams.outliers !== "all" ? Number(appParams.outliers) : appParams.outliers;

  let queryVal;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const site = rows[rowIndex].sta_id;
    const hit = Number(rows[rowIndex].hit);
    const fa = Number(rows[rowIndex].fa);
    const miss = Number(rows[rowIndex].miss);
    const cn = Number(rows[rowIndex].cn);
    const n = rows[rowIndex].nTimes;
    if (hit + fa + miss + cn > 0) {
      queryVal = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, n, statistic);
      queryVal = matsMethods.isThisANaN(Number(queryVal)) ? null : queryVal;
      switch (statistic) {
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
        case "TSS (True Skill Score)":
        case "HSS (Heidke Skill Score)":
        default:
          lowLimit = -100;
          highLimit = 100;
          break;
      }
    } else {
      queryVal = null;
    }

    // store sub values to test them for stdev.
    const thisSubHit = [];
    const thisSubFa = [];
    const thisSubMiss = [];
    const thisSubCn = [];
    const thisSubValues = [];
    const thisSubSecs = [];
    const thisSubLevs = [];
    let thisSubStdev = 0;
    let thisSubMean = 0;
    let sdLimit = 0;
    if (
      queryVal !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          thisSubSecs.push(Number(currSubData[0]));
          if (hasLevels) {
            if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
              thisSubLevs.push(Number(currSubData[1]));
            } else {
              thisSubLevs.push(currSubData[1]);
            }
            thisSubHit.push(Number(currSubData[2]));
            thisSubFa.push(Number(currSubData[3]));
            thisSubMiss.push(Number(currSubData[4]));
            thisSubCn.push(Number(currSubData[5]));
            thisSubValues.push(
              matsDataUtils.calculateStatCTC(
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                Number(currSubData[5]),
                currSubData.length,
                statistic
              )
            );
          } else {
            thisSubHit.push(Number(currSubData[1]));
            thisSubFa.push(Number(currSubData[2]));
            thisSubMiss.push(Number(currSubData[3]));
            thisSubCn.push(Number(currSubData[4]));
            thisSubValues.push(
              matsDataUtils.calculateStatCTC(
                Number(currSubData[1]),
                Number(currSubData[2]),
                Number(currSubData[3]),
                Number(currSubData[4]),
                currSubData.length,
                statistic
              )
            );
          }
        }
        // Now that we have all the sub-values, we can get the standard deviation and remove the ones that exceed it
        if (outlierQCParam !== "all") {
          thisSubStdev = matsDataUtils.stdev(thisSubValues);
          thisSubMean = matsDataUtils.average(thisSubValues);
          sdLimit = outlierQCParam * thisSubStdev;
          for (let svIdx = thisSubValues.length - 1; svIdx >= 0; svIdx -= 1) {
            if (Math.abs(thisSubValues[svIdx] - thisSubMean) > sdLimit) {
              thisSubHit.splice(svIdx, 1);
              thisSubFa.splice(svIdx, 1);
              thisSubMiss.splice(svIdx, 1);
              thisSubCn.splice(svIdx, 1);
              thisSubValues.splice(svIdx, 1);
              thisSubSecs.splice(svIdx, 1);
              if (hasLevels) {
                thisSubLevs.splice(svIdx, 1);
              }
            }
          }
        }
        const hitSum = matsDataUtils.sum(thisSubHit);
        const faSum = matsDataUtils.sum(thisSubFa);
        const missSum = matsDataUtils.sum(thisSubMiss);
        const cnSum = matsDataUtils.sum(thisSubCn);
        queryVal = matsDataUtils.calculateStatCTC(
          hitSum,
          faSum,
          missSum,
          cnSum,
          thisSubHit.length,
          statistic
        );
        queryVal = matsMethods.isThisANaN(Number(queryVal)) ? null : queryVal;
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataMapCTC. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
      returnD.queryVal.push(queryVal);
      returnD.stats.push({
        nTimes: rows[rowIndex].nTimes,
        min_time: rows[rowIndex].min_secs,
        max_time: rows[rowIndex].max_secs,
        hit: rows[rowIndex].hit,
        fa: rows[rowIndex].fa,
        miss: rows[rowIndex].miss,
        cn: rows[rowIndex].cn,
      });

      let thisSite;
      if (isCouchbase) {
        thisSite = siteMap.find((obj) => obj.name === site);
      } else {
        thisSite = siteMap.find((obj) => obj.options.id === site);
      }

      const tooltips =
        `${thisSite.origName}<br>` +
        `model: ${dataSource}<br>${statistic}: ${queryVal}<br>` +
        `n: ${rows[rowIndex].nTimes}<br>` +
        `hits: ${rows[rowIndex].hit}<br>` +
        `false alarms: ${rows[rowIndex].fa}<br>` +
        `misses: ${rows[rowIndex].miss}<br>` +
        `correct nulls: ${rows[rowIndex].cn}`;
      returnD.text.push(tooltips);
      returnD.siteName.push(thisSite.origName);
      returnD.lat.push(thisSite.point[0]);
      returnD.lon.push(thisSite.point[1]);

      // sort the data by the color it will appear on the map
      const textMarker = queryVal === null ? "" : queryVal.toFixed(0);
      if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.1) {
        returnD.color.push("rgb(128,0,255)");
        returnDPurple.siteName.push(thisSite.origName);
        returnDPurple.queryVal.push(queryVal);
        returnDPurple.text.push(textMarker);
        returnDPurple.lat.push(thisSite.point[0]);
        returnDPurple.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.2) {
        returnD.color.push("rgb(64,0,255)");
        returnDPurpleBlue.siteName.push(thisSite.origName);
        returnDPurpleBlue.queryVal.push(queryVal);
        returnDPurpleBlue.text.push(textMarker);
        returnDPurpleBlue.lat.push(thisSite.point[0]);
        returnDPurpleBlue.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.3) {
        returnD.color.push("rgb(0,0,255)");
        returnDBlue.siteName.push(thisSite.origName);
        returnDBlue.queryVal.push(queryVal);
        returnDBlue.text.push(textMarker);
        returnDBlue.lat.push(thisSite.point[0]);
        returnDBlue.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.4) {
        returnD.color.push("rgb(64,128,128)");
        returnDBlueGreen.siteName.push(thisSite.origName);
        returnDBlueGreen.queryVal.push(queryVal);
        returnDBlueGreen.text.push(textMarker);
        returnDBlueGreen.lat.push(thisSite.point[0]);
        returnDBlueGreen.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.5) {
        returnD.color.push("rgb(128,255,0)");
        returnDGreen.siteName.push(thisSite.origName);
        returnDGreen.queryVal.push(queryVal);
        returnDGreen.text.push(textMarker);
        returnDGreen.lat.push(thisSite.point[0]);
        returnDGreen.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.6) {
        returnD.color.push("rgb(160,224,0)");
        returnDGreenYellow.siteName.push(thisSite.origName);
        returnDGreenYellow.queryVal.push(queryVal);
        returnDGreenYellow.text.push(textMarker);
        returnDGreenYellow.lat.push(thisSite.point[0]);
        returnDGreenYellow.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.7) {
        returnD.color.push("rgb(192,192,0)");
        returnDYellow.siteName.push(thisSite.origName);
        returnDYellow.queryVal.push(queryVal);
        returnDYellow.text.push(textMarker);
        returnDYellow.lat.push(thisSite.point[0]);
        returnDYellow.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.8) {
        returnD.color.push("rgb(255,128,0)");
        returnDOrange.siteName.push(thisSite.origName);
        returnDOrange.queryVal.push(queryVal);
        returnDOrange.text.push(textMarker);
        returnDOrange.lat.push(thisSite.point[0]);
        returnDOrange.lon.push(thisSite.point[1]);
      } else if (queryVal <= lowLimit + (highLimit - lowLimit) * 0.9) {
        returnD.color.push("rgb(255,64,0)");
        returnDOrangeRed.siteName.push(thisSite.origName);
        returnDOrangeRed.queryVal.push(queryVal);
        returnDOrangeRed.text.push(textMarker);
        returnDOrangeRed.lat.push(thisSite.point[0]);
        returnDOrangeRed.lon.push(thisSite.point[1]);
      } else {
        returnD.color.push("rgb(255,0,0)");
        returnDRed.siteName.push(thisSite.origName);
        returnDRed.queryVal.push(queryVal);
        returnDRed.text.push(textMarker);
        returnDRed.lat.push(thisSite.point[0]);
        returnDRed.lon.push(thisSite.point[1]);
      }
    }
  } // end of loop row

  return {
    d: returnD,
    dPurple: returnDPurple,
    dPurpleBlue: returnDPurpleBlue,
    dBlue: returnDBlue,
    dBlueGreen: returnDBlue,
    dGreen: returnDGreen,
    dGreenYellow: returnDGreenYellow,
    dYellow: returnDYellow,
    dOrange: returnDOrange,
    dOrangeRed: returnDOrangeRed,
    dRed: returnDRed,
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
  const returnD = d;
  const { hasLevels } = appParams;
  let isCTC = false;
  let isScalar = false;

  // these arrays hold all the sub values and seconds (and levels) until they are sorted into bins
  const curveSubStatsRaw = [];
  const curveSubSecsRaw = [];
  const curveSubLevsRaw = [];

  // parse the data returned from the query
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let stat;
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
      } else {
        stat = null;
      }
    } else {
      // not a contingency table plot or a scalar partial sums plot
      stat = rows[rowIndex].stat === "NULL" ? null : rows[rowIndex].stat;
    }
    const thisSubStats = [];
    const thisSubSecs = [];
    const thisSubLevs = [];
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          if (isCTC) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubStats.push(
                matsDataUtils.calculateStatCTC(
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  1,
                  statisticStr
                )
              );
            } else {
              thisSubStats.push(
                matsDataUtils.calculateStatCTC(
                  Number(currSubData[1]),
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  1,
                  statisticStr
                )
              );
            }
          } else if (isScalar) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubStats.push(
                matsDataUtils.calculateStatScalar(
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  Number(currSubData[6]),
                  Number(currSubData[7]),
                  statisticStr
                )
              );
            } else {
              thisSubStats.push(
                matsDataUtils.calculateStatScalar(
                  Number(currSubData[1]),
                  Number(currSubData[2]),
                  Number(currSubData[3]),
                  Number(currSubData[4]),
                  Number(currSubData[5]),
                  Number(currSubData[6]),
                  statisticStr
                )
              );
            }
          } else {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubStats.push(Number(currSubData[2]));
            } else {
              thisSubStats.push(Number(currSubData[1]));
            }
          }
        }
        curveSubStatsRaw.push(thisSubStats);
        curveSubSecsRaw.push(thisSubSecs);
        curveSubLevsRaw.push(thisSubLevs);
      } catch (e) {
        // this is an error produced by a bug in the query function, not an error returned by the mysql database
        e.message = `Error in parseQueryDataHistogram. The expected fields don't seem to be present in the results cache: ${e.message}`;
        throw new Error(e.message);
      }
    }
  }

  // we don't have bins yet, so we want all of the data in one array
  const subVals =
    curveSubStatsRaw.length > 0
      ? curveSubStatsRaw.reduce(function (a, b) {
          return a.concat(b);
        })
      : [];
  const subSecs =
    curveSubSecsRaw.length > 0
      ? curveSubSecsRaw.reduce(function (a, b) {
          return a.concat(b);
        })
      : [];
  let subLevs;
  if (hasLevels) {
    subLevs =
      curveSubLevsRaw.length > 0
        ? curveSubLevsRaw.reduce(function (a, b) {
            return a.concat(b);
          })
        : [];
  }

  returnD.subVals = subVals;
  returnD.subSecs = subSecs;
  returnD.subLevs = subLevs;

  return {
    d: returnD,
    n0: subVals.length,
    nTimes: subSecs.length,
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
  const returnD = d;
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
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowXVal = Number(rows[rowIndex].xVal);
    const rowYVal = Number(rows[rowIndex].yVal);
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
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
        stat = matsMethods.isThisANaN(Number(stat)) ? null : stat;
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
    let thisSubHit = [];
    let thisSubFa = [];
    let thisSubMiss = [];
    let thisSubCn = [];
    let thisSubSquareDiffSum = [];
    let thisSubNSum = [];
    let thisSubObsModelDiffSum = [];
    let thisSubModelSum = [];
    let thisSubObsSum = [];
    let thisSubAbsSum = [];
    let thisSubValues = [];
    let thisSubSecs = [];
    let thisSubLevs = [];
    if (
      stat !== null &&
      rows[rowIndex].sub_data !== undefined &&
      rows[rowIndex].sub_data !== null
    ) {
      // parse the sub-data
      try {
        const thisSubData = rows[rowIndex].sub_data.toString().split(",");
        let currSubData;
        for (let sdIdx = 0; sdIdx < thisSubData.length; sdIdx += 1) {
          currSubData = thisSubData[sdIdx].split(";");
          if (isCTC) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubHit.push(Number(currSubData[2]));
              thisSubFa.push(Number(currSubData[3]));
              thisSubMiss.push(Number(currSubData[4]));
              thisSubCn.push(Number(currSubData[5]));
            } else {
              thisSubHit.push(Number(currSubData[1]));
              thisSubFa.push(Number(currSubData[2]));
              thisSubMiss.push(Number(currSubData[3]));
              thisSubCn.push(Number(currSubData[4]));
            }
          } else if (isScalar) {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubSquareDiffSum.push(Number(currSubData[2]));
              thisSubNSum.push(Number(currSubData[3]));
              thisSubObsModelDiffSum.push(Number(currSubData[4]));
              thisSubModelSum.push(Number(currSubData[5]));
              thisSubObsSum.push(Number(currSubData[6]));
              thisSubAbsSum.push(Number(currSubData[7]));
            } else {
              thisSubSquareDiffSum.push(Number(currSubData[1]));
              thisSubNSum.push(Number(currSubData[2]));
              thisSubObsModelDiffSum.push(Number(currSubData[3]));
              thisSubModelSum.push(Number(currSubData[4]));
              thisSubObsSum.push(Number(currSubData[5]));
              thisSubAbsSum.push(Number(currSubData[6]));
            }
          } else {
            thisSubSecs.push(Number(currSubData[0]));
            if (hasLevels) {
              if (!matsMethods.isThisANaN(Number(currSubData[1]))) {
                thisSubLevs.push(Number(currSubData[1]));
              } else {
                thisSubLevs.push(currSubData[1]);
              }
              thisSubValues.push(Number(currSubData[2]));
            } else {
              thisSubValues.push(Number(currSubData[1]));
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
        thisSubHit = NaN;
        thisSubFa = NaN;
        thisSubMiss = NaN;
        thisSubCn = NaN;
      } else if (isScalar) {
        thisSubSquareDiffSum = NaN;
        thisSubNSum = NaN;
        thisSubObsModelDiffSum = NaN;
        thisSubModelSum = NaN;
        thisSubObsSum = NaN;
        thisSubAbsSum = NaN;
      } else {
        thisSubValues = NaN;
      }
      thisSubSecs = NaN;
      if (hasLevels) {
        thisSubLevs = NaN;
      }
    }
    // store flat arrays of all the parsed data, used by the text output and for some calculations later
    returnD.xTextOutput.push(rowXVal);
    returnD.yTextOutput.push(rowYVal);
    returnD.zTextOutput.push(stat);
    returnD.nTextOutput.push(n);
    returnD.hitTextOutput.push(hit);
    returnD.faTextOutput.push(fa);
    returnD.missTextOutput.push(miss);
    returnD.cnTextOutput.push(cn);
    returnD.squareDiffSumTextOutput.push(squareDiffSum);
    returnD.NSumTextOutput.push(NSum);
    returnD.obsModelDiffSumTextOutput.push(obsModelDiffSum);
    returnD.modelSumTextOutput.push(modelSum);
    returnD.obsSumTextOutput.push(obsSum);
    returnD.absSumTextOutput.push(absSum);
    returnD.minDateTextOutput.push(minDate);
    returnD.maxDateTextOutput.push(maxDate);
    curveStatLookup[statKey] = stat;
    curveStdevLookup[statKey] = stdev;
    curveNLookup[statKey] = n;
    if (isCTC) {
      curveSubHitLookup[statKey] = thisSubHit;
      curveSubFaLookup[statKey] = thisSubFa;
      curveSubMissLookup[statKey] = thisSubMiss;
      curveSubCnLookup[statKey] = thisSubCn;
    } else if (isScalar) {
      curveSubSquareDiffSumLookup[statKey] = thisSubSquareDiffSum;
      curveSubNSumLookup[statKey] = thisSubNSum;
      curveSubObsModelDiffSumLookup[statKey] = thisSubObsModelDiffSum;
      curveSubModelSumLookup[statKey] = thisSubModelSum;
      curveSubObsSumLookup[statKey] = thisSubObsSum;
      curveSubAbsSumLookup[statKey] = thisSubAbsSum;
    } else {
      curveSubValLookup[statKey] = thisSubValues;
    }
    curveSubSecLookup[statKey] = thisSubSecs;
    if (hasLevels) {
      curveSubLevLookup[statKey] = thisSubLevs;
    }
  }

  // get the unique x and y values and sort the stats into the 2D z array accordingly
  returnD.x = matsDataUtils.arrayUnique(returnD.xTextOutput).sort(function (a, b) {
    return a - b;
  });
  returnD.y = matsDataUtils.arrayUnique(returnD.yTextOutput).sort(function (a, b) {
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

  for (j = 0; j < returnD.y.length; j += 1) {
    currY = returnD.y[j];
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
    for (i = 0; i < returnD.x.length; i += 1) {
      currX = returnD.x[i];
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
    returnD.z.push(currYStatArray);
    returnD.stdev.push(currYStdevArray);
    returnD.n.push(currYNArray);
    if (isCTC) {
      returnD.subHit.push(currYSubHitArray);
      returnD.subFa.push(currYSubFaArray);
      returnD.subMiss.push(currYSubMissArray);
      returnD.subCn.push(currYSubCnArray);
    } else if (isScalar) {
      returnD.subSquareDiffSum.push(currYSubSquareDiffSumArray);
      returnD.subNSum.push(currYSubNSumArray);
      returnD.subObsModelDiffSum.push(currYSubObsModelDiffSumArray);
      returnD.subModelSum.push(currYSubModelSumArray);
      returnD.subObsSum.push(currYSubObsSumArray);
      returnD.subAbsSum.push(currYSubAbsSumArray);
    } else {
      returnD.subVals.push(currYSubValArray);
    }
    returnD.subSecs.push(currYSubSecArray);
    if (hasLevels) {
      returnD.subLevs.push(currYSubLevArray);
    }
  }

  // calculate statistics
  [returnD.xmin] = returnD.x;
  returnD.xmax = returnD.x[returnD.x.length - 1];
  [returnD.ymin] = returnD.y;
  returnD.ymax = returnD.y[returnD.y.length - 1];
  returnD.zmin = zmin;
  returnD.zmax = zmax;
  returnD.sum = sum;

  const filteredMinDate = returnD.minDateTextOutput.filter((t) => t || t === 0);
  const filteredMaxDate = returnD.maxDateTextOutput.filter((t) => t || t === 0);
  returnD.glob_stats.mean = sum / nPoints;
  returnD.glob_stats.minDate = Math.min(...filteredMinDate);
  returnD.glob_stats.maxDate = Math.max(...filteredMaxDate);
  returnD.glob_stats.n = nPoints;

  return {
    d: returnD,
  };
};

// this method queries the database for timeseries plots
const queryDBTimeSeries = async function (
  pool,
  statementOrMwRows,
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
    let theseValidTimes = validTimes;
    if (theseValidTimes.length > 0 && theseValidTimes !== matsTypes.InputTypes.unused) {
      if (typeof theseValidTimes === "string" || theseValidTimes instanceof String) {
        theseValidTimes = theseValidTimes.split(",");
      }
      let vtCycles = theseValidTimes.map(function (x) {
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
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
      glob_stats: {},
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let n0 = [];
    let nTimes = [];
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBTimeSeries' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      let rows = null;
      if (Array.isArray(statementOrMwRows)) {
        rows = statementOrMwRows;
      } else {
        rows = await pool.queryCB(statementOrMwRows);
      }
      if (error.length === 0) {
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
          n0 = parsedData.n0;
          nTimes = parsedData.nTimes;
        }
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    }
    // if this app isn't couchbase, use mysql
    pool.query(statementOrMwRows, function (err, rows) {
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
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    });
  }
  return null;
};

// this method queries the database for specialty curves such as profiles, dieoffs, threshold plots, valid time plots, grid scale plots, and histograms
const queryDBSpecialtyCurve = async function (
  pool,
  statementOrMwRows,
  appParams,
  statisticStr
) {
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
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
      glob_stats: {},
      bin_stats: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };
    let error = "";
    let n0 = [];
    let nTimes = [];
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSpecialtyCurve' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
      */
      let rows = null;
      if (Array.isArray(statementOrMwRows)) {
        rows = statementOrMwRows;
      } else {
        rows = await pool.queryCB(statementOrMwRows);
      }
      if (error.length === 0) {
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
          n0 = parsedData.n0;
          nTimes = parsedData.nTimes;
        }
      }
      // if we have only null values, return a no data found
      if (appParams.plotType !== matsTypes.PlotTypes.histogram) {
        if (
          d.x.length > 0 &&
          d.y.length > 0 &&
          !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
        ) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        }
      } else if (d.subVals.length > 0 && !d.subVals.some((el) => el !== null)) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    }
    // if this app isn't couchbase, use mysql
    pool.query(statementOrMwRows, function (err, rows) {
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
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (appParams.plotType !== matsTypes.PlotTypes.histogram) {
        if (
          d.x.length > 0 &&
          d.y.length > 0 &&
          !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
        ) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        }
      } else if (d.subVals.length > 0 && !d.subVals.some((el) => el !== null)) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }

      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    });
  }
  return null;
};

// this method queries the database for performance diagrams
const queryDBReliability = async function (pool, statement, appParams, kernel) {
  if (Meteor.isServer) {
    let d = {
      // d will contain the curve data
      x: [],
      y: [],
      binVals: [],
      hitCount: [],
      fcstCount: [],
      fcstRawCount: [],
      sample_climo: 0,
      n: [],
      subHit: [],
      subFa: [],
      subMiss: [],
      subCn: [],
      subData: [],
      subHeaders: [],
      subRelHit: [],
      subRelRawCount: [],
      subRelCount: [],
      subVals: [],
      subSecs: [],
      subLevs: [],
      stats: [],
      text: [],
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
    };
    let error = "";
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBReliability' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      const rows = await pool.queryCB(statement);
      if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else if (rows.includes("queryCB ERROR: ")) {
        error = rows;
      } else {
        parsedData = parseQueryDataReliability(rows, d, appParams, kernel);
        d = parsedData.d;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
      };
    }
    // if this app isn't couchbase, use mysql
    pool.query(statement, function (err, rows) {
      // query callback - build the curve data from the results - or set an error
      if (err !== undefined && err !== null) {
        error = err.message;
      } else if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else {
        parsedData = parseQueryDataReliability(rows, d, appParams, kernel);
        d = parsedData.d;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }

      return {
        data: d,
        error,
      };
    });
  }
  return null;
};

// this method queries the database for performance diagrams
const queryDBPerformanceDiagram = async function (pool, statement, appParams) {
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
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
    };
    let error = "";
    let n0 = [];
    let nTimes = [];
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSPerformanceDiagram' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      const rows = await pool.queryCB(statement);
      if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else if (rows.includes("queryCB ERROR: ")) {
        error = rows;
      } else {
        parsedData = parseQueryDataPerformanceDiagram(rows, d, appParams);
        d = parsedData.d;
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    }
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
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    });
  }
  return null;
};

// this method queries the database for performance diagrams
const queryDBSimpleScatter = async function (
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
    let n0 = [];
    let nTimes = [];
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSPerformanceDiagram' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
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
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    }
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
        n0 = parsedData.n0;
        nTimes = parsedData.nTimes;
      }
      // if we have only null values, return a no data found
      if (
        d.x.length > 0 &&
        d.y.length > 0 &&
        !(d.x.some((el) => el !== null) && d.y.some((el) => el !== null))
      ) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
        n0,
        nTimes,
      };
    });
  }
  return null;
};

// this method queries the database for map plots
const queryDBMapScalar = async function (
  pool,
  statementOrMwRows,
  dataSource,
  statistic,
  variable,
  varUnits,
  siteMap,
  appParams,
  plotParams
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
    let parsedData;

    if (
      (await matsCollections.Settings.findOneAsync()).dbType ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSpecialtyCurve' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
      */
      let rows = null;
      if (Array.isArray(statementOrMwRows)) {
        rows = statementOrMwRows;
      } else {
        rows = await pool.queryCB(statementOrMwRows);
      }
      if (error.length === 0) {
        if (rows === undefined || rows === null || rows.length === 0) {
          error = matsTypes.Messages.NO_DATA_FOUND;
        } else if (rows.includes("queryCB ERROR: ")) {
          error = rows;
        } else {
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
            appParams,
            plotParams,
            true
          );
          d = parsedData.d;
          dLowest = parsedData.dLowest;
          dLow = parsedData.dLow;
          dModerate = parsedData.dModerate;
          dHigh = parsedData.dHigh;
          dHighest = parsedData.dHighest;
          valueLimits = parsedData.valueLimits;
        }
      }
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
    // if this app isn't couchbase, use mysql
    pool.query(statementOrMwRows, function (err, rows) {
      // query callback - build the curve data from the results - or set an error
      if (err !== undefined && err !== null) {
        error = err.message;
      } else if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else {
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
          appParams,
          plotParams,
          false
        );
        d = parsedData.d;
        dLowest = parsedData.dLowest;
        dLow = parsedData.dLow;
        dModerate = parsedData.dModerate;
        dHigh = parsedData.dHigh;
        dHighest = parsedData.dHighest;
        valueLimits = parsedData.valueLimits;
      }
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
    });
  }
  return null;
};

// helper method for function below
const runMultipleQueries = async function (
  pool,
  statement,
  querySites,
  error,
  allRows
) {
  if (querySites.length > 0) {
    const querySite = querySites[0];
    const thisStatement = statement
      .toString()
      .replace(/{{siteName}}/g, querySite.name)
      .replace(/{{siteID}}/g, querySite.id);

    pool.query(thisStatement, function (err, rows) {
      // query callback - build the curve data from the results - or set an error
      if (err !== undefined && err !== null) {
        // eslint-disable-next-line no-param-reassign
        error = err.message;
      } else {
        allRows.push(rows[0]);
        runMultipleQueries(
          pool,
          statement,
          querySites.filter((x, y) => y !== 0),
          error,
          allRows
        );
      }
    });
  }
};

// this method queries the database for map plots, in a loop with one query per station
const queryDBMapScalarLoop = function (
  pool,
  statement,
  dataSource,
  statistic,
  variable,
  varUnits,
  querySites,
  appParams,
  plotParams
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
    let parsedData;
    const allRows = [];
    let error = "";

    (async () => {
      await runMultipleQueries(pool, statement, querySites, error, allRows);
    })().catch((err) => {
      error = err.message;
    });

    if (error.length === 0) {
      if (allRows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else {
        parsedData = parseQueryDataMapScalar(
          allRows,
          d,
          dLowest,
          dLow,
          dModerate,
          dHigh,
          dHighest,
          dataSource,
          querySites,
          statistic,
          variable,
          varUnits,
          appParams,
          plotParams,
          true
        );
        d = parsedData.d;
        dLowest = parsedData.dLowest;
        dLow = parsedData.dLow;
        dModerate = parsedData.dModerate;
        dHigh = parsedData.dHigh;
        dHighest = parsedData.dHighest;
        valueLimits = parsedData.valueLimits;
      }
    }

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
  return null;
};

// this method queries the database for map plots in CTC apps
const queryDBMapCTC = async function (
  pool,
  statementOrMwRows,
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

    if (
      (await matsCollections.Settings.findOneAsync().dbType) ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBSpecialtyCurve' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
      */
      let rows = null;
      if (Array.isArray(statementOrMwRows)) {
        rows = statementOrMwRows;
      } else {
        rows = await pool.queryCB(statementOrMwRows);
      }
      if (error.length === 0) {
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
            appParams,
            true
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
      }
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
    // if this app isn't couchbase, use mysql
    pool.query(statementOrMwRows, function (err, rows) {
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
          appParams,
          false
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
    });
  }
  return null;
};

// this method queries the database for contour plots
const queryDBContour = async function (pool, statement, appParams, statisticStr) {
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
      nForecast: [],
      nMatched: [],
      nSimple: [],
      nTotal: [],
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

    if (
      (await matsCollections.Settings.findOneAsync().dbType) ===
      matsTypes.DbTypes.couchbase
    ) {
      /*
            we have to call the couchbase utilities as async functions but this
            routine 'queryDBContour' cannot itself be async because the graph page needs to wait
            for its result, so we use an anonymous async() function here to wrap the queryCB call
            */
      const rows = await pool.queryCB(statement);
      if (rows === undefined || rows === null || rows.length === 0) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else if (rows.includes("queryCB ERROR: ")) {
        error = rows;
      } else {
        parsedData = parseQueryDataContour(rows, d, appParams, statisticStr);
        d = parsedData.d;
      }
      // if we have only null values, return a no data found
      if (d.z.length > 0 && !d.z.some((el) => el !== null)) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
      };
    }
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
      // if we have only null values, return a no data found
      if (d.z.length > 0 && !d.z.some((el) => el !== null)) {
        error = matsTypes.Messages.NO_DATA_FOUND;
      }
      return {
        data: d,
        error,
      };
    });
  }
  return null;
};

// eslint-disable-next-line no-undef
export default matsDataQueryUtils = {
  queryMySQL,
  getStationsInCouchbaseRegion,
  queryDBPython,
  queryDBTimeSeries,
  queryDBSpecialtyCurve,
  queryDBReliability,
  queryDBPerformanceDiagram,
  queryDBSimpleScatter,
  queryDBMapScalar,
  queryDBMapScalarLoop,
  queryDBMapCTC,
  queryDBContour,
};
