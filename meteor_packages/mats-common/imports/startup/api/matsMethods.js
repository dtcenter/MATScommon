/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import SimpleSchema from "meteor/aldeed:simple-schema";
import { Picker } from "meteor/meteorhacks:picker";
import {
  matsCache,
  matsCollections,
  matsDataQueryUtils,
  matsCouchbaseUtils,
  matsDataUtils,
  matsTypes,
  versionInfo,
} from "meteor/randyp:mats-common";
import { mysql } from "meteor/pcel:mysql";
import { moment } from "meteor/momentjs:moment";
import { _ } from "meteor/underscore";
import { Mongo } from "meteor/mongo";
import { curveParamsByApp } from "../both/mats-curve-params";

/* global cbPool, cbScorecardPool, cbScorecardSettingsPool, appSpecificResetRoutines */

/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable global-require */

// PRIVATE

// local collection used to keep the table update times for refresh - won't ever be synchronized or persisted.
const metaDataTableUpdates = new Mongo.Collection(null);
// initialize collection used for pop-out window functionality
const LayoutStoreCollection = new Mongo.Collection("LayoutStoreCollection");
// initialize collection used to cache previously downsampled plots
const DownSampleResults = new Mongo.Collection("DownSampleResults");

// utility to check for empty object
const isEmpty = function (map) {
  const mapKeys = Object.keys(map);
  return mapKeys.length === 0;
};

// private middleware for getting the status - think health check
const status = function (res) {
  if (Meteor.isServer) {
    const settings = matsCollections.Settings.findOne();
    res.end(
      `<body><div id='status'>Running: version - ${settings.appVersion} </div></body>`
    );
  }
};

// wrapper for NaN check
const isThisANaN = function (val) {
  // eslint-disable-next-line no-restricted-globals
  return val === undefined || val === null || isNaN(val);
};

// private - used to see if the main page needs to update its selectors
const checkMetaDataRefresh = async function () {
  // This routine compares the current last modified time of the tables (MYSQL) or documents (Couchbase)
  // used for curveParameter metadata with the last update time to determine if an update is necessary.
  // We really only do this for Curveparams
  /*
        metaDataTableUpdates:
        {
            name: dataBaseName(MYSQL) or bucketName(couchbase),
            (for couchbase tables are documents)
            tables: [tableName1, tableName2 ..],
            lastRefreshed : timestamp
        }
     */
  let refresh = false;
  const tableUpdates = metaDataTableUpdates.find({}).fetch();
  const dbType =
    matsCollections.Settings.findOne() !== undefined
      ? matsCollections.Settings.findOne().dbType
      : matsTypes.DbTypes.mysql;
  for (let tui = 0; tui < tableUpdates.length; tui += 1) {
    const id = tableUpdates[tui]._id;
    const poolName = tableUpdates[tui].pool;
    const dbName = tableUpdates[tui].name;
    const tableNames = tableUpdates[tui].tables;
    const { lastRefreshed } = tableUpdates[tui];
    let updatedEpoch = Number.MAX_VALUE;
    let rows;
    let doc;
    for (let ti = 0; ti < tableNames.length; ti += 1) {
      const tName = tableNames[ti];
      try {
        if (Meteor.isServer) {
          switch (dbType) {
            case matsTypes.DbTypes.mysql:
              rows = matsDataQueryUtils.simplePoolQueryWrapSynchronous(
                global[poolName],
                `SELECT UNIX_TIMESTAMP(UPDATE_TIME)` +
                  `    FROM   information_schema.tables` +
                  `    WHERE  TABLE_SCHEMA = '${dbName}'` +
                  `    AND TABLE_NAME = '${tName}'`
              );
              updatedEpoch = rows[0]["UNIX_TIMESTAMP(UPDATE_TIME)"];
              break;
            case matsTypes.DbTypes.couchbase:
              // the tName for couchbase is supposed to be the document id
              doc = await cbPool.getCB(tName);
              updatedEpoch = doc.updated;
              break;
            default:
              throw new Meteor.Error("resetApp: undefined DbType");
          }
        }
        // console.log("DB says metadata for table " + dbName + "." + tName + " was updated at " + updatedEpoch);
        if (
          updatedEpoch === undefined ||
          updatedEpoch === null ||
          updatedEpoch === "NULL" ||
          updatedEpoch === Number.MAX_VALUE
        ) {
          // if time of last update isn't stored by the database (thanks, Aurora DB), refresh automatically
          // console.log("_checkMetaDataRefresh - cannot find last update time for database: " + dbName + " and table: " + tName);
          refresh = true;
          // console.log("FORCED Refreshing the metadata for table because updatedEpoch is undefined" + dbName + "." + tName + " : updated at " + updatedEpoch);
          break;
        }
      } catch (e) {
        throw new Error(
          `_checkMetaDataRefresh - error finding last update time for database: ${dbName} and table: ${tName}, ERROR:${e.message}`
        );
      }
      const lastRefreshedEpoch = moment.utc(lastRefreshed).valueOf() / 1000;
      const updatedEpochMoment = moment.utc(updatedEpoch).valueOf();
      // console.log("Epoch of when this app last refreshed metadata for table " + dbName + "." + tName + " is " + lastRefreshedEpoch);
      // console.log("Epoch of when the DB says table " + dbName + "." + tName + " was last updated is " + updatedEpochMoment);
      if (lastRefreshedEpoch < updatedEpochMoment || updatedEpochMoment === 0) {
        // Aurora DB sometimes returns a 0 for last updated. In that case, do refresh the metadata.
        refresh = true;
        // console.log("Refreshing the metadata in the app selectors because table " + dbName + "." + tName + " was updated at " + moment.utc(updatedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss") + " while the metadata was last refreshed at " + moment.utc(lastRefreshedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss"));
        break;
      } else {
        // console.log("NOT Refreshing the metadata for table " + dbName + "." + tName + " : updated at " + moment.utc(updatedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss") + " : metadata last refreshed at " + moment.utc(lastRefreshedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss"));
      }
    }
    if (refresh === true) {
      // refresh the app metadata
      // app specific routines
      for (let ai = 0; ai < appSpecificResetRoutines.length; ai += 1) {
        await global.appSpecificResetRoutines[ai]();
      }
      // remember that we updated ALL the metadata tables just now
      metaDataTableUpdates.update(
        {
          _id: id,
        },
        {
          $set: {
            lastRefreshed: moment().format(),
          },
        }
      );
    }
  }
  return true;
};

// private middleware for clearing the cache
const clearCache = function (res) {
  if (Meteor.isServer) {
    matsCache.clear();
    res.end("<body><h1>clearCache Done!</h1></body>");
  }
};

// private middleware for dropping a distinct instance (a single run) of a scorecard
const dropThisScorecardInstance = async function (
  userName,
  name,
  submittedTime,
  processedAt
) {
  try {
    if (cbScorecardPool === undefined) {
      throw new Meteor.Error("dropThisScorecardInstance: No cbScorecardPool defined");
    }
    const statement = `DELETE
            From
                vxdata._default.SCORECARD sc
            WHERE
                sc.type='SC'
                AND sc.userName='${userName}'
                AND sc.name='${name}'
                AND sc.processedAt=${processedAt}
                AND sc.submitted=${submittedTime};`;
    return await cbScorecardPool.queryCB(statement);
    // delete this result from the mongo Scorecard collection
  } catch (err) {
    console.log(`dropThisScorecardInstance error : ${err.message}`);
    return {
      error: err.message,
    };
  }
};

// helper function for returning an array of database-distinct apps contained within a larger MATS app
function getListOfApps() {
  let apps;
  if (
    matsCollections.database !== undefined &&
    matsCollections.database.findOne({ name: "database" }) !== undefined
  ) {
    // get list of databases (one per app)
    apps = matsCollections.database.findOne({
      name: "database",
    }).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
  } else if (
    matsCollections.variable !== undefined &&
    matsCollections.variable.findOne({
      name: "variable",
    }) !== undefined &&
    matsCollections.threshold !== undefined &&
    matsCollections.threshold.findOne({
      name: "threshold",
    }) !== undefined
  ) {
    // get list of apps (variables in apps that also have thresholds)
    apps = matsCollections.variable.findOne({
      name: "variable",
    }).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
  } else {
    apps = [matsCollections.Settings.findOne().Title];
  }
  return apps;
}

// helper function to map a results array to specific apps
function mapArrayToApps(result) {
  // put results in a map keyed by app
  const newResult = {};
  const apps = getListOfApps();
  for (let aidx = 0; aidx < apps.length; aidx += 1) {
    if (result[aidx] === apps[aidx]) {
      newResult[apps[aidx]] = [result[aidx]];
    } else {
      newResult[apps[aidx]] = result;
    }
  }
  return newResult;
}

// helper function to map a results map to specific apps
function mapMapToApps(result) {
  // put results in a map keyed by app
  let newResult = {};
  let tempResult;
  const apps = getListOfApps();
  const resultKeys = Object.keys(result);
  if (!matsDataUtils.arraysEqual(apps.sort(), resultKeys.sort())) {
    if (resultKeys.includes("Predefined region")) {
      tempResult = result["Predefined region"];
    } else {
      tempResult = result;
    }
    for (let aidx = 0; aidx < apps.length; aidx += 1) {
      newResult[apps[aidx]] = tempResult;
    }
  } else {
    newResult = result;
  }
  return newResult;
}

// helper function for returning a map of database-distinct apps contained within a larger MATS app and their DBs
function getListOfAppDBs() {
  let apps;
  const result = {};
  let aidx;
  if (
    matsCollections.database !== undefined &&
    matsCollections.database.findOne({ name: "database" }) !== undefined
  ) {
    // get list of databases (one per app)
    apps = matsCollections.database.findOne({
      name: "database",
    }).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
    for (aidx = 0; aidx < apps.length; aidx += 1) {
      result[apps[aidx]] = matsCollections.database.findOne({
        name: "database",
      }).optionsMap[apps[aidx]].sumsDB;
    }
  } else if (
    matsCollections.variable !== undefined &&
    matsCollections.variable.findOne({
      name: "variable",
    }) !== undefined &&
    matsCollections.threshold !== undefined &&
    matsCollections.threshold.findOne({
      name: "threshold",
    }) !== undefined
  ) {
    // get list of apps (variables in apps that also have thresholds)
    apps = matsCollections.variable.findOne({
      name: "variable",
    }).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
    for (aidx = 0; aidx < apps.length; aidx += 1) {
      result[apps[aidx]] = matsCollections.variable.findOne({
        name: "variable",
      }).optionsMap[apps[aidx]];
      if (
        typeof result[apps[aidx]] !== "string" &&
        !(result[apps[aidx]] instanceof String)
      )
        result[apps[aidx]] = result[apps[aidx]].sumsDB;
    }
  } else {
    result[matsCollections.Settings.findOne().Title] =
      matsCollections.Databases.findOne({
        role: matsTypes.DatabaseRoles.SUMS_DATA,
        status: "active",
      }).database;
  }
  return result;
}

// helper function for getting a metadata map from a MATS selector, keyed by app title and model display text
function getMapByAppAndModel(selector, mapType) {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections[selector] !== undefined &&
      matsCollections[selector].findOne({ name: selector }) !== undefined &&
      matsCollections[selector].findOne({ name: selector })[mapType] !== undefined
    ) {
      // get map of requested selector's metadata
      result = matsCollections[selector].findOne({
        name: selector,
      })[mapType];
      let newResult = {};
      if (
        mapType === "valuesMap" ||
        selector === "variable" ||
        selector === "statistic"
      ) {
        // valueMaps always need to be re-keyed by app (statistic and variable get their valuesMaps from optionsMaps)
        newResult = mapMapToApps(result);
        result = newResult;
      } else if (
        matsCollections.database === undefined &&
        !(
          matsCollections.variable !== undefined &&
          matsCollections.threshold !== undefined
        )
      ) {
        // key by app title if we're not already
        const appTitle = matsCollections.Settings.findOne().Title;
        newResult[appTitle] = result;
        result = newResult;
      }
    } else {
      result = {};
    }
    flatJSON = JSON.stringify(result);
  } catch (e) {
    console.log(`error retrieving metadata from ${selector}: `, e);
    flatJSON = JSON.stringify({
      error: e,
    });
  }
  return flatJSON;
}

