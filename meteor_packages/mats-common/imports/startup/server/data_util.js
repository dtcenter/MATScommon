/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections, matsPlotUtils } from "meteor/randyp:mats-common";

// this function checks if two JSON objects are identical
const areObjectsEqual = function (o, p) {
  if ((o && !p) || (p && !o)) {
    return false;
  }
  if (JSON.stringify(o) === JSON.stringify(p)) {
    return true;
  }
  return false;
};

// this function checks if values of subArray are also in superArray
const arrayContainsArray = function (superArray, subArray) {
  superArray.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  subArray.sort(function (a, b) {
    return Number(a) - Number(b);
  });
  let i;
  let j;
  for (i = 0, j = 0; i < superArray.length && j < subArray.length; ) {
    if (superArray[i] < subArray[j]) {
      ++i;
    } else if (superArray[i] === subArray[j]) {
      ++i;
      ++j;
    } else {
      // subArray[j] not in superArray, so superArray does not contain all elements of subArray
      return false;
    }
  }
  // make sure there are no elements left in sub
  return j === subArray.length;
};

// this function checks if the entire array subArray is contained in superArray
const arrayContainsSubArray = function (superArray, subArray) {
  let i;
  let j;
  let current;
  for (i = 0; i < superArray.length; ++i) {
    if (subArray.length === superArray[i].length) {
      current = superArray[i];
      for (j = 0; j < subArray.length && subArray[j] === current[j]; ++j);
      if (j === subArray.length) return true;
    }
  }
  return false;
};

// this function checks if two arrays are identical
const arraysEqual = function (a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const arrayUnique = function (a) {
  const arr = [];
  for (let i = 0; i < a.length; i++) {
    if (!arr.includes(a[i])) {
      arr.push(a[i]);
    }
  }
  return arr;
};

// this function finds the position of the array subArray in superArray
const findArrayInSubArray = function (superArray, subArray) {
  let i;
  let j;
  let current;
  for (i = 0; i < superArray.length; ++i) {
    if (subArray.length === superArray[i].length) {
      current = superArray[i];
      for (j = 0; j < subArray.length && subArray[j] === current[j]; ++j);
      if (j === subArray.length) return i;
    }
  }
  return -1;
};

// this function checks if an object is a value in another object
const objectContainsObject = function (superObject, subObject) {
  const superObjectKeys = Object.keys(superObject);
  let currentObject;
  for (let i = 0; i < superObjectKeys.length; i++) {
    currentObject = superObject[superObjectKeys[i]];
    if (areObjectsEqual(subObject, currentObject)) {
      return true;
    }
  }
  // if the loop completes, the subObject was not found
  return false;
};

// utility for calculating the sum of an array
const sum = function (data) {
  if (data.length === 0) return null;
  return data.reduce(function (sum, value) {
    return !value ? sum : sum + value;
  }, 0);
};

// utility for calculating the average of an array
const average = function (data) {
  if (data.length === 0) return null;
  return sum(data) / data.length;
};

// utility for calculating the median of an array
const median = function (data) {
  if (data.length === 0) return null;
  data.sort(function (a, b) {
    return a - b;
  });
  const half = Math.floor(data.length / 2);
  if (data.length % 2) return data[half];
  return (data[half - 1] + data[half]) / 2.0;
};

// utility for calculating the stdev of an array
const stdev = function (data) {
  if (data.length === 0) return 0;
  const avg = average(data);
  const squareDiffs = data.map(function (value) {
    const diff = value - avg;
    return diff * diff;
  });
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
};

// this function makes sure date strings are in the correct format
const dateConvert = function (dStr) {
  if (dStr === undefined || dStr === " ") {
    const now = new Date();
    const date = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    );
    var yr = date.getUTCFullYear();
    var day = date.getUTCDate();
    var month = date.getUTCMonth();
    var hour = date.getUTCHours();
    var minute = date.getUTCMinutes();
    return `${month}/${day}/${yr} ${hour}:${minute}`;
  }
  const dateParts = dStr.split(" ");
  const dateArray = dateParts[0].split(/[\-\/]/); // split on - or /    01-01-2017 OR 01/01/2017
  var month = dateArray[0];
  var day = dateArray[1];
  var yr = dateArray[2];
  var hour = 0;
  var minute = 0;
  if (dateParts[1]) {
    const timeArray = dateParts[1].split(":");
    hour = timeArray[0];
    minute = timeArray[1];
  }
  return `${month}/${day}/${yr} ${hour}:${minute}`;
};

// splits the date range string from the date selector into standardized fromDate/toDate strings,
//  plus the epochs for the fromDate and toDate
const getDateRange = function (dateRange) {
  const dates = dateRange.split(" - ");
  const fromDateStr = dates[0];
  const fromDate = dateConvert(fromDateStr);
  const toDateStr = dates[1];
  const toDate = dateConvert(toDateStr);
  const fromSecs = secsConvert(fromDateStr);
  const toSecs = secsConvert(toDateStr);
  return {
    fromDate,
    toDate,
    fromSeconds: fromSecs,
    toSeconds: toSecs,
  };
};

// this function converts a date string into an epoch
const secsConvert = function (dStr) {
  if (dStr === undefined || dStr === " ") {
    const now = new Date();
    return now.getTime() / 1000;
  }
  const dateParts = dStr.split(" ");
  const dateArray = dateParts[0].split(/[\-\/]/); // split on - or /    01-01-2017 OR 01/01/2017
  const month = dateArray[0];
  const day = dateArray[1];
  const yr = dateArray[2];
  let hour = 0;
  let minute = 0;
  if (dateParts[1]) {
    const timeArray = dateParts[1].split(":");
    hour = timeArray[0];
    minute = timeArray[1];
  }
  const my_date = new Date(Date.UTC(yr, month - 1, day, hour, minute, 0));
  // to UTC time, not local time
  const date_in_secs = my_date.getTime();

  // to UTC time, not local time
  // return date_in_secs/1000 -3600*6;
  return date_in_secs / 1000;
};

// function to manage authorized logins for MATS
const doAuthorization = function () {
  if (
    matsCollections.Settings.findOne({}) === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === true
  ) {
    matsCollections.Authorization.remove({});
  }
  if (matsCollections.Authorization.find().count() === 0) {
    matsCollections.Authorization.insert({
      email: "randy.pierce@noaa.gov",
      roles: ["administrator"],
    });
    matsCollections.Authorization.insert({
      email: "kirk.l.holub@noaa.gov",
      roles: ["administrator"],
    });
    matsCollections.Authorization.insert({
      email: "jeffrey.a.hamilton@noaa.gov",
      roles: ["administrator"],
    });
    matsCollections.Authorization.insert({
      email: "bonny.strong@noaa.gov",
      roles: ["administrator"],
    });
    matsCollections.Authorization.insert({
      email: "molly.b.smith@noaa.gov",
      roles: ["administrator"],
    });
    matsCollections.Authorization.insert({
      email: "mats.gsd@noaa.gov",
      roles: ["administrator"],
    });
  }
};

