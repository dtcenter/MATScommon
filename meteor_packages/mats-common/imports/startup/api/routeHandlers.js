/**
 * Route handler functions for MATS API
 * Each function handles requests for a specific route
 * Backing functions for the handlers should go in handlerHelpers.js
 */

import { Meteor } from "meteor/meteor";
import { matsCache, matsCollections } from "meteor/randyp:mats-common";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";
import {
  stringifyCurveData,
  getListOfApps,
  getListOfAppDBs,
  getMapByAppAndModel,
  getMapByApp,
  getlevelsByApp,
  getDateMapByAppAndModel,
} from "./handlerHelpers";
// } from "/imports/startup/api/routeHelpers";
import {
  checkMetaDataRefresh,
  getFlattenedResultData,
  getPagenatedData,
} from "./matsHelpers";

/* eslint-disable no-console */

// Health check middleware
export const getHealth = async function ({ res }) {
  if (Meteor.isServer) {
    res.sendStatus(200);
  }
};

// handler for CSV route
export const getCSV = function ({ req, res }) {
  if (Meteor.isServer) {
    // Make sure req exists and has params
    if (!req || !req.params) {
      console.error("Request or request parameters missing in getCSV handler");
      res.status(400).send("Bad request - missing parameters");
      return;
    }

    const { params } = req;
    // eslint-disable-next-line global-require
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

// handler for JSON route
export const getJSON = function ({ req, res }) {
  if (Meteor.isServer) {
    // Make sure req exists and has params
    if (!req || !req.params) {
      console.error("Request or request parameters missing in getJSON handler");
      res.status(400).send("Bad request - missing parameters");
      return;
    }

    const { params } = req;
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

// Cache management middleware
export const clearCache = function ({ res }) {
  if (Meteor.isServer) {
    matsCache.clear();
    res.end("<body><h1>clearCache Done!</h1></body>");
  }
};

// handler for getApps route
export const getApps = async function ({ res }) {
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

// handler for getAppSumsDBs route
export const getAppSumsDBs = async function ({ res }) {
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

// handler for getModels route
export const getModels = async function ({ res }) {
  // this function returns a map of models keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("data-source", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getRegions route
export const getRegions = async function ({ res }) {
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

// handler for getRegionsValuesMap route
export const getRegionsValuesMap = async function ({ res }) {
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

// handler for getStatistics route
export const getStatistics = async function ({ res }) {
  // this function returns an map of statistics keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("statistic");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getStatisticsValuesMap route
export const getStatisticsValuesMap = async function ({ res }) {
  // this function returns a map of statistic values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("statistic", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getVariables route
export const getVariables = async function ({ res }) {
  // this function returns an map of variables keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("variable");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getVariablesValuesMap route
export const getVariablesValuesMap = async function ({ res }) {
  // this function returns a map of variable values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("variable", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getThresholds route
export const getThresholds = async function ({ res }) {
  // this function returns a map of thresholds keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("threshold", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getThresholdsValuesMap route
export const getThresholdsValuesMap = async function ({ res }) {
  // this function returns a map of threshold values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("threshold", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getScales route
export const getScales = async function ({ res }) {
  // this function returns a map of scales keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("scale", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getScalesValuesMap route
export const getScalesValuesMap = async function ({ res }) {
  // this function returns a map of scale values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("scale", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getTruth route
export const getTruths = async function ({ res }) {
  // this function returns a map of truths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("truth", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getTruthValuesMap route
export const getTruthsValuesMap = async function ({ res }) {
  // this function returns a map of truth values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("truth", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getFcstLengths route
export const getFcstLengths = async function ({ res }) {
  // this function returns a map of forecast lengths keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-length", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getFcstTypes route
export const getFcstTypes = async function ({ res }) {
  // this function returns a map of forecast types keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-type", "optionsMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getFcstTypesValuesMap route
export const getFcstTypesValuesMap = async function ({ res }) {
  // this function returns a map of forecast type values keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByAppAndModel("forecast-type", "valuesMap");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getValidTimes route
export const getValidTimes = async function ({ res }) {
  // this function returns an map of valid times keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getMapByApp("valid-time");
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getValidTimes route
export const getLevels = async function ({ res }) {
  // this function returns an map of pressure levels keyed by app title
  if (Meteor.isServer) {
    const flatJSON = await getlevelsByApp();
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for getDates route
export const getDates = async function ({ res }) {
  // this function returns a map of dates keyed by app title and model display text
  if (Meteor.isServer) {
    const flatJSON = await getDateMapByAppAndModel();
    res.setHeader("Content-Type", "application/json");
    res.write(flatJSON);
    res.end();
  }
};

// handler for refreshing the metadata
export const refreshMetadataMWltData = async function ({ res }) {
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

// handler for causing the scorecard to refresh its mongo collection for a given document
export const refreshScorecard = function ({ req, res }) {
  if (Meteor.isServer) {
    // Make sure req exists and has params
    if (!req || !req.params) {
      console.error(
        "Request or request parameters missing in refreshScorecard handler"
      );
      res.status(400).send("Bad request - missing parameters");
      return;
    }

    const { params } = req;
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

export const setStatusScorecard = function ({ req, res }) {
  if (Meteor.isServer) {
    // Make sure req exists and has params
    if (!req || !req.params) {
      console.error(
        "Request or request parameters missing in setStatusScorecard handler"
      );
      res.status(400).send("Bad request - missing parameters");
      return;
    }

    const { params } = req;
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