// helper function for getting a date metadata map from a MATS selector, keyed by app title and model display text
function getDateMapByAppAndModel() {
  let flatJSON = "";
  try {
    let result;
    // the date map can be in a few places. we have to hunt for it.
    if (
      matsCollections.database !== undefined &&
      matsCollections.database.findOne({
        name: "database",
      }) !== undefined &&
      matsCollections.database.findOne({
        name: "database",
      }).dates !== undefined
    ) {
      result = matsCollections.database.findOne({
        name: "database",
      }).dates;
    } else if (
      matsCollections.variable !== undefined &&
      matsCollections.variable.findOne({
        name: "variable",
      }) !== undefined &&
      matsCollections.variable.findOne({
        name: "variable",
      }).dates !== undefined
    ) {
      result = matsCollections.variable.findOne({
        name: "variable",
      }).dates;
    } else if (
      matsCollections["data-source"] !== undefined &&
      matsCollections["data-source"].findOne({
        name: "data-source",
      }) !== undefined &&
      matsCollections["data-source"].findOne({
        name: "data-source",
      }).dates !== undefined
    ) {
      result = matsCollections["data-source"].findOne({
        name: "data-source",
      }).dates;
    } else {
      result = {};
    }
    if (
      matsCollections.database === undefined &&
      !(
        matsCollections.variable !== undefined &&
        matsCollections.threshold !== undefined
      )
    ) {
      // key by app title if we're not already
      const appTitle = matsCollections.Settings.findOne().Title;
      const newResult = {};
      newResult[appTitle] = result;
      result = newResult;
    }
    flatJSON = JSON.stringify(result);
  } catch (e) {
    console.log("error retrieving datemap", e);
    flatJSON = JSON.stringify({
      error: e,
    });
  }
  return flatJSON;
}

// helper function for getting a metadata map from a MATS selector, keyed by app title
function getMapByApp(selector) {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections[selector] !== undefined &&
      matsCollections[selector].findOne({ name: selector }) !== undefined
    ) {
      // get array of requested selector's metadata
      result = matsCollections[selector].findOne({
        name: selector,
      }).options;
      if (!Array.isArray(result)) result = Object.keys(result);
    } else if (selector === "statistic") {
      result = ["ACC"];
    } else if (selector === "variable") {
      result = [matsCollections.Settings.findOne().Title];
    } else {
      result = [];
    }
    // put results in a map keyed by app
    let newResult;
    if (result.length === 0) {
      newResult = {};
    } else {
      newResult = mapArrayToApps(result);
    }
    flatJSON = JSON.stringify(newResult);
  } catch (e) {
    console.log(`error retrieving metadata from ${selector}: `, e);
    flatJSON = JSON.stringify({
      error: e,
    });
  }
  return flatJSON;
}

// helper function for populating the levels in a MATS selector
function getlevelsByApp() {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections.level !== undefined &&
      matsCollections.level.findOne({ name: "level" }) !== undefined
    ) {
      // we have levels already defined
      result = matsCollections.level.findOne({
        name: "level",
      }).options;
      if (!Array.isArray(result)) result = Object.keys(result);
    } else if (
      matsCollections.top !== undefined &&
      matsCollections.top.findOne({ name: "top" }) !== undefined
    ) {
      // use the MATS mandatory levels
      result = _.range(100, 1050, 50);
      if (!Array.isArray(result)) result = Object.keys(result);
    } else {
      result = [];
    }
    let newResult;
    if (result.length === 0) {
      newResult = {};
    } else {
      newResult = mapArrayToApps(result);
    }
    flatJSON = JSON.stringify(newResult);
  } catch (e) {
    console.log("error retrieving levels: ", e);
    flatJSON = JSON.stringify({
      error: e,
    });
  }
  return flatJSON;
}