// master list of colors for MATS curves
const doColorScheme = function () {
  if (
    matsCollections.Settings.findOne({}) === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === true
  ) {
    matsCollections.ColorScheme.remove({});
  }
  if (matsCollections.ColorScheme.find().count() === 0) {
    matsCollections.ColorScheme.insert({
      colors: [
        "rgb(255,0,0)",
        "rgb(0,0,255)",
        "rgb(255,165,0)",
        "rgb(128,128,128)",
        "rgb(238,130,238)",

        "rgb(238,130,238)",
        "rgb(0,0,139)",
        "rgb(148,0,211)",
        "rgb(105,105,105)",
        "rgb(255,140,0)",

        "rgb(235,92,92)",
        "rgb(82,92,245)",
        "rgb(133,143,143)",
        "rgb(235,143,92)",
        "rgb(190,120,120)",

        "rgb(225,82,92)",
        "rgb(72,82,245)",
        "rgb(123,133,143)",
        "rgb(225,133,92)",
        "rgb(180,120,120)",
      ],
    });
  }
};

// utility for google login capabilities in MATS -- broken for esrl.noaa.gov/gsd/mats?
const doCredentials = function () {
  // the gmail account for the credentials is mats.mail.daemon@gmail.com - pwd mats2015!
  if (
    matsCollections.Settings.findOne({}) === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === true
  ) {
    matsCollections.Credentials.remove({});
  }
  if (matsCollections.Credentials.find().count() === 0) {
    matsCollections.Credentials.insert({
      name: "oauth_google",
      clientId:
        "499180266722-aai2tddo8s9edv4km1pst88vebpf9hec.apps.googleusercontent.com",
      clientSecret: "xdU0sc7SbdOOEzSyID_PTIRE",
      refresh_token:
        "1/3bhWyvCMMfwwDdd4F3ftlJs3-vksgg7G8POtiOBwYnhIgOrJDtdun6zK6XiATCKT",
    });
  }
};

// another utility to assist at logging into MATS
const doRoles = function () {
  if (
    matsCollections.Settings.findOne({}) === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === true
  ) {
    matsCollections.Roles.remove({});
  }
  if (matsCollections.Roles.find().count() === 0) {
    matsCollections.Roles.insert({
      name: "administrator",
      description: "administrator privileges",
    });
  }
};

// for use in matsMethods.resetApp() to establish default settings
const doSettings = function (
  title,
  dbType,
  version,
  commit,
  appName,
  appType,
  mapboxKey,
  appDefaultGroup,
  appDefaultDB,
  appDefaultModel,
  thresholdUnits,
  appMessage,
  scorecard
) {
  if (
    matsCollections.Settings.findOne({}) === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === undefined ||
    matsCollections.Settings.findOne({}).resetFromCode === true
  ) {
    matsCollections.Settings.remove({});
  }
  if (matsCollections.Settings.find().count() === 0) {
    matsCollections.Settings.insert({
      LabelPrefix: scorecard ? "Block" : "Curve",
      Title: title,
      dbType,
      appVersion: version,
      commit,
      appName,
      appType,
      LineWidth: 3.5,
      NullFillString: "---",
      resetFromCode: false,
      mapboxKey,
      appDefaultGroup,
      appDefaultDB,
      appDefaultModel,
      thresholdUnits,
      appMessage,
      scorecard,
    });
  }
  // always update the version, roles, and the hostname, not just if it doesn't exist...
  const settings = matsCollections.Settings.findOne({});
  const deploymentRoles = {
    "mats-docker-dev": "development",
    "mats-docker-preint": "integration",
    gsl: "production",
    esrl: "production",
    metexpress: "production",
  };
  const settingsId = settings._id;
  const os = Npm.require("os");
  const hostname = os.hostname().split(".")[0];
  settings.appVersion = version;
  settings.hostname = hostname;
  settings.deploymentRoles = JSON.stringify(deploymentRoles);
  matsCollections.Settings.update(settingsId, { $set: settings });
};

const callMetadataAPI = function (
  selector,
  queryURL,
  destinationStructure,
  expectedApps,
  fakeMetadata,
  hideOtherFor
) {
  const Future = require("fibers/future");
  const pFuture = new Future();
  HTTP.get(queryURL, {}, function (error, response) {
    if (error) {
      console.log(error);
    } else {
      const metadata = JSON.parse(response.content);
      if (Array.isArray(destinationStructure)) {
        // this is the list of apps. It's the only array in the API.
        destinationStructure = [...destinationStructure, ...metadata];
        expectedApps = metadata;
      } else if (Object.keys(metadata).length === 0) {
        // this metadata type (e.g. 'threshold') is not valid for this app
        // we need to add placeholder metadata to the destination structure
        // and add the selector in question to the hideOtherFor map.
        const dummyMetadata = {};
        if (!selector.includes("values")) {
          hideOtherFor[selector] =
            hideOtherFor[selector] === undefined ? [] : hideOtherFor[selector];
          for (let eidx = 0; eidx < expectedApps.length; eidx++) {
            dummyMetadata[expectedApps[eidx]] = fakeMetadata;
            hideOtherFor[selector].push(expectedApps[eidx]);
          }
        }
        destinationStructure = { ...destinationStructure, ...dummyMetadata };
      } else {
        destinationStructure = { ...destinationStructure, ...metadata };
      }
    }
    pFuture.return();
  });
  pFuture.wait();
  return [destinationStructure, expectedApps, hideOtherFor];
};

// calculates the statistic for ctc plots
const calculateStatCTC = function (hit, fa, miss, cn, n, statistic) {
  if (isNaN(hit) || isNaN(fa) || isNaN(miss) || isNaN(cn)) return null;
  let queryVal;
  switch (statistic) {
    case "TSS (True Skill Score)":
      queryVal = ((hit * cn - fa * miss) / ((hit + miss) * (fa + cn))) * 100;
      break;
    // some PODy measures look for a value over a threshold, some look for under
    case "PODy (POD of value < threshold)":
    case "PODy (POD of value > threshold)":
      queryVal = (hit / (hit + miss)) * 100;
      break;
    // some PODn measures look for a value under a threshold, some look for over
    case "PODn (POD of value > threshold)":
    case "PODn (POD of value < threshold)":
      queryVal = (cn / (cn + fa)) * 100;
      break;
    case "POFD (Probability of False Detection)":
      queryVal = (fa / (fa + cn)) * 100;
      break;
    case "FAR (False Alarm Ratio)":
      queryVal = (fa / (fa + hit)) * 100;
      break;
    case "Bias (forecast/actual)":
      queryVal = (hit + fa) / (hit + miss);
      break;
    case "CSI (Critical Success Index)":
      queryVal = (hit / (hit + miss + fa)) * 100;
      break;
    case "HSS (Heidke Skill Score)":
      queryVal =
        ((2 * (cn * hit - miss * fa)) /
          ((cn + fa) * (fa + hit) + (cn + miss) * (miss + hit))) *
        100;
      break;
    case "ETS (Equitable Threat Score)":
      queryVal =
        ((hit - ((hit + fa) * (hit + miss)) / (hit + fa + miss + cn)) /
          (hit + fa + miss - ((hit + fa) * (hit + miss)) / (hit + fa + miss + cn))) *
        100;
      break;
    case "Nlow (Number of obs < threshold (hits + misses))":
    case "Nhigh (Number of obs > threshold (hits + misses))":
    case "All observed yes":
      queryVal = hit + miss;
      break;
    case "Nlow (Number of obs < threshold (false alarms + correct nulls))":
    case "Nhigh (Number of obs > threshold (false alarms + correct nulls))":
    case "All observed no":
      queryVal = cn + fa;
      break;
    case "Ntot (Total number of obs, (Nlow + Nhigh))":
      queryVal = hit + fa + miss + cn;
      break;
    case "Ratio Nlow / Ntot ((hit + miss)/(hit + miss + fa + cn))":
    case "Ratio Nhigh / Ntot ((hit + miss)/(hit + miss + fa + cn))":
      queryVal = (hit + miss) / (hit + fa + miss + cn);
      break;
    case "Ratio Nlow / Ntot ((fa + cn)/(hit + miss + fa + cn))":
    case "Ratio Nhigh / Ntot ((fa + cn)/(hit + miss + fa + cn))":
      queryVal = (cn + fa) / (hit + fa + miss + cn);
      break;
    case "N times*levels(*stations if station plot) per graph point":
      queryVal = n;
      break;
    default:
      queryVal = null;
  }
  return queryVal;
};

