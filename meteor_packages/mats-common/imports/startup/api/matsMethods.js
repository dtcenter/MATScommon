/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/**
 * Internal data functions for MATS
 * Also handles route registration
 */

import { Meteor } from "meteor/meteor";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import SimpleSchema from "meteor/aldeed:simple-schema";
import {
  matsCache,
  matsCollections,
  matsCouchbaseUtils,
  matsDataUtils,
  matsTypes,
  versionInfo,
} from "meteor/randyp:mats-common";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";
import { Mongo } from "meteor/mongo";
import { curveParamsByApp } from "../both/mats-curve-params";
import { setupRouter } from "./routeRegistration";
import { checkMetaDataRefresh, getFlattenedResultData } from "./matsHelpers";

/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable global-require */

// PRIVATE

// initialize collection used for pop-out window functionality
const LayoutStoreCollection = new Mongo.Collection("LayoutStoreCollection");
// initialize collection used to cache previously downsampled plots
const DownSampleResults = new Mongo.Collection("DownSampleResults");

// utility to check for empty object
const isEmpty = function (map) {
  const mapKeys = Object.keys(map);
  return mapKeys.length === 0;
};

// wrapper for NaN check
const isThisANaN = function (val) {
  // eslint-disable-next-line no-restricted-globals
  return val === undefined || val === null || isNaN(val);
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
    return matsCollections.metaDataTableUpdates.find({}).fetchAsync();
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
              : Meteor.settings.public.undefinedRoles;
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
          (await matsCollections.metaDataTableUpdates
            .find({ name: metaDataRef.name })
            .countAsync()) === 0
        ) {
          await matsCollections.metaDataTableUpdates.updateAsync(
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
    return matsCollections.metaDataTableUpdates.find({}).fetchAsync();
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
    const mtu = await matsCollections.metaDataTableUpdates.find({}).fetchAsync();
    const id = mtu[0]._id;
    await matsCollections.metaDataTableUpdates.updateAsync(
      {
        _id: id,
      },
      {
        $set: {
          lastRefreshed: 0,
        },
      }
    );
    return matsCollections.metaDataTableUpdates.find({}).fetchAsync();
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

  // configure the routes
  setupRouter();
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
