/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import SimpleSchema from "meteor/aldeed:simple-schema";
import {
  matsCache,
  matsCollections,
  matsDataQueryUtils,
  matsCouchbaseUtils,
  matsDataUtils,
  matsTypes,
  versionInfo,
} from "meteor/randyp:mats-common";
import { moment } from "meteor/momentjs:moment";
import { _ } from "meteor/underscore";
import { Mongo } from "meteor/mongo";
import { curveParamsByApp } from "../both/mats-curve-params";

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
const status = async function (res) {
  if (Meteor.isServer) {
    const settings = await matsCollections.Settings.findOneAsync();
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
  const tableUpdates = await metaDataTableUpdates.find({}).fetchAsync();
  const settings = await matsCollections.Settings.findOneAsync();
  const dbType = settings !== undefined ? settings.dbType : matsTypes.DbTypes.mysql;
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
              rows = await matsDataQueryUtils.queryMySQL(
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
              doc = await global.cbPool.getCB(tName);
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
      for (let ai = 0; ai < global.appSpecificResetRoutines.length; ai += 1) {
        await global.appSpecificResetRoutines[ai]();
      }
      // remember that we updated ALL the metadata tables just now
      await metaDataTableUpdates.updateAsync(
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
    if (global.cbScorecardPool === undefined) {
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
    return global.cbScorecardPool.queryCB(statement);
    // delete this result from the mongo Scorecard collection
  } catch (err) {
    console.log(`dropThisScorecardInstance error : ${err.message}`);
    return {
      error: err.message,
    };
  }
};

// helper function for returning an array of database-distinct apps contained within a larger MATS app
async function getListOfApps() {
  let apps;
  if (
    matsCollections.database !== undefined &&
    (await matsCollections.database.findOneAsync({ name: "database" })) !== undefined
  ) {
    // get list of databases (one per app)
    apps = (
      await matsCollections.database.findOneAsync({
        name: "database",
      })
    ).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
  } else if (
    matsCollections.variable !== undefined &&
    (await matsCollections.variable.findOneAsync({
      name: "variable",
    })) !== undefined &&
    matsCollections.threshold !== undefined &&
    (await matsCollections.threshold.findOneAsync({
      name: "threshold",
    })) !== undefined
  ) {
    // get list of apps (variables in apps that also have thresholds)
    apps = (
      await matsCollections.variable.findOneAsync({
        name: "variable",
      })
    ).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
  } else {
    apps = [(await matsCollections.Settings.findOneAsync()).Title];
  }
  return apps;
}

// helper function to map a results array to specific apps
async function mapArrayToApps(result) {
  // put results in a map keyed by app
  const newResult = {};
  const apps = await getListOfApps();
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
async function mapMapToApps(result) {
  // put results in a map keyed by app
  let newResult = {};
  let tempResult;
  const apps = await getListOfApps();
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
async function getListOfAppDBs() {
  let apps;
  const result = {};
  let aidx;
  if (
    matsCollections.database !== undefined &&
    (await matsCollections.database.findOneAsync({ name: "database" })) !== undefined
  ) {
    // get list of databases (one per app)
    apps = (
      await matsCollections.database.findOneAsync({
        name: "database",
      })
    ).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
    for (aidx = 0; aidx < apps.length; aidx += 1) {
      result[apps[aidx]] = (
        await matsCollections.database.findOneAsync({
          name: "database",
        })
      ).optionsMap[apps[aidx]].sumsDB;
    }
  } else if (
    matsCollections.variable !== undefined &&
    (await matsCollections.variable.findOneAsync({
      name: "variable",
    })) !== undefined &&
    matsCollections.threshold !== undefined &&
    (await matsCollections.threshold.findOneAsync({
      name: "threshold",
    })) !== undefined
  ) {
    // get list of apps (variables in apps that also have thresholds)
    apps = (
      await matsCollections.variable.findOneAsync({
        name: "variable",
      })
    ).options;
    if (!Array.isArray(apps)) apps = Object.keys(apps);
    for (aidx = 0; aidx < apps.length; aidx += 1) {
      result[apps[aidx]] = (
        await matsCollections.variable.findOneAsync({
          name: "variable",
        })
      ).optionsMap[apps[aidx]];
      if (
        typeof result[apps[aidx]] !== "string" &&
        !(result[apps[aidx]] instanceof String)
      )
        result[apps[aidx]] = result[apps[aidx]].sumsDB;
    }
  } else {
    result[(await matsCollections.Settings.findOneAsync()).Title] = (
      await matsCollections.Databases.findOneAsync({
        role: matsTypes.DatabaseRoles.SUMS_DATA,
        status: "active",
      })
    ).database;
  }
  return result;
}

// helper function for getting a metadata map from a MATS selector, keyed by app title and model display text
async function getMapByAppAndModel(selector, mapType) {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections[selector] !== undefined &&
      (await matsCollections[selector].findOneAsync({ name: selector })) !==
        undefined &&
      (await matsCollections[selector].findOneAsync({ name: selector }))[mapType] !==
        undefined
    ) {
      // get map of requested selector's metadata
      result = (
        await matsCollections[selector].findOneAsync({
          name: selector,
        })
      )[mapType];
      let newResult = {};
      if (
        mapType === "valuesMap" ||
        selector === "variable" ||
        selector === "statistic"
      ) {
        // valueMaps always need to be re-keyed by app (statistic and variable get their valuesMaps from optionsMaps)
        newResult = await mapMapToApps(result);
        result = newResult;
      } else if (
        matsCollections.database === undefined &&
        !(
          matsCollections.variable !== undefined &&
          matsCollections.threshold !== undefined
        )
      ) {
        // key by app title if we're not already
        const appTitle = (await matsCollections.Settings.findOneAsync()).Title;
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
async function getDateMapByAppAndModel() {
  let flatJSON = "";
  try {
    let result;
    // the date map can be in a few places. we have to hunt for it.
    if (
      matsCollections.database !== undefined &&
      (await matsCollections.database.findOneAsync({
        name: "database",
      })) !== undefined &&
      (
        await matsCollections.database.findOneAsync({
          name: "database",
        })
      ).dates !== undefined
    ) {
      result = (
        await matsCollections.database.findOneAsync({
          name: "database",
        })
      ).dates;
    } else if (
      matsCollections.variable !== undefined &&
      (await matsCollections.variable.findOneAsync({
        name: "variable",
      })) !== undefined &&
      (
        await matsCollections.variable.findOneAsync({
          name: "variable",
        })
      ).dates !== undefined
    ) {
      result = (
        await matsCollections.variable.findOneAsync({
          name: "variable",
        })
      ).dates;
    } else if (
      matsCollections["data-source"] !== undefined &&
      (await matsCollections["data-source"].findOneAsync({
        name: "data-source",
      })) !== undefined &&
      (
        await matsCollections["data-source"].findOneAsync({
          name: "data-source",
        })
      ).dates !== undefined
    ) {
      result = (
        await matsCollections["data-source"].findOneAsync({
          name: "data-source",
        })
      ).dates;
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
      const appTitle = (await matsCollections.Settings.findOneAsync()).Title;
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
async function getMapByApp(selector) {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections[selector] !== undefined &&
      (await matsCollections[selector].findOneAsync({ name: selector })) !== undefined
    ) {
      // get array of requested selector's metadata
      result = (
        await matsCollections[selector].findOneAsync({
          name: selector,
        })
      ).options;
      if (!Array.isArray(result)) result = Object.keys(result);
    } else if (selector === "statistic") {
      result = ["ACC"];
    } else if (selector === "variable") {
      result = [(await matsCollections.Settings.findOneAsync()).Title];
    } else {
      result = [];
    }
    // put results in a map keyed by app
    let newResult;
    if (result.length === 0) {
      newResult = {};
    } else {
      newResult = await mapArrayToApps(result);
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
async function getlevelsByApp() {
  let flatJSON = "";
  try {
    let result;
    if (
      matsCollections.level !== undefined &&
      (await matsCollections.level.findOneAsync({ name: "level" })) !== undefined
    ) {
      // we have levels already defined
      result = (
        await matsCollections.level.findOneAsync({
          name: "level",
        })
      ).options;
      if (!Array.isArray(result)) result = Object.keys(result);
    } else if (
      matsCollections.top !== undefined &&
      (await matsCollections.top.findOneAsync({ name: "top" })) !== undefined
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
      newResult = await mapArrayToApps(result);
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
const getApps = async function (res) {
  // this function returns an array of apps.
  if (Meteor.isServer) {
    let flatJSON = "";
    try {
      const result = await getListOfApps();
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
const getAppSumsDBs = async function (res) {
  // this function returns map of apps and appRefs.
  if (Meteor.isServer) {
    let flatJSON = "";
    try {
      const result = await getListOfAppDBs();
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
const getModels = async function (res) {
  // this function returns a map of models keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("data-source", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getRegions route
const getRegions = async function (res) {
  // this function returns a map of regions keyed by app title and model display text
  if (Meteor.isServer) {
    let flatJSON = await getMapByAppAndModel("region", "optionsMap");
    if (flatJSON === "{}") {
      flatJSON = await getMapByAppAndModel("vgtyp", "optionsMap");
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getRegionsValuesMap route
const getRegionsValuesMap = async function (res) {
  // this function returns a map of regions values keyed by app title
  if (Meteor.isServer) {
    let flatJSON = await getMapByAppAndModel("region", "valuesMap");
    if (flatJSON === "{}") {
      flatJSON = await getMapByAppAndModel("vgtyp", "valuesMap");
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getStatistics route
const getStatistics = async function (res) {
  // this function returns an map of statistics keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("statistic");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getStatisticsValuesMap route
const getStatisticsValuesMap = async function (res) {
  // this function returns a map of statistic values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("statistic", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getVariables route
const getVariables = async function (res) {
  // this function returns an map of variables keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("variable");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getVariablesValuesMap route
const getVariablesValuesMap = async function (res) {
  // this function returns a map of variable values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("variable", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getThresholds route
const getThresholds = async function (res) {
  // this function returns a map of thresholds keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("threshold", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getThresholdsValuesMap route
const getThresholdsValuesMap = async function (res) {
  // this function returns a map of threshold values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("threshold", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getScales route
const getScales = async function (res) {
  // this function returns a map of scales keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("scale", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getScalesValuesMap route
const getScalesValuesMap = async function (res) {
  // this function returns a map of scale values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("scale", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getTruth route
const getTruths = async function (res) {
  // this function returns a map of truths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("truth", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getTruthValuesMap route
const getTruthsValuesMap = async function (res) {
  // this function returns a map of truth values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("truth", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstLengths route
const getFcstLengths = async function (res) {
  // this function returns a map of forecast lengths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-length", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstTypes route
const getFcstTypes = async function (res) {
  // this function returns a map of forecast types keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-type", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getFcstTypesValuesMap route
const getFcstTypesValuesMap = async function (res) {
  // this function returns a map of forecast type values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-type", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getValidTimes route
const getValidTimes = async function (res) {
  // this function returns an map of valid times keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("valid-time");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getValidTimes route
const getLevels = async function (res) {
  // this function returns an map of pressure levels keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getlevelsByApp();
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private middleware for getDates route
const getDates = async function (res) {
  // this function returns a map of dates keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getDateMapByAppAndModel();
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
              returnData.stats[data[ci].label] = JSON.parse(JSON.stringify(stats));

              curveData = []; // array of maps
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
              returnData.stats[data[ci].label] = JSON.parse(JSON.stringify(stats));

              curveData = []; // array of maps
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
              returnData.stats[data[ci].label] = JSON.parse(JSON.stringify(stats));

              curveData = []; // array of maps
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

              curveData = []; // array of maps
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

          returnData.stats[data[0].label] = JSON.parse(JSON.stringify(stats));

          isCTC =
            data[0] !== undefined &&
            data[0].stats !== undefined &&
            data[0].stats[0] !== undefined &&
            data[0].stats[0].hit !== undefined;

          curveData = []; // array of maps
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
              returnData.stats[data[ci].label] = JSON.parse(JSON.stringify(stats));

              curveData = []; // array of maps
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
              returnData.stats[data[ci].label] = JSON.parse(JSON.stringify(stats));

              curveData = []; // array of maps
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

          returnData.stats[data[0].label] = JSON.parse(JSON.stringify(stats));

          isCTC =
            data[0] !== undefined &&
            data[0].hitTextOutput !== undefined &&
            data[0].hitTextOutput.length > 0;

          curveData = []; // array of maps
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

          curveData = []; // array of maps
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
      flatJSON = JSON.stringify(result.basis);
    } catch (e) {
      console.log("error retrieving data: ", e);
      flatJSON = JSON.stringify({
        error: e,
      });
    }
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// private define a middleware for refreshing the metadata
const refreshMetadataMWltData = async function (res) {
  if (Meteor.isServer) {
    console.log("Server route asked to refresh metadata");

    try {
      console.log("GUI asked to refresh metadata");
      await checkMetaDataRefresh();
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
    if (global.cbScorecardPool === undefined) {
      throw new Meteor.Error("getScorecardData: No cbScorecardPool defined");
    }
    const statement = `SELECT sc.*
                From
                    vxdata._default.SCORECARD sc
                WHERE
                    sc.id='${docId}';`;
    global.cbScorecardPool
      .queryCB(statement)
      .then(async (result) => {
        // insert this result into the mongo Scorecard collection - createdAt is used for TTL
        // created at gets updated each display even if it already existed.
        // TTL is 24 hours
        if (typeof result === "string") {
          throw new Error(`Error from couchbase query - ${result}`);
        } else if (result[0] === undefined) {
          throw new Error("Error from couchbase query - document not found");
        } else {
          await matsCollections.Scorecard.upsertAsync(
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
      Meteor.bindEnvironment(async function () {
        // console.log(body);
        try {
          const doc = JSON.parse(body);
          const docStatus = doc.status;
          const found = await matsCollections.Scorecard.find({
            id: docId,
          }).fetchAsync();
          if (found.length === 0) {
            throw new Error("Error from scorecard lookup - document not found");
          }
          await matsCollections.Scorecard.upsertAsync(
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
const saveResultData = async function (result) {
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
        await DownSampleResults.insertAsync({
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
    if (global.cbScorecardPool === undefined) {
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
    const result = await global.cbScorecardPool.queryCBWithConsistency(statement);
    if (typeof result === "string" && result.indexOf("ERROR")) {
      throw new Meteor.Error(result);
    }
    // insert this result into the mongo Scorecard collection - createdAt is used for TTL
    // created at gets updated each display even if it already existed.
    // TTL is 24 hours
    await matsCollections.Scorecard.upsertAsync(
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
    const docID = (
      await matsCollections.Scorecard.findOneAsync(
        {
          "scorecard.userName": result[0].userName,
          "scorecard.name": result[0].name,
          "scorecard.submitted": result[0].submitted,
          "scorecard.processedAt": result[0].processedAt,
        },
        { _id: 1 }
      )
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
    if (global.cbScorecardPool === undefined) {
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
    const result = await global.cbScorecardPool.queryCBWithConsistency(statement);
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
    if (global.cbScorecardPool === undefined) {
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
    const result = await global.cbScorecardPool.queryCBWithConsistency(statement);
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

// database controls
const applyDatabaseSettings = new ValidatedMethod({
  name: "matsMethods.applyDatabaseSettings",
  validate: new SimpleSchema({
    settings: {
      type: Object,
      blackbox: true,
    },
  }).validator(),

  async run(settings) {
    if (Meteor.isServer) {
      if (settings.name) {
        await matsCollections.Databases.upsertAsync(
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
  async run(params) {
    if (!Meteor.userId()) {
      throw new Meteor.Error("not-logged-in");
    }
    if (Meteor.isServer) {
      await matsCollections.CurveSettings.removeAsync({
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
  async run(params) {
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

// administration tool

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
  async run(params) {
    if (Meteor.isServer) {
      const plotGraphFunction = await matsCollections.PlotGraphFunctions.findOneAsync({
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
          const graphData = await global[dataFunction](params.plotParams);
          const newRet = await saveResultData(graphData);
          return newRet;
        }
        // results were already in the matsCache (same params and not yet expired)
        // are results in the downsampled collection?
        const dsResults = await DownSampleResults.findOneAsync(
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
          await DownSampleResults.updateAsync(
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
  async run(params) {
    if (Meteor.isServer) {
      let ret;
      const key = params.resultKey;
      try {
        const dsResults = await DownSampleResults.findOneAsync(
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
  async run(params) {
    if (Meteor.isServer) {
      let ret;
      const key = params.resultKey;
      try {
        ret = await LayoutStoreCollection.findOneAsync({
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
        const rv = await global.cbScorecardSettingsPool.getCB(key);
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
  async run(params) {
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
    if (Meteor.isServer) {
      const fse = require("fs-extra");
      let file;
      if (process.env.NODE_ENV === "development") {
        file = `${process.env.PWD}/.meteor/local/build/programs/server/assets/packages/randyp_mats-common/public/MATSReleaseNotes.html`;
      } else {
        file = `${process.env.PWD}/programs/server/assets/packages/randyp_mats-common/public/MATSReleaseNotes.html`;
      }
      return fse.readFileSync(file, "utf8", function (err, data) {
        if (err) {
          return err.message;
        }
        return data;
      });
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
  async run(params) {
    if (Meteor.isServer) {
      return matsCollections[params.paramName].updateAsync(
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
  async run(params) {
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
  async run() {
    if (Meteor.isServer) {
      return getThisScorecardInfo();
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
  async run(params) {
    if (params.newColor === "rgb(255,255,255)") {
      return false;
    }
    const colorScheme = await matsCollections.ColorScheme.findOneAsync({});
    colorScheme.colors.splice(params.insertAfterIndex, 0, params.newColor);
    await matsCollections.updateAsync({}, colorScheme);
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
      const fse = require("fs-extra");
      let path = "";
      if (params.type === "data") {
        path = `/web/static/dataFunctions/${params.file}`;
        console.log(`exporting data file: ${path}`);
      } else if (params.type === "graph") {
        path = `/web/static/displayFunctions/${params.file}`;
        console.log(`exporting graph file: ${path}`);
      } else {
        return "error - wrong type";
      }
      return fse.readFile(path, function (err, data) {
        if (err) throw err;
        return data.toString();
      });
    }
    return null;
  },
});

// refreshes the metadata for the app that's running
const refreshMetaData = new ValidatedMethod({
  name: "matsMethods.refreshMetaData",
  validate: new SimpleSchema({}).validator(),
  async run() {
    if (Meteor.isServer) {
      try {
        // console.log("GUI asked to refresh metadata");
        await checkMetaDataRefresh();
      } catch (e) {
        console.log(e);
        throw new Meteor.Error("Server error: ", e.message);
      }
    }
    return metaDataTableUpdates.find({}).fetchAsync();
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
  async run(params) {
    const colorScheme = await matsCollections.ColorScheme.findOneAsync({});
    const removeIndex = colorScheme.colors.indexOf(params.removeColor);
    colorScheme.colors.splice(removeIndex, 1);
    await matsCollections.ColorScheme.updateAsync({}, colorScheme);
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
  async run(dbName) {
    if (Meteor.isServer) {
      await matsCollections.Databases.removeAsync({
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
  async run(settingsParam) {
    if (Meteor.isServer) {
      // Read the existing settings file
      const { settings } = settingsParam;
      console.log(
        "applySettingsData - matsCollections.appName.findOneAsync({}) is ",
        await matsCollections.appName.findOneAsync({})
      );
      const { appName } = await matsCollections.Settings.findOneAsync({});
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
    const agency = Meteor.settings.public.agency
      ? Meteor.settings.public.agency
      : "Unknown Agency";
    const agencyURL = Meteor.settings.public.agencyURL
      ? Meteor.settings.public.agencyURL
      : "#";
    const displayDisclaimer = Meteor.settings.public.displayResearchDisclaimerOnPlots
      ? Meteor.settings.public.displayResearchDisclaimerOnPlots
      : false;
    const appTitle = Meteor.settings.public.title
      ? Meteor.settings.public.title
      : "Unnamed App";
    const thresholdUnits = Meteor.settings.public.threshold_units
      ? Meteor.settings.public.threshold_units
      : {};
    let appDefaultGroup = "";
    let appDefaultDB = "";
    let appDefaultModel = "";
    switch (type) {
      case matsTypes.AppTypes.metexpress:
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
          agency,
          agencyURL,
          displayResearchDisclaimerOnPlots: displayDisclaimer,
          mysql_wait_timeout: appTimeOut,
          title: appTitle,
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
            const mysqlConnection = await global[poolName].getConnection();
            mysqlConnection.release();
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
        if (
          (await metaDataTableUpdates.find({ name: metaDataRef.name }).countAsync()) ===
          0
        ) {
          await metaDataTableUpdates.updateAsync(
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
    await matsCollections.PlotGraphFunctions.removeAsync({});
    await matsCollections.ColorScheme.removeAsync({});
    await matsDataUtils.doColorScheme();
    await matsCollections.Settings.removeAsync({});
    await matsDataUtils.doSettings(
      appTitle,
      dbType,
      appVersion,
      commit,
      branch,
      appName,
      agency,
      agencyURL,
      displayDisclaimer,
      appType,
      mapboxKey,
      appDefaultGroup,
      appDefaultDB,
      appDefaultModel,
      thresholdUnits,
      appMessage,
      scorecard
    );
    await matsCollections.PlotParams.removeAsync({});
    await matsCollections.CurveTextPatterns.removeAsync({});
    // get the curve params for this app into their collections
    await matsCollections.CurveParamsInfo.removeAsync({});
    await matsCollections.CurveParamsInfo.insertAsync({
      curve_params: curveParams,
    });
    for (let cp = 0; cp < curveParams.length; cp += 1) {
      if (matsCollections[curveParams[cp]] !== undefined) {
        await matsCollections[curveParams[cp]].removeAsync({});
      }
    }
    // if this is a scorecard also get the apps to score out of the settings file
    if (Meteor.settings.public && Meteor.settings.public.scorecard) {
      if (Meteor.settings.public.apps_to_score) {
        appsToScore = Meteor.settings.public.apps_to_score;
        await matsCollections.AppsToScore.removeAsync({});
        await matsCollections.AppsToScore.insertAsync({
          apps_to_score: appsToScore,
        });
      } else {
        throw new Meteor.Error(
          "apps_to_score are not initialized in app settings -= 1cannot build selectors"
        );
      }
    }
    // invoke the app specific routines
    for (let ai = 0; ai < global.appSpecificResetRoutines.length; ai += 1) {
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
  async run(params) {
    if (Meteor.isServer) {
      const key = params.resultKey;
      const { layout } = params;
      const { curveOpsUpdate } = params;
      const { annotation } = params;
      try {
        await LayoutStoreCollection.upsertAsync(
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
        (async function (id, doc) {
          global.cbScorecardSettingsPool.upsertCB(id, doc);
        })(key, scorecardSettings).then(() => {
          console.log("upserted doc with id", key);
        });
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
  async run(params) {
    const user = "anonymous";
    await matsCollections.CurveSettings.upsertAsync(
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
        savedBy: !(await Meteor.userAsync()) ? "anonymous" : user,
      }
    );
  },
});

/* test methods */

const testGetMetaDataTableUpdates = new ValidatedMethod({
  name: "matsMethods.testGetMetaDataTableUpdates",
  validate: new SimpleSchema({}).validator(),
  async run() {
    return metaDataTableUpdates.find({}).fetchAsync();
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
      if (
        (await matsCollections.Settings.findOneAsync()).dbType ===
        matsTypes.DbTypes.couchbase
      ) {
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
        try {
          const mysql = require("mysql2/promise");
          const connection = await mysql.mysql.createConnection({
            host: params.host,
            port: params.port,
            user: params.user,
            password: params.password,
            database: params.database,
          });
          const result = await connection.query("show tables;");
          if (!result || result.includes("ERROR: ")) {
            // return callback(err,null);
            return null;
          }
          const tables = result.map(function (a) {
            return a;
          });
          await connection.end(function (err) {
            if (err) {
              console.log("testGetTables cannot end connection");
            }
          });
          console.log(`MySQL get tables suceeded. result: ${tables}`);
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
  async run() {
    const mtu = await metaDataTableUpdates.find({}).fetchAsync();
    const id = mtu[0]._id;
    await metaDataTableUpdates.updateAsync(
      {
        _id: id,
      },
      {
        $set: {
          lastRefreshed: 0,
        },
      }
    );
    return metaDataTableUpdates.find({}).fetchAsync();
  },
});

// Define routes for server
if (Meteor.isServer) {
  // add indexes to result and axes collections
  DownSampleResults.createIndex(
    {
      createdAt: 1,
    },
    {
      expireAfterSeconds: 3600 * 8,
    }
  ); // 8 hour expiration
  LayoutStoreCollection.createIndex(
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

  // needed for middleware routes
  const app = WebApp.express();
  const router = WebApp.express.Router();

  // eslint-disable-next-line no-unused-vars
  router.use("/status", async function (req, res, next) {
    await status(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/status`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await status(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/CSV/:f/:key/:m/:a", function (req, res, next) {
    getCSV(req.params, res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/CSV/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (req, res, next) {
      getCSV(req.params, res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/JSON/:f/:key/:m/:a", function (req, res, next) {
    getJSON(req.params, res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/JSON/:f/:key/:m/:a`,
    // eslint-disable-next-line no-unused-vars
    function (req, res, next) {
      getJSON(req.params, res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/clearCache", function (req, res, next) {
    clearCache(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/clearCache`,
    // eslint-disable-next-line no-unused-vars
    function (req, res, next) {
      clearCache(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getApps", async function (req, res, next) {
    await getApps(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getApps`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getApps(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getAppSumsDBs", async function (req, res, next) {
    await getAppSumsDBs(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getAppSumsDBs`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getAppSumsDBs(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getModels", async function (req, res, next) {
    await getModels(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getModels`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getModels(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getRegions", async function (req, res, next) {
    await getRegions(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getRegions`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getRegions(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getRegionsValuesMap", async function (req, res, next) {
    await getRegionsValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getRegionsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getRegionsValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getStatistics", async function (req, res, next) {
    await getStatistics(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getStatistics`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getStatistics(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getStatisticsValuesMap", async function (req, res, next) {
    await getStatisticsValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getStatisticsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getStatisticsValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getVariables", async function (req, res, next) {
    await getVariables(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getVariables`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getVariables(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getVariablesValuesMap", async function (req, res, next) {
    await getVariablesValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getVariablesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getVariablesValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getThresholds", async function (req, res, next) {
    await getThresholds(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getThresholds`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getThresholds(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getThresholdsValuesMap", async function (req, res, next) {
    await getThresholdsValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getThresholdsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getThresholdsValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getScales", async function (req, res, next) {
    await getScales(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getScales`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getScales(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getScalesValuesMap", async function (req, res, next) {
    await getScalesValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getScalesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getScalesValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getTruths", async function (req, res, next) {
    await getTruths(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getTruths`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getTruths(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getTruthsValuesMap", async function (req, res, next) {
    await getTruthsValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getTruthsValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getTruthsValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getFcstLengths", async function (req, res, next) {
    await getFcstLengths(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstLengths`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getFcstLengths(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getFcstTypes", async function (req, res, next) {
    await getFcstTypes(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstTypes`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getFcstTypes(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getFcstTypesValuesMap", async function (req, res, next) {
    await getFcstTypesValuesMap(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getFcstTypesValuesMap`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getFcstTypesValuesMap(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getValidTimes", async function (req, res, next) {
    await getValidTimes(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getValidTimes`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getValidTimes(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getLevels", async function (req, res, next) {
    await getLevels(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getLevels`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getLevels(res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/getDates", async function (req, res, next) {
    await getDates(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/getDates`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await getDates(res);
      next();
    }
  );

  // create picker routes for refreshMetaData
  // eslint-disable-next-line no-unused-vars
  router.use("/refreshMetadata", async function (req, res, next) {
    await refreshMetadataMWltData(res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/refreshMetadata`,
    // eslint-disable-next-line no-unused-vars
    async function (req, res, next) {
      await refreshMetadataMWltData(res);
      next();
    }
  );
  // eslint-disable-next-line no-unused-vars
  router.use("/refreshScorecard/:docId", function (req, res, next) {
    refreshScorecard(req.params, res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/refreshScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (req, res, next) {
      refreshScorecard(req.params, res);
      next();
    }
  );

  // eslint-disable-next-line no-unused-vars
  router.use("/setStatusScorecard/:docId", function (req, res, next) {
    setStatusScorecard(req.params, req, res);
    next();
  });

  router.use(
    `${Meteor.settings.public.proxy_prefix_path}/:app/setStatusScorecard/:docId`,
    // eslint-disable-next-line no-unused-vars
    function (req, res, next) {
      setStatusScorecard(req.params, req, res);
      next();
    }
  );

  // mount the router on the app
  app.use("/", router);

  WebApp.handlers.use(app);
}

// eslint-disable-next-line no-undef
export default matsMethods = {
  isThisANaN,
  applyDatabaseSettings,
  applySettingsData,
  deleteSettings,
  dropScorecardInstance,
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
  insertColor,
  readFunctionFile,
  refreshMetaData,
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