// calculates the statistic for scalar partial sums plots
const calculateStatScalar = function (
  squareDiffSum,
  NSum,
  obsModelDiffSum,
  modelSum,
  obsSum,
  absSum,
  statistic
) {
  if (
    isNaN(squareDiffSum) ||
    isNaN(NSum) ||
    isNaN(obsModelDiffSum) ||
    isNaN(modelSum) ||
    isNaN(obsSum) ||
    isNaN(absSum)
  )
    return null;
  let queryVal;
  const variable = statistic.split("_")[1];
  [statistic] = statistic.split("_");
  switch (statistic) {
    case "RMSE":
      queryVal = Math.sqrt(squareDiffSum / NSum);
      break;
    case "Bias (Model - Obs)":
      queryVal = (modelSum - obsSum) / NSum;
      break;
    case "N":
      queryVal = NSum;
      break;
    case "Model average":
      queryVal = modelSum / NSum;
      break;
    case "Obs average":
      queryVal = obsSum / NSum;
      break;
    case "Std deviation":
      queryVal = Math.sqrt(squareDiffSum / NSum - (obsModelDiffSum / NSum) ** 2);
      break;
    case "MAE (temp and dewpoint only)":
    case "MAE (station plots only)":
    case "MAE":
      queryVal = absSum / NSum;
      break;
    default:
      queryVal = null;
  }
  if (isNaN(queryVal)) return null;
  // need to convert to correct units for surface data but not upperair
  if (statistic !== "N") {
    if (
      variable.includes("2m") &&
      (variable.toLowerCase().includes("temperature") ||
        variable.toLowerCase().includes("dewpoint"))
    ) {
      if (statistic.includes("average")) {
        queryVal -= 32;
      }
      queryVal /= 1.8;
    } else if (
      variable.includes("10m") &&
      variable.toLowerCase().includes("wind") &&
      variable.toLowerCase().includes("speed")
    ) {
      queryVal /= 2.23693629;
    }
  }
  return queryVal;
};

// function to build a contour plot with multiple queries
const consolidateContour = function (d, dTemp, statType, xAxisParam, yAxisParam) {
  let dReturn = d;
  if (Object.keys(d).length === 0) {
    dReturn = dTemp;
  } else {
    if (xAxisParam === "Threshold") {
      dReturn.x.push(dTemp.x[0]);
      dReturn.y = dTemp.y;
      for (let didx = 0; didx < dTemp.y.length; didx += 1) {
        dReturn.z[didx].push(dTemp.z[didx][0]);
        dReturn.n[didx].push(dTemp.n[didx][0]);
        if (statType === "ctc") {
          dReturn.subHit[didx].push(dTemp.subHit[didx][0]);
          dReturn.subFa[didx].push(dTemp.subFa[didx][0]);
          dReturn.subMiss[didx].push(dTemp.subMiss[didx][0]);
          dReturn.subCn[didx].push(dTemp.subCn[didx][0]);
        } else if (statType === "scalar") {
          dReturn.subSquareDiffSum[didx].push(dTemp.subSquareDiffSum[didx][0]);
          dReturn.subObsModelDiffSum[didx].push(dTemp.subObsModelDiffSum[didx][0]);
          dReturn.subNSum[didx].push(dTemp.subNSum[didx][0]);
          dReturn.subModelSum[didx].push(dTemp.subModelSum[didx][0]);
          dReturn.subObsSum[didx].push(dTemp.subObsSum[didx][0]);
          dReturn.subAbsSum[didx].push(dTemp.subAbsSum[didx][0]);
        }
        dReturn.stdev[didx].push(dTemp.stdev[didx]);
        dReturn.subSecs[didx].push(dTemp.subSecs[didx]);
      }
    } else if (yAxisParam === "Threshold") {
      dReturn.x = dTemp.x;
      dReturn.y.push(dTemp.y[0]);
      for (let didx = 0; didx < dTemp.y.length; didx += 1) {
        dReturn.z.push(dTemp.z[didx]);
        dReturn.n.push(dTemp.n[didx]);
        if (statType === "ctc") {
          dReturn.subHit.push(dTemp.subHit[didx]);
          dReturn.subFa.push(dTemp.subFa[didx]);
          dReturn.subMiss.push(dTemp.subMiss[didx]);
          dReturn.subCn.push(dTemp.subCn[didx]);
        } else if (statType === "scalar") {
          dReturn.subSquareDiffSum.push(dTemp.subSquareDiffSum[didx]);
          dReturn.subObsModelDiffSum.push(dTemp.subObsModelDiffSum[didx]);
          dReturn.subNSum.push(dTemp.subNSum[didx]);
          dReturn.subModelSum.push(dTemp.subModelSum[didx]);
          dReturn.subObsSum.push(dTemp.subAbsSum[didx]);
        }
        dReturn.stdev.push(dTemp.stdev[didx]);
        dReturn.subSecs.push(dTemp.subSecs[didx]);
      }
    }
    dReturn.xTextOutput = [...d.xTextOutput, ...dTemp.xTextOutput];
    dReturn.yTextOutput = [...d.yTextOutput, ...dTemp.yTextOutput];
    dReturn.zTextOutput = [...d.zTextOutput, ...dTemp.zTextOutput];
    dReturn.nTextOutput = [...d.nTextOutput, ...dTemp.nTextOutput];
    dReturn.hitTextOutput = [...d.hitTextOutput, ...dTemp.hitTextOutput];
    dReturn.faTextOutput = [...d.faTextOutput, ...dTemp.faTextOutput];
    dReturn.missTextOutput = [...d.missTextOutput, ...dTemp.missTextOutput];
    dReturn.cnTextOutput = [...d.cnTextOutput, ...dTemp.cnTextOutput];
    dReturn.squareDiffSumTextOutput = [
      ...d.squareDiffSumTextOutput,
      ...dTemp.squareDiffSumTextOutput,
    ];
    dReturn.obsModelDiffSumTextOutput = [
      ...d.obsModelDiffSumTextOutput,
      ...dTemp.obsModelDiffSumTextOutput,
    ];
    dReturn.NSumTextOutput = [...d.NSumTextOutput, ...dTemp.NSumTextOutput];
    dReturn.modelSumTextOutput = [...d.modelSumTextOutput, ...dTemp.modelSumTextOutput];
    dReturn.obsSumTextOutput = [...d.obsSumTextOutput, ...dTemp.obsSumTextOutput];
    dReturn.absSumTextOutput = [...d.absSumTextOutput, ...dTemp.absSumTextOutput];
    dReturn.glob_stats.minDate =
      d.glob_stats.minDate < dTemp.glob_stats.minDate
        ? d.glob_stats.minDate
        : dTemp.glob_stats.minDate;
    dReturn.glob_stats.maxDate =
      d.glob_stats.maxDate > dTemp.glob_stats.maxDate
        ? d.glob_stats.maxDate
        : dTemp.glob_stats.maxDate;
    dReturn.glob_stats.n += dTemp.glob_stats.n;
    dReturn.xmin = d.xmin < dTemp.xmin ? d.xmin : dTemp.xmin;
    dReturn.xmax = d.xmax > dTemp.xmax ? d.xmax : dTemp.xmax;
    dReturn.ymin = d.ymin < dTemp.ymin ? d.ymin : dTemp.ymin;
    dReturn.ymax = d.ymax > dTemp.ymax ? d.ymax : dTemp.ymax;
    dReturn.zmin = d.zmin < dTemp.zmin ? d.zmin : dTemp.zmin;
    dReturn.zmax = d.zmax > dTemp.zmax ? d.zmax : dTemp.zmax;
  }
  return dReturn;
};

