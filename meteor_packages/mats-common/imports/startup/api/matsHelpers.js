/**
 * Helper functions used by matsMethods and routerHandlers
 */

import { Meteor } from "meteor/meteor";
import {
  matsCache,
  matsCollections,
  matsDataQueryUtils,
  matsDataUtils,
  matsTypes,
} from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";

/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

// private - used to see if the main page needs to update its selectors
export const checkMetaDataRefresh = async function () {
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
  const tableUpdates = await matsCollections.metaDataTableUpdates.find({}).fetchAsync();
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
      await matsCollections.metaDataTableUpdates.updateAsync(
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

// private method for getting pagenated data
// a newPageIndex of -1000 means get all the data (used for export)
// a newPageIndex of -2000 means get just the last page
export const getPagenatedData = function (rky, p, np) {
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
export const getFlattenedResultData = function (rk, p, np) {
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
