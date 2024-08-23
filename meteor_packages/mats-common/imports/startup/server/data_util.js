/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections, matsMethods } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";
import { HTTP } from "meteor/jkuester:http";

/* global Npm */
/* eslint-disable global-require */
/* eslint-disable no-console */

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
      i += 1;
    } else if (superArray[i] === subArray[j]) {
      i += 1;
      j += 1;
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
  for (i = 0; i < superArray.length; i += 1) {
    if (subArray.length === superArray[i].length) {
      current = superArray[i];
      for (j = 0; j < subArray.length && subArray[j] === current[j]; j += 1);
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
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const arrayUnique = function (a) {
  const arr = [];
  for (let i = 0; i < a.length; i += 1) {
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
  for (i = 0; i < superArray.length; i += 1) {
    if (subArray.length === superArray[i].length) {
      current = superArray[i];
      for (j = 0; j < subArray.length && subArray[j] === current[j]; j += 1);
      if (j === subArray.length) return i;
    }
  }
  return -1;
};

// this function checks if an object is a value in another object
const objectContainsObject = function (superObject, subObject) {
  const superObjectKeys = Object.keys(superObject);
  let currentObject;
  for (let i = 0; i < superObjectKeys.length; i += 1) {
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
  return data.reduce(function (thisSum, value) {
    return !value ? thisSum : thisSum + value;
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
    const yr = date.getUTCFullYear();
    const day = date.getUTCDate();
    const month = date.getUTCMonth();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    return `${month}/${day}/${yr} ${hour}:${minute}`;
  }
  const dateParts = dStr.split(" ");
  const dateArray = dateParts[0].split(/[-/]/); // split on - or /    01-01-2017 OR 01/01/2017
  const month = dateArray[0];
  const day = dateArray[1];
  const yr = dateArray[2];
  let hour = 0;
  let minute = 0;
  if (dateParts[1]) {
    const timeArray = dateParts[1].split(":");
    [hour] = timeArray;
    [, minute] = timeArray;
  }
  return `${month}/${day}/${yr} ${hour}:${minute}`;
};

// this function converts a date string into an epoch
const secsConvert = function (dStr) {
  if (dStr === undefined || dStr === " ") {
    const now = new Date();
    return now.getTime() / 1000;
  }
  const dateParts = dStr.split(" ");
  const dateArray = dateParts[0].split(/[-/]/); // split on - or /    01-01-2017 OR 01/01/2017
  const month = dateArray[0];
  const day = dateArray[1];
  const yr = dateArray[2];
  let hour = 0;
  let minute = 0;
  if (dateParts[1]) {
    const timeArray = dateParts[1].split(":");
    [hour] = timeArray;
    [, minute] = timeArray;
  }
  const myDate = new Date(Date.UTC(yr, month - 1, day, hour, minute, 0));
  // to UTC time, not local time
  const dateInSecs = myDate.getTime();

  // to UTC time, not local time
  // return date_in_secs/1000 -3600*6;
  return dateInSecs / 1000;
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
        "rgb(95,95,95)",
        "rgb(238,130,238)",
        "rgb(0,0,139)",
        "rgb(148,0,211)",
        "rgb(135,135,135)",
        "rgb(190,120,120)",
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
  branch,
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
  let returnDestinationStructure = destinationStructure;
  const returnHideOtherFor = hideOtherFor;
  let returnExpectedApps = expectedApps;
  const Future = require("fibers/future");
  const pFuture = new Future();
  HTTP.get(queryURL, {}, function (error, response) {
    if (error) {
      console.log(error);
    } else {
      const metadata = JSON.parse(response.content);
      if (Array.isArray(returnDestinationStructure)) {
        // this is the list of apps. It's the only array in the API.
        returnDestinationStructure = [...returnDestinationStructure, ...metadata];
        returnExpectedApps = metadata;
      } else if (Object.keys(metadata).length === 0) {
        // this metadata type (e.g. 'threshold') is not valid for this app
        // we need to add placeholder metadata to the destination structure
        // and add the selector in question to the hideOtherFor map.
        const dummyMetadata = {};
        if (!selector.includes("values")) {
          returnHideOtherFor[selector] =
            returnHideOtherFor[selector] === undefined
              ? []
              : returnHideOtherFor[selector];
          for (let eidx = 0; eidx < returnExpectedApps.length; eidx += 1) {
            dummyMetadata[returnExpectedApps[eidx]] = fakeMetadata;
            returnHideOtherFor[selector].push(returnExpectedApps[eidx]);
          }
        }
        returnDestinationStructure = {
          ...returnDestinationStructure,
          ...dummyMetadata,
        };
      } else {
        returnDestinationStructure = { ...returnDestinationStructure, ...metadata };
      }
    }
    pFuture.return();
  });
  pFuture.wait();
  return [returnDestinationStructure, returnExpectedApps, returnHideOtherFor];
};

// calculates the statistic for ctc plots
const calculateStatCTC = function (hit, fa, miss, cn, n, statistic) {
  if (
    matsMethods.isThisANaN(hit) ||
    matsMethods.isThisANaN(fa) ||
    matsMethods.isThisANaN(miss) ||
    matsMethods.isThisANaN(cn)
  )
    return null;
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
  statisticAndVariable
) {
  if (
    matsMethods.isThisANaN(squareDiffSum) ||
    matsMethods.isThisANaN(NSum) ||
    matsMethods.isThisANaN(obsModelDiffSum) ||
    matsMethods.isThisANaN(modelSum) ||
    matsMethods.isThisANaN(obsSum) ||
    matsMethods.isThisANaN(absSum)
  )
    return null;
  let queryVal;
  const variable = statisticAndVariable.split("_")[1];
  const statistic = statisticAndVariable.split("_")[0];
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
  if (matsMethods.isThisANaN(queryVal)) return null;
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

// turn METexpress regions into readable text
const readableStandardRegions = function () {
  return {
    // EMC regions
    FULL: "FULL: Full Domain",
    APL: "APL: Appalachia",
    ATC: "ATC: North American Arctic",
    CAM: "CAM: Central America",
    CAR: "CAR: Caribbean",
    CONUS: "CONUS: Continental US",
    EAST: "EAST: Eastern US",
    ECA: "ECA: Eastern Canada",
    GLF: "GLF: Gulf of Mexico",
    GMC: "GMC: Gulf of Mexico Coast",
    GRB: "GRB: Great Basin",
    HWI: "HWI: Hawaii",
    LMV: "LMV: Lower Mississippi Valley",
    MDW: "MDW: Midwest US",
    MEX: "MEX: Mexico",
    N60: "N60: Northern Polar Latitudes",
    NAK: "NAK: Northern Alaska",
    NAO: "NAO: Northern North Atlantic Ocean",
    NEC: "NEC: Northeastern US Coast",
    NHX: "NHX: Northern Hemisphere (20N <= lat <= 80N)",
    NMT: "NMT: Northern Rocky Mountains",
    NPL: "NPL: Northern Great Plains",
    NPO: "NPO: Northern North Pacific Ocean",
    NSA: "NSA: Northern South America",
    NWC: "NWC: Northwestern US Coast",
    PNA: "PNA: Pacific / North America",
    PRI: "PRI: Puerto Rico",
    S60: "S60: Southern Polar Latitudes",
    SAC: "SAC: Southern Alaska",
    SAO: "SAO: Southern North Atlantic Ocean",
    SEC: "SEC: Southeastern US Coast",
    SHX: "SHX: Southern Hemisphere (20S >= lat >= 80S)",
    SMT: "SMT: Southern Rocky Mountains",
    SPL: "SPL: Southern Great Plains",
    SPO: "SPO: Southern North Pacific Ocean",
    SWC: "SWC: Southwestern US Coast",
    SWD: "SWD: Southwestern US Desert",
    TRO: "TRO: Global Tropics (20N >= lat >= 20S)",
    WCA: "WCA: Western Canada",
    WEST: "WEST: Western US",
    // GSL additions
    AAK: "AAK: Alaska",
    ALL_HRRR: "HRRR Domain",
    E_HRRR: "Eastern HRRR Domain",
    W_HRRR: "Western HRRR Domain",
    GtLk: "Great Lakes",
  };
};

// turn METexpress TC categories into readable text
const readableTCCategories = function () {
  return {
    TD: {
      name: "Tropical depression (wind <34kt)",
      order: "0",
    },
    TS: {
      name: "Tropical storm (wind 34–63 kt)",
      order: "1",
    },
    HU: {
      name: "Hurricane (wind ≥64 kt)",
      order: "2",
    },
    EX: {
      name: "Extratropical cyclone (any intensity)",
      order: "3",
    },
    SD: {
      name: "Subtropical depression (wind <34kt)",
      order: "4",
    },
    SS: {
      name: "Subtropical storm (wind ≥34kt)",
      order: "5",
    },
    LO: {
      name: "Low that isn't a tropical, subtropical, or extratropical cyclone",
      order: "6",
    },
    WV: {
      name: "Tropical wave (any intensity)",
      order: "7",
    },
    DB: {
      name: "Disturbance (any intensity)",
      order: "8",
    },
  };
};

// turn METexpress adeck models into readable text
const readableAdeckModels = function () {
  return {
    OFCL: "OFCL: Official NHC/CPHC Forecast",
    OFCI: "OFCI: Official NHC/CPHC Forecast",
    OFC2: "OFC2: Official NHC/CPHC Forecast",
    OFCP: "OFCP: Provisional NHC/CPHC Forecast",
    OFPI: "OFPI: Provisional NHC/CPHC Forecast",
    OFP2: "OFP2: Provisional NHC/CPHC Forecast",
    OHPC: "OHPC: Official WPC Forecast",
    OOPC: "OOPC: Official OPC Forecast",
    OMPC: "OMPC: Official MPC Forecast",
    JTWC: "JTWC: Official JTWC Forecast",
    JTWI: "JTWI: Official JTWC Forecast",
    AVNO: "AVNO: GFS",
    AVNI: "AVNI: GFS",
    AVN2: "AVN2: GFS",
    AHNI: "AHNI: GFS No Bias Correction",
    GFSO: "GFSO: GFS",
    GFSI: "GFSI: GFS",
    GFS2: "GFS2: GFS",
    AVXO: "AVXO: GFS 10-day Tracker",
    AVXI: "AVXI: GFS 10-day Tracker",
    AVX2: "AVX2: GFS 10-day Tracker",
    AC00: "AC00: GFS Ensemble Control",
    AEMN: "AEMN: GFS Ensemble Mean",
    AEMI: "AEMI: GFS Ensemble Mean",
    AEM2: "AEM2: GFS Ensemble Mean",
    AMMN: "AMMN: GFS New Ensemble Mean",
    CMC: "CMC: Canadian Global Model",
    CMCI: "CMCI: Canadian Global Model",
    CMC2: "CMC2: Canadian Global Model",
    CC00: "CC00: Canadian Ensemble Control",
    CEMN: "CEMN: Canadian Ensemble Mean",
    CEMI: "CEMI: Canadian Ensemble Mean",
    CEM2: "CEM2: Canadian Ensemble Mean",
    COTC: "COTC: US Navy COAMPS-TC",
    COTI: "COTI: US Navy COAMPS-TC",
    COT2: "COT2: US Navy COAMPS-TC",
    CTMN: "CTMN: US Navy COAMPS-TC Ensemble Mean",
    COAL: "COAL: US Navy COAMPS-TC, Atlantic Basin",
    COAI: "COAI: US Navy COAMPS-TC, Atlantic Basin",
    COA2: "COA2: US Navy COAMPS-TC, Atlantic Basin",
    COCE: "COCE: US Navy COAMPS-TC, E Pacific Basin",
    COEI: "COEI: US Navy COAMPS-TC, E Pacific Basin",
    COE2: "COE2: US Navy COAMPS-TC, E Pacific Basin",
    CTCX: "CTCX: Experimental US Navy COAMPS-TC",
    CTCI: "CTCI: Experimental US Navy COAMPS-TC",
    CTC2: "CTC2: Experimental US Navy COAMPS-TC",
    EGRR: "EGRR: UKMET (GTS Tracker)",
    EGRI: "EGRI: UKMET (GTS Tracker)",
    EGR2: "EGR2: UKMET (GTS Tracker)",
    UKX: "UKX: UKMET (NCEP Tracker)",
    UKXI: "UKXI: UKMET (NCEP Tracker)",
    UKX2: "UKX2: UKMET (NCEP Tracker)",
    UKM: "UKM: UKMET (Automated Tracker)",
    UKMI: "UKMI: UKMET (Automated Tracker)",
    UKM2: "UKM2: UKMET (Automated Tracker)",
    KEGR: "KEGR: UKMET (GTS Tracker; 2014)",
    KEGI: "KEGI: UKMET (GTS Tracker; 2014)",
    KEG2: "KEG2: UKMET (GTS Tracker; 2014)",
    UE00: "UE00: UKMET MOGREPS Ensemble Control",
    UEMN: "UEMN: UKMET MOGREPS Ensemble Mean",
    UEMI: "UEMI: UKMET MOGREPS Ensemble Mean",
    UEM2: "UEM2: UKMET MOGREPS Ensemble Mean",
    ECM: "ECM: ECMWF",
    ECMI: "ECMI: ECMWF",
    ECM2: "ECM2: ECMWF",
    ECMO: "ECMO: ECMWF (GTS Tracker)",
    ECOI: "ECOI: ECMWF (GTS Tracker)",
    ECO2: "ECO2: ECMWF (GTS Tracker)",
    EMX: "EMX: ECMWF (NCEP Tracker)",
    EMXI: "EMXI: ECMWF (NCEP Tracker)",
    EMX2: "EMX2: ECMWF (NCEP Tracker)",
    EHXI: "EHXI: ECMWF No Bias Correction (NCEP Tracker)",
    ECMF: "ECMF: ECMWF",
    ECME: "ECME: ECMWF EPS Ensemble Control (GTS Tracker)",
    EC00: "EC00: ECMWF EPS Ensemble Control (NCEP Tracker)",
    EEMN: "EEMN: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    EEMI: "EEMI: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    EMNI: "EMNI: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    EMN2: "EMN2: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    EMN3: "EMN3: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    EMN4: "EMN4: ECMWF EPS Ensemble Mean (NCEP Tracker)",
    JGSM: "JGSM: Japanese Global Spectral Model",
    JGSI: "JGSI: Japanese Global Spectral Model",
    JGS2: "JGS2: Japanese Global Spectral Model",
    NAM: "NAM: North American Mesoscale Model",
    NAMI: "NAMI: North American Mesoscale Model",
    NAM2: "NAM2: North American Mesoscale Model",
    NGPS: "NGPS: US Navy NOGAPS",
    NGPI: "NGPI: US Navy NOGAPS",
    NGP2: "NGP2: US Navy NOGAPS",
    NGX: "NGX: US Navy NOGAPS",
    NGXI: "NGXI: US Navy NOGAPS",
    NGX2: "NGX2: US Navy NOGAPS",
    NVGM: "NVGM: US Navy NAVGEM",
    NVGI: "NVGI: US Navy NAVGEM",
    NVG2: "NVG2: US Navy NAVGEM",
    HMON: "HMON: HMON Hurricane Model",
    HMNI: "HMNI: HMON Hurricane Model",
    HMN2: "HMN2: HMON Hurricane Model",
    HMMN: "HMMN: HMON Ensemble Mean",
    HAFS: "HAFS: Hurricane Analysis and Forecast System",
    HAFI: "HAFI: Hurricane Analysis and Forecast System",
    HAF2: "HAF2: Hurricane Analysis and Forecast System",
    HFSA: "HFSA: Hurricane Analysis and Forecast System - A",
    HFAI: "HFAI: Hurricane Analysis and Forecast System - A",
    HFA2: "HFA2: Hurricane Analysis and Forecast System - A",
    HFSB: "HFSB: Hurricane Analysis and Forecast System - B",
    HFBI: "HFBI: Hurricane Analysis and Forecast System - B",
    HFB2: "HFB2: Hurricane Analysis and Forecast System - B",
    HAMN: "HAMN: HAFS Ensemble Mean",
    HAMI: "HAMI: HAFS Ensemble Mean",
    HAM2: "HAM2: HAFS Ensemble Mean",
    HWRF: "HWRF: HWRF Hurricane Model",
    HWFI: "HWFI: HWRF Hurricane Model",
    HWF2: "HWF2: HWRF Hurricane Model",
    HWFE: "HWFE: HWRF Model (ECMWF Fields)",
    HWEI: "HWEI: HWRF Model (ECMWF Fields)",
    HWE2: "HWE2: HWRF Model (ECMWF Fields)",
    HW3F: "HW3F: HWRF Model v2013",
    HW3I: "HW3I: HWRF Model v2013",
    HW32: "HW32: HWRF Model v2013",
    HHFI: "HHFI: HWRF Model No Bias Correction",
    HWMN: "HWMN: HWRF Ensemble Mean",
    HWMI: "HWMI: HWRF Ensemble Mean",
    HWM2: "HWM2: HWRF Ensemble Mean",
    HHYC: "HHYC: HWRF with HYCOM Ocean Model",
    HHYI: "HHYI: HWRF with HYCOM Ocean Model",
    HHY2: "HHY2: HWRF with HYCOM Ocean Model",
    HWFH: "HWFH: Experimental NOAA/HRD HWRF",
    HWHI: "HWHI: Experimental NOAA/HRD HWRF",
    HWH2: "HWH2: Experimental NOAA/HRD HWRF",
    GFEX: "GFEX Consensus",
    HCCA: "HCCA Consensus",
    HCON: "HCON Consensus",
    ICON: "ICON Consensus",
    IVCN: "IVCN Consensus",
    IVCR: "IVCR Consensus",
    IVRI: "IVRI Consensus",
    IV15: "IV15 Consensus",
    INT4: "INT4 Consensus",
    GUNA: "GUNA Consensus",
    GUNS: "GUNS Consensus",
    CGUN: "CGUN Consensus",
    TCON: "TCON Consensus",
    TCOE: "TCOE Consensus",
    TCOA: "TCOA Consensus",
    TCCN: "TCCN Consensus",
    TVCN: "TVCN Consensus",
    TVCE: "TVCE Consensus",
    TVCA: "TVCA Consensus",
    TVCC: "TVCC Consensus",
    TVCP: "TVCP Consensus",
    TVCX: "TVCX Consensus",
    TVCY: "TVCY Consensus",
    RYOC: "RYOC Consensus",
    MYOC: "MYOC Consensus",
    RVCN: "RVCN Consensus",
    GENA: "GENA Consensus",
    CONE: "CONE Consensus",
    CONI: "CONI Consensus",
    CONU: "CONU Consensus",
    CCON: "CCON: Corrected CONU Consensus",
    BAMD: "BAMD: Deep-Layer Beta and Advection Model",
    TABD: "TABD: Deep-Layer Trajectory and Beta Model",
    BAMM: "BAMM: Medium-Layer Beta and Advection Model",
    TABM: "TABM: Medium-Layer Trajectory and Beta Model",
    BAMS: "BAMS: Shallow-Layer Beta and Advection Model",
    TABS: "TABS: Shallow-Layer Trajectory and Beta Model",
    KBMD: "KBMD: Parallel Deep-Layer Beta and Advection Model",
    KBMM: "KBMM: Parallel Medium-Layer Beta and Advection Model",
    KBMS: "KBMS: Parallel Shallow-Layer Beta and Advection Model",
    CLIP: "CLIP: 72-hr Climatology and Persistence",
    CLP5: "CLP5: 120-hr Climatology and Persistence",
    KCLP: "KCLP: Parallel 72-hr Climatology and Persistence",
    KCL5: "KCL5: Parallel 120-hr Climatology and Persistence",
    TCLP: "TCLP: 168-hr Trajectory Climatology and Persistence",
    LBAR: "LBAR: Limited Area Barotropic Model",
    KLBR: "KLBR: Parallel Limited Area Barotropic Model",
    LGEM: "LGEM: Logistical Growth Error Model",
    KLGM: "KLGM: Parallel Logistical Growth Error Model",
    SHFR: "SHFR: 72-hr SHIFOR Model",
    SHF5: "SHF5: 120-hr SHIFOR Model",
    DSHF: "DSHF: 72-hr Decay SHIFOR Model",
    DSF5: "DSF5: 120-hr Decay SHIFOR Model",
    KOCD: "KOCD: Parallel CLP5/Decay-SHIFOR",
    KSFR: "KSFR: Parallel 72-hr SHIFOR Model",
    KSF5: "KSF5: Parallel 120-hr SHIFOR Model",
    SHIP: "SHIP: SHIPS Model",
    DSHP: "DSHP: Decay SHIPS Model",
    SHNS: "SHNS: SHIPS Model No IR Profile Predictors",
    DSNS: "DSNS: Decay SHIPS Model No IR Profile Predictors",
    KSHP: "KSHP: Parallel SHIPS Model",
    KDSP: "KDSP: Parallel Decay SHIPS Model",
    OCD5: "OCD5: Operational CLP5 and DSHF Blended Model",
    DRCL: "DRCL: DeMaria Climatology and Persistence Model",
    DRCI: "DRCI: DeMaria Climatology and Persistence Model",
    MRCL: "MRCL: McAdie Climatology and Persistence Model",
    MRCI: "MRCI: McAdie Climatology and Persistence Model",
    AHQI: "AHQI: NCAR Hurricane Regional Model",
    HURN: "HURN: HURRAN Model",
    APSU: "APSU: PSU WRF-ARW Model",
    APSI: "APSI: PSU WRF-ARW Model",
    APS2: "APS2: PSU WRF-ARW Model",
    A4PS: "A4PS: PSU WRF-ARW Doppler 2011",
    A4PI: "A4PI: PSU WRF-ARW Doppler 2011",
    A4P2: "A4P2: PSU WRF-ARW Doppler 2011",
    A1PS: "A1PS: PSU WRF-ARW 1 km (Tail Doppler Radar Assimilated)",
    A1PI: "A1PI: PSU WRF-ARW 1 km (Tail Doppler Radar Assimilated)",
    A1P2: "A1P2: PSU WRF-ARW 1 km (Tail Doppler Radar Assimilated)",
    A4NR: "A4NR: PSU WRF-ARW 4.5 km (No Tail Doppler Radar Assimilated)",
    A4NI: "A4NI: PSU WRF-ARW 4.5 km (No Tail Doppler Radar Assimilated)",
    A4N2: "A4N2: PSU WRF-ARW 4.5 km (No Tail Doppler Radar Assimilated)",
    A4QI: "A4QI: PSU WRF-ARW 4.5 km (Tail Doppler Radar Assimilated; GFDL Interpolator)",
    A4Q2: "A4Q2: PSU WRF-ARW 4.5 km (Tail Doppler Radar Assimilated; GFDL Interpolator)",
    ANPS: "ANPS: PSU WRF-ARW 3 km (No Tail Doppler Radar Assimilated)",
    AHW4: "AHW4: SUNY Advanced Hurricane WRF",
    AHWI: "AHWI: SUNY Advanced Hurricane WRF",
    AHW2: "AHW2: SUNY Advanced Hurricane WRF",
    FIM9: "FIM9: Finite-Volume Icosahedral Model (FIM9)",
    FM9I: "FM9I: Finite-Volume Icosahedral Model (FIM9)",
    FM92: "FM92: Finite-Volume Icosahedral Model (FIM9)",
    FIMY: "FIMY: Finite-Volume Icosahedral Model (FIMY)",
    FIMI: "FIMI: Finite-Volume Icosahedral Model (FIMY)",
    FIM2: "FIM2: Finite-Volume Icosahedral Model (FIMY)",
    H3GP: "H3GP: NCEP/AOML Hires 3-Nest HWRF",
    H3GI: "H3GI: NCEP/AOML Hires 3-Nest HWRF",
    H3G2: "H3G2: NCEP/AOML Hires 3-Nest HWRF",
    GFDL: "GFDL: NWS/GFDL Model",
    GFDI: "GFDI: NWS/GFDL Model",
    GFD2: "GFD2: NWS/GFDL Model",
    GHTI: "GHTI: NWS/GFDL Model No Bias Correction",
    GHMI: "GHMI: NWS/GFDL Model Variable Intensity Offset",
    GHM2: "GHM2: NWS/GFDL Model Variable Intensity Offset",
    GFDT: "GFDT: NWS/GFDL Model (NCEP Tracker)",
    GFTI: "GFTI: NWS/GFDL Model (NCEP Tracker)",
    GFT2: "GFT2: NWS/GFDL Model (NCEP Tracker)",
    GFDN: "GFDN: NWS/GFDL Model (Navy Version)",
    GFNI: "GFNI: NWS/GFDL Model (Navy Version)",
    GFN2: "GFN2: NWS/GFDL Model (Navy Version)",
    GFDU: "GFDU: NWS/GFDL Model (UKMET Version)",
    GFUI: "GFUI: NWS/GFDL Model (UKMET Version)",
    GFU2: "GFU2: NWS/GFDL Model (UKMET Version)",
    GFD5: "GFD5: NWS/GFDL Model Parallel",
    GF5I: "GF5I: NWS/GFDL Model Parallel",
    GF52: "GF52: NWS/GFDL Model Parallel",
    GFDE: "GFDE: NWS/GFDL Model (ECMWF Fields)",
    GFEI: "GFEI: NWS/GFDL Model (ECMWF Fields)",
    GFE2: "GFE2: NWS/GFDL Model (ECMWF Fields)",
    GFDC: "GFDC: NWS/GFDL Coupled Model",
    GFCI: "GFCI: NWS/GFDL Coupled Model",
    GFC2: "GFC2: NWS/GFDL Coupled Model",
    GFDA: "GFDA: NWS/GFDL Model With Aviation PBL",
    GP00: "GP00: GFDL Ensemble Control",
    G00I: "G00I: GFDL Ensemble Control",
    G002: "G002: GFDL Ensemble Control",
    GPMN: "GPMN: GFDL Ensemble Mean",
    GPMI: "GPMI: GFDL Ensemble Mean",
    GPM2: "GPM2: GFDL Ensemble Mean",
    UWN4: "UWN4: UW Madison NMS Model 4km",
    UW4I: "UW4I: UW Madison NMS Model 4km",
    UW42: "UW42: UW Madison NMS Model 4km",
    UWN8: "UWN8: UW NMS Model 8km",
    UWNI: "UWNI: UW Madison NMS Model 8km",
    UWN2: "UWN2: UW Madison NMS Model 8km",
    UWQI: "UWQI: UW Madison NMS Model (GFDL Interpolator)",
    UWQ2: "UWQ2: UW Madison NMS Model (GFDL Interpolator)",
    TV15: "TV15: HFIP Stream 1_5 Model Consensus",
    FSSE: "FSSE: FSU Superensemble",
    FSSI: "FSSI: FSU Superensemble",
    MMSE: "MMSE: FSU Multimodel Superensemble",
    SPC3: "SPC3: Statistical Prediction of Intensity",
    CARQ: "CARQ: Combined ARQ Position",
    XTRP: "XTRP: 12-hr Extrapolation",
    KXTR: "KXTR: Parallel 12-hr Extrapolation",
    "90AE": "90AE: NHC-90 test",
    "90BE": "90BE: NHC-90 test",
    A98E: "A98E: NHC-98 Statistical-Dynamical Model",
    A67: "A67: NHC-67 Statistical-Synoptic Model",
    A72: "A72: NHC-72 Statistical-Dynamical Model",
    A73: "A73: NHC-73 Statistic Model",
    A83: "A83: NHC-83 Statistical-Dynamical Model",
    A90E: "A90E: NHC-90 (Early) Statistical-Dynamical Model",
    A90L: "A90L: NHC-90 (Late) Statistical-Dynamical Model",
    A9UK: "A9UK: NHC-98 (UKMET Version)",
    AFW1: "AFW1: US Air Force MM5 Model",
    AF1I: "AF1I: US Air Force MM5 Model",
    AF12: "AF12: US Air Force MM5 Model",
    MM36: "MM36: US Air Force MM5 Model",
    M36I: "M36I: US Air Force MM5 Model",
    M362: "M362: US Air Force MM5 Model",
    BAMA: "BAMA: BAM test A",
    BAMB: "BAMB: BAM test B",
    BAMC: "BAMC: BAM test C",
    ETA: "ETA: ETA Model",
    ETAI: "ETAI: ETA Model",
    ETA2: "ETA2: ETA Model",
    FV5: "FV5: NASA fvGCM Model",
    FVGI: "FVGI: NASA fvGCM Model",
    FVG2: "FVG2: NASA fvGCM Model",
    MFM: "MFM: Medium Fine Mesh Model",
    MRFO: "MRFO: Medium Range Forecast (MRF) Model",
    NGM: "NGM: Nested Grid Model",
    NGMI: "NGMI: Nested Grid Model",
    NGM2: "NGM2: Nested Grid Model",
    PSS: "PSS: EP Statistic-Synoptic Model",
    PSDL: "PSDL: EP Statistic-Dynamic Model",
    PSDE: "PSDL: EP (Early) Statistic-Dynamic Model",
    P91L: "P91L: EP NHC-91 (Late) Statistic-Dynamic Model",
    P91E: "P91E: EP NHC-91 (Early) Statistic-Dynamic Model",
    P9UK: "P91E: EP NHC-91 (UKMET) Statistic-Dynamic Model",
    QLM: "QLM: Quasi-Lagrangian Model",
    QLMI: "QLMI: Quasi-Lagrangian Model",
    QLM2: "QLM2: Quasi-Lagrangian Model",
    SBAR: "SBAR: SANBAR Barotropic Model",
    VBAR: "VBAR: VICBAR Model",
    VBRI: "VBRI: VICBAR Model",
    VBR2: "VBR2: VICBAR Model",
    DTOP: "DTOP: Deterministic to Probabilistic Statistical Model",
    DTPE: "DTPE: Deterministic to Probabilistic Statistical Model (ECMWF Version)",
    RIOB: "RIOB: Bayesian RI Model",
    RIOD: "RIOD: Discriminant Analysis RI Model",
    RIOL: "RIOL: Logistic Regression RI Model",
    RIOC: "RIOC: Consensus of RIOB, RIOD, RIOL",
    EIOB: "EIOB: Bayesian RI Model (ECMWF Version)",
    EIOD: "EIOD: Discriminant Analysis RI Model (ECMWF Version)",
    EIOL: "EIOL: Logistic Regression RI Model (ECMWF Version)",
    EIOC: "EIOC: Consensus of EIOB, EIOD, EIOL",
    GCP0: "GCP1: GFS-CAM Physics v0 (NOAA/GSL)",
    GCP1: "GCP1: GFS-CAM Physics v1 (NOAA/GSL)",
    GCP2: "GCP1: GFS-CAM Physics v2 (NOAA/GSL)",
    BEST: "BEST: Best Track",
    BCD5: "BCD5: Best Track Decay",
  };
};

// calculates mean, stdev, and other statistics for curve data points in all apps and plot types
const getErr = function (sVals, sSecs, sLevs, appParams) {
  /* refer to perl error_library.pl sub  get_stats
     to see the perl implementation of these statics calculations.
     These should match exactly those, except that they are processed in reverse order.
     */
  const autocorrLimit = 0.95;
  const { hasLevels } = appParams;

  let n = sVals.length;
  const dataWg = [];
  let nGaps = 0;
  let dataSum = 0;
  let sum2 = 0;
  let dMean = 0;
  let sd2 = 0;
  let sd = 0;
  let error;
  let i;

  if (n < 1) {
    return {
      dMean: null,
      stdeBetsy: null,
      sd: null,
      nGood: n,
      lag1: null,
      min: null,
      max: null,
      sum: null,
    };
  }

  // find minimum delta_time, if any value missing, set null
  let lastSecs = 0;
  let minDelta = Number.MAX_VALUE;
  let minSecs = Number.MAX_VALUE;
  let maxSecs = Number.MIN_VALUE;
  let minVal = Number.MAX_VALUE;
  let maxVal = -1 * Number.MAX_VALUE;
  let secs;
  let delta;
  for (i = 0; i < sSecs.length; i += 1) {
    if (matsMethods.isThisANaN(sVals[i])) {
      n -= 1;
    } else {
      secs = sSecs[i];
      delta = Math.abs(secs - lastSecs);
      if (delta > 0 && delta < minDelta) {
        minDelta = delta;
      }
      if (secs < minSecs) {
        minSecs = secs;
      }
      if (secs > maxSecs) {
        maxSecs = secs;
      }
      lastSecs = secs;
    }
  }

  if (minDelta < 0) {
    error = `Invalid time interval - minDelta: ${minDelta}`;
    console.log(`matsDataUtil.getErr: ${error}`);
  }
  for (i = 0; i < sVals.length; i += 1) {
    if (!matsMethods.isThisANaN(sVals[i])) {
      minVal = minVal < sVals[i] ? minVal : sVals[i];
      maxVal = maxVal > sVals[i] ? maxVal : sVals[i];
      dataSum += sVals[i];
      sum2 += sVals[i] * sVals[i];
    }
  }

  dMean = dataSum / n;
  sd2 = sum2 / n - dMean * dMean;
  if (sd2 > 0) {
    sd = Math.sqrt(sd2);
  }

  // look for gaps
  let lastSecond = -1 * Number.MAX_VALUE;
  let lastPressure = -1 * Number.MAX_VALUE;
  let nPressures;
  if (hasLevels) {
    nPressures = arrayUnique(sLevs).length;
  } else {
    nPressures = 1;
  }
  // set lag1_t to the first time the time changes from its initial value + 1 (data zero based)
  // set lag1_p to the first time the pressure changes from its initial value + 1 (data zero based)
  let lag1T = 0;
  let lag1P = 0;
  let r1T = 0; // autocorrelation for time
  let r1P = 0; // autocorrelation for pressure
  let j = 0; // i is loop index without gaps; j is loop index with gaps
  let nDeltas = 0;

  for (i = 0; i < sSecs.length; i += 1) {
    if (!matsMethods.isThisANaN(sVals[i])) {
      let sec = sSecs[i];
      if (typeof sec === "string" || sec instanceof String) sec = Number(sec);
      let lev;
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
        if (lag1P === 0 && lastPressure > 0) {
          if (lev !== lastPressure) {
            lag1P = j;
          }
        }
      }
      if (lastSecond >= 0) {
        if (lag1T === 0 && sec !== lastSecond) {
          lag1T = j;
        }
        if (Math.abs(sec - lastSecond) > minDelta) {
          nDeltas = (Math.abs(sec - lastSecond) / minDelta - 1) * nPressures;
          // for the Autocorrelation at lag 1, it doesn't matter how many missing
          // data we put in within gaps! (But for the other AC's it does.)
          // since we're using only the AC at lag 1 for calculating std err, let's
          // save cpu time and only put in one missing datum per gap, no matter
          // how long. WRM 2/22/2019
          // but if we're using a different lag, which could happen, we'll need
          // to insert all the missing data in each gap. WRM 2/22/2019
          // $n_deltas=1;
          for (let count = 0; count < nDeltas; count += 1) {
            dataWg.push(null);
            nGaps += 1;
            j += 1;
          }
        }
      }
      lastSecond = sec;
      if (hasLevels) {
        lastPressure = lev;
      }
      dataWg.push(sVals[i]);
      j += 1;
    }
  }

  // from http://www.itl.nist.gov/div898/handbook/eda/section3/eda35c.htm
  const r = [];
  const lagByR = {};
  const lag1Max = lag1P > lag1T ? lag1P : lag1T;
  // let rSum = 0;
  // let nR = 0;
  let nInLag;
  let lag;
  let t;
  for (lag = 0; lag <= lag1Max; lag += 1) {
    r[lag] = 0;
    nInLag = 0;
    for (t = 0; t < n + nGaps - lag; t += 1) {
      if (dataWg[t] && dataWg[t + lag]) {
        r[lag] += +(dataWg[t] - dMean) * (dataWg[t + lag] - dMean);
        nInLag += 1;
      }
    }
    if (nInLag > 0 && sd > 0) {
      r[lag] /= nInLag * sd * sd;
      // rSum += r[lag];
      // nR++;
    } else {
      r[lag] = null;
    }
    if (lag >= 1 && lag < (n + nGaps) / 2) {
      lagByR[r[lag]] = lag;
    }
  }
  if (lag1T > 0) {
    r1T = r[lag1T] !== undefined ? r[lag1T] : 0;
  }
  if (lag1P > 0) {
    r1P = r[lag1P] !== undefined ? r[lag1P] : 0;
  }

  // Betsy Weatherhead's correction, based on lag 1, augmented by the highest
  // lag > 1 and < n/2
  if (r1P >= autocorrLimit) {
    r1P = autocorrLimit;
  }
  if (r1T >= autocorrLimit) {
    r1T = autocorrLimit;
  }

  const betsy = Math.sqrt((n - 1) * (1 - r1P) * (1 - r1T));
  let stdeBetsy;
  if (betsy !== 0) {
    stdeBetsy = sd / betsy;
  } else {
    stdeBetsy = null;
  }
  const stats = {
    dMean,
    stdeBetsy,
    sd,
    nGood: n,
    lag1: r[1],
    min: minSecs,
    max: maxSecs,
    minVal,
    maxVal,
    sum: dataSum,
  };
  // console.log("stats are " + JSON.stringify(stats));
  // stdeBetsy is standard error with auto correlation
  // console.log("---------\n\n");
  return stats;
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
  return null;
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
      if (matsMethods.isThisANaN(binNum)) {
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
      if (matsMethods.isThisANaN(pivotVal)) {
        throw new Error("Error parsing bin pivot: please enter the desired bin pivot.");
      }
      break;

    case "Set number of bins and make zero a bin bound":
      // get the user's chosen number of bins and let the histogram routine know that we want the bins shifted over to zero
      binNum = Number(plotParams["bin-number"]);
      if (matsMethods.isThisANaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      pivotVal = 0;
      break;

    case "Set number of bins and choose a bin bound":
      // get the user's chosen number of bins and let the histogram routine know that we want the bins shifted over to whatever was input
      binNum = Number(plotParams["bin-number"]);
      if (matsMethods.isThisANaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      pivotVal = Number(plotParams["bin-pivot"]);
      if (matsMethods.isThisANaN(pivotVal)) {
        throw new Error("Error parsing bin pivot: please enter the desired bin pivot.");
      }
      break;

    case "Manual bins":
      // try to parse whatever we've been given for bin bounds. Throw an error if they didn't follow directions to enter a comma-separated list of numbers.
      try {
        binBounds = plotParams["bin-bounds"].split(",").map(function (item) {
          let thisItem = item.trim();
          thisItem = Number(thisItem);
          if (!matsMethods.isThisANaN(thisItem)) {
            return thisItem;
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
      if (matsMethods.isThisANaN(binNum)) {
        throw new Error(
          "Error parsing bin number: please enter the desired number of bins."
        );
      }
      binStart = Number(plotParams["bin-start"]);
      if (matsMethods.isThisANaN(binStart)) {
        throw new Error("Error parsing bin start: please enter the desired bin start.");
      }
      binStride = Number(plotParams["bin-stride"]);
      if (matsMethods.isThisANaN(binStride)) {
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
  const globalStats = getErr(curveSubStats, curveSubSecs, [], {
    hasLevels: false,
    outliers: appParams.outliers,
  }); // we don't need levels for the mean or sd calculations, so just pass in an empty array
  const globMean = globalStats.dMean;
  const globSd = globalStats.sd;

  let fullLowBound;
  let fullUpBound;
  let fullRange;
  let binInterval;

  if (binParams.binStart === undefined || binParams.binStride === undefined) {
    // use the global stats to determine the bin bounds -- should be based on dividing up +/- 3*sd from the mean into requested number of bins
    fullLowBound = globMean - 3 * globSd;
    fullUpBound = globMean + 3 * globSd;
    fullRange = 6 * globSd;
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
  for (let bIdx = 1; bIdx < binParams.binNum - 1; bIdx += 1) {
    binUpBounds[bIdx] = binUpBounds[bIdx - 1] + binInterval; // increment from fullLowBound to get the rest of the bin upper limits
    binLowBounds[bIdx] = binUpBounds[bIdx - 1];
    binMeans[bIdx] = binUpBounds[bIdx - 1] + binInterval / 2;
  }
  binUpBounds[binParams.binNum - 1] = Number.MAX_VALUE; // the last bin should have everything too large to fit into the previous bins, so make its upper bound the max number value
  binLowBounds[binParams.binNum - 1] = fullUpBound;
  binMeans[binParams.binNum - 1] = fullUpBound + binInterval / 2;

  if (binParams.pivotVal !== undefined && !matsMethods.isThisANaN(binParams.pivotVal)) {
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
  for (let bIdx = 0; bIdx < binParams.binNum; bIdx += 1) {
    lowSdFromMean = binLowBounds[bIdx].toFixed(2);
    upSdFromMean = binUpBounds[bIdx].toFixed(2);
    if (bIdx === 0) {
      binLabels[bIdx] = `< ${upSdFromMean}`;
    } else if (bIdx === binParams.binNum - 1) {
      binLabels[bIdx] = `> ${lowSdFromMean}`;
    } else {
      binLabels[bIdx] = `${lowSdFromMean}-${upSdFromMean}`;
    }
  }

  binStats.glob_mean = globMean;
  binStats.glob_sd = globSd;
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
  const returnBinParams = binParams;

  // calculate the global stats across all of the data
  const globalStats = getErr(curveSubStats, curveSubSecs, [], {
    hasLevels: false,
    outliers: appParams.outliers,
  }); // we don't need levels for the mean or sd calculations, so just pass in an empty array
  const globMean = globalStats.dMean;
  const globSd = globalStats.sd;

  // make sure the user-defined bins are in order from least to greatest
  returnBinParams.binBounds = returnBinParams.binBounds.sort(function (a, b) {
    return Number(a) - Number(b);
  });

  // store an array of the upper and lower bounding values for each bin.
  const binUpBounds = [];
  const binLowBounds = [];
  const binMeans = [];
  let binIntervalSum = 0;
  for (let bIdx = 1; bIdx < binParams.binNum - 1; bIdx += 1) {
    binUpBounds[bIdx] = binParams.binBounds[bIdx];
    binLowBounds[bIdx] = binParams.binBounds[bIdx - 1];
    binMeans[bIdx] = (binUpBounds[bIdx] + binLowBounds[bIdx]) / 2;
    binIntervalSum += binUpBounds[bIdx] - binLowBounds[bIdx];
  }
  const binIntervalAverage = binIntervalSum / (binParams.binNum - 2);
  [, binUpBounds[0]] = binLowBounds;
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
  for (let bIdx = 0; bIdx < binParams.binNum; bIdx += 1) {
    lowSdFromMean = binLowBounds[bIdx].toFixed(2);
    upSdFromMean = binUpBounds[bIdx].toFixed(2);
    if (bIdx === 0) {
      binLabels[bIdx] = `< ${upSdFromMean}`;
    } else if (bIdx === binParams.binNum - 1) {
      binLabels[bIdx] = `> ${lowSdFromMean}`;
    } else {
      binLabels[bIdx] = `${lowSdFromMean}-${upSdFromMean}`;
    }
  }

  binStats.glob_mean = globMean;
  binStats.glob_sd = globSd;
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
  const returnD = d;

  for (let bIdx = 0; bIdx < binNum; bIdx += 1) {
    binSubStats[bIdx] = [];
    binSubSecs[bIdx] = [];
    binSubLevs[bIdx] = [];
  }

  // calculate the global stats across all of the data
  const globalStats = getErr(curveSubStats, curveSubSecs, curveSubLevs, appParams);
  const globMean = globalStats.dMean;
  const globSd = globalStats.sd;
  const globN = globalStats.nGood;
  const globMax = globalStats.maxVal;
  const globMin = globalStats.minVal;

  // sort data into bins
  const { binUpBounds } = masterBinStats;
  const { binLowBounds } = masterBinStats;
  const { binMeans } = masterBinStats;
  const { binLabels } = masterBinStats;

  for (let dIdx = 0; dIdx < curveSubStats.length; dIdx += 1) {
    // iterate through all of the bins until we find one where the upper limit is greater than our datum.
    for (let bIdx = 0; bIdx < binNum; bIdx += 1) {
      if (curveSubStats[dIdx] <= binUpBounds[bIdx]) {
        binSubStats[bIdx].push(curveSubStats[dIdx]);
        binSubSecs[bIdx].push(curveSubSecs[dIdx]);
        if (appParams.hasLevels) {
          binSubLevs[bIdx].push(curveSubLevs[dIdx]);
        }
        break;
      }
    }
  }

  // calculate the statistics for each bin
  // we are especially interested in the number of values in each bin, as that is the plotted stat in a histogram
  let binStats;
  let binMean;
  let binSd;
  let binN;
  let binRf;

  for (let bIdx = 0; bIdx < binNum; bIdx += 1) {
    binStats = getErr(binSubStats[bIdx], binSubSecs[bIdx], binSubLevs[bIdx], appParams);
    binMean = binStats.dMean;
    binSd = binStats.sd;
    binN = binStats.nGood;
    binRf = binN / globN;

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

    returnD.x.push(binMeans[bIdx]);
    returnD.y.push(binN);
    returnD.subVals.push(binSubStats[bIdx]);
    returnD.subSecs.push(binSubSecs[bIdx]);
    returnD.bin_stats.push({
      bin_mean: binMean,
      bin_sd: binSd,
      bin_n: binN,
      bin_rf: binRf,
      binLowBound: binLowBounds[bIdx],
      binUpBound: binUpBounds[bIdx],
      binLabel: binLabels[bIdx],
    });
    returnD.text.push(null);

    if (appParams.hasLevels) {
      returnD.subLevs.push(binSubLevs[bIdx]);
    }

    // set axis limits based on returned data
    if (returnD.y[bIdx] !== null) {
      returnD.ymin = returnD.ymin < returnD.y[bIdx] ? returnD.ymin : returnD.y[bIdx];
      returnD.ymax = returnD.ymax > returnD.y[bIdx] ? returnD.ymax : returnD.y[bIdx];
    }
  }
  returnD.glob_stats = {
    glob_mean: globMean,
    glob_sd: globSd,
    glob_n: globN,
    glob_max: globMax,
    glob_min: globMin,
  };
  [returnD.xmin] = returnD.x;
  returnD.xmax = returnD.x[binNum - 1];

  return { d: returnD };
};

// utility that takes the curve params for two contour plots and collapses them into the curve params for one diff contour.
const getDiffContourCurveParams = function (curves) {
  const newCurve = {};
  const curveKeys = Object.keys(curves[0]);
  let currKey;
  for (let ckidx = 0; ckidx < curveKeys.length; ckidx += 1) {
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
  const returnData = data;
  returnData.x.splice(di, 1);
  returnData.y.splice(di, 1);
  if (
    plotType === matsTypes.PlotTypes.performanceDiagram ||
    plotType === matsTypes.PlotTypes.roc
  ) {
    returnData.oy_all.splice(di, 1);
    returnData.on_all.splice(di, 1);
  }
  if (returnData[`error_${statVarName}`].array !== undefined) {
    returnData[`error_${statVarName}`].array.splice(di, 1);
  }
  if (isCTC) {
    returnData.subHit.splice(di, 1);
    returnData.subFa.splice(di, 1);
    returnData.subMiss.splice(di, 1);
    returnData.subCn.splice(di, 1);
  } else if (isScalar) {
    if (returnData.subSquareDiffSumX !== undefined) {
      returnData.subSquareDiffSumX.splice(di, 1);
      returnData.subNSumX.splice(di, 1);
      returnData.subObsModelDiffSumX.splice(di, 1);
      returnData.subModelSumX.splice(di, 1);
      returnData.subObsSumX.splice(di, 1);
      returnData.subAbsSumX.splice(di, 1);
      returnData.subSquareDiffSumY.splice(di, 1);
      returnData.subNSumY.splice(di, 1);
      returnData.subObsModelDiffSumY.splice(di, 1);
      returnData.subModelSumY.splice(di, 1);
      returnData.subObsSumY.splice(di, 1);
      returnData.subAbsSumY.splice(di, 1);
    } else {
      returnData.subSquareDiffSum.splice(di, 1);
      returnData.subNSum.splice(di, 1);
      returnData.subObsModelDiffSum.splice(di, 1);
      returnData.subModelSum.splice(di, 1);
      returnData.subObsSum.splice(di, 1);
      returnData.subAbsSum.splice(di, 1);
    }
  } else if (returnData.subRelHit !== undefined) {
    returnData.subRelHit.splice(di, 1);
    returnData.subRelCount.splice(di, 1);
    returnData.subRelRawCount.splice(di, 1);
  }
  if (returnData.subValsX !== undefined) {
    returnData.subValsX.splice(di, 1);
    returnData.subValsY.splice(di, 1);
  } else {
    returnData.subVals.splice(di, 1);
  }
  returnData.subSecs.splice(di, 1);
  if (hasLevels) {
    returnData.subLevs.splice(di, 1);
  }
  returnData.stats.splice(di, 1);
  returnData.text.splice(di, 1);
  return returnData;
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
  const returnData = data;
  returnData[indVarName].splice(di, 0, newIndVar);
  returnData[statVarName].splice(di, 0, null);
  if (
    plotType === matsTypes.PlotTypes.performanceDiagram ||
    plotType === matsTypes.PlotTypes.roc
  ) {
    returnData.oy_all.splice(di, 0, null);
    returnData.on_all.splice(di, 0, null);
  }
  returnData[`error_${statVarName}`].splice(di, 0, null);
  if (isCTC) {
    returnData.subHit.splice(di, 0, []);
    returnData.subFa.splice(di, 0, []);
    returnData.subMiss.splice(di, 0, []);
    returnData.subCn.splice(di, 0, []);
  } else if (isScalar) {
    if (returnData.subSquareDiffSumX !== undefined) {
      returnData.subSquareDiffSumX.splice(di, 0, []);
      returnData.subNSumX.splice(di, 0, []);
      returnData.subObsModelDiffSumX.splice(di, 0, []);
      returnData.subModelSumX.splice(di, 0, []);
      returnData.subObsSumX.splice(di, 0, []);
      returnData.subAbsSumX.splice(di, 0, []);
      returnData.subSquareDiffSumY.splice(di, 0, []);
      returnData.subNSumY.splice(di, 0, []);
      returnData.subObsModelDiffSumY.splice(di, 0, []);
      returnData.subModelSumY.splice(di, 0, []);
      returnData.subObsSumY.splice(di, 0, []);
      returnData.subAbsSumY.splice(di, 0, []);
    } else {
      returnData.subSquareDiffSum.splice(di, 0, []);
      returnData.subNSum.splice(di, 0, []);
      returnData.subObsModelDiffSum.splice(di, 0, []);
      returnData.subModelSum.splice(di, 0, []);
      returnData.subObsSum.splice(di, 0, []);
      returnData.subAbsSum.splice(di, 0, []);
    }
  } else if (returnData.subRelHit !== undefined) {
    returnData.subRelHit.splice(di, 0, []);
    returnData.subRelCount.splice(di, 0, []);
    returnData.subRelRawCount.splice(di, 0, []);
  }
  if (returnData.subValsX !== undefined) {
    returnData.subValsX.splice(di, 0, []);
    returnData.subValsY.splice(di, 0, []);
  } else {
    returnData.subVals.splice(di, 0, []);
  }
  returnData.subSecs.splice(di, 0, []);
  if (hasLevels) {
    returnData.subLevs.splice(di, 0, []);
  }
  returnData.stats.splice(di, 0, []);
  returnData.text.splice(di, 0, []);
  return returnData;
};

// utility to make null an existing point on a graph
const nullPoint = function (data, di, statVarName, isCTC, isScalar, hasLevels) {
  const returnData = data;
  returnData[statVarName][di] = null;
  if (isCTC) {
    returnData.subHit[di] = [];
    returnData.subFa[di] = [];
    returnData.subMiss[di] = [];
    returnData.subCn[di] = [];
  } else if (isScalar) {
    if (returnData.subSquareDiffSumX !== undefined) {
      returnData.subSquareDiffSumX[di] = [];
      returnData.subNSumX[di] = [];
      returnData.subObsModelDiffSumX[di] = [];
      returnData.subModelSumX[di] = [];
      returnData.subObsSumX[di] = [];
      returnData.subAbsSumX[di] = [];
      returnData.subSquareDiffSumY[di] = [];
      returnData.subNSumY[di] = [];
      returnData.subObsModelDiffSumY[di] = [];
      returnData.subModelSumY[di] = [];
      returnData.subObsSumY[di] = [];
      returnData.subAbsSumY[di] = [];
    } else {
      returnData.subSquareDiffSum[di] = [];
      returnData.subNSum[di] = [];
      returnData.subObsModelDiffSum[di] = [];
      returnData.subModelSum[di] = [];
      returnData.subObsSum[di] = [];
      returnData.subAbsSum[di] = [];
    }
  } else if (returnData.subRelHit !== undefined) {
    returnData.subRelHit[di] = [];
    returnData.subRelCount[di] = [];
    returnData.subRelRawCount[di] = [];
  }
  if (returnData.subValsX !== undefined) {
    returnData.subValsX[di] = [];
    returnData.subValsY[di] = [];
  } else {
    returnData.subVals[di] = [];
  }
  returnData.subSecs[di] = [];
  if (hasLevels) {
    returnData.subLevs[di] = [];
  }
  return returnData;
};

// used for sorting arrays
const sortFunction = function (a, b) {
  if (a[0] === b[0]) {
    return 0;
  }
  return a[0] < b[0] ? -1 : 1;
};

// eslint-disable-next-line no-undef
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
  readableStandardRegions,
  readableTCCategories,
  readableAdeckModels,
  getErr,
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
