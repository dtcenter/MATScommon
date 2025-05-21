/**
 * Helper functions for our Express route handlers defined in routeHandlers.js
 */

import { _ } from "meteor/underscore";
import { matsTypes, matsCollections, matsDataUtils } from "meteor/randyp:mats-common";

/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */

// helper function for getCSV
export const stringifyCurveData = function (stringify, dataArray, res) {
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

// helper function for returning an array of database-distinct apps contained within a larger MATS app
export async function getListOfApps() {
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

// helper function for returning a map of database-distinct apps contained within a larger MATS app and their DBs
export async function getListOfAppDBs() {
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

// helper function for getting a metadata map from a MATS selector, keyed by app title and model display text
export async function getMapByAppAndModel(selector, mapType) {
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

// helper function for getting a date metadata map from a MATS selector, keyed by app title and model display text
export async function getDateMapByAppAndModel() {
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

// helper function for populating the levels in a MATS selector
export async function getlevelsByApp() {
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

// helper function for getting a metadata map from a MATS selector, keyed by app title
export async function getMapByApp(selector) {
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
