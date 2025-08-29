/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsMethods,
  matsDataUtils,
  matsDataMatchUtils,
  matsDataDiffUtils,
  matsDataCurveOpsUtils,
  matsDataPlotOpsUtils,
} from "meteor/randyp:mats-common";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";
import { _ } from "meteor/underscore";

/* eslint-disable no-await-in-loop */

const processDataXYCurve = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  // variable to store maximum error bar length
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  let errorMax = Number.MIN_VALUE;
  const error = "";

  const { appName } = await matsCollections.Settings.findOneAsync({});
  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] !==
      undefined;
    const { diffFrom } = returnCurveInfoParams.curves[curveIndex];
    const statisticSelect =
      appName.indexOf("anomalycor") !== -1
        ? "ACC"
        : returnCurveInfoParams.curves[curveIndex].statistic;
    const data = returnDataset[curveIndex];
    let statType;
    if (returnCurveInfoParams.statType === undefined) {
      statType = "default"; // dummy stat type
    } else if (Array.isArray(returnCurveInfoParams.statType)) {
      statType = returnCurveInfoParams.statType[curveIndex];
    } else {
      statType = returnCurveInfoParams.statType;
    }
    const { label } = returnDataset[curveIndex];

    let di = 0;
    const values = [];
    const indVars = [];

    while (di < data.x.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      // These don't make sense for aggregated MODE stats, so skip for them.
      let errorResult;
      if (!statType.includes("met-mode")) {
        if (appParams.hasLevels) {
          errorResult = matsDataUtils.getErr(
            data.subVals[di],
            data.subSecs[di],
            data.subLevs[di],
            appParams
          );
        } else {
          errorResult = matsDataUtils.getErr(
            data.subVals[di],
            data.subSecs[di],
            [],
            appParams
          );
        }
      }

      if (diffFrom !== null && diffFrom !== undefined) {
        if (
          returnDataset[diffFrom[0]].y[di] !== null &&
          returnDataset[diffFrom[1]].y[di] !== null
        ) {
          // make sure that the diff curve actually shows the difference when matching.
          // otherwise outlier filtering etc. can make it slightly off.
          data.y[di] =
            returnDataset[diffFrom[0]].y[di] - returnDataset[diffFrom[1]].y[di];
        } else {
          // keep the null for no data at this point
          data.y[di] = null;
        }
      }

      values.push(data.y[di]);
      indVars.push(data.x[di]);

      // store error bars if matching and not an aggregated MODE stat
      let errorLength = 0;
      if (!appParams.matching || statType.includes("met-mode")) {
        data.error_y.array[di] = null;
      } else if (statType === "ctc") {
        // call the python ctc error bar code for diff curves
        if (
          diffFrom === undefined ||
          diffFrom === null ||
          !(
            Array.isArray(returnDataset[diffFrom[0]].subHit[di]) ||
            !matsMethods.isThisANaN(returnDataset[diffFrom[0]].subHit[di])
          ) ||
          !(
            Array.isArray(returnDataset[diffFrom[1]].subHit[di]) ||
            !matsMethods.isThisANaN(returnDataset[diffFrom[1]].subHit[di])
          )
        ) {
          data.error_y.array[di] = null;
        } else {
          const minuendData = {
            hit: returnDataset[diffFrom[0]].subHit[di],
            fa: returnDataset[diffFrom[0]].subFa[di],
            miss: returnDataset[diffFrom[0]].subMiss[di],
            cn: returnDataset[diffFrom[0]].subCn[di],
          };
          const subtrahendData = {
            hit: returnDataset[diffFrom[1]].subHit[di],
            fa: returnDataset[diffFrom[1]].subFa[di],
            miss: returnDataset[diffFrom[1]].subMiss[di],
            cn: returnDataset[diffFrom[1]].subCn[di],
          };
          errorLength = await matsDataUtils.ctcErrorPython(
            statisticSelect,
            minuendData,
            subtrahendData
          );
          errorMax = errorMax > errorLength ? errorMax : errorLength;
          data.error_y.array[di] = errorLength;
        }
      } else {
        const errorBar = errorResult.stdeBetsy * 1.96;
        errorMax = errorMax > errorBar ? errorMax : errorBar;
        data.error_y.array[di] = errorBar;
      }

      // the tooltip is stored in data.text
      // also change the x array from epoch to date for timeseries and DMC, as we are now done with it for calculations.
      data.text[di] = label;
      switch (appParams.plotType) {
        case matsTypes.PlotTypes.timeSeries:
          data.text[di] = `${data.text[di]}<br>time: ${moment
            .utc(data.x[di])
            .format("YYYY-MM-DD HH:mm")}`;
          break;
        case matsTypes.PlotTypes.dailyModelCycle:
          {
            let fhr =
              ((data.x[di] / 1000) % (24 * 3600)) / 3600 -
              returnCurveInfoParams.utcCycleStarts[curveIndex];
            fhr = fhr < 0 ? fhr + 24 : fhr;
            data.text[di] = `${data.text[di]}<br>time: ${moment
              .utc(data.x[di])
              .format("YYYY-MM-DD HH:mm")}`;
            data.text[di] = `${data.text[di]}<br>forecast hour: ${fhr}`;
          }
          break;
        case matsTypes.PlotTypes.dieoff:
          data.text[di] = `${data.text[di]}<br>fhr: ${data.x[di]}`;
          break;
        case matsTypes.PlotTypes.threshold:
          data.text[di] = `${data.text[di]}<br>threshold: ${data.x[di]}`;
          break;
        case matsTypes.PlotTypes.validtime:
          data.text[di] = `${data.text[di]}<br>hour of day: ${data.x[di]}`;
          break;
        case matsTypes.PlotTypes.gridscale:
          data.text[di] = `${data.text[di]}<br>grid scale: ${data.x[di]}`;
          break;
        case matsTypes.PlotTypes.yearToYear:
          data.text[di] = `${data.text[di]}<br>year: ${data.x[di]}`;
          break;
        default:
          data.text[di] = `${data.text[di]}<br>${data.x[di]}`;
          break;
      }

      // store statistics for this di datapoint
      if (statType === "ctc") {
        data.stats[di] = {
          stat: data.y[di],
          n:
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? data.subHit[di].length
              : 0,
          hit:
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null,
          fa:
            Array.isArray(data.subFa[di]) || !matsMethods.isThisANaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null,
          miss:
            Array.isArray(data.subMiss[di]) || !matsMethods.isThisANaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null,
          cn:
            Array.isArray(data.subCn[di]) || !matsMethods.isThisANaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
            ? data.subHit[di].length
            : 0
        }<br>Hits: ${
          Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
            ? matsDataUtils.sum(data.subHit[di])
            : null
        }<br>False alarms: ${
          Array.isArray(data.subFa[di]) || !matsMethods.isThisANaN(data.subFa[di])
            ? matsDataUtils.sum(data.subFa[di])
            : null
        }<br>Misses: ${
          Array.isArray(data.subMiss[di]) || !matsMethods.isThisANaN(data.subMiss[di])
            ? matsDataUtils.sum(data.subMiss[di])
            : null
        }<br>Correct Nulls: ${
          Array.isArray(data.subCn[di]) || !matsMethods.isThisANaN(data.subCn[di])
            ? matsDataUtils.sum(data.subCn[di])
            : null
        }<br>Errorbars: ${Number(data.y[di] - errorLength).toPrecision(4)} to ${Number(
          data.y[di] + errorLength
        ).toPrecision(4)}`;
      } else if (statType === "met-mode_pair") {
        data.stats[di] = {
          stat: data.y[di],
          n:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          raw_stat: data.y[di],
          nGood:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          avgInterest:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subInterest[di]) ||
          !matsMethods.isThisANaN(data.subInterest[di])
            ? data.subInterest[di].length
            : 0
        }<br>Average Interest: ${
          Array.isArray(data.subInterest[di]) ||
          !matsMethods.isThisANaN(data.subInterest[di])
            ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
            : null
        }`;
      } else if (statType === "met-mode_single") {
        data.stats[di] = {
          stat: data.y[di],
          nForecast: data.nForecast[di],
          nMatched: data.nMatched[di],
          nSimple: data.nSimple[di],
          nTotal: data.nTotal[di],
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>Forecast objects: ${
          data.nForecast[di] === null ? null : data.nForecast[di].toString()
        }<br>Matched objects: ${
          data.nMatched[di] === null ? null : data.nMatched[di].toString()
        }<br>Simple objects: ${
          data.nSimple[di] === null ? null : data.nSimple[di].toString()
        }<br>Total objects: ${
          data.nTotal[di] === null ? null : data.nTotal[di].toString()
        }`;
      } else {
        data.stats[di] = {
          stat: data.y[di],
          n: errorResult.nGood,
          mean:
            statisticSelect === "N" ||
            statisticSelect ===
              "N times*levels(*stations if station plot) per graph point"
              ? errorResult.sum
              : errorResult.dMean,
          sd: errorResult.sd,
          nGood: errorResult.nGood,
          lag1: errorResult.lag1,
          stdeBetsy: errorResult.stdeBetsy,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>sd: ${
          errorResult.sd === null ? null : errorResult.sd.toPrecision(4)
        }<br>mean: ${
          errorResult.dMean === null ? null : errorResult.dMean.toPrecision(4)
        }<br>n: ${errorResult.nGood}<br>stde: ${
          errorResult.stdeBetsy
        }<br>errorbars: ${Number(data.y[di] - errorResult.stdeBetsy * 1.96).toPrecision(
          4
        )} to ${Number(data.y[di] + errorResult.stdeBetsy * 1.96).toPrecision(4)}`;
      }

      di += 1;
    }

    // enable error bars if matching and they aren't null.
    if (
      appParams.matching &&
      data.error_y.array.filter((x) => x || x === 0).length > 0
    ) {
      if (statType !== "ctc" || (diffFrom !== undefined && diffFrom !== null)) {
        data.error_y.visible = true;
      }
    }

    // get the overall stats for the text output.
    const stats = matsDataUtils.getErr(values, indVars, [], appParams);
    const filteredValues = values.filter((x) => x || x === 0);
    stats.miny = Math.min(...filteredValues);
    stats.maxy = Math.max(...filteredValues);
    returnDataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const filteredIndVars = [];
    for (let vidx = 0; vidx < values.length; vidx += 1) {
      if (values[vidx] !== null) filteredIndVars.push(indVars[vidx]);
    }
    const minx = Math.min(...filteredIndVars);
    const maxx = Math.max(...filteredIndVars);
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymax < stats.maxy ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.maxy
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymin > stats.miny ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.miny
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymin;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmax < maxx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? maxx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmin > minx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? minx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmin;

    // recalculate curve annotation after QC and matching
    const newMean = matsDataUtils.average(filteredValues);
    const newMedian = matsDataUtils.median(filteredValues);
    const newStdev = matsDataUtils.stdev(filteredValues);
    if (newMean !== undefined && newMean !== null) {
      returnDataset[curveIndex].annotation = `${label} mean = ${newMean.toPrecision(
        4
      )}`;
      returnDataset[curveIndex].annotation = `${
        returnDataset[curveIndex].annotation
      }, median = ${newMedian.toPrecision(4)}`;
      returnDataset[curveIndex].annotation = `${
        returnDataset[curveIndex].annotation
      }, stdev = ${newStdev.toPrecision(4)}`;
    } else {
      returnDataset[
        curveIndex
      ].annotation = `${label} mean = NoData, median = NoData, stdev = NoData`;
    }

    if (
      appParams.plotType === matsTypes.PlotTypes.timeSeries ||
      appParams.plotType === matsTypes.PlotTypes.dailyModelCycle
    ) {
      data.x_epoch = data.x;
      data.x = data.x.map(function (val) {
        return moment.utc(val).format("YYYY-MM-DD HH:mm");
      });
    }
  }

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subHit = [];
    data.subFa = [];
    data.subMiss = [];
    data.subCn = [];
    data.subSquareDiffSum = [];
    data.subNSum = [];
    data.subObsModelDiffSum = [];
    data.subModelSum = [];
    data.subObsSum = [];
    data.subAbsSum = [];
    data.subInterest = [];
    data.subData = [];
    data.subHeaders = [];
    data.nForecast = [];
    data.nMatched = [];
    data.nSimple = [];
    data.nTotal = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  // generate plot options
  let resultOptions;
  switch (appParams.plotType) {
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dailyModelCycle:
      resultOptions = await matsDataPlotOpsUtils.generateSeriesPlotOptions(
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.dieoff:
      resultOptions = await matsDataPlotOpsUtils.generateDieoffPlotOptions(
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.threshold:
      resultOptions = await matsDataPlotOpsUtils.generateThresholdPlotOptions(
        returnDataset,
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.validtime:
      resultOptions = await matsDataPlotOpsUtils.generateValidTimePlotOptions(
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.gridscale:
      resultOptions = await matsDataPlotOpsUtils.generateGridScalePlotOptions(
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.yearToYear:
      resultOptions = await matsDataPlotOpsUtils.generateYearToYearPlotOptions(
        returnCurveInfoParams.axisMap,
        errorMax
      );
      break;
    default:
      break;
  }

  // add black 0 line curve
  // need to define the minimum and maximum x value for making the zero curve
  const zeroLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    0,
    "top left",
    matsTypes.ReservedWords.zero,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(zeroLine);

  // add ideal value lines, if any
  let idealValueLine;
  let idealLabel;
  for (let ivIdx = 0; ivIdx < returnCurveInfoParams.idealValues.length; ivIdx += 1) {
    idealLabel = `ideal${ivIdx.toString()}`;
    idealValueLine = matsDataCurveOpsUtils.getHorizontalValueLine(
      resultOptions.xaxis.range[1],
      resultOptions.xaxis.range[0],
      returnCurveInfoParams.idealValues[ivIdx],
      "bottom left",
      matsTypes.ReservedWords[idealLabel],
      "rgb(0,0,0)",
      1
    );
    returnDataset.push(idealValueLine);
  }

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataProfile = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  // variable to store maximum error bar length
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  let errorMax = Number.MIN_VALUE;
  const error = "";

  const { appName } = await matsCollections.Settings.findOneAsync({});
  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] !==
      undefined;
    const { diffFrom } = returnCurveInfoParams.curves[curveIndex];
    const statisticSelect =
      appName.indexOf("anomalycor") !== -1
        ? "ACC"
        : returnCurveInfoParams.curves[curveIndex].statistic;
    const data = returnDataset[curveIndex];
    let statType;
    if (returnCurveInfoParams.statType === undefined) {
      statType = "default"; // dummy stat type
    } else if (Array.isArray(returnCurveInfoParams.statType)) {
      statType = returnCurveInfoParams.statType[curveIndex];
    } else {
      statType = returnCurveInfoParams.statType;
    }
    const { label } = returnDataset[curveIndex];

    let di = 0;
    const values = [];
    const levels = [];

    while (di < data.y.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      // These don't make sense for aggregated MODE stats, so skip for them.
      let errorResult;
      if (!statType.includes("met-mode")) {
        errorResult = matsDataUtils.getErr(
          data.subVals[di],
          data.subSecs[di],
          data.subLevs[di],
          appParams
        );
      }

      if (diffFrom !== null && diffFrom !== undefined) {
        if (
          returnDataset[diffFrom[0]].x[di] !== null &&
          returnDataset[diffFrom[1]].x[di] !== null
        ) {
          // make sure that the diff curve actually shows the difference when matching.
          // otherwise outlier filtering etc. can make it slightly off.
          data.x[di] =
            returnDataset[diffFrom[0]].x[di] - returnDataset[diffFrom[1]].x[di];
        } else {
          // keep the null for no data at this point
          data.x[di] = null;
        }
      }

      values.push(data.x[di]);
      levels.push(data.y[di]);

      // store error bars if matching and not an aggregated MODE stat
      let errorLength = 0;
      if (!appParams.matching || statType.includes("met-mode")) {
        data.error_x.array[di] = null;
      } else if (statType === "ctc") {
        // call the python ctc error bar code for diff curves
        if (
          diffFrom === undefined ||
          diffFrom === null ||
          !(
            Array.isArray(returnDataset[diffFrom[0]].subHit[di]) ||
            !matsMethods.isThisANaN(returnDataset[diffFrom[0]].subHit[di])
          ) ||
          !(
            Array.isArray(returnDataset[diffFrom[1]].subHit[di]) ||
            !matsMethods.isThisANaN(returnDataset[diffFrom[1]].subHit[di])
          )
        ) {
          data.error_x.array[di] = null;
        } else {
          const minuendData = {
            hit: returnDataset[diffFrom[0]].subHit[di],
            fa: returnDataset[diffFrom[0]].subFa[di],
            miss: returnDataset[diffFrom[0]].subMiss[di],
            cn: returnDataset[diffFrom[0]].subCn[di],
          };
          const subtrahendData = {
            hit: returnDataset[diffFrom[1]].subHit[di],
            fa: returnDataset[diffFrom[1]].subFa[di],
            miss: returnDataset[diffFrom[1]].subMiss[di],
            cn: returnDataset[diffFrom[1]].subCn[di],
          };
          errorLength = await matsDataUtils.ctcErrorPython(
            statisticSelect,
            minuendData,
            subtrahendData
          );
          errorMax = errorMax > errorLength ? errorMax : errorLength;
          data.error_x.array[di] = errorLength;
        }
      } else {
        const errorBar = errorResult.stdeBetsy * 1.96;
        errorMax = errorMax > errorBar ? errorMax : errorBar;
        data.error_x.array[di] = errorBar;
      }

      // store statistics for this di datapoint
      if (statType === "ctc") {
        data.stats[di] = {
          stat: data.x[di],
          n:
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? data.subHit[di].length
              : 0,
          hit:
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null,
          fa:
            Array.isArray(data.subFa[di]) || !matsMethods.isThisANaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null,
          miss:
            Array.isArray(data.subMiss[di]) || !matsMethods.isThisANaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null,
          cn:
            Array.isArray(data.subCn[di]) || !matsMethods.isThisANaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null,
        };
        data.text[di] =
          `${label}<br>${data.y[di]}mb` +
          `<br>${statisticSelect}: ${
            data.x[di] === null ? null : data.x[di].toPrecision(4)
          }<br>n: ${
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? data.subHit[di].length
              : 0
          }<br>Hits: ${
            Array.isArray(data.subHit[di]) || !matsMethods.isThisANaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null
          }<br>False alarms: ${
            Array.isArray(data.subFa[di]) || !matsMethods.isThisANaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null
          }<br>Misses: ${
            Array.isArray(data.subMiss[di]) || !matsMethods.isThisANaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null
          }<br>Correct Nulls: ${
            Array.isArray(data.subCn[di]) || !matsMethods.isThisANaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null
          }<br>Errorbars: ${Number(data.x[di] - errorLength).toPrecision(
            4
          )} to ${Number(data.x[di] + errorLength).toPrecision(4)}`;
      } else if (statType === "met-mode_pair") {
        data.stats[di] = {
          stat: data.x[di],
          n:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          raw_stat: data.x[di],
          nGood:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          avgInterest:
            Array.isArray(data.subInterest[di]) ||
            !matsMethods.isThisANaN(data.subInterest[di])
              ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.x[di] === null ? null : data.x[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subInterest[di]) ||
          !matsMethods.isThisANaN(data.subInterest[di])
            ? data.subInterest[di].length
            : 0
        }<br>Average Interest: ${
          Array.isArray(data.subInterest[di]) ||
          !matsMethods.isThisANaN(data.subInterest[di])
            ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
            : null
        }`;
      } else if (statType === "met-mode_single") {
        data.stats[di] = {
          stat: data.x[di],
          nForecast: data.nForecast[di],
          nMatched: data.nMatched[di],
          nSimple: data.nSimple[di],
          nTotal: data.nTotal[di],
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.x[di] === null ? null : data.x[di].toPrecision(4)
        }<br>Forecast objects: ${
          data.nForecast[di] === null ? null : data.nForecast[di].toString()
        }<br>Matched objects: ${
          data.nMatched[di] === null ? null : data.nMatched[di].toString()
        }<br>Simple objects: ${
          data.nSimple[di] === null ? null : data.nSimple[di].toString()
        }<br>Total objects: ${
          data.nTotal[di] === null ? null : data.nTotal[di].toString()
        }`;
      } else {
        data.stats[di] = {
          stat: data.x[di],
          n: errorResult.nGood,
          mean:
            statisticSelect === "N" ||
            statisticSelect ===
              "N times*levels(*stations if station plot) per graph point"
              ? errorResult.sum
              : errorResult.dMean,
          sd: errorResult.sd,
          nGood: errorResult.nGood,
          lag1: errorResult.lag1,
          stdeBetsy: errorResult.stdeBetsy,
        };
        data.text[di] =
          `${label}<br>${data.y[di]}mb` +
          `<br>${statisticSelect}: ${
            data.x[di] === null ? null : data.x[di].toPrecision(4)
          }<br>sd: ${
            errorResult.sd === null ? null : errorResult.sd.toPrecision(4)
          }<br>mean: ${
            errorResult.dMean === null ? null : errorResult.dMean.toPrecision(4)
          }<br>n: ${errorResult.nGood}<br>stde: ${
            errorResult.stdeBetsy
          }<br>errorbars: ${Number(
            data.x[di] - errorResult.stdeBetsy * 1.96
          ).toPrecision(4)} to ${Number(
            data.x[di] + errorResult.stdeBetsy * 1.96
          ).toPrecision(4)}`;
      }

      di += 1;
    }

    // enable error bars if matching and they aren't null.
    if (
      appParams.matching &&
      data.error_x.array.filter((x) => x || x === 0).length > 0
    ) {
      if (statType !== "ctc" || (diffFrom !== undefined && diffFrom !== null)) {
        data.error_x.visible = true;
      }
    }

    // get the overall stats for the text output.
    const stats = matsDataUtils.getErr(
      values.reverse(),
      levels.reverse(),
      [],
      appParams
    ); // have to reverse because of data inversion
    const filteredValues = values.filter((x) => x || x === 0);
    stats.minx = Math.min(...filteredValues);
    stats.maxx = Math.max(...filteredValues);
    returnDataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const filteredLevels = [];
    for (let vidx = 0; vidx < values.length; vidx += 1) {
      if (values[vidx] !== null) filteredLevels.push(levels[vidx]);
    }
    const miny = Math.min(...filteredLevels);
    const maxy = Math.max(...filteredLevels);
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymax < maxy ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? maxy
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymin > miny ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? miny
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymin;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmax < stats.maxx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.maxx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmin > stats.minx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.minx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmin;

    // recalculate curve annotation after QC and matching
    const newMean = matsDataUtils.average(filteredValues);
    const newMedian = matsDataUtils.median(filteredValues);
    const newStdev = matsDataUtils.stdev(filteredValues);
    if (newMean !== undefined && newMean !== null) {
      returnDataset[curveIndex].annotation = `${label} mean = ${newMean.toPrecision(
        4
      )}`;
      returnDataset[curveIndex].annotation = `${
        returnDataset[curveIndex].annotation
      }, median = ${newMedian.toPrecision(4)}`;
      returnDataset[curveIndex].annotation = `${
        returnDataset[curveIndex].annotation
      }, stdev = ${newStdev.toPrecision(4)}`;
    } else {
      returnDataset[
        curveIndex
      ].annotation = `${label} mean = NoData, median = NoData, stdev = NoData`;
    }
  }

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subHit = [];
    data.subFa = [];
    data.subMiss = [];
    data.subCn = [];
    data.subSquareDiffSum = [];
    data.subNSum = [];
    data.subObsModelDiffSum = [];
    data.subModelSum = [];
    data.subObsSum = [];
    data.subAbsSum = [];
    data.subInterest = [];
    data.subData = [];
    data.subHeaders = [];
    data.nForecast = [];
    data.nMatched = [];
    data.nSimple = [];
    data.nTotal = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateProfilePlotOptions(
    returnCurveInfoParams.axisMap,
    errorMax
  );

  // add black 0 line curve
  // need to define the minimum and maximum y value for making the zero curve
  const zeroLine = matsDataCurveOpsUtils.getVerticalValueLine(
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    0,
    "bottom right",
    matsTypes.ReservedWords.zero,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(zeroLine);

  // add ideal value lines, if any
  let idealValueLine;
  let idealLabel;
  for (let ivIdx = 0; ivIdx < returnCurveInfoParams.idealValues.length; ivIdx += 1) {
    idealLabel = `ideal${ivIdx.toString()}`;
    idealValueLine = matsDataCurveOpsUtils.getVerticalValueLine(
      resultOptions.yaxis.range[1],
      resultOptions.yaxis.range[0],
      returnCurveInfoParams.idealValues[ivIdx],
      "bottom left",
      matsTypes.ReservedWords[idealLabel],
      "rgb(0,0,0)",
      1
    );
    returnDataset.push(idealValueLine);
  }

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataReliability = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    const { label } = data;
    const sampleClimo = data.sample_climo;

    let di = 0;
    while (di < data.x.length) {
      // store statistics for this di datapoint
      if (isMetexpress) {
        data.stats[di] = {
          prob_bin: data.x[di],
          hit_rate: data.y[di],
          obs_y: data.oy_all[di],
          obs_n: data.on_all[di],
        };
      } else {
        data.stats[di] = {
          prob_bin: data.x[di],
          obs_freq: data.y[di],
          hit_count: data.hitCount[di],
          fcst_count: data.fcstCount[di],
        };
      }
      // the tooltip is stored in data.text
      data.text[di] = label;
      if (isMetexpress) {
        data.text[di] = `${data.text[di]}<br>probability bin: ${data.x[di]}`;
        data.text[di] = `${data.text[di]}<br>hit rate: ${data.y[di]}`;
        data.text[di] = `${data.text[di]}<br>oy: ${data.oy_all[di]}`;
        data.text[di] = `${data.text[di]}<br>on: ${data.on_all[di]}`;
      } else {
        data.text[di] = `${data.text[di]}<br>probability bin: ${data.x[di]}`;
        data.text[di] = `${data.text[di]}<br>observed frequency: ${data.y[di]}`;
        data.text[di] = `${data.text[di]}<br>hit count: ${data.hitCount[di]}`;
        data.text[di] = `${data.text[di]}<br>fcst count: ${data.fcstCount[di]}`;
      }

      di += 1;
    }
    returnDataset[curveIndex].glob_stats = {
      sample_climo: sampleClimo,
    };
  }

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateReliabilityPlotOptions();

  // add black perfect reliability line curve
  const perfectLine = matsDataCurveOpsUtils.getLinearValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    matsTypes.ReservedWords.perfectReliability,
    "top left",
    matsTypes.ReservedWords.perfectReliability,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(perfectLine);

  // assign no skill lines for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    const { label } = data;
    const color = data.annotateColor;
    const sampleClimo = data.sample_climo;
    let skillmin;
    let skillmax;
    if (sampleClimo >= data.ymin) {
      skillmin = sampleClimo - (sampleClimo - data.xmin) / 2;
    } else {
      skillmin = data.xmin - (data.xmin - sampleClimo) / 2;
    }
    if (sampleClimo >= data.ymax) {
      skillmax = sampleClimo - (sampleClimo - data.xmax) / 2;
    } else {
      skillmax = data.xmax - (data.xmax - sampleClimo) / 2;
    }
    // add black no skill line curve
    const noSkillLine = matsDataCurveOpsUtils.getLinearValueLine(
      resultOptions.xaxis.range[1],
      resultOptions.xaxis.range[0],
      skillmax,
      skillmin,
      `${"  "}${
        curveIndex === 0
          ? matsTypes.ReservedWords.noSkill
          : matsTypes.ReservedWords.noSkillNoLabel
      }`,
      "bottom right",
      `${label}-${
        curveIndex === 0
          ? matsTypes.ReservedWords.noSkill
          : matsTypes.ReservedWords.noSkillNoLabel
      }`,
      color,
      1
    );
    returnDataset.push(noSkillLine);
  }

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subRelHit = [];
    data.subRelRawCount = [];
    data.subRelCount = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataROC = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    let statType;
    if (returnCurveInfoParams.statType === undefined) {
      statType = "scalar";
    } else if (Array.isArray(returnCurveInfoParams.statType)) {
      statType = returnCurveInfoParams.statType[curveIndex];
    } else {
      statType = returnCurveInfoParams.statType;
    }
    const { label } = returnDataset[curveIndex];
    const { auc } = data;

    let di = 0;
    while (di < data.x.length) {
      let binValue = statType.includes("met-")
        ? data.threshold_all[di]
        : data.binVals[di];
      binValue =
        data.binParam.indexOf("Date") > -1
          ? moment.utc(binValue * 1000).format("YYYY-MM-DD HH:mm")
          : binValue;
      // store statistics for this di datapoint
      data.stats[di] = {
        bin_value: binValue,
        pody: data.y[di],
        pofd: data.x[di],
        n: data.n[di],
        obs_y: data.oy_all[di],
        obs_n: data.on_all[di],
      };
      // the tooltip is stored in data.text
      data.text[di] = label;
      data.text[di] = `${data.text[di]}<br>bin value: ${binValue}`;
      data.text[di] = `${data.text[di]}<br>probability of detection: ${data.y[di]}`;
      data.text[
        di
      ] = `${data.text[di]}<br>probability of false detection: ${data.x[di]}`;
      data.text[di] = `${data.text[di]}<br>n: ${data.n[di]}`;

      di += 1;
    }
    returnDataset[curveIndex].glob_stats = {
      auc,
    };
  }

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateROCPlotOptions();

  // add black no skill line curve
  const noSkillLine = matsDataCurveOpsUtils.getLinearValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    matsTypes.ReservedWords.noSkill,
    "top left",
    matsTypes.ReservedWords.noSkill,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(noSkillLine);

  // add perfect forecast lines
  const xPerfectLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[0],
    resultOptions.xaxis.range[1],
    resultOptions.yaxis.range[1],
    "bottom right",
    matsTypes.ReservedWords.perfectForecast,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(xPerfectLine);

  const yPerfectLine = matsDataCurveOpsUtils.getVerticalValueLine(
    resultOptions.yaxis.range[0],
    resultOptions.yaxis.range[1],
    resultOptions.xaxis.range[1],
    "top left",
    matsTypes.ReservedWords.perfectForecast,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(yPerfectLine);

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataPerformanceDiagram = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    let statType;
    if (returnCurveInfoParams.statType === undefined) {
      statType = "scalar";
    } else if (Array.isArray(returnCurveInfoParams.statType)) {
      statType = returnCurveInfoParams.statType[curveIndex];
    } else {
      statType = returnCurveInfoParams.statType;
    }
    const { label } = returnDataset[curveIndex];

    let di = 0;
    while (di < data.x.length) {
      let binValue = statType.includes("met-")
        ? data.threshold_all[di]
        : data.binVals[di];
      binValue =
        data.binParam.indexOf("Date") > -1
          ? moment.utc(binValue * 1000).format("YYYY-MM-DD HH:mm")
          : binValue;
      // store statistics for this di datapoint
      data.stats[di] = {
        bin_value: binValue,
        pody: data.y[di],
        fa: data.x[di],
        n: data.n[di],
        obs_y: data.oy_all[di],
        obs_n: data.on_all[di],
      };
      // the tooltip is stored in data.text
      data.text[di] = label;
      data.text[di] = `${data.text[di]}<br>bin value: ${binValue}`;
      data.text[di] = `${data.text[di]}<br>probability of detection: ${data.y[di]}`;
      data.text[di] = `${data.text[di]}<br>success ratio: ${data.x[di]}`;
      data.text[di] = `${data.text[di]}<br>n: ${data.n[di]}`;

      di += 1;
    }
    returnDataset[curveIndex].glob_stats = {};
  }

  // generate plot options
  const resultOptions =
    await matsDataPlotOpsUtils.generatePerformanceDiagramPlotOptions();

  // add black lines of constant bias
  let biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.125,
    0,
    1,
    0,
    " 8.0",
    "bottom right",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.25,
    0,
    1,
    0,
    " 4.0",
    "bottom right",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.5,
    0,
    1,
    0,
    " 2.0",
    "bottom right",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    1,
    0,
    "1.0  ",
    "bottom left",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.5,
    0,
    "0.5",
    "bottom left",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.25,
    0,
    "0.25",
    "top left",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.125,
    0,
    "0.125",
    "top left",
    matsTypes.ReservedWords.constantBias,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(biasLine);

  let xvals;
  let yvals;
  let textVals;
  let cval;
  let csiLine;
  for (let csiidx = 1; csiidx < 10; csiidx += 1) {
    cval = csiidx / 10;
    xvals = _.range(cval, 1.01, 0.01);
    yvals = [];
    textVals = [];
    let xval;
    let yval;
    for (let xidx = 0; xidx < xvals.length; xidx += 1) {
      xval = xvals[xidx];
      yval = (xval * cval) / (xval + xval * cval - cval);
      yvals.push(yval);
      textVals.push("");
    }
    textVals[Math.floor(xvals.length * 0.6)] = cval;
    csiLine = matsDataCurveOpsUtils.getCurveLine(
      xvals,
      yvals,
      textVals,
      cval.toFixed(1),
      "bottom left",
      matsTypes.ReservedWords.constantCSI,
      "rgb(0,0,0)",
      1
    );
    returnDataset.push(csiLine);
  }

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subHit = [];
    data.subFa = [];
    data.subMiss = [];
    data.subCn = [];
    data.subSquareDiffSum = [];
    data.subNSum = [];
    data.subObsModelDiffSum = [];
    data.subModelSum = [];
    data.subObsSum = [];
    data.subAbsSum = [];
    data.subInterest = [];
    data.subData = [];
    data.subHeaders = [];
    data.nForecast = [];
    data.nMatched = [];
    data.nSimple = [];
    data.nTotal = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataGridScaleProb = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    const { label } = returnDataset[curveIndex];

    let di = 0;
    while (di < data.x.length) {
      // store statistics for this di datapoint
      data.stats[di] = {
        bin_value: data.x[di],
        n_grid: data.y[di],
        n: data.subVals[di].length,
      };
      // the tooltip is stored in data.text
      data.text[di] = label;
      data.text[di] = `${data.text[di]}<br>probability bin: ${data.x[di]}`;
      data.text[di] = `${data.text[di]}<br>number of grid points: ${data.y[di]}`;
      data.text[di] = `${data.text[di]}<br>n: ${data.subVals[di].length}`;

      di += 1;
    }
    returnDataset[curveIndex].glob_stats = {};
  }

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateGridScaleProbPlotOptions(
    returnCurveInfoParams.axisMap
  );

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subHit = [];
    data.subFa = [];
    data.subMiss = [];
    data.subCn = [];
    data.subSquareDiffSum = [];
    data.subNSum = [];
    data.subObsModelDiffSum = [];
    data.subModelSum = [];
    data.subObsSum = [];
    data.subAbsSum = [];
    data.subInterest = [];
    data.subData = [];
    data.subHeaders = [];
    data.nForecast = [];
    data.nMatched = [];
    data.nSimple = [];
    data.nTotal = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataEnsembleHistogram = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey] !==
      undefined;
    const { diffFrom } = returnCurveInfoParams.curves[curveIndex];
    const data = returnDataset[curveIndex];
    const { label } = returnDataset[curveIndex];

    let di = 0;
    const values = [];
    const indVars = [];

    while (di < data.x.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      let errorResult;
      if (appParams.hasLevels) {
        errorResult = matsDataUtils.getErr(
          data.subVals[di],
          data.subSecs[di],
          data.subLevs[di],
          appParams
        );
      } else {
        errorResult = matsDataUtils.getErr(
          data.subVals[di],
          data.subSecs[di],
          [],
          appParams
        );
      }

      // store raw statistic from query before recalculating that statistic to account for data removed due to matching, QC, etc.
      if (diffFrom === null || diffFrom === undefined || !appParams.matching) {
        // assign recalculated statistic to data[di][1], which is the value to be plotted
        data.y[di] = errorResult.sum;
      } else if (
        returnDataset[diffFrom[0]].y[di] !== null &&
        returnDataset[diffFrom[1]].y[di] !== null
      ) {
        // make sure that the diff curve actually shows the difference. Otherwise outlier filtering etc. can make it slightly off.
        data.y[di] =
          returnDataset[diffFrom[0]].bin_stats[di].bin_n -
          returnDataset[diffFrom[1]].bin_stats[di].bin_n;
      } else {
        // keep the null for no data at this point
        data.y[di] = null;
      }
      values.push(data.y[di]);
      indVars.push(data.x[di]);

      // remove sub values and times to save space
      data.subVals[di] = [];
      data.subSecs[di] = [];
      data.subLevs[di] = [];

      // store statistics for this di datapoint
      data.bin_stats[di] = {
        bin: data.x[di],
        bin_n: data.y[di],
        bin_rf: data.y[di], // placeholder
      };

      // the tooltip is stored in data.text
      data.text[di] =
        `${label}<br>` +
        `bin: ${data.x[di] === null ? null : data.x[di]}<br>` +
        `number in bin for this curve: ${
          data.y[di] === null ? null : Math.round(data.y[di])
        }`;

      di += 1;
    }

    const valueTotal = values.reduce((a, b) => Math.abs(a) + Math.abs(b), 0);

    // calculate the relative frequency for all the bins.
    // for diff curves, there's no good way to produce a diff of only matching data, so just diff the two parent curves.
    let diffIndexVal = 0;
    for (let didx = 0; didx < data.y.length; didx += 1) {
      if (data.y[didx] !== null) {
        if (diffFrom === null || diffFrom === undefined) {
          data.bin_stats[didx].bin_rf /= valueTotal;
        } else {
          for (
            let diffIndex = diffIndexVal;
            diffIndex < data.x.length;
            diffIndex += 1
          ) {
            if (
              returnDataset[diffFrom[0]].x[didx] ===
              returnDataset[diffFrom[1]].x[diffIndex]
            ) {
              data.bin_stats[didx].bin_rf =
                returnDataset[diffFrom[0]].bin_stats[didx].bin_rf -
                returnDataset[diffFrom[1]].bin_stats[diffIndex].bin_rf;
              diffIndexVal = diffIndex;
              break;
            }
            data.bin_stats[didx].bin_rf = null;
          }
        }
      } else {
        data.bin_stats[didx].bin_rf = null;
      }
      if (returnCurveInfoParams.yAxisFormat === "Relative frequency") {
        // replace the bin number with the bin relative frequency for the plotted statistic
        data.y[didx] = data.bin_stats[didx].bin_rf;
        values[didx] = data.y[didx];
      }
      data.text[didx] =
        `${data.text[didx]}<br>` +
        `bin rel freq for this curve: ${
          data.bin_stats[didx].bin_rf === null
            ? null
            : data.bin_stats[didx].bin_rf.toPrecision(4)
        }`;
    }

    // get the overall stats for the text output - this uses the means not the stats.
    const stats = matsDataUtils.getErr(values, indVars, [], appParams);
    const filteredValues = values.filter((x) => x || x === 0);
    stats.miny = Math.min(...filteredValues);
    stats.maxy = Math.max(...filteredValues);
    returnDataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const minx = Math.min(...indVars);
    const maxx = Math.max(...indVars);
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymax < stats.maxy ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.maxy
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].ymin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .ymin > stats.miny ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? stats.miny
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].ymin;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmax =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmax < maxx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? maxx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmax;
    returnCurveInfoParams.axisMap[
      returnCurveInfoParams.curves[curveIndex].axisKey
    ].xmin =
      returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[curveIndex].axisKey]
        .xmin > minx ||
      !axisLimitReprocessed[returnCurveInfoParams.curves[curveIndex].axisKey]
        ? minx
        : returnCurveInfoParams.axisMap[
            returnCurveInfoParams.curves[curveIndex].axisKey
          ].xmin;
  } // end curves

  const resultOptions = await matsDataPlotOpsUtils.generateEnsembleHistogramPlotOptions(
    returnDataset,
    returnCurveInfoParams.curves,
    returnCurveInfoParams.axisMap
  );

  // add black 0 line curve
  // need to define the minimum and maximum x value for making the zero curve
  const zeroLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    0,
    "top left",
    matsTypes.ReservedWords.zero,
    "rgb(0,0,0)",
    1
  );
  returnDataset.push(zeroLine);

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataHistogram = async function (
  allReturnedSubStats,
  allReturnedSubSecs,
  allReturnedSubLevs,
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  binParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";
  let curvesLengthSoFar = 0;
  let xmax = -1 * Number.MAX_VALUE;
  let ymax = -1 * Number.MAX_VALUE;
  let xmin = Number.MAX_VALUE;
  let ymin = Number.MAX_VALUE;

  // flatten all the returned data into one stats array and one secs array in order to calculate histogram bins over the whole range.
  const curveSubStats =
    allReturnedSubStats.length > 0
      ? allReturnedSubStats.reduce(function (a, b) {
          return a.concat(b);
        })
      : [];
  const curveSubSecs = allReturnedSubSecs.reduce(function (a, b) {
    return a.concat(b);
  });

  let binStats;
  if (binParams.binBounds.length === 0) {
    binStats = matsDataUtils.calculateHistogramBins(
      curveSubStats,
      curveSubSecs,
      binParams,
      appParams
    ).binStats;
  } else {
    binStats = matsDataUtils.prescribeHistogramBins(
      curveSubStats,
      curveSubSecs,
      binParams,
      appParams
    ).binStats;
  }

  // store bin labels and x-axis positions of those labels for later when we set up the plot options
  const plotBins = {};
  plotBins.binMeans = [];
  plotBins.binLabels = [];
  for (let bidx = 0; bidx < binStats.binMeans.length; bidx += 1) {
    plotBins.binMeans.push(binStats.binMeans[bidx]);
    plotBins.binLabels.push(binStats.binLabels[bidx]);
  }

  // post process curves
  let sortedData;
  let curve;
  let diffFrom;
  let label;
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    curve = returnCurveInfoParams.curves[curveIndex];
    diffFrom = curve.diffFrom;
    label = curve.label;

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

    if (!diffFrom) {
      if (returnCurveInfoParams.dataFoundForCurve[curveIndex]) {
        // sort queried data into the full set of histogram bins
        sortedData = matsDataUtils.sortHistogramBins(
          allReturnedSubStats[curveIndex],
          allReturnedSubSecs[curveIndex],
          allReturnedSubLevs[curveIndex],
          binParams.binNum,
          binStats,
          appParams,
          d
        );
        d = sortedData.d;
      }
    } else {
      // this is a difference curve, so we're done with regular curves.
      // do any matching that needs to be done.
      if (appParams.matching && !returnBookkeepingParams.alreadyMatched) {
        const originalCurvesLength = returnCurveInfoParams.curvesLength;
        returnCurveInfoParams.curvesLength = curvesLengthSoFar;
        returnDataset = matsDataMatchUtils.getMatchedDataSet(
          returnDataset,
          returnCurveInfoParams,
          appParams,
          binStats
        );
        returnCurveInfoParams.curvesLength = originalCurvesLength;
        returnBookkeepingParams.alreadyMatched = true;
      }

      // then take diffs
      const diffResult = matsDataDiffUtils.getDataForDiffCurve(
        returnDataset,
        diffFrom,
        appParams,
        ["histogram", "histogram"]
      );

      // adjust axis stats based on new data from diff curve
      d = diffResult.dataset;
    }

    // set curve annotation to be the curve mean -- may be recalculated later
    // also pass previously calculated axis stats to curve options
    curve.annotation = "";
    curve.axisKey = returnCurveInfoParams.curves[curveIndex].axisKey;
    if (d.length > 0) {
      d.xmin = d.bin_stats[0].binUpBound;
      d.xmax = d.bin_stats[d.bin_stats.length - 1].binLowBound;
    }
    d.ymin =
      returnCurveInfoParams.yAxisFormat === "Relative frequency"
        ? (d.ymin / d.glob_stats.glob_n) * 100
        : d.ymin;
    d.ymax =
      returnCurveInfoParams.yAxisFormat === "Relative frequency"
        ? (d.ymax / d.glob_stats.glob_n) * 100
        : d.ymax;
    xmin = d.xmin < xmin ? d.xmin : xmin;
    xmax = d.xmax > xmax ? d.xmax : xmax;
    ymin = d.ymin < ymin ? d.ymin : ymin;
    ymax = d.ymax > ymax ? d.ymax : ymax;
    const cOptions = await matsDataCurveOpsUtils.generateBarChartCurveOptions(
      curve,
      curveIndex,
      returnCurveInfoParams.axisMap,
      d,
      appParams
    ); // generate plot with data, curve annotation, axis labels, etc.
    returnDataset.push(cOptions);
    curvesLengthSoFar += 1;
  } // end for curves

  // if matching, pare down returnDataset to only matching data. Only do this if we didn't already do it while calculating diffs.
  if (
    returnCurveInfoParams.curvesLength > 1 &&
    appParams.matching &&
    !returnBookkeepingParams.alreadyMatched
  ) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      binStats
    );
  }

  // calculate data statistics (including error bars) for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const statisticSelect = returnCurveInfoParams.curves[curveIndex].statistic;
    diffFrom = returnCurveInfoParams.curves[curveIndex].diffFrom;
    const data = returnDataset[curveIndex];
    label = returnDataset[curveIndex].label;

    let di = 0;
    while (di < data.x.length) {
      if (returnCurveInfoParams.yAxisFormat === "Relative frequency") {
        // replace the bin number with the bin relative frequency for the plotted statistic
        data.y[di] = data.bin_stats[di].bin_rf * 100;
      }

      // remove sub values and times to save space
      data.subVals[di] = [];
      data.subSecs[di] = [];
      data.subLevs[di] = [];

      // the tooltip is stored in data.text
      data.text[di] =
        `${label}<br>` +
        `bin: ${di} (${statisticSelect} values between ${
          data.bin_stats[di].binLowBound === null
            ? null
            : data.bin_stats[di].binLowBound.toPrecision(4)
        } and ${
          data.bin_stats[di].binUpBound === null
            ? null
            : data.bin_stats[di].binUpBound.toPrecision(4)
        })` +
        `<br>` +
        `number in bin for this curve: ${
          data.y[di] === null ? null : data.y[di]
        }<br>bin mean for this curve: ${statisticSelect} = ${
          data.bin_stats[di].bin_mean === null
            ? null
            : data.bin_stats[di].bin_mean.toPrecision(4)
        }<br>bin sd for this curve: ${statisticSelect} = ${
          data.bin_stats[di].bin_sd === null
            ? null
            : data.bin_stats[di].bin_sd.toPrecision(4)
        }`;

      di += 1;
    }
  } // end curves

  // generate plot options
  returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[0].axisKey].xmin = xmin;
  returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[0].axisKey].xmax = xmax;
  returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[0].axisKey].ymin = ymin;
  returnCurveInfoParams.axisMap[returnCurveInfoParams.curves[0].axisKey].ymax = ymax;

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subHit = [];
    data.subFa = [];
    data.subMiss = [];
    data.subCn = [];
    data.subSquareDiffSum = [];
    data.subNSum = [];
    data.subObsModelDiffSum = [];
    data.subModelSum = [];
    data.subObsSum = [];
    data.subAbsSum = [];
    data.subInterest = [];
    data.subData = [];
    data.subHeaders = [];
    data.nForecast = [];
    data.nMatched = [];
    data.nSimple = [];
    data.nTotal = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const resultOptions = await matsDataPlotOpsUtils.generateHistogramPlotOptions(
    returnCurveInfoParams.curves,
    returnCurveInfoParams.axisMap,
    returnCurveInfoParams.varUnits,
    plotBins
  );
  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataContour = async function (
  dataset,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";
  const { appName } = await matsCollections.Settings.findOneAsync({});
  const statisticSelect =
    appName.indexOf("anomalycor") !== -1
      ? "ACC"
      : returnCurveInfoParams.curve[0].statistic;
  const data = returnDataset[0];
  const { label } = returnDataset[0];

  // if we have dates on one axis, make sure they're formatted correctly
  if (data.xAxisKey.indexOf("Date") !== -1) {
    data.x = data.x.map(function (val) {
      return moment.utc(val * 1000).format("YYYY-MM-DD HH:mm");
    });
  } else if (data.yAxisKey.indexOf("Date") !== -1) {
    data.y = data.y.map(function (val) {
      return moment.utc(val * 1000).format("YYYY-MM-DD HH:mm");
    });
  }

  // if we have forecast leads on one axis, make sure they're formatted correctly
  if (data.xAxisKey.indexOf("Fcst lead time") !== -1) {
    data.x = data.x.map(function (val) {
      return Number(val.toString().replace(/0000/g, ""));
    });
  } else if (data.yAxisKey.indexOf("Fcst lead time") !== -1) {
    data.y = data.y.map(function (val) {
      return Number(val.toString().replace(/0000/g, ""));
    });
  }

  // build the tooltip, and store it in data.text
  let i;
  let j;
  let currText;
  let currYTextArray;
  for (j = 0; j < data.y.length; j += 1) {
    currYTextArray = [];
    for (i = 0; i < data.x.length; i += 1) {
      currText = `${label}<br>${data.xAxisKey}: ${data.x[i]}<br>${data.yAxisKey}: ${
        data.y[j]
      }<br>${statisticSelect}: ${
        data.z[j][i] === undefined || data.z[j][i] === null || data.z[j][i] === "null"
          ? null
          : Number(data.z[j][i]).toPrecision(4)
      }<br>n: ${data.n[j][i]}`;
      currYTextArray.push(currText);
    }
    data.text.push(currYTextArray);
  }

  // remove sub values and times to save space
  data.subHit = [];
  data.subFa = [];
  data.subMiss = [];
  data.subCn = [];
  data.subSquareDiffSum = [];
  data.subNSum = [];
  data.subObsModelDiffSum = [];
  data.subModelSum = [];
  data.subObsSum = [];
  data.subAbsSum = [];
  data.subData = [];
  data.subHeaders = [];
  data.nForecast = [];
  data.nMatched = [];
  data.nSimple = [];
  data.nTotal = [];
  data.subVals = [];
  data.subSecs = [];
  data.subLevs = [];

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateContourPlotOptions(
    returnDataset
  );

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

const processDataSimpleScatter = async function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  let returnDataset = dataset;
  const returnCurveInfoParams = curveInfoParams;
  const returnBookkeepingParams = bookkeepingParams;
  const error = "";

  const isMetexpress =
    (await matsCollections.Settings.findOneAsync({})).appType ===
    matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (returnCurveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    returnDataset = matsDataMatchUtils.getMatchedDataSet(
      returnDataset,
      returnCurveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    const data = returnDataset[curveIndex];
    const { label } = returnDataset[curveIndex];

    const statisticXSelect =
      returnCurveInfoParams.curves[curveIndex]["x-statistic"] === undefined
        ? returnCurveInfoParams.curves[curveIndex].statistic
        : returnCurveInfoParams.curves[curveIndex]["x-statistic"];
    const statisticYSelect = returnCurveInfoParams.curves[curveIndex]["y-statistic"];
    const variableXSelect =
      returnCurveInfoParams.curves[curveIndex]["x-variable"] === undefined
        ? returnCurveInfoParams.curves[curveIndex].variable
        : returnCurveInfoParams.curves[curveIndex]["x-variable"];
    const variableYSelect = returnCurveInfoParams.curves[curveIndex]["y-variable"];

    let di = 0;
    while (di < data.x.length) {
      let binValue = data.binVals[di];
      binValue =
        data.binParam.indexOf("Date") > -1
          ? moment.utc(binValue * 1000).format("YYYY-MM-DD HH:mm")
          : binValue;
      // store statistics for this di datapoint
      data.stats[di] = {
        bin_value: binValue,
        ystat: data.y[di],
        xstat: data.x[di],
        n: data.n[di],
      };
      // the tooltip is stored in data.text
      data.text[di] = label;
      data.text[di] = `${data.text[di]}<br>bin value: ${binValue}`;
      data.text[
        di
      ] = `${data.text[di]}<br>${variableXSelect} ${statisticXSelect}: ${data.x[di]}`;
      data.text[
        di
      ] = `${data.text[di]}<br>${variableYSelect} ${statisticYSelect}: ${data.y[di]}`;
      data.text[di] = `${data.text[di]}<br>n: ${data.n[di]}`;

      di += 1;
    }
    returnDataset[curveIndex].glob_stats = {};
  }

  for (
    let curveIndex = 0;
    curveIndex < returnCurveInfoParams.curvesLength;
    curveIndex += 1
  ) {
    // remove sub values and times to save space
    const data = returnDataset[curveIndex];
    data.subSquareDiffSumX = [];
    data.subNSumX = [];
    data.subObsModelDiffSumX = [];
    data.subModelSumX = [];
    data.subObsSumX = [];
    data.subAbsSumX = [];
    data.subValsX = [];
    data.subSecsX = [];
    data.subLevsX = [];
    data.subSquareDiffSumY = [];
    data.subNSumY = [];
    data.subObsModelDiffSumY = [];
    data.subModelSumY = [];
    data.subObsSumY = [];
    data.subAbsSumY = [];
    data.subValsY = [];
    data.subSecsY = [];
    data.subLevsY = [];
    data.subData = [];
    data.subHeaders = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  // generate plot options
  const resultOptions = await matsDataPlotOpsUtils.generateScatterPlotOptions(
    returnCurveInfoParams.axisXMap,
    returnCurveInfoParams.axisYMap
  );

  const totalProcessingFinish = moment();
  returnBookkeepingParams.dataRequests[
    "total retrieval and processing time for curve set"
  ] = {
    begin: returnBookkeepingParams.totalProcessingStart.format(),
    finish: totalProcessingFinish.format(),
    duration: `${moment
      .duration(
        totalProcessingFinish.diff(returnBookkeepingParams.totalProcessingStart)
      )
      .asSeconds()} seconds`,
  };

  // pass result to client-side plotting functions
  return {
    error,
    data: returnDataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: returnBookkeepingParams.dataRequests,
    },
  };
};

// eslint-disable-next-line no-undef
export default matsDataProcessUtils = {
  processDataXYCurve,
  processDataProfile,
  processDataReliability,
  processDataROC,
  processDataPerformanceDiagram,
  processDataGridScaleProb,
  processDataHistogram,
  processDataEnsembleHistogram,
  processDataContour,
  processDataSimpleScatter,
};