// which statistics are excluded from scorecards?
const excludeStatFromScorecard = function (stat) {
  const statsToExclude = [
    "Bias (forecast/actual)",
    "Nlow (Number of obs < threshold (hits + misses))",
    "Nhigh (Number of obs > threshold (hits + misses))",
    "All observed yes",
    "Nlow (Number of obs < threshold (false alarms + correct nulls))",
    "Nhigh (Number of obs > threshold (false alarms + correct nulls))",
    "All observed no",
    "Ntot (Total number of obs, (Nlow + Nhigh))",
    "Ratio Nlow / Ntot ((hit + miss)/(hit + miss + fa + cn))",
    "Ratio Nhigh / Ntot ((hit + miss)/(hit + miss + fa + cn))",
    "Ratio Nlow / Ntot ((fa + cn)/(hit + miss + fa + cn))",
    "Ratio Nhigh / Ntot ((fa + cn)/(hit + miss + fa + cn))",
    "N times*levels(*stations if station plot) per graph point",
    "N",
    "Model average",
    "Obs average",
    "Std deviation",
    "MAE (station plots only)",
  ];
  return statsToExclude.indexOf(stat) !== -1;
};

// calculates mean, stdev, and other statistics for curve data points in all apps and plot types
const get_err = function (sVals, sSecs, sLevs, appParams) {
  /* refer to perl error_library.pl sub  get_stats
     to see the perl implementation of these statics calculations.
     These should match exactly those, except that they are processed in reverse order.
     */
  const autocorr_limit = 0.95;
  const { hasLevels } = appParams;

  let n = sVals.length;
  const data_wg = [];
  let n_gaps = 0;
  let sum = 0;
  let sum2 = 0;
  let d_mean = 0;
  let sd2 = 0;
  let sd = 0;
  let error;
  let i;

  if (n < 1) {
    return {
      d_mean: null,
      stde_betsy: null,
      sd: null,
      n_good: n,
      lag1: null,
      min: null,
      max: null,
      sum: null,
    };
  }

  // find minimum delta_time, if any value missing, set null
  let last_secs = 0;
  let minDelta = Number.MAX_VALUE;
  let minSecs = Number.MAX_VALUE;
  let max_secs = Number.MIN_VALUE;
  let minVal = Number.MAX_VALUE;
  let maxVal = -1 * Number.MAX_VALUE;
  let secs;
  let delta;
  for (i = 0; i < sSecs.length; i++) {
    if (isNaN(sVals[i])) {
      n -= 1;
      continue;
    }
    secs = sSecs[i];
    delta = Math.abs(secs - last_secs);
    if (delta > 0 && delta < minDelta) {
      minDelta = delta;
    }
    if (secs < minSecs) {
      minSecs = secs;
    }
    if (secs > max_secs) {
      max_secs = secs;
    }
    last_secs = secs;
  }

  if (minDelta < 0) {
    error = `Invalid time interval - minDelta: ${minDelta}`;
    console.log(`matsDataUtil.getErr: ${error}`);
  }
  for (i = 0; i < sVals.length; i++) {
    if (isNaN(sVals[i])) continue;
    minVal = minVal < sVals[i] ? minVal : sVals[i];
    maxVal = maxVal > sVals[i] ? maxVal : sVals[i];
    sum += sVals[i];
    sum2 += sVals[i] * sVals[i];
  }

  d_mean = sum / n;
  sd2 = sum2 / n - d_mean * d_mean;
  if (sd2 > 0) {
    sd = Math.sqrt(sd2);
  }

  // look for gaps
  let lastSecond = -1 * Number.MAX_VALUE;
  let lastPressure = -1 * Number.MAX_VALUE;
  let n_pressures;
  if (hasLevels) {
    n_pressures = arrayUnique(sLevs).length;
  } else {
    n_pressures = 1;
  }
  // set lag1_t to the first time the time changes from its initial value + 1 (data zero based)
  // set lag1_p to the first time the pressure changes from its initial value + 1 (data zero based)
  let lag1_t = 0;
  let lag1_p = 0;
  let r1_t = 0; // autocorrelation for time
  let r1_p = 0; // autocorrelation for pressure
  let j = 0; // i is loop index without gaps; j is loop index with gaps
  let n_deltas = 0;

  for (i = 0; i < sSecs.length; i++) {
    if (isNaN(sVals[i])) continue;
    let sec = sSecs[i];
    if (typeof sec === "string" || sec instanceof String) sec = Number(sec);
    var lev;
    if (hasLevels) {
      lev = sLevs[i];
      if (typeof lev === "string" || lev instanceof String) {
        if (lev[0] === "P") {
          lev = Number(lev.substring(1));
        } else {
          lev = Number(lev);
        }
      }
      // find first time the pressure changes
      if (lag1_p === 0 && lastPressure > 0) {
        if (lev !== lastPressure) {
          lag1_p = j;
        }
      }
    }
    if (lastSecond >= 0) {
      if (lag1_t === 0 && sec !== lastSecond) {
        lag1_t = j;
      }
      if (Math.abs(sec - lastSecond) > minDelta) {
        n_deltas = (Math.abs(sec - lastSecond) / minDelta - 1) * n_pressures;
        // for the Autocorrelation at lag 1, it doesn't matter how many missing
        // data we put in within gaps! (But for the other AC's it does.)
        // since we're using only the AC at lag 1 for calculating std err, let's
        // save cpu time and only put in one missing datum per gap, no matter
        // how long. WRM 2/22/2019
        // but if we're using a different lag, which could happen, we'll need
        // to insert all the missing data in each gap. WRM 2/22/2019
        // $n_deltas=1;
        for (let count = 0; count < n_deltas; count++) {
          data_wg.push(null);
          n_gaps++;
          j++;
        }
      }
    }
    lastSecond = sec;
    if (hasLevels) {
      lastPressure = lev;
    }
    data_wg.push(sVals[i]);
    j++;
  }

  // from http://www.itl.nist.gov/div898/handbook/eda/section3/eda35c.htm
  const r = [];
  const lag_by_r = {};
  const lag1_max = lag1_p > lag1_t ? lag1_p : lag1_t;
  let r_sum = 0;
  let n_r = 0;
  let n_in_lag;
  let lag;
  let t;
  for (lag = 0; lag <= lag1_max; lag++) {
    r[lag] = 0;
    n_in_lag = 0;
    for (t = 0; t < n + n_gaps - lag; t++) {
      if (data_wg[t] && data_wg[t + lag]) {
        r[lag] += +(data_wg[t] - d_mean) * (data_wg[t + lag] - d_mean);
        n_in_lag++;
      }
    }
    if (n_in_lag > 0 && sd > 0) {
      r[lag] /= n_in_lag * sd * sd;
      r_sum += r[lag];
      n_r++;
    } else {
      r[lag] = null;
    }
    if (lag >= 1 && lag < (n + n_gaps) / 2) {
      lag_by_r[r[lag]] = lag;
    }
  }
  if (lag1_t > 0) {
    r1_t = r[lag1_t] !== undefined ? r[lag1_t] : 0;
  }
  if (lag1_p > 0) {
    r1_p = r[lag1_p] !== undefined ? r[lag1_p] : 0;
  }

  // Betsy Weatherhead's correction, based on lag 1, augmented by the highest
  // lag > 1 and < n/2
  if (r1_p >= autocorr_limit) {
    r1_p = autocorr_limit;
  }
  if (r1_t >= autocorr_limit) {
    r1_t = autocorr_limit;
  }

  const betsy = Math.sqrt((n - 1) * (1 - r1_p) * (1 - r1_t));
  let stde_betsy;
  if (betsy !== 0) {
    stde_betsy = sd / betsy;
  } else {
    stde_betsy = null;
  }
  const stats = {
    d_mean,
    stde_betsy,
    sd,
    n_good: n,
    lag1: r[1],
    min: minSecs,
    max: max_secs,
    minVal,
    maxVal,
    sum,
  };
  // console.log("stats are " + JSON.stringify(stats));
  // stde_betsy is standard error with auto correlation
  // console.log("---------\n\n");
  return stats;
};