// private middleware for getApps route
const getApps = function (res) {
  // this function returns an array of apps.
  if (Meteor.isServer) {
    let flatJSON = "";
    try {
      const result = getListOfApps();
      flatJSON = JSON.stringify(result);
    } catch (e) {
      console.log("error retrieving apps: ", e);
      flatJSON = JSON.stringify({
        error: e,
      });
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getAppSumsDBs route
const getAppSumsDBs = function (res) {
  // this function returns map of apps and appRefs.
  if (Meteor.isServer) {
    let flatJSON = "";
    try {
      const result = getListOfAppDBs();
      flatJSON = JSON.stringify(result);
    } catch (e) {
      console.log("error retrieving apps: ", e);
      flatJSON = JSON.stringify({
        error: e,
      });
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getModels route
const getModels = function (res) {
  // this function returns a map of models keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("data-source", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getRegions route
const getRegions = function (res) {
  // this function returns a map of regions keyed by app title and model display text
  if (Meteor.isServer) {
    let flatJSON = getMapByAppAndModel("region", "optionsMap");
    if (flatJSON === "{}") {
      flatJSON = getMapByAppAndModel("vgtyp", "optionsMap");
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getRegionsValuesMap route
const getRegionsValuesMap = function (res) {
  // this function returns a map of regions values keyed by app title
  if (Meteor.isServer) {
    let flatJSON = getMapByAppAndModel("region", "valuesMap");
    if (flatJSON === "{}") {
      flatJSON = getMapByAppAndModel("vgtyp", "valuesMap");
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getStatistics route
const getStatistics = function (res) {
  // this function returns an map of statistics keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByApp("statistic");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getStatisticsValuesMap route
const getStatisticsValuesMap = function (res) {
  // this function returns a map of statistic values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("statistic", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getVariables route
const getVariables = function (res) {
  // this function returns an map of variables keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByApp("variable");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getVariablesValuesMap route
const getVariablesValuesMap = function (res) {
  // this function returns a map of variable values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("variable", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getThresholds route
const getThresholds = function (res) {
  // this function returns a map of thresholds keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("threshold", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getThresholdsValuesMap route
const getThresholdsValuesMap = function (res) {
  // this function returns a map of threshold values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("threshold", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getScales route
const getScales = function (res) {
  // this function returns a map of scales keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("scale", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getScalesValuesMap route
const getScalesValuesMap = function (res) {
  // this function returns a map of scale values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("scale", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getTruth route
const getTruths = function (res) {
  // this function returns a map of truths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("truth", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getTruthValuesMap route
const getTruthsValuesMap = function (res) {
  // this function returns a map of truth values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("truth", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstLengths route
const getFcstLengths = function (res) {
  // this function returns a map of forecast lengths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("forecast-length", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstTypes route
const getFcstTypes = function (res) {
  // this function returns a map of forecast types keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("forecast-type", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstTypesValuesMap route
const getFcstTypesValuesMap = function (res) {
  // this function returns a map of forecast type values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByAppAndModel("forecast-type", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getValidTimes route
const getValidTimes = function (res) {
  // this function returns an map of valid times keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getMapByApp("valid-time");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getValidTimes route
const getLevels = function (res) {
  // this function returns an map of pressure levels keyed by app title
  if (Meteor.isServer) {
    const flatJSON = getlevelsByApp();
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getDates route
const getDates = function (res) {
  // this function returns a map of dates keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = getDateMapByAppAndModel();
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// helper function for getCSV
const stringifyCurveData = function (stringify, dataArray, res) {
  const thisDataArray = dataArray[0];
  stringify.stringify(
    thisDataArray,
    {
      header: true,
    },
    function (err, output) {
      if (err) {
        console.log("error in getCSV:", err);
        res.write(`error,${err.toLocaleString()}`);
        res.end(`<body><h1>getCSV Error! ${err.toLocaleString()}</h1></body>`);
        return;
      }
      res.write(output);
      if (dataArray.length > 1) {
        const newDataArray = dataArray.slice(1);
        stringifyCurveData(stringify, newDataArray, res);
      } else {
        res.end();
      }
    }
  );
};

// private method for getting pagenated data
// a newPageIndex of -1000 means get all the data (used for export)
// a newPageIndex of -2000 means get just the last page
const getPagenatedData = function (rky, p, np) {
  if (Meteor.isServer) {
    const key = rky;
    const myPageIndex = p;
    const newPageIndex = np;
    let rawReturn;

    try {
      const result = matsCache.getResult(key);
      rawReturn = result === undefined ? undefined : result.result; // getResult structure is {key:something, result:resultObject}
    } catch (e) {
      console.log("getPagenatedData: Error - ", e);
      return undefined;
    }
    const ret =
      rawReturn === undefined ? undefined : JSON.parse(JSON.stringify(rawReturn));
    let start;
    let end;
    let direction = 1;
    if (newPageIndex === -1000) {
      // all the data
      start = 0;
      end = Number.MAX_VALUE;
    } else if (newPageIndex === -2000) {
      // just the last page
      start = -2000;
      direction = -1;
    } else if (myPageIndex <= newPageIndex) {
      // proceed forward
      start = (newPageIndex - 1) * 100;
      end = newPageIndex * 100;
    } else {
      // move back
      direction = -1;
      start = newPageIndex * 100;
      end = (newPageIndex + 1) * 100;
    }

    let dsiStart;
    let dsiEnd;
    for (let csi = 0; csi < ret.data.length; csi += 1) {
      if (ret.data[csi].x && ret.data[csi].x.length > 100) {
        dsiStart = start;
        dsiEnd = end;
        if (dsiStart > ret.data[csi].x.length || dsiStart === -2000) {
          // show the last page if we either requested it specifically or are trying to navigate past it
          dsiStart = Math.floor(rawReturn.data[csi].x.length / 100) * 100;
          dsiEnd = rawReturn.data[csi].x.length;
          if (dsiEnd === dsiStart) {
            // make sure the last page isn't empty -= 1if rawReturn.data[csi].data.length/100 produces a whole number,
            // dsiStart and dsiEnd would be the same. This makes sure that the last full page is indeed the last page, without a phantom empty page afterwards
            dsiStart = dsiEnd - 100;
          }
        }
        if (dsiStart < 0) {
          // show the first page if we are trying to navigate before it
          dsiStart = 0;
          dsiEnd = 100;
        }
        if (dsiEnd < dsiStart) {
          // make sure that the end is after the start
          dsiEnd = dsiStart + 100;
        }
        if (dsiEnd > ret.data[csi].x.length) {
          // make sure we don't request past the end  -= 1 if results are one page, this should convert the
          // start and end from 0 and 100 to 0 and whatever the end is.
          dsiEnd = ret.data[csi].x.length;
        }
        ret.data[csi].x = rawReturn.data[csi].x.slice(dsiStart, dsiEnd);
        ret.data[csi].y = rawReturn.data[csi].y.slice(dsiStart, dsiEnd);
        ret.data[csi].stats = rawReturn.data[csi].stats.slice(dsiStart, dsiEnd);
        ret.data[csi].glob_stats = rawReturn.data[csi].glob_stats;
      }
    }

    if (direction === 1) {
      ret.dsiRealPageIndex = Math.floor(dsiEnd / 100);
    } else {
      ret.dsiRealPageIndex = Math.floor(dsiStart / 100);
    }
    ret.dsiTextDirection = direction;
    return ret;
  }
  return null;
};

// private method for getting pagenated results and flattening them in order to be appropriate for text display.
const getFlattenedResultData = function (rk, p, np) {
  if (Meteor.isServer) {
    try {
      const r = rk;
      const thisP = p;
      const thisNP = np;
      // get the pagenated data
      const result = getPagenatedData(r, thisP, thisNP);
      // find the type
      const { plotTypes } = result.basis.plotParams;
      const plotType = _.invert(plotTypes).true;
      // extract data
      let isCTC = false;
      let isModeSingle = false;
      let isModePairs = false;
      let labelSuffix;
      const returnData = {};
      const stats = {};
      let curveData = []; // array of maps
      const { data } = result;
      const { dsiRealPageIndex } = result;
      const { dsiTextDirection } = result;
      let firstBestFitIndex = -1;
      let bestFitIndexes = {};
      switch (plotType) {
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.profile:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.yearToYear:
          switch (plotType) {
            case matsTypes.PlotTypes.timeSeries:
            case matsTypes.PlotTypes.dailyModelCycle:
              labelSuffix = " time";
              break;
            case matsTypes.PlotTypes.profile:
              labelSuffix = " level";
              break;
            case matsTypes.PlotTypes.dieoff:
              labelSuffix = " forecast lead time";
              break;
            case matsTypes.PlotTypes.validtime:
              labelSuffix = " hour of day";
              break;
            case matsTypes.PlotTypes.threshold:
              labelSuffix = " threshold";
              break;
            case matsTypes.PlotTypes.gridscale:
              labelSuffix = " grid scale";
              break;
            case matsTypes.PlotTypes.yearToYear:
              labelSuffix = " year";
              break;
            default:
              labelSuffix = "x-value";
          }
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (reservedWords.indexOf(data[ci].label) === -1) {
              // for each curve
              isCTC =
                data[ci] !== undefined &&
                ((data[ci].stats !== undefined &&
                  data[ci].stats[0] !== undefined &&
                  data[ci].stats[0].hit !== undefined) ||
                  (data[ci].hitTextOutput !== undefined &&
                    data[ci].hitTextOutput.length > 0));
              isModePairs =
                data[ci] !== undefined &&
                data[ci].stats !== undefined &&
                data[ci].stats[0] !== undefined &&
                data[ci].stats[0].avgInterest !== undefined;
              isModeSingle =
                data[ci] !== undefined &&
                data[ci].stats !== undefined &&
                data[ci].stats[0] !== undefined &&
                data[ci].stats[0].nForecast !== undefined;
              // if the curve label is a reserved word do not process the curve (its a zero or max curve)
              stats.label = data[ci].label;
              stats.mean = data[ci].glob_stats.dMean;
              stats["standard deviation"] = data[ci].glob_stats.sd;
              stats.n = data[ci].glob_stats.nGood;
              if (
                plotType === matsTypes.PlotTypes.timeSeries ||
                plotType === matsTypes.PlotTypes.profile
              ) {
                stats["standard error"] = data[ci].glob_stats.stdeBetsy;
                stats.lag1 = data[ci].glob_stats.lag1;
              }
              stats.minimum = data[ci].glob_stats.minVal;
              stats.maximum = data[ci].glob_stats.maxVal;
              returnData.stats[data[ci].label] = stats;

              for (let cdi = 0; cdi < data[ci].x.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                if (plotType === matsTypes.PlotTypes.profile) {
                  curveDataElement[data[ci].label + labelSuffix] = data[ci].y[cdi];
                } else {
                  curveDataElement[data[ci].label + labelSuffix] = data[ci].x[cdi];
                }
                if (isCTC) {
                  curveDataElement.stat = data[ci].stats[cdi].stat;
                  curveDataElement.n = data[ci].stats[cdi].n;
                  curveDataElement.hit = data[ci].stats[cdi].hit;
                  curveDataElement.fa = data[ci].stats[cdi].fa;
                  curveDataElement.miss = data[ci].stats[cdi].miss;
                  curveDataElement.cn = data[ci].stats[cdi].cn;
                } else if (isModeSingle) {
                  curveDataElement.stat = data[ci].stats[cdi].stat;
                  curveDataElement.nForecast = data[ci].stats[cdi].nForecast;
                  curveDataElement.nMatched = data[ci].stats[cdi].nMatched;
                  curveDataElement.nSimple = data[ci].stats[cdi].nSimple;
                  curveDataElement.nTotal = data[ci].stats[cdi].nTotal;
                } else if (isModePairs) {
                  curveDataElement.stat = data[ci].stats[cdi].stat;
                  curveDataElement.n = data[ci].stats[cdi].n;
                  curveDataElement.avgInterest = data[ci].stats[cdi].avgInterest;
                } else {
                  curveDataElement.stat = data[ci].stats[cdi].stat;
                  curveDataElement.mean = data[ci].stats[cdi].mean;
                  curveDataElement["std dev"] = data[ci].stats[cdi].sd;
                  if (
                    plotType === matsTypes.PlotTypes.timeSeries ||
                    plotType === matsTypes.PlotTypes.profile
                  ) {
                    curveDataElement["std error"] = data[ci].stats[cdi].stdeBetsy;
                    curveDataElement.lag1 = data[ci].stats[cdi].lag1;
                  }
                  curveDataElement.n = data[ci].stats[cdi].nGood;
                }
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            // for each curve
            // if the curve label is a reserved word do not process the curve (its a zero or max curve)
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (
              reservedWords.indexOf(data[ci].label) === -1 &&
              !data[ci].label.includes(matsTypes.ReservedWords.noSkill)
            ) {
              stats.label = data[ci].label;
              if (plotType === matsTypes.PlotTypes.reliability) {
                stats["sample climo"] = data[ci].glob_stats.sample_climo;
              } else if (plotType === matsTypes.PlotTypes.roc) {
                stats.auc = data[ci].glob_stats.auc;
              }
              returnData.stats[data[ci].label] = stats;

              for (let cdi = 0; cdi < data[ci].y.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                if (plotType === matsTypes.PlotTypes.reliability) {
                  curveDataElement[`${data[ci].label} probability bin`] =
                    data[ci].stats[cdi].prob_bin;
                  if (data[ci].stats[cdi].hit_rate) {
                    curveDataElement["hit rate"] = data[ci].stats[cdi].hit_rate;
                  } else {
                    curveDataElement["observed frequency"] =
                      data[ci].stats[cdi].obs_freq;
                  }
                } else {
                  curveDataElement[`${data[ci].label} bin value`] =
                    data[ci].stats[cdi].bin_value;
                  curveDataElement["probability of detection"] =
                    data[ci].stats[cdi].pody;
                  if (plotType === matsTypes.PlotTypes.roc) {
                    curveDataElement["probability of false detection"] =
                      data[ci].stats[cdi].pofd;
                  } else {
                    curveDataElement["success ratio"] = data[ci].stats[cdi].fa;
                  }
                  curveDataElement.n = data[ci].stats[cdi].n;
                }
                if (data[ci].stats[cdi].obs_y) {
                  curveDataElement.oy = data[ci].stats[cdi].obs_y;
                  curveDataElement.on = data[ci].stats[cdi].obs_n;
                } else {
                  curveDataElement.hitcount = data[ci].stats[cdi].hit_count;
                  curveDataElement.fcstcount = data[ci].stats[cdi].fcst_count;
                }
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.gridscaleProb:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            // for each curve
            // if the curve label is a reserved word do not process the curve (its a zero or max curve)
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (reservedWords.indexOf(data[ci].label) === -1) {
              stats.label = data[ci].label;
              returnData.stats[data[ci].label] = stats;

              for (let cdi = 0; cdi < data[ci].y.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                curveDataElement[`${data[ci].label} probability bin`] =
                  data[ci].stats[cdi].bin_value;
                curveDataElement["number of grid points"] = data[ci].stats[cdi].n_grid;
                curveDataElement.n = data[ci].stats[cdi].n;
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.simpleScatter:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            // for each curve
            // if the curve label is a reserved word do not process the curve (its a zero or max curve)
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (reservedWords.indexOf(data[ci].label) === -1) {
              stats.label = data[ci].label;

              for (let cdi = 0; cdi < data[ci].y.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                curveDataElement[`${data[ci].label} bin value`] =
                  data[ci].stats[cdi].bin_value;
                curveDataElement["x-stat"] = data[ci].stats[cdi].xstat;
                curveDataElement["y-stat"] = data[ci].stats[cdi].ystat;
                curveDataElement.n = data[ci].stats[cdi].n;
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.map:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          stats.label = data[0].label;
          stats["total number of obs"] = data[0].stats.reduce(function (prev, curr) {
            return prev + curr.nTimes;
          }, 0);
          stats["mean difference"] = matsDataUtils.average(data[0].queryVal);
          stats["standard deviation"] = matsDataUtils.stdev(data[0].queryVal);
          stats["minimum time"] = data[0].stats.reduce(function (prev, curr) {
            return prev < curr.min_time ? prev : curr.min_time;
          });
          stats["minimum time"] = moment
            .utc(stats["minimum time"] * 1000)
            .format("YYYY-MM-DD HH:mm");
          stats["maximum time"] = data[0].stats.reduce(function (prev, curr) {
            return prev > curr.max_time ? prev : curr.max_time;
          });
          stats["maximum time"] = moment
            .utc(stats["maximum time"] * 1000)
            .format("YYYY-MM-DD HH:mm");

          returnData.stats[data[0].label] = stats;

          isCTC =
            data[0] !== undefined &&
            data[0].stats !== undefined &&
            data[0].stats[0] !== undefined &&
            data[0].stats[0].hit !== undefined;
          for (let si = 0; si < data[0].siteName.length; si += 1) {
            const curveDataElement = {};
            curveDataElement["site name"] = data[0].siteName[si];
            curveDataElement["number of times"] = data[0].stats[si].nTimes;
            if (isCTC) {
              curveDataElement.stat = data[0].queryVal[si];
              curveDataElement.hit = data[0].stats[si].hit;
              curveDataElement.fa = data[0].stats[si].fa;
              curveDataElement.miss = data[0].stats[si].miss;
              curveDataElement.cn = data[0].stats[si].cn;
            } else {
              curveDataElement["start date"] = moment
                .utc(data[0].stats[si].min_time * 1000)
                .format("YYYY-MM-DD HH:mm");
              curveDataElement["end date"] = moment
                .utc(data[0].stats[si].max_time * 1000)
                .format("YYYY-MM-DD HH:mm");
              curveDataElement.stat = data[0].queryVal[si];
            }
            curveData.push(curveDataElement);
          }
          returnData.data[data[0].label] = curveData;
          break;
        case matsTypes.PlotTypes.histogram:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            // for each curve
            // if the curve label is a reserved word do not process the curve (its a zero or max curve)
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (reservedWords.indexOf(data[ci].label) === -1) {
              stats.label = data[ci].label;
              stats.mean = data[ci].glob_stats.glob_mean;
              stats["standard deviation"] = data[ci].glob_stats.glob_sd;
              stats.n = data[ci].glob_stats.glob_n;
              stats.minimum = data[ci].glob_stats.glob_min;
              stats.maximum = data[ci].glob_stats.glob_max;
              returnData.stats[data[ci].label] = stats;

              for (let cdi = 0; cdi < data[ci].x.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                curveDataElement[`${data[ci].label} bin range`] =
                  data[ci].bin_stats[cdi].binLabel;
                curveDataElement.n = data[ci].bin_stats[cdi].bin_n;
                curveDataElement["bin rel freq"] = data[ci].bin_stats[cdi].bin_rf;
                curveDataElement["bin lower bound"] =
                  data[ci].bin_stats[cdi].binLowBound;
                curveDataElement["bin upper bound"] =
                  data[ci].bin_stats[cdi].binUpBound;
                curveDataElement["bin mean"] = data[ci].bin_stats[cdi].bin_mean;
                curveDataElement["bin std dev"] = data[ci].bin_stats[cdi].bin_sd;
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.ensembleHistogram:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          for (let ci = 0; ci < data.length; ci += 1) {
            // for each curve
            // if the curve label is a reserved word do not process the curve (its a zero or max curve)
            const reservedWords = Object.values(matsTypes.ReservedWords);
            if (reservedWords.indexOf(data[ci].label) === -1) {
              stats.label = data[ci].label;
              stats.mean = data[ci].glob_stats.dMean;
              stats["standard deviation"] = data[ci].glob_stats.sd;
              stats.n = data[ci].glob_stats.nGood;
              stats.minimum = data[ci].glob_stats.minVal;
              stats.maximum = data[ci].glob_stats.maxVal;
              returnData.stats[data[ci].label] = stats;

              for (let cdi = 0; cdi < data[ci].x.length; cdi += 1) {
                // for each datapoint
                const curveDataElement = {};
                curveDataElement[`${data[ci].label} bin`] = data[ci].x[cdi];
                curveDataElement.n = data[ci].bin_stats[cdi].bin_n;
                curveDataElement["bin rel freq"] = data[ci].bin_stats[cdi].bin_rf;
                curveData.push(curveDataElement);
              }
              returnData.data[data[ci].label] = curveData;
            }
          }
          break;
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
          returnData.stats = {}; // map of maps
          returnData.data = {}; // map of arrays of maps
          stats.label = data[0].label;
          stats["total number of points"] = data[0].glob_stats.n;
          stats["mean stat"] = data[0].glob_stats.mean;
          stats["minimum time"] = moment
            .utc(data[0].glob_stats.minDate * 1000)
            .format("YYYY-MM-DD HH:mm");
          stats["maximum time"] = moment
            .utc(data[0].glob_stats.maxDate * 1000)
            .format("YYYY-MM-DD HH:mm");

          returnData.stats[data[0].label] = stats;

          isCTC =
            data[0] !== undefined &&
            data[0].hitTextOutput !== undefined &&
            data[0].hitTextOutput.length > 0;
          for (let si = 0; si < data[0].xTextOutput.length; si += 1) {
            const curveDataElement = {};
            curveDataElement.xVal = data[0].xTextOutput[si];
            curveDataElement.yVal = data[0].yTextOutput[si];
            curveDataElement.stat = data[0].zTextOutput[si];
            curveDataElement.N = data[0].nTextOutput[si];
            if (isCTC) {
              curveDataElement.hit = data[0].hitTextOutput[si];
              curveDataElement.fa = data[0].faTextOutput[si];
              curveDataElement.miss = data[0].missTextOutput[si];
              curveDataElement.cn = data[0].cnTextOutput[si];
            } else {
              curveDataElement["Start Date"] = moment
                .utc(data[0].minDateTextOutput[si] * 1000)
                .format("YYYY-MM-DD HH:mm");
              curveDataElement["End Date"] = moment
                .utc(data[0].maxDateTextOutput[si] * 1000)
                .format("YYYY-MM-DD HH:mm");
            }
            curveData.push(curveDataElement);
          }
          returnData.data[data[0].label] = curveData;
          break;
        case matsTypes.PlotTypes.scatter2d:
          firstBestFitIndex = -1;
          bestFitIndexes = {};
          for (let ci = 0; ci < data.length; ci += 1) {
            if (ci === firstBestFitIndex) {
              break; // best fit curves are at the end so do not do further processing
            }
            curveData = data[ci];
            // look for a best fit curve - only have to look at curves with higher index than this one
            for (let cbi = ci + 1; cbi < data.length; cbi += 1) {
              if (
                data[cbi].label.indexOf(curveData.label) !== -1 &&
                data[cbi].label.indexOf("-best fit") !== -1
              ) {
                bestFitIndexes[ci] = cbi;
                if (firstBestFitIndex === -1) {
                  firstBestFitIndex = cbi;
                }
                break;
              }
            }
            const curveTextData = [];
            for (let cdi = 0; cdi < curveData.data.length; cdi += 1) {
              const element = {};
              [element.xAxis] = curveData.data[cdi];
              [, element.yAxis] = curveData.data[cdi];
              if (bestFitIndexes[ci] === undefined) {
                element["best fit"] = "none;";
              } else {
                [, element["best fit"]] = data[bestFitIndexes[ci]].data[cdi];
              }
              curveTextData.push(element);
            }
            returnData[curveData.label] = curveTextData;
          }
          break;
        default:
          return undefined;
      }
      returnData.dsiRealPageIndex = dsiRealPageIndex;
      returnData.dsiTextDirection = dsiTextDirection;
      return returnData;
    } catch (error) {
      throw new Meteor.Error(
        `Error in getFlattenedResultData function: ${error.message}`
      );
    }
  }
  return null;
};

// private middleware for getCSV route
const getCSV = function (params, res) {
  if (Meteor.isServer) {
    const stringify = require("csv-stringify");
    let csv = "";
    try {
      const result = getFlattenedResultData(params.key, 0, -1000);
      const statArray = Object.values(result.stats);
      const dataArray = Object.values(result.data);

      const fileName = `matsplot-${moment.utc().format("YYYYMMDD-HH.mm.ss")}.csv`;
      res.setHeader("Content-disposition", `attachment; filename=${fileName}`);
      res.setHeader("Content-Type", "attachment.ContentType");
      stringify.stringify(
        statArray,
        {
          header: true,
        },
        function (err, output) {
          if (err) {
            console.log("error in getCSV:", err);
            res.write(`error,${err.toLocaleString()}`);
            res.end(`<body><h1>getCSV Error! ${err.toLocaleString()}</h1></body>`);
            return;
          }
          res.write(output);
          stringifyCurveData(stringify, dataArray, res);
        }
      );
    } catch (e) {
      console.log("error retrieving data: ", e);
      csv = `error,${e.toLocaleString()}`;
      res.setHeader("Content-disposition", "attachment; filename=matsplot.csv");
      res.setHeader("Content-Type", "attachment.ContentType");
      res.end(`<body><h1>getCSV Error! ${csv}</h1></body>`);
    }
  }
};

// private middleware for getJSON route
const getJSON = function (params, res) {
  if (Meteor.isServer) {
    let flatJSON = "";
    try {
      const result = getPagenatedData(params.key, 0, -1000);
      flatJSON = JSON.stringify(result);
    } catch (e) {
      console.log("error retrieving data: ", e);
      flatJSON = JSON.stringify({
        error: e,
      });
      delete flatJSON.dsiRealPageIndex;
      delete flatJSON.dsiTextDirection;
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private define a middleware for refreshing the metadata
const refreshMetadataMWltData = function (res) {
  if (Meteor.isServer) {
    console.log("Server route asked to refresh metadata");

    try {
      console.log("GUI asked to refresh metadata");
      checkMetaDataRefresh();
    } catch (e) {
      console.log(e);
      res.end(
        `<body>` +
          `<h1>refreshMetadata Failed!</h1>` +
          `<p>${e.message}</p>` +
          `</body>`
      );
    }
    res.end("<body><h1>refreshMetadata Done!</h1></body>");
  }
};

// private middleware for causing the scorecard to refresh its mongo collection for a given document
const refreshScorecard = function (params, res) {
  if (Meteor.isServer) {
    const docId = decodeURIComponent(params.docId);
    // get userName, name, submitted, processedAt from id
    // SC:anonymous -= 1submitted:20230322230435 -= 11block:0:02/19/2023_20_00_-_03/21/2023_20_00
    if (cbScorecardPool === undefined) {
      throw new Meteor.Error("getScorecardData: No cbScorecardPool defined");
    }
    const statement = `SELECT sc.*
                From
                    vxdata._default.SCORECARD sc
                WHERE
                    sc.id='${docId}';`;
    cbScorecardPool
      .queryCB(statement)
      .then((result) => {
        // insert this result into the mongo Scorecard collection - createdAt is used for TTL
        // created at gets updated each display even if it already existed.
        // TTL is 24 hours
        if (typeof result === "string") {
          throw new Error(`Error from couchbase query - ${result}`);
        } else if (result[0] === undefined) {
          throw new Error("Error from couchbase query - document not found");
        } else {
          matsCollections.Scorecard.upsert(
            {
              "scorecard.userName": result[0].userName,
              "scorecard.name": result[0].name,
              "scorecard.submitted": result[0].submitted,
              "scorecard.processedAt": result[0].processedAt,
            },
            {
              $set: {
                createdAt: new Date(),
                scorecard: result[0],
              },
            }
          );
        }
        res.end("<body><h1>refreshScorecard Done!</h1></body>");
      })
      .catch((err) => {
        res.end(
          `<body>` +
            `<h1>refreshScorecard Failed!</h1>` +
            `<p>${err.message}</p>` +
            `</body>`
        );
      });
  }
};

const setStatusScorecard = function (params, req, res) {
  if (Meteor.isServer) {
    const docId = decodeURIComponent(params.docId);
    let body = "";
    req.on(
      "data",
      Meteor.bindEnvironment(function (data) {
        body += data;
      })
    );

    req.on(
      "end",
      Meteor.bindEnvironment(function () {
        // console.log(body);
        try {
          const doc = JSON.parse(body);
          const docStatus = doc.status;
          const found = matsCollections.Scorecard.find({ id: docId }).fetch();
          if (found.length === 0) {
            throw new Error("Error from scorecard lookup - document not found");
          }
          matsCollections.Scorecard.upsert(
            {
              id: docId,
            },
            {
              $set: {
                docStatus,
              },
            }
          );
          // set error if there is one somehow. (use the session?)
          res.end("<body><h1>setScorecardStatus Done!</h1></body>");
        } catch (err) {
          res.statusCode = 400;
          res.end(
            `<body>` +
              `<h1>setScorecardStatus Failed!</h1>` +
              `<p>${err.message}</p>` +
              `</body>`
          );
        }
      })
    );
  }
};

// private save the result from the query into mongo and downsample if that result's size is greater than 1.2Mb
const saveResultData = function (result) {
  if (Meteor.isServer) {
    const storedResult = result;
    const sizeof = require("object-sizeof");
    const hash = require("object-hash");
    const key = hash(storedResult.basis.plotParams);
    const threshold = 1200000;
    let ret = {};
    try {
      const dSize = sizeof(storedResult.data);
      // console.log("storedResult.basis.data size is ", dSize);
      // TimeSeries and DailyModelCycle are the only plot types that require downSampling
      if (
        dSize > threshold &&
        (storedResult.basis.plotParams.plotTypes.TimeSeries ||
          storedResult.basis.plotParams.plotTypes.DailyModelCycle)
      ) {
        // greater than threshold need to downsample
        // downsample and save it in DownSampleResult
        console.log("DownSampling");
        const downsampler = require("downsample-lttb");
        let totalPoints = 0;
        for (let di = 0; di < storedResult.data.length; di += 1) {
          totalPoints += storedResult.data[di].x_epoch.length;
        }
        const allowedNumberOfPoints = (threshold / dSize) * totalPoints;
        const downSampleResult =
          storedResult === undefined
            ? undefined
            : JSON.parse(JSON.stringify(storedResult));
        for (let ci = 0; ci < storedResult.data.length; ci += 1) {
          const dsData = {};
          const xyDataset = storedResult.data[ci].x_epoch.map(function (d, index) {
            return [
              storedResult.data[ci].x_epoch[index],
              storedResult.data[ci].y[index],
            ];
          });
          const ratioTotalPoints = xyDataset.length / totalPoints;
          const myAllowedPoints = Math.round(ratioTotalPoints * allowedNumberOfPoints);
          // downsample the array
          let downsampledSeries;
          if (myAllowedPoints < xyDataset.length && xyDataset.length > 2) {
            downsampledSeries = downsampler.processData(xyDataset, myAllowedPoints);
            // replace the y attributes (tooltips etc.) with the y attributes from the nearest x
            let originalIndex = 0;
            // skip through the original dataset capturing each downSampled data point
            const arrayKeys = [];
            const nonArrayKeys = [];
            const keys = Object.keys(storedResult.data[ci]);
            for (let ki = 0; ki < keys.length; ki += 1) {
              if (keys[ki] !== "x_epoch") {
                if (Array.isArray(storedResult.data[ci][keys[ki]])) {
                  arrayKeys.push(keys[ki]);
                  dsData[keys[ki]] = [];
                } else {
                  nonArrayKeys.push(keys[ki]);
                }
              }
            }
            // We only ever downsample series plots - never profiles and series plots only ever have error_y arrays.
            // This is a little hacky but what is happening is we putting error_y.array on the arrayKeys list so that it gets its
            // downsampled equivalent values.
            for (let ki = 0; ki < nonArrayKeys.length; ki += 1) {
              dsData[nonArrayKeys[ki]] = JSON.parse(
                JSON.stringify(storedResult.data[ci][nonArrayKeys[ki]])
              );
            }
            // remove the original error_y array data.
            dsData.error_y.array = [];
            for (let dsi = 0; dsi < downsampledSeries.length; dsi += 1) {
              while (
                originalIndex < storedResult.data[ci].x_epoch.length &&
                storedResult.data[ci].x_epoch[originalIndex] < downsampledSeries[dsi][0]
              ) {
                originalIndex += 1;
              }
              // capture the stuff related to this downSampled data point (downSampled data points are always a subset of original data points)
              for (let ki = 0; ki < arrayKeys.length; ki += 1) {
                dsData[arrayKeys[ki]][dsi] =
                  storedResult.data[ci][arrayKeys[ki]][originalIndex];
              }
              dsData.error_y.array[dsi] =
                storedResult.data[ci].error_y.array[originalIndex];
            }
            // add downsampled annotation to curve options
            downSampleResult[ci] = dsData;
            downSampleResult[ci].annotation += "   **DOWNSAMPLED**";
          } else {
            downSampleResult[ci] = storedResult.data[ci];
          }
          downSampleResult.data[ci] = downSampleResult[ci];
        }
        DownSampleResults.rawCollection().insert({
          createdAt: new Date(),
          key,
          result: downSampleResult,
        }); // createdAt ensures expiration set in mats-collections
        ret = {
          key,
          result: downSampleResult,
        };
      } else {
        ret = {
          key,
          result: storedResult,
        };
      }
      // save original dataset in the matsCache
      if (
        storedResult.basis.plotParams.plotTypes.TimeSeries ||
        storedResult.basis.plotParams.plotTypes.DailyModelCycle
      ) {
        for (let ci = 0; ci < storedResult.data.length; ci += 1) {
          delete storedResult.data[ci].x_epoch; // we only needed this as an index for downsampling
        }
      }
      matsCache.storeResult(key, {
        key,
        result: storedResult,
      }); // lifespan is handled by lowDb (internally) in matscache
    } catch (error) {
      if (error.toLocaleString().indexOf("larger than the maximum size") !== -1) {
        throw new Meteor.Error(": Requesting too much data... try averaging");
      }
    }
    return ret;
  }
  return null;
};

// Utility method for writing out the meteor.settings file
const writeSettings = function (settings, appName) {
  const fs = require("fs");
  let settingsPath = process.env.METEOR_SETTINGS_DIR;
  if (!settingsPath) {
    console.log(
      "environment var METEOR_SETTINGS_DIR is undefined: setting it to /usr/app/settings"
    );
    settingsPath = "/usr/app/settings";
  }
  if (!fs.existsSync(settingsPath)) {
    fs.mkdirSync(settingsPath, {
      recursive: true,
    });
  }
  let appSettings = {};
  let newSettings = {};
  try {
    const appSettingsData = fs.readFileSync(`${settingsPath}/${appName}/settings.json`);
    appSettings = JSON.parse(appSettingsData);
  } catch (e) {
    appSettings = {
      private: {},
      public: {},
    };
  }
  newSettings = settings;
  // Merge settings into appSettings
  newSettings.private = {
    ...appSettings.private,
    ...settings.private,
  };
  newSettings.public = {
    ...appSettings.public,
    ...settings.public,
  };
  // write the settings file
  const jsonSettings = JSON.stringify(newSettings, null, 2);
  // console.log (jsonSettings);
  fs.writeFileSync(`${settingsPath}/${appName}/settings.json`, jsonSettings, {
    encoding: "utf8",
    flag: "w",
  });
};
// return the scorecard for the provided selectors
const getThisScorecardData = async function (userName, name, submitted, processedAt) {
  try {
    if (cbScorecardPool === undefined) {
      throw new Meteor.Error("getThisScorecardData: No cbScorecardPool defined");
    }
    const statement = `SELECT sc.*
            From
                vxdata._default.SCORECARD sc
            WHERE
                sc.type='SC'
                AND sc.userName='${userName}'
                AND sc.name='${name}'
                AND sc.processedAt=${processedAt}
                AND sc.submitted=${submitted};`;
    const result = await cbScorecardPool.queryCBWithConsistency(statement);
    if (typeof result === "string" && result.indexOf("ERROR")) {
      throw new Meteor.Error(result);
    }
    // insert this result into the mongo Scorecard collection - createdAt is used for TTL
    // created at gets updated each display even if it already existed.
    // TTL is 24 hours
    matsCollections.Scorecard.upsert(
      {
        "scorecard.userName": result[0].userName,
        "scorecard.name": result[0].name,
        "scorecard.submitted": result[0].submitted,
        "scorecard.processedAt": result[0].processedAt,
      },
      {
        $set: {
          createdAt: new Date(),
          scorecard: result[0],
        },
      }
    );
    const docID = matsCollections.Scorecard.findOne(
      {
        "scorecard.userName": result[0].userName,
        "scorecard.name": result[0].name,
        "scorecard.submitted": result[0].submitted,
        "scorecard.processedAt": result[0].processedAt,
      },
      { _id: 1 }
    )._id;
    // no need to return the whole thing, just the identifying fields
    // and the ID. The app will find the whole thing in the mongo collection.
    return { scorecard: result[0], docID };
  } catch (err) {
    console.log(`getThisScorecardData error : ${err.message}`);
    return {
      error: err.message,
    };
  }
};

// return the scorecard status information from the couchbase database
const getThisScorecardInfo = async function () {
  try {
    if (cbScorecardPool === undefined) {
      throw new Meteor.Error("getThisScorecardInfo: No cbScorecardPool defined");
    }

    const statement = `SELECT
            sc.id,
            sc.userName,
            sc.name,
            sc.status,
            sc.processedAt as processedAt,
            sc.submitted,
            sc.dateRange
            From
            vxdata._default.SCORECARD sc
            WHERE
            sc.type='SC';`;
    const result = await cbScorecardPool.queryCBWithConsistency(statement);
    const scMap = {};
    result.forEach(function (elem) {
      if (!Object.keys(scMap).includes(elem.userName)) {
        scMap[elem.userName] = {};
      }
      const userElem = scMap[elem.userName];
      if (!Object.keys(userElem).includes(elem.name)) {
        userElem[elem.name] = {};
      }
      const nameElem = userElem[elem.name];
      if (!Object.keys(nameElem).includes(elem.submited)) {
        nameElem[elem.submitted] = {};
      }
      const submittedElem = nameElem[elem.submitted];
      submittedElem[elem.processedAt] = {
        id: elem.id,
        status: elem.status,
        submitted: elem.submitted,
      };
    });
    return scMap;
  } catch (err) {
    console.log(`getThisScorecardInfo error : ${err.message}`);
    return {
      error: err.message,
    };
  }
};

const getThesePlotParamsFromScorecardInstance = async function (
  userName,
  name,
  submitted,
  processedAt
) {
  try {
    if (cbScorecardPool === undefined) {
      throw new Meteor.Error(
        "getThesePlotParamsFromScorecardInstance: No cbScorecardPool defined"
      );
    }
    const statement = `SELECT sc.plotParams
            From
                vxdata._default.SCORECARD sc
            WHERE
                sc.type='SC'
                AND sc.userName='${userName}'
                AND sc.name='${name}'
                AND sc.processedAt=${processedAt}
                AND sc.submitted=${submitted};`;
    const result = await cbScorecardPool.queryCBWithConsistency(statement);
    if (typeof result === "string" && result.indexOf("ERROR")) {
      throw new Meteor.Error(result);
    }
    return result[0];
  } catch (err) {
    console.log(`getThesePlotParamsFromScorecardInstance error : ${err.message}`);
    return {
      error: err.message,
    };
  }
};

// PUBLIC METHODS
// administration tools
const addSentAddress = new ValidatedMethod({
  name: "matsMethods.addSentAddress",
  validate: new SimpleSchema({
    toAddress: {
      type: String,
    },
  }).validator(),
  run(toAddress) {
    if (!Meteor.userId()) {
      throw new Meteor.Error(401, "not-logged-in");
    }
    matsCollections.SentAddresses.upsert(
      {
        address: toAddress,
      },
      {
        address: toAddress,
        userId: Meteor.userId(),
      }
    );
    return false;
  },
});

//  administation tool
const applyAuthorization = new ValidatedMethod({
  name: "matsMethods.applyAuthorization",
  validate: new SimpleSchema({
    settings: {
      type: Object,
      blackbox: true,
    },
  }).validator(),
  run(settings) {
    if (Meteor.isServer) {
      let roles;
      let roleName;
      let authorization;

      const { userRoleName } = settings;
      const { userRoleDescription } = settings;
      const { authorizationRole } = settings;
      const { newUserEmail } = settings;
      const { existingUserEmail } = settings;

      if (authorizationRole) {
        // existing role - the role roleName - no need to verify as the selection list came from the database
        roleName = authorizationRole;
      } else if (userRoleName && userRoleDescription) {
        // possible new role - see if it happens to already exist
        const role = matsCollections.Roles.findOne({
          name: userRoleName,
        });
        if (role === undefined) {
          // need to add new role using description
          matsCollections.Roles.upsert(
            {
              name: userRoleName,
            },
            {
              $set: {
                description: userRoleDescription,
              },
            }
          );
          roleName = userRoleName;
        } else {
          // see if the description matches...
          roleName = role.name;
          const { description } = role;
          if (description !== userRoleDescription) {
            // have to update the description
            matsCollections.Roles.upsert(
              {
                name: userRoleName,
              },
              {
                $set: {
                  description: userRoleDescription,
                },
              }
            );
          }
        }
      }
      // now we have a role roleName - now we need an email
      if (existingUserEmail) {
        // existing user -  no need to verify as the selection list came from the database
        // see if it already has the role
        authorization = matsCollections.Authorization.findOne({
          email: existingUserEmail,
        });
        roles = authorization.roles;
        if (roles.indexOf(roleName) === -1) {
          // have to add the role
          if (roleName) {
            roles.push(roleName);
          }
          matsCollections.Authorization.upsert(
            {
              email: existingUserEmail,
            },
            {
              $set: {
                roles,
              },
            }
          );
        }
      } else if (newUserEmail) {
        // possible new authorization - see if it happens to exist
        authorization = matsCollections.Authorization.findOne({
          email: newUserEmail,
        });
        if (authorization !== undefined) {
          // authorization exists - add role to roles if necessary
          roles = authorization.roles;
          if (roles.indexOf(roleName) === -1) {
            // have to add the role
            if (roleName) {
              roles.push(roleName);
            }
            matsCollections.Authorization.upsert(
              {
                email: existingUserEmail,
              },
              {
                $set: {
                  roles,
                },
              }
            );
          }
        } else {
          // need a new authorization
          roles = [];
          if (roleName) {
            roles.push(roleName);
          }
          if (newUserEmail) {
            matsCollections.Authorization.upsert(
              {
                email: newUserEmail,
              },
              {
                $set: {
                  roles,
                },
              }
            );
          }
        }
      }
    }
    return false;
  },
});

// database controls
const applyDatabaseSettings = new ValidatedMethod({
  name: "matsMethods.applyDatabaseSettings",
  validate: new SimpleSchema({
    settings: {
      type: Object,
      blackbox: true,
    },
  }).validator(),

  run(settings) {
    if (Meteor.isServer) {
      if (settings.name) {
        matsCollections.Databases.upsert(
          {
            name: settings.name,
          },
          {
            $set: {
              name: settings.name,
              role: settings.role,
              status: settings.status,
              host: settings.host,
              database: settings.database,
              user: settings.user,
              password: settings.password,
            },
          }
        );
      }
    }
    return false;
  },
});

// administration tools
const deleteSettings = new ValidatedMethod({
  name: "matsMethods.deleteSettings",
  validate: new SimpleSchema({
    name: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (!Meteor.userId()) {
      throw new Meteor.Error("not-logged-in");
    }
    if (Meteor.isServer) {
      matsCollections.CurveSettings.remove({
        name: params.name,
      });
    }
  },
});

// drop a single instance of a scorecard
const dropScorecardInstance = new ValidatedMethod({
  name: "matsMethods.dropScorecardInstance",
  validate: new SimpleSchema({
    userName: {
      type: String,
    },
    name: {
      type: String,
    },
    submittedTime: {
      type: String,
    },
    processedAt: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      return dropThisScorecardInstance(
        params.userName,
        params.name,
        params.submittedTime,
        params.processedAt
      );
    }
    return null;
  },
});

// administration tools
const emailImage = new ValidatedMethod({
  name: "matsMethods.emailImage",
  validate: new SimpleSchema({
    imageStr: {
      type: String,
    },
    toAddress: {
      type: String,
    },
    subject: {
      type: String,
    },
  }).validator(),
  run(params) {
    const { imageStr } = params;
    const { toAddress } = params;
    const { subject } = params;
    if (!Meteor.userId()) {
      throw new Meteor.Error(401, "not-logged-in");
    }
    const fromAddress = Meteor.user().services.google.email;
    // these come from google - see
    // http://masashi-k.blogspot.fr/2013/06/sending-mail-with-gmail-using-xoauth2.html
    // http://stackoverflow.com/questions/24098461/nodemailer-gmail-what-exactly-is-a-refresh-token-and-how-do-i-get-one/24123550

    // the gmail account for the credentials is mats.mail.daemon@gmail.com - pwd mats2015!
    // var clientId = "339389735380-382sf11aicmgdgn7e72p4end5gnm9sad.apps.googleusercontent.com";
    // var clientSecret = "7CfNN-tRl5QAL595JTW2TkRl";
    // var refresh_token = "1/PDql7FR01N2gmq5NiTfnrT-OlCYC3U67KJYYDNPeGnA";
    const credentials = matsCollections.Credentials.findOne(
      {
        name: "oauth_google",
      },
      {
        clientId: 1,
        clientSecret: 1,
        refresh_token: 1,
      }
    );
    const { clientId } = credentials;
    const { clientSecret } = credentials;
    const refreshToken = credentials.refresh_token;

    let smtpTransporter;
    try {
      const Nodemailer = require("nodemailer");
      smtpTransporter = Nodemailer.createTransport("SMTP", {
        service: "Gmail",
        auth: {
          XOAuth2: {
            user: "mats.gsl@noaa.gov",
            clientId,
            clientSecret,
            refreshToken,
          },
        },
      });
    } catch (e) {
      throw new Meteor.Error(401, `Transport error ${e.message()}`);
    }
    try {
      const mailOptions = {
        sender: fromAddress,
        replyTo: fromAddress,
        from: fromAddress,
        to: toAddress,
        subject,
        attachments: [
          {
            filename: "graph.png",
            contents: Buffer.from(imageStr.split("base64,")[1], "base64"),
          },
        ],
      };

      smtpTransporter.sendMail(mailOptions, function (error, response) {
        if (error) {
          console.log(
            `smtpTransporter error ${error} from:${fromAddress} to:${toAddress}`
          );
        } else {
          console.log(`${response} from:${fromAddress} to:${toAddress}`);
        }
        smtpTransporter.close();
      });
    } catch (e) {
      throw new Meteor.Error(401, `Send error ${e.message()}`);
    }
    return false;
  },
});

// administation tool
const getAuthorizations = new ValidatedMethod({
  name: "matsMethods.getAuthorizations",
  validate: new SimpleSchema({}).validator(),
  run() {
    let roles = [];
    if (Meteor.isServer) {
      const userEmail = Meteor.user().services.google.email.toLowerCase();
      roles = matsCollections.Authorization.findOne({
        email: userEmail,
      }).roles;
    }
    return roles;
  },
});

// administration tool

const getRunEnvironment = new ValidatedMethod({
  name: "matsMethods.getRunEnvironment",
  validate: new SimpleSchema({}).validator(),
  run() {
    return Meteor.settings.public.run_environment;
  },
});

const getDefaultGroupList = new ValidatedMethod({
  name: "matsMethods.getDefaultGroupList",
  validate: new SimpleSchema({}).validator(),
  run() {
    return matsTypes.DEFAULT_GROUP_LIST;
  },
});

// retrieves the saved query results (or downsampled results)
const getGraphData = new ValidatedMethod({
  name: "matsMethods.getGraphData",
  validate: new SimpleSchema({
    plotParams: {
      type: Object,
      blackbox: true,
    },
    plotType: {
      type: String,
    },
    expireKey: {
      type: Boolean,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      const plotGraphFunction = matsCollections.PlotGraphFunctions.findOne({
        plotType: params.plotType,
      });
      const { dataFunction } = plotGraphFunction;
      let ret;
      try {
        const hash = require("object-hash");
        const key = hash(params.plotParams);
        if (process.env.NODE_ENV === "development" || params.expireKey) {
          matsCache.expireKey(key);
        }
        const results = matsCache.getResult(key);
        if (results === undefined) {
          // results aren't in the cache - need to process data routine
          const Future = require("fibers/future");
          const future = new Future();
          global[dataFunction](params.plotParams, function (result) {
            ret = saveResultData(result);
            future.return(ret);
          });
          return future.wait();
        }
        // results were already in the matsCache (same params and not yet expired)
        // are results in the downsampled collection?
        const dsResults = DownSampleResults.findOne(
          {
            key,
          },
          {},
          {
            disableOplog: true,
          }
        );
        if (dsResults !== undefined) {
          // results are in the mongo cache downsampled collection - returned the downsampled graph data
          ret = dsResults;
          // update the expire time in the downsampled collection - this requires a new Date
          DownSampleResults.rawCollection().update(
            {
              key,
            },
            {
              $set: {
                createdAt: new Date(),
              },
            }
          );
        } else {
          ret = results; // {key:someKey, result:resultObject}
          // refresh expire time. The only way to perform a refresh on matsCache is to re-save the result.
          matsCache.storeResult(results.key, results);
        }
        const sizeof = require("object-sizeof");
        console.log("result.data size is ", sizeof(results));
        return ret;
      } catch (dataFunctionError) {
        if (dataFunctionError.toLocaleString().indexOf("INFO:") !== -1) {
          throw new Meteor.Error(dataFunctionError.message);
        } else {
          throw new Meteor.Error(
            `Error in getGraphData function:${dataFunction} : ${dataFunctionError.message}`
          );
        }
      }
    }
    return null;
  },
});

// retrieves the saved query results (or downsampled results) for a specific key
const getGraphDataByKey = new ValidatedMethod({
  name: "matsMethods.getGraphDataByKey",
  validate: new SimpleSchema({
    resultKey: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      let ret;
      const key = params.resultKey;
      try {
        const dsResults = DownSampleResults.findOne(
          {
            key,
          },
          {},
          {
            disableOplog: true,
          }
        );
        if (dsResults !== undefined) {
          ret = dsResults;
        } else {
          ret = matsCache.getResult(key); // {key:someKey, result:resultObject}
        }
        const sizeof = require("object-sizeof");
        console.log("getGraphDataByKey results size is ", sizeof(dsResults));
        return ret;
      } catch (error) {
        throw new Meteor.Error(
          `Error in getGraphDataByKey function:${key} : ${error.message}`
        );
      }
    }
    return null;
  },
});

const getLayout = new ValidatedMethod({
  name: "matsMethods.getLayout",
  validate: new SimpleSchema({
    resultKey: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      let ret;
      const key = params.resultKey;
      try {
        ret = LayoutStoreCollection.rawCollection().findOne({
          key,
        });
        return ret;
      } catch (error) {
        throw new Meteor.Error(`Error in getLayout function:${key} : ${error.message}`);
      }
    }
    return null;
  },
});

const getScorecardSettings = new ValidatedMethod({
  name: "matsMethods.getScorecardSettings",
  validate: new SimpleSchema({
    settingsKey: {
      type: String,
    },
  }).validator(),
  async run(params) {
    if (Meteor.isServer) {
      const key = params.settingsKey;
      try {
        // global cbScorecardSettingsPool
        const rv = await cbScorecardSettingsPool.getCB(key);
        return { scorecardSettings: rv.content };
      } catch (error) {
        throw new Meteor.Error(
          `Error in getScorecardSettings function:${key} : ${error.message}`
        );
      }
    }
    return null;
  },
});

const getPlotParamsFromScorecardInstance = new ValidatedMethod({
  name: "matsMethods.getPlotParamsFromScorecardInstance",
  validate: new SimpleSchema({
    userName: {
      type: String,
    },
    name: {
      type: String,
    },
    submitted: {
      type: String,
    },
    processedAt: {
      type: String,
    },
  }).validator(),
  run(params) {
    try {
      if (Meteor.isServer) {
        return getThesePlotParamsFromScorecardInstance(
          params.userName,
          params.name,
          params.submitted,
          params.processedAt
        );
      }
    } catch (error) {
      throw new Meteor.Error(
        `Error in getPlotParamsFromScorecardInstance function:${error.message}`
      );
    }
    return null;
  },
});

/*
getPlotResult is used by the graph/text_*_output templates which are used to display textual results.
Because the data isn't being rendered graphically this data is always full size, i.e. NOT downsampled.
That is why it only finds it in the Result file cache, never the DownSampleResult collection.

Because the dataset can be so large ... e.g. megabytes the data retrieval is pagenated. The index is
applied to the underlying datasets.The data gets stripped down and flattened to only contain the data neccesary for text presentation.
A new page index of -1000 means get all the data i.e. no pagenation.
 */
const getPlotResult = new ValidatedMethod({
  name: "matsMethods.getPlotResult",
  validate: new SimpleSchema({
    resultKey: {
      type: String,
    },
    pageIndex: {
      type: Number,
    },
    newPageIndex: {
      type: Number,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      const rKey = params.resultKey;
      const pi = params.pageIndex;
      const npi = params.newPageIndex;
      let ret = {};
      try {
        ret = getFlattenedResultData(rKey, pi, npi);
      } catch (e) {
        console.log(e);
      }
      return ret;
    }
    return null;
  },
});

const getReleaseNotes = new ValidatedMethod({
  name: "matsMethods.getReleaseNotes",
  validate: new SimpleSchema({}).validator(),
  run() {
    //     return Assets.getText('public/MATSReleaseNotes.html');
    // }
    if (Meteor.isServer) {
      const Future = require("fibers/future");
      const fse = require("fs-extra");
      const dFuture = new Future();
      let fData;
      let file;
      if (process.env.NODE_ENV === "development") {
        file = `${process.env.PWD}/.meteor/local/build/programs/server/assets/packages/randyp_mats-common/public/MATSReleaseNotes.html`;
      } else {
        file = `${process.env.PWD}/programs/server/assets/packages/randyp_mats-common/public/MATSReleaseNotes.html`;
      }
      try {
        fse.readFile(file, "utf8", function (err, data) {
          if (err) {
            fData = err.message;
            dFuture.return();
          } else {
            fData = data;
            dFuture.return();
          }
        });
      } catch (e) {
        fData = e.message;
        dFuture.return();
      }
      dFuture.wait();
      return fData;
    }
    return null;
  },
});

const setCurveParamDisplayText = new ValidatedMethod({
  name: "matsMethods.setCurveParamDisplayText",
  validate: new SimpleSchema({
    paramName: {
      type: String,
    },
    newText: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      return matsCollections[params.paramName].update(
        { name: params.paramName },
        { $set: { controlButtonText: params.newText } }
      );
    }
    return null;
  },
});

const getScorecardData = new ValidatedMethod({
  name: "matsMethods.getScorecardData",
  validate: new SimpleSchema({
    userName: {
      type: String,
    },
    name: {
      type: String,
    },
    submitted: {
      type: String,
    },
    processedAt: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      return getThisScorecardData(
        params.userName,
        params.name,
        params.submitted,
        params.processedAt
      );
    }
    return null;
  },
});

const getScorecardInfo = new ValidatedMethod({
  name: "matsMethods.getScorecardInfo",
  validate: new SimpleSchema({}).validator(),
  run() {
    if (Meteor.isServer) {
      return getThisScorecardInfo();
    }
    return null;
  },
});

// administration tool
const getUserAddress = new ValidatedMethod({
  name: "matsMethods.getUserAddress",
  validate: new SimpleSchema({}).validator(),
  run() {
    if (Meteor.isServer) {
      return Meteor.user().services.google.email.toLowerCase();
    }
    return null;
  },
});

// app utility
const insertColor = new ValidatedMethod({
  name: "matsMethods.insertColor",
  validate: new SimpleSchema({
    newColor: {
      type: String,
    },
    insertAfterIndex: {
      type: Number,
    },
  }).validator(),
  run(params) {
    if (params.newColor === "rgb(255,255,255)") {
      return false;
    }
    const colorScheme = matsCollections.ColorScheme.findOne({});
    colorScheme.colors.splice(params.insertAfterIndex, 0, params.newColor);
    matsCollections.update({}, colorScheme);
    return false;
  },
});

// administration tool
const readFunctionFile = new ValidatedMethod({
  name: "matsMethods.readFunctionFile",
  validate: new SimpleSchema({
    file: {
      type: String,
    },
    type: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      const future = require("fibers/future");
      const fse = require("fs-extra");
      let path = "";
      let fData;
      if (params.type === "data") {
        path = `/web/static/dataFunctions/${params.file}`;
        console.log(`exporting data file: ${path}`);
      } else if (params.type === "graph") {
        path = `/web/static/displayFunctions/${params.file}`;
        console.log(`exporting graph file: ${path}`);
      } else {
        return "error - wrong type";
      }
      fse.readFile(path, function (err, data) {
        if (err) throw err;
        fData = data.toString();
        future.return(fData);
      });
      return future.wait();
    }
    return null;
  },
});

// refreshes the metadata for the app that's running
const refreshMetaData = new ValidatedMethod({
  name: "matsMethods.refreshMetaData",
  validate: new SimpleSchema({}).validator(),
  run() {
    if (Meteor.isServer) {
      try {
        // console.log("GUI asked to refresh metadata");
        checkMetaDataRefresh();
      } catch (e) {
        console.log(e);
        throw new Meteor.Error("Server error: ", e.message);
      }
    }
    return metaDataTableUpdates.find({}).fetch();
  },
});

// administation tool
const removeAuthorization = new ValidatedMethod({
  name: "matsMethods.removeAuthorization",
  validate: new SimpleSchema({
    settings: {
      type: Object,
      blackbox: true,
    },
  }).validator(),
  run(settings) {
    if (Meteor.isServer) {
      let email;
      let roleName;
      const { userRoleName } = settings;
      const { authorizationRole } = settings;
      const { newUserEmail } = settings;
      const { existingUserEmail } = settings;
      if (authorizationRole) {
        // existing role - the role roleName - no need to verify as the selection list came from the database
        roleName = authorizationRole;
      } else if (userRoleName) {
        roleName = userRoleName;
      }
      if (existingUserEmail) {
        email = existingUserEmail;
      } else {
        email = newUserEmail;
      }

      // if user and role remove the role from the user
      if (email && roleName) {
        matsCollections.Authorization.update(
          {
            email,
          },
          {
            $pull: {
              roles: roleName,
            },
          }
        );
      }
      // if user and no role remove the user
      if (email && !roleName) {
        matsCollections.Authorization.remove({
          email,
        });
      }
      // if role and no user remove role and remove role from all users
      if (roleName && !email) {
        // remove the role
        matsCollections.Roles.remove({
          name: roleName,
        });
        // remove the roleName role from all the authorizations
        matsCollections.Authorization.update(
          {
            roles: roleName,
          },
          {
            $pull: {
              roles: roleName,
            },
          },
          {
            multi: true,
          }
        );
      }
    }
    return false;
  },
});

// app utility
const removeColor = new ValidatedMethod({
  name: "matsMethods.removeColor",
  validate: new SimpleSchema({
    removeColor: {
      type: String,
    },
  }).validator(),
  run(params) {
    const colorScheme = matsCollections.ColorScheme.findOne({});
    const removeIndex = colorScheme.colors.indexOf(params.removeColor);
    colorScheme.colors.splice(removeIndex, 1);
    matsCollections.ColorScheme.update({}, colorScheme);
    return false;
  },
});

// database controls
const removeDatabase = new ValidatedMethod({
  name: "matsMethods.removeDatabase",
  validate: new SimpleSchema({
    dbName: {
      type: String,
    },
  }).validator(),
  run(dbName) {
    if (Meteor.isServer) {
      matsCollections.Databases.remove({
        name: dbName,
      });
    }
  },
});

const applySettingsData = new ValidatedMethod({
  name: "matsMethods.applySettingsData",
  validate: new SimpleSchema({
    settings: {
      type: Object,
      blackbox: true,
    },
  }).validator(),
  // this method forces a restart on purpose. We do not want retries
  applyOptions: {
    noRetry: true,
  },
  run(settingsParam) {
    if (Meteor.isServer) {
      // Read the existing settings file
      const { settings } = settingsParam;
      console.log(
        "applySettingsData - matsCollections.appName.findOne({}) is ",
        matsCollections.appName.findOne({})
      );
      const { appName } = matsCollections.Settings.findOne({});
      writeSettings(settings, appName);
      // in development - when being run by meteor, this should force a restart of the app.
      // in case I am in a container - exit and force a reload
      console.log(
        `applySettingsData - process.env.NODE_ENV is: ${process.env.NODE_ENV}`
      );
      if (process.env.NODE_ENV !== "development") {
        console.log("applySettingsData - exiting after writing new Settings");
        process.exit(0);
      }
    }
  },
});

// makes sure all of the parameters display appropriate selections in relation to one another
// for default settings ...
const resetApp = async function (appRef) {
  if (Meteor.isServer) {
    const metaDataTableRecords = appRef.appMdr;
    const { appPools } = appRef;
    const type = appRef.appType;
    const scorecard = Meteor.settings.public.scorecard
      ? Meteor.settings.public.scorecard
      : false;
    const dbType = appRef.dbType ? appRef.dbType : matsTypes.DbTypes.mysql;
    const appName = Meteor.settings.public.app ? Meteor.settings.public.app : "unnamed";
    const appTitle = Meteor.settings.public.title
      ? Meteor.settings.public.title
      : "Unnamed App";
    const appGroup = Meteor.settings.public.group
      ? Meteor.settings.public.group
      : "Misc. Apps";
    const thresholdUnits = Meteor.settings.public.threshold_units
      ? Meteor.settings.public.threshold_units
      : {};
    let appDefaultGroup = "";
    let appDefaultDB = "";
    let appDefaultModel = "";
    let appColor;
    switch (type) {
      case matsTypes.AppTypes.metexpress:
        appColor = Meteor.settings.public.color
          ? Meteor.settings.public.color
          : "darkorchid";
        appDefaultGroup = Meteor.settings.public.default_group
          ? Meteor.settings.public.default_group
          : "NO GROUP";
        appDefaultDB = Meteor.settings.public.default_db
          ? Meteor.settings.public.default_db
          : "mv_default";
        appDefaultModel = Meteor.settings.public.default_model
          ? Meteor.settings.public.default_model
          : "Default";
        break;
      case matsTypes.AppTypes.mats:
      default:
        if (dbType === matsTypes.DbTypes.couchbase) {
          appColor = "#33abbb";
        } else {
          appColor = Meteor.settings.public.color
            ? Meteor.settings.public.color
            : "#3366bb";
        }
        break;
    }
    const appTimeOut = Meteor.settings.public.mysql_wait_timeout
      ? Meteor.settings.public.mysql_wait_timeout
      : 300;
    let depEnv = process.env.NODE_ENV;
    const curveParams = curveParamsByApp[Meteor.settings.public.app];
    let appsToScore;
    if (Meteor.settings.public.scorecard) {
      appsToScore = Meteor.settings.public.apps_to_score
        ? Meteor.settings.public.apps_to_score
        : [];
    }
    let mapboxKey = "undefined";

    // see if there's any messages to display to the users
    const appMessage = Meteor.settings.public.alert_message
      ? Meteor.settings.public.alert_message
      : undefined;

    // set meteor settings defaults if they do not exist
    if (isEmpty(Meteor.settings.private) || isEmpty(Meteor.settings.public)) {
      // create some default meteor settings and write them out
      let homeUrl = "";
      if (!process.env.ROOT_URL) {
        homeUrl = "https://localhost/home";
      } else {
        const homeUrlArr = process.env.ROOT_URL.split("/");
        homeUrlArr.pop();
        homeUrl = `${homeUrlArr.join("/")}/home`;
      }
      const settings = {
        private: {
          databases: [],
          PYTHON_PATH: "/usr/bin/python3",
          MAPBOX_KEY: mapboxKey,
        },
        public: {
          run_environment: depEnv,
          apps_to_score: appsToScore,
          default_group: appDefaultGroup,
          default_db: appDefaultDB,
          default_model: appDefaultModel,
          proxy_prefix_path: "",
          home: homeUrl,
          appName,
          mysql_wait_timeout: appTimeOut,
          group: appGroup,
          app_order: 1,
          title: appTitle,
          color: appColor,
          threshold_units: thresholdUnits,
        },
      };
      writeSettings(settings, appName); // this is going to cause the app to restart in the meteor development environment!!!
      // exit for production - probably won't ever get here in development mode (running with meteor)
      // This depends on whatever system is running the node process to restart it.
      console.log("resetApp - exiting after creating default settings");
      process.exit(1);
    }

    // mostly for running locally for debugging. We have to be able to choose the app from the app list in deployment.json
    // normally (on a server) it will be an environment variable.
    // to debug an integration or production deployment, set the environment variable deployment_environment to one of
    // development, integration, production, metexpress
    if (Meteor.settings.public && Meteor.settings.public.run_environment) {
      depEnv = Meteor.settings.public.run_environment;
    } else {
      depEnv = process.env.NODE_ENV;
    }
    // get the mapbox key out of the settings file, if it exists
    if (Meteor.settings.private && Meteor.settings.private.MAPBOX_KEY) {
      mapboxKey = Meteor.settings.private.MAPBOX_KEY;
    }
    delete Meteor.settings.public.undefinedRoles;
    for (let pi = 0; pi < appPools.length; pi += 1) {
      const record = appPools[pi];
      const poolName = record.pool;
      // if the database credentials have been set in the meteor.private.settings file then the global[poolName]
      // will have been defined in the app main.js. Otherwise it will not have been defined.
      // If it is undefined (requiring configuration) we will skip it but add
      // the corresponding role to Meteor.settings.public.undefinedRoles -
      // which will cause the app to route to the configuration page.
      if (!global[poolName]) {
        console.log(`resetApp adding ${global[poolName]}to undefined roles`);
        // There was no pool defined for this poolName - probably needs to be configured so stash the role in the public settings
        if (!Meteor.settings.public.undefinedRoles) {
          Meteor.settings.public.undefinedRoles = [];
        }
        Meteor.settings.public.undefinedRoles.push(record.role);
      } else {
        try {
          if (dbType !== matsTypes.DbTypes.couchbase) {
            // default to mysql so that old apps won't break
            global[poolName].on("connection", function (connection) {
              connection.query("set group_concat_max_len = 4294967295");
              connection.query(`set session wait_timeout = ${appTimeOut}`);
              // ("opening new " + poolName + " connection");
            });
          }
          // connections all work so make sure that Meteor.settings.public.undefinedRoles is undefined
          delete Meteor.settings.public.undefinedRoles;
        } catch (e) {
          console.log(
            `${poolName}:  not initialized -= 1 could not open connection: Error:${e.message}`
          );
          Meteor.settings.public.undefinedRoles =
            Meteor.settings.public.undefinedRoles === undefined
              ? []
              : Meteor.settings.public.undefinedRoles === undefined;
          Meteor.settings.public.undefinedRoles.push(record.role);
        }
      }
    }
    // just in case - should never happen.
    if (
      Meteor.settings.public.undefinedRoles &&
      Meteor.settings.public.undefinedRoles.length > 1
    ) {
      throw new Meteor.Error(
        `dbpools not initialized ${Meteor.settings.public.undefinedRoles}`
      );
    }

    // Try getting version from env
    let { version: appVersion, commit, branch } = versionInfo.getVersionsFromEnv();
    if (appVersion === "Unknown") {
      // Try getting versionInfo from the appProduction database
      console.log("VERSION not set in the environment - using localhost");
      appVersion = "localhost";
      commit = "HEAD";
      branch = "feature";
    }
    const appType = type || matsTypes.AppTypes.mats;

    // remember that we updated the metadata tables just now - create metaDataTableUpdates
    /*
            metaDataTableUpdates:
            {
                name: dataBaseName,
                tables: [tableName1, tableName2 ..],
                lastRefreshed : timestamp
            }
         */
    // only create metadata tables if the resetApp was called with a real metaDataTables object
    if (metaDataTableRecords instanceof matsTypes.MetaDataDBRecord) {
      const metaDataTables = metaDataTableRecords.getRecords();
      for (let mdti = 0; mdti < metaDataTables.length; mdti += 1) {
        const metaDataRef = metaDataTables[mdti];
        metaDataRef.lastRefreshed = moment().format();
        if (metaDataTableUpdates.find({ name: metaDataRef.name }).count() === 0) {
          metaDataTableUpdates.update(
            {
              name: metaDataRef.name,
            },
            metaDataRef,
            {
              upsert: true,
            }
          );
        }
      }
    } else {
      throw new Meteor.Error("Server error: ", "resetApp: bad pool-database entry");
    }
    // invoke the standard common routines
    matsCollections.Roles.remove({});
    matsDataUtils.doRoles();
    matsCollections.Authorization.remove({});
    matsDataUtils.doAuthorization();
    matsCollections.Credentials.remove({});
    matsDataUtils.doCredentials();
    matsCollections.PlotGraphFunctions.remove({});
    matsCollections.ColorScheme.remove({});
    matsDataUtils.doColorScheme();
    matsCollections.Settings.remove({});
    matsDataUtils.doSettings(
      appTitle,
      dbType,
      appVersion,
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
    );
    matsCollections.PlotParams.remove({});
    matsCollections.CurveTextPatterns.remove({});
    // get the curve params for this app into their collections
    matsCollections.CurveParamsInfo.remove({});
    matsCollections.CurveParamsInfo.insert({
      curve_params: curveParams,
    });
    for (let cp = 0; cp < curveParams.length; cp += 1) {
      if (matsCollections[curveParams[cp]] !== undefined) {
        matsCollections[curveParams[cp]].remove({});
      }
    }
    // if this is a scorecard also get the apps to score out of the settings file
    if (Meteor.settings.public && Meteor.settings.public.scorecard) {
      if (Meteor.settings.public.apps_to_score) {
        appsToScore = Meteor.settings.public.apps_to_score;
        matsCollections.AppsToScore.remove({});
        matsCollections.AppsToScore.insert({
          apps_to_score: appsToScore,
        });
      } else {
        throw new Meteor.Error(
          "apps_to_score are not initialized in app settings -= 1cannot build selectors"
        );
      }
    }
    // invoke the app specific routines
    for (let ai = 0; ai < appSpecificResetRoutines.length; ai += 1) {
      await global.appSpecificResetRoutines[ai]();
    }
    matsCache.clear();
  }
};

const saveLayout = new ValidatedMethod({
  name: "matsMethods.saveLayout",
  validate: new SimpleSchema({
    resultKey: {
      type: String,
    },
    layout: {
      type: Object,
      blackbox: true,
    },
    curveOpsUpdate: {
      type: Object,
      blackbox: true,
    },
    annotation: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      const key = params.resultKey;
      const { layout } = params;
      const { curveOpsUpdate } = params;
      const { annotation } = params;
      try {
        LayoutStoreCollection.upsert(
          {
            key,
          },
          {
            $set: {
              createdAt: new Date(),
              layout,
              curveOpsUpdate,
              annotation,
            },
          }
        );
      } catch (error) {
        throw new Meteor.Error(
          `Error in saveLayout function:${key} : ${error.message}`
        );
      }
    }
  },
});

const saveScorecardSettings = new ValidatedMethod({
  name: "matsMethods.saveScorecardSettings",
  validate: new SimpleSchema({
    settingsKey: {
      type: String,
    },
    scorecardSettings: {
      type: String,
    },
  }).validator(),
  run(params) {
    if (Meteor.isServer) {
      const key = params.settingsKey;
      const { scorecardSettings } = params;
      try {
        // TODO - remove after tests
        console.log(
          `saveScorecardSettings(${key}):\n${JSON.stringify(
            scorecardSettings,
            null,
            2
          )}`
        );
        // global cbScorecardSettingsPool
        (async function (id, doc) {
          cbScorecardSettingsPool.upsertCB(id, doc);
        })(key, scorecardSettings).then(() => {
          console.log("upserted doc with id", key);
        });
        // await cbScorecardSettingsPool.upsertCB(settingsKey, scorecardSettings);
      } catch (err) {
        console.log(`error writing scorecard to database: ${err.message}`);
      }
    }
  },
});

// administration tools
const saveSettings = new ValidatedMethod({
  name: "matsMethods.saveSettings",
  validate: new SimpleSchema({
    saveAs: {
      type: String,
    },
    p: {
      type: Object,
      blackbox: true,
    },
    permission: {
      type: String,
    },
  }).validator(),
  run(params) {
    const user = "anonymous";
    matsCollections.CurveSettings.upsert(
      {
        name: params.saveAs,
      },
      {
        created: moment().format("MM/DD/YYYY HH:mm:ss"),
        name: params.saveAs,
        data: params.p,
        owner: !Meteor.userId() ? "anonymous" : Meteor.userId(),
        permission: params.permission,
        savedAt: new Date(),
        savedBy: !Meteor.user() ? "anonymous" : user,
      }
    );
  },
});

/* test methods */

const testGetMetaDataTableUpdates = new ValidatedMethod({
  name: "matsMethods.testGetMetaDataTableUpdates",
  validate: new SimpleSchema({}).validator(),
  run() {
    return metaDataTableUpdates.find({}).fetch();
  },
});

const testGetTables = new ValidatedMethod({
  name: "matsMethods.testGetTables",
  validate: new SimpleSchema({
    host: {
      type: String,
    },
    port: {
      type: String,
    },
    user: {
      type: String,
    },
    password: {
      type: String,
    },
    database: {
      type: String,
    },
  }).validator(),
  async run(params) {
    if (Meteor.isServer) {
      if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
        const cbUtilities = new matsCouchbaseUtils.CBUtilities(
          params.host,
          params.bucket,
          params.user,
          params.password
        );
        try {
          const result = await cbUtilities.queryCB("select NOW_MILLIS() as time");
          console.log(`Couchbase get tables suceeded. result: ${result}`);
        } catch (err) {
          throw new Meteor.Error(err.message);
        }
      } else {
        // default to mysql so that old apps won't break
        const Future = require("fibers/future");
        const queryWrap = Future.wrap(function (callback) {
          const connection = mysql.createConnection({
            host: params.host,
            port: params.port,
            user: params.user,
            password: params.password,
            database: params.database,
          });
          connection.query("show tables;", function (err, result) {
            if (err || result === undefined) {
              // return callback(err,null);
              return callback(err, null);
            }
            const tables = result.map(function (a) {
              return a;
            });

            return callback(err, tables);
          });
          connection.end(function (err) {
            if (err) {
              console.log("testGetTables cannot end connection");
            }
          });
        });
        try {
          return queryWrap().wait();
        } catch (e) {
          throw new Meteor.Error(e.message);
        }
      }
    }
    return null;
  },
});

const testSetMetaDataTableUpdatesLastRefreshedBack = new ValidatedMethod({
  name: "matsMethods.testSetMetaDataTableUpdatesLastRefreshedBack",
  validate: new SimpleSchema({}).validator(),
  run() {
    const mtu = metaDataTableUpdates.find({}).fetch();
    const id = mtu[0]._id;
    metaDataTableUpdates.update(
      {
        _id: id,
      },
      {
        $set: {
          lastRefreshed: 0,
        },
      }
    );
    return metaDataTableUpdates.find({}).fetch();
  },
});

// Define routes for server
if (Meteor.isServer) {
  // add indexes to result and axes collections
  DownSampleResults.rawCollection().createIndex(
    {
      createdAt: 1,
    },
    {
      expireAfterSeconds: 3600 * 8,
    }
  ); // 8 hour expiration
  LayoutStoreCollection.rawCollection().createIndex(
    {
      createdAt: 1,
    },
    {
      expireAfterSeconds: 900,
    }
  ); // 15 min expiration

  // set the default proxy prefix path to ""
  // If the settings are not complete, they will be set by the configuration and written out, which will cause the app to reset
  if (Meteor.settings.public && !Meteor.settings.public.proxy_prefix_path) {
    Meteor.settings.public.proxy_prefix_path = "";
  }

  // eslint-disable-next-line no-unused-vars
  Picker.route("/status", function (params, req, res, next) {
    Picker.middleware(status(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/status`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(status(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/status`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(status(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getCSV/:key", function (params, req, res, next) {
    Picker.middleware(getCSV(params, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getCSV/:key`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getCSV(params, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/app:/getCSV/:key`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getCSV(params, res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/CSV/:f/:key/:m/:a", function (params, req, res, next) {
    Picker.middleware(getCSV(params, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/CSV/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getCSV(params, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/CSV/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getCSV(params, res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getJSON/:key", function (params, req, res, next) {
    Picker.middleware(getJSON(params, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getJSON/:key`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getJSON(params, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/app:/getJSON/:key`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getJSON(params, res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/JSON/:f/:key/:m/:a", function (params, req, res, next) {
    Picker.middleware(getJSON(params, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/JSON/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getJSON(params, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/JSON/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getJSON(params, res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/clearCache", function (params, req, res, next) {
    Picker.middleware(clearCache(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/clearCache`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(clearCache(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/clearCache`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(clearCache(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getApps", function (params, req, res, next) {
    Picker.middleware(getApps(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getApps`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getApps(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getApps`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getApps(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getAppSumsDBs", function (params, req, res, next) {
    Picker.middleware(getAppSumsDBs(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getAppSumsDBs`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getAppSumsDBs(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getAppSumsDBs`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getAppSumsDBs(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getModels", function (params, req, res, next) {
    Picker.middleware(getModels(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getModels`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getModels(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getModels`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getModels(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getRegions", function (params, req, res, next) {
    Picker.middleware(getRegions(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getRegions`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getRegions(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getRegions`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getRegions(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getRegionsValuesMap", function (params, req, res, next) {
    Picker.middleware(getRegionsValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getRegionsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getRegionsValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getRegionsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getRegionsValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getStatistics", function (params, req, res, next) {
    Picker.middleware(getStatistics(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getStatistics`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getStatistics(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getStatistics`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getStatistics(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getStatisticsValuesMap", function (params, req, res, next) {
    Picker.middleware(getStatisticsValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getStatisticsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getStatisticsValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getStatisticsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getStatisticsValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getVariables", function (params, req, res, next) {
    Picker.middleware(getVariables(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getVariables`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getVariables(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getVariables`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getVariables(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getVariablesValuesMap", function (params, req, res, next) {
    Picker.middleware(getVariablesValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getVariablesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getVariablesValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getVariablesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getVariablesValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getThresholds", function (params, req, res, next) {
    Picker.middleware(getThresholds(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getThresholds`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getThresholds(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getThresholds`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getThresholds(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getThresholdsValuesMap", function (params, req, res, next) {
    Picker.middleware(getThresholdsValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getThresholdsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getThresholdsValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getThresholdsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getThresholdsValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getScales", function (params, req, res, next) {
    Picker.middleware(getScales(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getScales`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getScales(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getScales`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getScales(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getScalesValuesMap", function (params, req, res, next) {
    Picker.middleware(getScalesValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getScalesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getScalesValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getScalesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getScalesValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getTruths", function (params, req, res, next) {
    Picker.middleware(getTruths(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getTruths`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getTruths(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getTruths`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getTruths(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getTruthsValuesMap", function (params, req, res, next) {
    Picker.middleware(getTruthsValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getTruthsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getTruthsValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getTruthsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getTruthsValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getFcstLengths", function (params, req, res, next) {
    Picker.middleware(getFcstLengths(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getFcstLengths`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstLengths(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstLengths`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstLengths(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getFcstTypes", function (params, req, res, next) {
    Picker.middleware(getFcstTypes(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getFcstTypes`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstTypes(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstTypes`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstTypes(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getFcstTypesValuesMap", function (params, req, res, next) {
    Picker.middleware(getFcstTypesValuesMap(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getFcstTypesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstTypesValuesMap(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstTypesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getFcstTypesValuesMap(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getValidTimes", function (params, req, res, next) {
    Picker.middleware(getValidTimes(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getValidTimes`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getValidTimes(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getValidTimes`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getValidTimes(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getLevels", function (params, req, res, next) {
    Picker.middleware(getLevels(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getLevels`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getLevels(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getLevels`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getLevels(res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/getDates", function (params, req, res, next) {
    Picker.middleware(getDates(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/getDates`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getDates(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getDates`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(getDates(res));
    }
  );

  // create picker routes for refreshMetaData
  // eslint-disable-next-line no-unused-vars
  Picker.route("/refreshMetadata", function (params, req, res, next) {
    Picker.middleware(refreshMetadataMWltData(res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/refreshMetadata`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(refreshMetadataMWltData(res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/refreshMetadata`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(refreshMetadataMWltData(res));
    }
  );
  // eslint-disable-next-line no-unused-vars
  Picker.route("/refreshScorecard/:docId", function (params, req, res, next) {
    Picker.middleware(refreshScorecard(params, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/refreshScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(refreshScorecard(params, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/refreshScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(refreshScorecard(params, res));
    }
  );

  // eslint-disable-next-line no-unused-vars
  Picker.route("/setStatusScorecard/:docId", function (params, req, res, next) {
    Picker.middleware(setStatusScorecard(params, req, res));
  });

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/setStatusScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(setStatusScorecard(params, req, res));
    }
  );

  Picker.route(
    `${Meteor.settings.public.proxy_prefix_path}/:app/setStatusScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (params, req, res, next) {
      Picker.middleware(setStatusScorecard(params, req, res));
    }
  );
}

// eslint-disable-next-line no-undef
export default matsMethods = {
  isThisANaN,
  addSentAddress,
  applyAuthorization,
  applyDatabaseSettings,
  applySettingsData,
  deleteSettings,
  dropScorecardInstance,
  emailImage,
  getAuthorizations,
  getRunEnvironment,
  getDefaultGroupList,
  getGraphData,
  getGraphDataByKey,
  getLayout,
  getPlotParamsFromScorecardInstance,
  getPlotResult,
  getReleaseNotes,
  getScorecardInfo,
  getScorecardData,
  getScorecardSettings,
  getUserAddress,
  insertColor,
  readFunctionFile,
  refreshMetaData,
  removeAuthorization,
  removeColor,
  removeDatabase,
  resetApp,
  saveLayout,
  saveScorecardSettings,
  saveSettings,
  setCurveParamDisplayText,
  testGetMetaDataTableUpdates,
  testGetTables,
  testSetMetaDataTableUpdatesLastRefreshedBack,
};