// find the p-value or significance for this
const checkDiffContourSignificanceCTC = function (
  diffValue,
  mH,
  mF,
  mM,
  mC,
  sH,
  sF,
  sM,
  sC,
  sigType,
  statistic
) {
  const minuendData = {
    hit: mH,
    fa: mF,
    miss: mM,
    cn: mC,
  };
  const subtrahendData = {
    hit: sH,
    fa: sF,
    miss: sM,
    cn: sC,
  };
  const errorLength = ctcErrorPython(statistic, minuendData, subtrahendData);
  const upperBound = diffValue + errorLength;
  const lowerBound = diffValue - errorLength;
  return (upperBound > 0 && lowerBound > 0) || (upperBound < 0 && lowerBound < 0);
};

// use a student's t-test to see if a point on a contour diff is statistically significant
const checkDiffContourSignificance = function (x1, x2, s1, s2, n1, n2, sigType) {
  const t = getTValue(x1, x2, s1, s2, n1, n2);
  const df = getDfValue(x1, x2, s1, s2, n1, n2);
  return isStudentTTestValueSignificant(t, df, sigType);
};

// calculate the t value for a student's t-test
const getTValue = function (x1, x2, s1, s2, n1, n2) {
  return Math.abs(x1 - x2) / Math.sqrt(s1 ** 2 / n1 + s2 ** 2 / n2);
};

// calculate the degrees of freedom for a student's t-test
const getDfValue = function (x1, x2, s1, s2, n1, n2) {
  return (
    (s1 ** 2 / n1 + s2 ** 2 / n2) ** 2 /
    ((1 / (n1 - 1)) * (s1 ** 2 / n1) ** 2 + (1 / (n2 - 1)) * (s2 ** 2 / n2) ** 2)
  );
};

// checks if a t value an degrees of freedom combo is significant
const isStudentTTestValueSignificant = function (t, df, sigType) {
  const sigThreshs = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.477,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.16,
    14: 2.145,
    15: 2.131,
    16: 2.12,
    17: 2.11,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    21: 2.08,
    22: 2.074,
    23: 2.069,
    24: 2.064,
    25: 2.06,
    26: 2.056,
    27: 2.052,
    28: 2.048,
    29: 2.043,
    30: 2.042,
  };

  let sigThresh;
  if (sigType === "standard") {
    if (df <= 30) {
      sigThresh = sigThreshs[df];
    } else if (df <= 40) {
      sigThresh = 2.021;
    } else if (df <= 60) {
      sigThresh = 2.0;
    } else if (df <= 120) {
      sigThresh = 1.98;
    } else {
      sigThresh = 1.96;
    }
  } else {
    sigThresh = 1.96;
  }

  return t > sigThresh;
};

// utility to process the user-input histogram customization controls
const setHistogramParameters = function (plotParams) {
  const yAxisFormat = plotParams["histogram-yaxis-controls"];
  const binType = plotParams["histogram-bin-controls"];
  let binNum = 12; // default bin number
  let binStart; // default is no mandated bin start
  let binStride; // default is no mandated stride
  let pivotVal; // default is not to shift the bins over to a pivot
  let binBounds = []; // default is no specified bin bounds -- our algorithm will figure them out if this array stays empty

  switch (binType) {
    case "Set number of bins":
      // get the user's chosen number of bins
      binNum = Number(plotParams["bin-number"]);
      if (isNaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      break;

    case "Make zero a bin bound":
      // let the histogram routine know that we want the bins shifted over to zero
      pivotVal = 0;
      break;

    case "Choose a bin bound":
      // let the histogram routine know that we want the bins shifted over to whatever was input
      pivotVal = Number(plotParams["bin-pivot"]);
      if (isNaN(pivotVal)) {
        throw new Error("Error parsing bin pivot: please enter the desired bin pivot.");
      }
      break;

    case "Set number of bins and make zero a bin bound":
      // get the user's chosen number of bins and let the histogram routine know that we want the bins shifted over to zero
      binNum = Number(plotParams["bin-number"]);
      if (isNaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      pivotVal = 0;
      break;

    case "Set number of bins and choose a bin bound":
      // get the user's chosen number of bins and let the histogram routine know that we want the bins shifted over to whatever was input
      binNum = Number(plotParams["bin-number"]);
      if (isNaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      pivotVal = Number(plotParams["bin-pivot"]);
      if (isNaN(pivotVal)) {
        throw new Error("Error parsing bin pivot: please enter the desired bin pivot.");
      }
      break;

    case "Manual bins":
      // try to parse whatever we've been given for bin bounds. Throw an error if they didn't follow directions to enter a comma-separated list of numbers.
      try {
        binBounds = plotParams["bin-bounds"].split(",").map(function (item) {
          item.trim();
          item = Number(item);
          if (!isNaN(item)) {
            return item;
          }
          throw new Error(
            "Error parsing bin bounds: please enter  at least two numbers delimited by commas."
          );
        });
        binNum = binBounds.length + 1; // add 1 because these are inner bin bounds
      } catch (e) {
        throw new Error(
          "Error parsing bin bounds: please enter  at least two numbers delimited by commas."
        );
      }
      // make sure that we've been given at least two good bin bounds (enough to make one bin).
      if (binNum < 3) {
        throw new Error(
          "Error parsing bin bounds: please enter at least two numbers delimited by commas."
        );
      }
      break;

    case "Manual bin start, number, and stride":
      // get the bin start, number, and stride.
      binNum = Number(plotParams["bin-number"]);
      if (isNaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      binStart = Number(plotParams["bin-start"]);
      if (isNaN(binStart)) {
        throw new Error("Error parsing bin start: please enter the desired bin start.");
      }
      binStride = Number(plotParams["bin-stride"]);
      if (isNaN(binStride)) {
        throw new Error(
          "Error parsing bin stride: please enter the desired bin stride."
        );
      }
      break;

    case "Default bins":
    default:
      break;
  }
  return {
    yAxisFormat,
    binNum,
    binStart,
    binStride,
    pivotVal,
    binBounds,
  };
};

// utility that takes arrays of seconds and values and produces a data structure containing bin information for histogram plotting
const calculateHistogramBins = function (
  curveSubStats,
  curveSubSecs,
  binParams,
  appParams
) {
  // binStart and binStride will only be defined if the user wants to specify the bin spacing.
  // otherwise, we'll use the mean and standard deviation of the data to space the bins.

  // pivotVal will only be defined if the user wants to shift the bin limits to align with a certain value.
  // otherwise, we'll keep everything aligned with the data mean.

  const binStats = {};
  let binUpBounds = [];
  let binLowBounds = [];
  let binMeans = [];

  // calculate the global stats across all of the data
  const globalStats = get_err(curveSubStats, curveSubSecs, [], {
    hasLevels: false,
    outliers: appParams.outliers,
  }); // we don't need levels for the mean or sd calculations, so just pass in an empty array
  const glob_mean = globalStats.d_mean;
  const glob_sd = globalStats.sd;

  let fullLowBound;
  let fullUpBound;
  let fullRange;
  let binInterval;

  if (binParams.binStart === undefined || binParams.binStride === undefined) {
    // use the global stats to determine the bin bounds -- should be based on dividing up +/- 3*sd from the mean into requested number of bins
    fullLowBound = glob_mean - 3 * glob_sd;
    fullUpBound = glob_mean + 3 * glob_sd;
    fullRange = 6 * glob_sd;
    binInterval = fullRange / (binParams.binNum - 2); // take off two bins from the total number of requested bins to represent values either less than - 3*sd from the mean or greater than 3*sd from the mean
  } else {
    // use the user-defined start, number, and stride to determine the bin bounds
    fullLowBound = binParams.binStart;
    fullUpBound = binParams.binStart + (binParams.binNum - 2) * binParams.binStride; // take off two bins from the total number of requested bins to represent values that fall outside of the prescribed range
    fullRange = (binParams.binNum - 2) * binParams.binStride;
    binInterval = binParams.binStride;
  }

  // store an array of the upper and lower bounding values for each bin.
  binUpBounds[0] = fullLowBound; // the first upper bound should be exactly - 3*sd from the mean, or the previously calculated fullLowBound
  binLowBounds[0] = -1 * Number.MAX_VALUE;
  binMeans[0] = fullLowBound - binInterval / 2;
  for (var b_idx = 1; b_idx < binParams.binNum - 1; b_idx++) {
    binUpBounds[b_idx] = binUpBounds[b_idx - 1] + binInterval; // increment from fullLowBound to get the rest of the bin upper limits
    binLowBounds[b_idx] = binUpBounds[b_idx - 1];
    binMeans[b_idx] = binUpBounds[b_idx - 1] + binInterval / 2;
  }
  binUpBounds[binParams.binNum - 1] = Number.MAX_VALUE; // the last bin should have everything too large to fit into the previous bins, so make its upper bound the max number value
  binLowBounds[binParams.binNum - 1] = fullUpBound;
  binMeans[binParams.binNum - 1] = fullUpBound + binInterval / 2;

  if (binParams.pivotVal !== undefined && !isNaN(binParams.pivotVal)) {
    // need to shift the bounds and means over so that one of the bounds is on the chosen pivot
    const closestBoundToPivot = binLowBounds.reduce(function (prev, curr) {
      return Math.abs(curr - binParams.pivotVal) < Math.abs(prev - binParams.pivotVal)
        ? curr
        : prev;
    });
    binUpBounds = binUpBounds.map(function (val) {
      return val - (closestBoundToPivot - binParams.pivotVal);
    });
    binLowBounds = binLowBounds.map(function (val) {
      return val - (closestBoundToPivot - binParams.pivotVal);
    });
    binMeans = binMeans.map(function (val) {
      return val - (closestBoundToPivot - binParams.pivotVal);
    });
  }

  // calculate the labels for each bin, based on the data bounding range, for the graph x-axis later
  const binLabels = [];
  let lowSdFromMean;
  let upSdFromMean;
  for (b_idx = 0; b_idx < binParams.binNum; b_idx++) {
    lowSdFromMean = binLowBounds[b_idx].toFixed(2);
    upSdFromMean = binUpBounds[b_idx].toFixed(2);
    if (b_idx === 0) {
      binLabels[b_idx] = `< ${upSdFromMean}`;
    } else if (b_idx === binParams.binNum - 1) {
      binLabels[b_idx] = `> ${lowSdFromMean}`;
    } else {
      binLabels[b_idx] = `${lowSdFromMean}-${upSdFromMean}`;
    }
  }

  binStats.glob_mean = glob_mean;
  binStats.glob_sd = glob_sd;
  binStats.binUpBounds = binUpBounds;
  binStats.binLowBounds = binLowBounds;
  binStats.binMeans = binMeans;
  binStats.binLabels = binLabels;

  return { binStats };
};

// utility that takes an array of user-defined bin bounds and produces a data structure containing bin information for histogram plotting
const prescribeHistogramBins = function (
  curveSubStats,
  curveSubSecs,
  binParams,
  appParams
) {
  const binStats = {};

  // calculate the global stats across all of the data
  const globalStats = get_err(curveSubStats, curveSubSecs, [], {
    hasLevels: false,
    outliers: appParams.outliers,
  }); // we don't need levels for the mean or sd calculations, so just pass in an empty array
  const glob_mean = globalStats.d_mean;
  const glob_sd = globalStats.sd;

  // make sure the user-defined bins are in order from least to greatest
  binParams.binBounds = binParams.binBounds.sort(function (a, b) {
    return Number(a) - Number(b);
  });

  // store an array of the upper and lower bounding values for each bin.
  const binUpBounds = [];
  const binLowBounds = [];
  const binMeans = [];
  let binIntervalSum = 0;
  for (var b_idx = 1; b_idx < binParams.binNum - 1; b_idx++) {
    binUpBounds[b_idx] = binParams.binBounds[b_idx];
    binLowBounds[b_idx] = binParams.binBounds[b_idx - 1];
    binMeans[b_idx] = (binUpBounds[b_idx] + binLowBounds[b_idx]) / 2;
    binIntervalSum += binUpBounds[b_idx] - binLowBounds[b_idx];
  }
  const binIntervalAverage = binIntervalSum / (binParams.binNum - 2);
  binUpBounds[0] = binLowBounds[1];
  binLowBounds[0] = -1 * Number.MAX_VALUE; // the first bin should have everything too small to fit into the other bins, so make its lower bound -1 * the max number value
  binMeans[0] = binLowBounds[1] - binIntervalAverage / 2; // the bin means for the edge bins is a little arbitrary, so base it on the average bin width
  binUpBounds[binParams.binNum - 1] = Number.MAX_VALUE; // the last bin should have everything too large to fit into the previous bins, so make its upper bound the max number value
  binLowBounds[binParams.binNum - 1] = binUpBounds[binParams.binNum - 2];
  binMeans[binParams.binNum - 1] =
    binUpBounds[binParams.binNum - 2] + binIntervalAverage / 2; // the bin means for the edge bins is a little arbitrary, so base it on the average bin width

  // calculate the labels for each bin, based on the data bounding range, for the graph x-axis later
  const binLabels = [];
  let lowSdFromMean;
  let upSdFromMean;
  for (b_idx = 0; b_idx < binParams.binNum; b_idx++) {
    lowSdFromMean = binLowBounds[b_idx].toFixed(2);
    upSdFromMean = binUpBounds[b_idx].toFixed(2);
    if (b_idx === 0) {
      binLabels[b_idx] = `< ${upSdFromMean}`;
    } else if (b_idx === binParams.binNum - 1) {
      binLabels[b_idx] = `> ${lowSdFromMean}`;
    } else {
      binLabels[b_idx] = `${lowSdFromMean}-${upSdFromMean}`;
    }
  }

  binStats.glob_mean = glob_mean;
  binStats.glob_sd = glob_sd;
  binStats.binUpBounds = binUpBounds;
  binStats.binLowBounds = binLowBounds;
  binStats.binMeans = binMeans;
  binStats.binLabels = binLabels;

  return { binStats };
};

// utility that takes arrays of seconds, values, and optionally levels, and produces a data structure for histogram data
// processing. Used in the initial histogram DB query and in matching.
const sortHistogramBins = function (
  curveSubStats,
  curveSubSecs,
  curveSubLevs,
  binNum,
  masterBinStats,
  appParams,
  d
) {
  // need maps to hold the sub values and seconds (and levels) for each bin, after the bin bounds are calculated.
  const binSubStats = {};
  const binSubSecs = {};
  const binSubLevs = {};

  for (var b_idx = 0; b_idx < binNum; b_idx++) {
    binSubStats[b_idx] = [];
    binSubSecs[b_idx] = [];
    binSubLevs[b_idx] = [];
  }

  // calculate the global stats across all of the data
  let globalStats;
  globalStats = get_err(curveSubStats, curveSubSecs, curveSubLevs, appParams);
  const glob_mean = globalStats.d_mean;
  const glob_sd = globalStats.sd;
  const glob_n = globalStats.n_good;
  const glob_max = globalStats.maxVal;
  const glob_min = globalStats.minVal;

  // sort data into bins
  const { binUpBounds } = masterBinStats;
  const { binLowBounds } = masterBinStats;
  const { binMeans } = masterBinStats;
  const { binLabels } = masterBinStats;

  for (let d_idx = 0; d_idx < curveSubStats.length; d_idx++) {
    // iterate through all of the bins until we find one where the upper limit is greater than our datum.
    for (b_idx = 0; b_idx < binNum; b_idx++) {
      if (curveSubStats[d_idx] <= binUpBounds[b_idx]) {
        binSubStats[b_idx].push(curveSubStats[d_idx]);
        binSubSecs[b_idx].push(curveSubSecs[d_idx]);
        if (appParams.hasLevels) {
          binSubLevs[b_idx].push(curveSubLevs[d_idx]);
        }
        break;
      }
    }
  }

  // calculate the statistics for each bin
  // we are especially interested in the number of values in each bin, as that is the plotted stat in a histogram
  let binStats;
  let bin_mean;
  let bin_sd;
  let bin_n;
  let bin_rf;

  let sum = 0;
  let count = 0;
  for (b_idx = 0; b_idx < binNum; b_idx++) {
    binStats = get_err(
      binSubStats[b_idx],
      binSubSecs[b_idx],
      binSubLevs[b_idx],
      appParams
    );
    bin_mean = binStats.d_mean;
    bin_sd = binStats.sd;
    bin_n = binStats.n_good;
    bin_rf = bin_n / glob_n;

    /*
        var d = {// d will contain the curve data
            x: [],
            y: [],
            error_x: [],
            error_y: [],
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
            glob_stats: {},
            bin_stats: [],
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            sum: 0
        };
        */

    d.x.push(binMeans[b_idx]);
    d.y.push(bin_n);
    d.subVals.push(binSubStats[b_idx]);
    d.subSecs.push(binSubSecs[b_idx]);
    d.bin_stats.push({
      bin_mean,
      bin_sd,
      bin_n,
      bin_rf,
      binLowBound: binLowBounds[b_idx],
      binUpBound: binUpBounds[b_idx],
      binLabel: binLabels[b_idx],
    });
    d.text.push(null);

    if (appParams.hasLevels) {
      d.subLevs.push(binSubLevs[b_idx]);
    }

    // set axis limits based on returned data
    if (d.y[b_idx] !== null) {
      sum += d.y[b_idx];
      count++;
      d.ymin = d.ymin < d.y[b_idx] ? d.ymin : d.y[b_idx];
      d.ymax = d.ymax > d.y[b_idx] ? d.ymax : d.y[b_idx];
    }
  }
  d.glob_stats = {
    glob_mean,
    glob_sd,
    glob_n,
    glob_max,
    glob_min,
  };
  d.xmin = d.x[0];
  d.xmax = d.x[binNum - 1];

  return { d };
};

// utility that takes the curve params for two contour plots and collapses them into the curve params for one diff contour.
const getDiffContourCurveParams = function (curves) {
  const newCurve = {};
  const curveKeys = Object.keys(curves[0]);
  let currKey;
  for (let ckidx = 0; ckidx < curveKeys.length; ckidx++) {
    currKey = curveKeys[ckidx];
    if (currKey === "color") {
      newCurve.color = "rgb(255,165,0)";
    } else if (curves[0][currKey] === curves[1][currKey]) {
      newCurve[currKey] = curves[0][currKey];
    } else {
      newCurve[currKey] = `${curves[1][currKey]}-${curves[0][currKey]}`;
    }
  }
  return [newCurve];
};

// utility for getting CTC error bar length via Python
const ctcErrorPython = function (statistic, minuendData, subtrahendData) {
  if (Meteor.isServer) {
    // send the data to the python script
    const pyOptions = {
      mode: "text",
      pythonPath: Meteor.settings.private.PYTHON_PATH,
      pythonOptions: ["-u"], // get print results in real-time
      scriptPath:
        process.env.NODE_ENV === "development"
          ? `${process.env.PWD}/.meteor/local/build/programs/server/assets/packages/randyp_mats-common/public/python/`
          : `${process.env.PWD}/programs/server/assets/packages/randyp_mats-common/public/python/`,
      args: [
        "-S",
        statistic,
        "-m",
        JSON.stringify(minuendData),
        "-s",
        JSON.stringify(subtrahendData),
      ],
    };
    const pyShell = require("python-shell");
    const Future = require("fibers/future");

    const future = new Future();
    let error;
    let errorLength = 0;
    pyShell.PythonShell.run("python_ctc_error.py", pyOptions)
      .then((results) => {
        // parse the results or set an error
        if (results === undefined || results === "undefined") {
          error =
            "Error thrown by python_ctc_error.py. Please write down exactly how you produced this error, and submit a ticket at mats.gsl@noaa.gov.";
        } else {
          // get the data back from the query
          const parsedData = JSON.parse(results);
          errorLength = Number(parsedData.error_length);
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
    if (error) {
      throw new Error(`Error when calculating CTC errorbars: ${error}`);
    }
    return errorLength;
  }
};

// utility to remove a point on a graph
const removePoint = function (
  data,
  di,
  plotType,
  statVarName,
  isCTC,
  isScalar,
  hasLevels
) {
  data.x.splice(di, 1);
  data.y.splice(di, 1);
  if (
    plotType === matsTypes.PlotTypes.performanceDiagram ||
    plotType === matsTypes.PlotTypes.roc
  ) {
    data.oy_all.splice(di, 1);
    data.on_all.splice(di, 1);
  }
  if (data[`error_${statVarName}`].array !== undefined) {
    data[`error_${statVarName}`].array.splice(di, 1);
  }
  if (isCTC) {
    data.subHit.splice(di, 1);
    data.subFa.splice(di, 1);
    data.subMiss.splice(di, 1);
    data.subCn.splice(di, 1);
  } else if (isScalar) {
    if (data.subSquareDiffSumX !== undefined) {
      data.subSquareDiffSumX.splice(di, 1);
      data.subNSumX.splice(di, 1);
      data.subObsModelDiffSumX.splice(di, 1);
      data.subModelSumX.splice(di, 1);
      data.subObsSumX.splice(di, 1);
      data.subAbsSumX.splice(di, 1);
      data.subSquareDiffSumY.splice(di, 1);
      data.subNSumY.splice(di, 1);
      data.subObsModelDiffSumY.splice(di, 1);
      data.subModelSumY.splice(di, 1);
      data.subObsSumY.splice(di, 1);
      data.subAbsSumY.splice(di, 1);
    } else {
      data.subSquareDiffSum.splice(di, 1);
      data.subNSum.splice(di, 1);
      data.subObsModelDiffSum.splice(di, 1);
      data.subModelSum.splice(di, 1);
      data.subObsSum.splice(di, 1);
      data.subAbsSum.splice(di, 1);
    }
  } else if (data.subRelHit !== undefined) {
    data.subRelHit.splice(di, 1);
    data.subRelCount.splice(di, 1);
    data.subRelRawCount.splice(di, 1);
  }
  if (data.subValsX !== undefined) {
    data.subValsX.splice(di, 1);
    data.subValsY.splice(di, 1);
  } else {
    data.subVals.splice(di, 1);
  }
  data.subSecs.splice(di, 1);
  if (hasLevels) {
    data.subLevs.splice(di, 1);
  }
  data.stats.splice(di, 1);
  data.text.splice(di, 1);
};

// utility to add an additional null point on a graph
const addNullPoint = function (
  data,
  di,
  plotType,
  indVarName,
  newIndVar,
  statVarName,
  isCTC,
  isScalar,
  hasLevels
) {
  data[indVarName].splice(di, 0, newIndVar);
  data[statVarName].splice(di, 0, null);
  if (
    plotType === matsTypes.PlotTypes.performanceDiagram ||
    plotType === matsTypes.PlotTypes.roc
  ) {
    data.oy_all.splice(di, 0, null);
    data.on_all.splice(di, 0, null);
  }
  data[`error_${statVarName}`].splice(di, 0, null);
  if (isCTC) {
    data.subHit.splice(di, 0, []);
    data.subFa.splice(di, 0, []);
    data.subMiss.splice(di, 0, []);
    data.subCn.splice(di, 0, []);
  } else if (isScalar) {
    if (data.subSquareDiffSumX !== undefined) {
      data.subSquareDiffSumX.splice(di, 0, []);
      data.subNSumX.splice(di, 0, []);
      data.subObsModelDiffSumX.splice(di, 0, []);
      data.subModelSumX.splice(di, 0, []);
      data.subObsSumX.splice(di, 0, []);
      data.subAbsSumX.splice(di, 0, []);
      data.subSquareDiffSumY.splice(di, 0, []);
      data.subNSumY.splice(di, 0, []);
      data.subObsModelDiffSumY.splice(di, 0, []);
      data.subModelSumY.splice(di, 0, []);
      data.subObsSumY.splice(di, 0, []);
      data.subAbsSumY.splice(di, 0, []);
    } else {
      data.subSquareDiffSum.splice(di, 0, []);
      data.subNSum.splice(di, 0, []);
      data.subObsModelDiffSum.splice(di, 0, []);
      data.subModelSum.splice(di, 0, []);
      data.subObsSum.splice(di, 0, []);
      data.subAbsSum.splice(di, 0, []);
    }
  } else if (data.subRelHit !== undefined) {
    data.subRelHit.splice(di, 0, []);
    data.subRelCount.splice(di, 0, []);
    data.subRelRawCount.splice(di, 0, []);
  }
  if (data.subValsX !== undefined) {
    data.subValsX.splice(di, 0, []);
    data.subValsY.splice(di, 0, []);
  } else {
    data.subVals.splice(di, 0, []);
  }
  data.subSecs.splice(di, 0, []);
  if (hasLevels) {
    data.subLevs.splice(di, 0, []);
  }
  data.stats.splice(di, 0, []);
  data.text.splice(di, 0, []);
};

// utility to make null an existing point on a graph
const nullPoint = function (data, di, statVarName, isCTC, isScalar, hasLevels) {
  data[statVarName][di] = null;
  if (isCTC) {
    data.subHit[di] = [];
    data.subFa[di] = [];
    data.subMiss[di] = [];
    data.subCn[di] = [];
  } else if (isScalar) {
    if (data.subSquareDiffSumX !== undefined) {
      data.subSquareDiffSumX[di] = [];
      data.subNSumX[di] = [];
      data.subObsModelDiffSumX[di] = [];
      data.subModelSumX[di] = [];
      data.subObsSumX[di] = [];
      data.subAbsSumX[di] = [];
      data.subSquareDiffSumY[di] = [];
      data.subNSumY[di] = [];
      data.subObsModelDiffSumY[di] = [];
      data.subModelSumY[di] = [];
      data.subObsSumY[di] = [];
      data.subAbsSumY[di] = [];
    } else {
      data.subSquareDiffSum[di] = [];
      data.subNSum[di] = [];
      data.subObsModelDiffSum[di] = [];
      data.subModelSum[di] = [];
      data.subObsSum[di] = [];
      data.subAbsSum[di] = [];
    }
  } else if (data.subRelHit !== undefined) {
    data.subRelHit[di] = [];
    data.subRelCount[di] = [];
    data.subRelRawCount[di] = [];
  }
  if (data.subValsX !== undefined) {
    data.subValsX[di] = [];
    data.subValsY[di] = [];
  } else {
    data.subVals[di] = [];
  }
  data.subSecs[di] = [];
  if (hasLevels) {
    data.subLevs[di] = [];
  }
};

// used for sorting arrays
const sortFunction = function (a, b) {
  if (a[0] === b[0]) {
    return 0;
  }
  return a[0] < b[0] ? -1 : 1;
};

export default matsDataUtils = {
  areObjectsEqual,
  arrayContainsArray,
  arrayContainsSubArray,
  arraysEqual,
  arrayUnique,
  findArrayInSubArray,
  objectContainsObject,
  sum,
  average,
  median,
  stdev,
  dateConvert,
  getDateRange,
  secsConvert,
  doAuthorization,
  doColorScheme,
  doCredentials,
  doRoles,
  doSettings,
  callMetadataAPI,
  calculateStatCTC,
  calculateStatScalar,
  consolidateContour,
  excludeStatFromScorecard,
  get_err,
  ctcErrorPython,
  checkDiffContourSignificance,
  checkDiffContourSignificanceCTC,
  setHistogramParameters,
  calculateHistogramBins,
  prescribeHistogramBins,
  sortHistogramBins,
  getDiffContourCurveParams,
  sortFunction,
  removePoint,
  nullPoint,
  addNullPoint,
};
