/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsDataUtils,
  matsDataMatchUtils,
  matsDataDiffUtils,
  matsDataCurveOpsUtils,
  matsDataPlotOpsUtils,
} from "meteor/randyp:mats-common";
import { moment } from "meteor/momentjs:moment";

const processDataXYCurve = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  // variable to store maximum error bar length
  let errorMax = Number.MIN_VALUE;
  const error = "";

  const { appName } = matsCollections.Settings.findOne({});
  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (var curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] !== undefined;
    const { diffFrom } = curveInfoParams.curves[curveIndex];
    const statisticSelect =
      appName.indexOf("anomalycor") !== -1
        ? "ACC"
        : curveInfoParams.curves[curveIndex].statistic;
    var data = dataset[curveIndex];
    var statType;
    if (curveInfoParams.statType === undefined) {
      statType = "default"; // dummy stat type
    } else if (Array.isArray(curveInfoParams.statType)) {
      statType = curveInfoParams.statType[curveIndex];
    } else {
      statType = curveInfoParams.statType;
    }
    const { label } = dataset[curveIndex];

    let di = 0;
    const values = [];
    const indVars = [];

    while (di < data.x.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      // These don't make sense for aggregated MODE stats, so skip for them.
      var errorResult;
      if (!statType.includes("met-mode")) {
        if (appParams.hasLevels) {
          errorResult = matsDataUtils.get_err(
            data.subVals[di],
            data.subSecs[di],
            data.subLevs[di],
            appParams
          );
        } else {
          errorResult = matsDataUtils.get_err(
            data.subVals[di],
            data.subSecs[di],
            [],
            appParams
          );
        }
      }

      if (diffFrom !== null && diffFrom !== undefined) {
        if (
          dataset[diffFrom[0]].y[di] !== null &&
          dataset[diffFrom[1]].y[di] !== null
        ) {
          // make sure that the diff curve actually shows the difference when matching.
          // otherwise outlier filtering etc. can make it slightly off.
          data.y[di] = dataset[diffFrom[0]].y[di] - dataset[diffFrom[1]].y[di];
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
            Array.isArray(dataset[diffFrom[0]].subHit[di]) ||
            !isNaN(dataset[diffFrom[0]].subHit[di])
          ) ||
          !(
            Array.isArray(dataset[diffFrom[1]].subHit[di]) ||
            !isNaN(dataset[diffFrom[1]].subHit[di])
          )
        ) {
          data.error_y.array[di] = null;
        } else {
          const minuendData = {
            hit: dataset[diffFrom[0]].subHit[di],
            fa: dataset[diffFrom[0]].subFa[di],
            miss: dataset[diffFrom[0]].subMiss[di],
            cn: dataset[diffFrom[0]].subCn[di],
          };
          const subtrahendData = {
            hit: dataset[diffFrom[1]].subHit[di],
            fa: dataset[diffFrom[1]].subFa[di],
            miss: dataset[diffFrom[1]].subMiss[di],
            cn: dataset[diffFrom[1]].subCn[di],
          };
          errorLength = matsDataUtils.ctcErrorPython(
            statisticSelect,
            minuendData,
            subtrahendData
          );
          errorMax = errorMax > errorLength ? errorMax : errorLength;
          data.error_y.array[di] = errorLength;
        }
      } else {
        const errorBar = errorResult.stde_betsy * 1.96;
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
          var fhr =
            ((data.x[di] / 1000) % (24 * 3600)) / 3600 -
            curveInfoParams.utcCycleStarts[curveIndex];
          fhr = fhr < 0 ? fhr + 24 : fhr;
          data.text[di] = `${data.text[di]}<br>time: ${moment
            .utc(data.x[di])
            .format("YYYY-MM-DD HH:mm")}`;
          data.text[di] = `${data.text[di]}<br>forecast hour: ${fhr}`;
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
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? data.subHit[di].length
              : 0,
          hit:
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null,
          fa:
            Array.isArray(data.subFa[di]) || !isNaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null,
          miss:
            Array.isArray(data.subMiss[di]) || !isNaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null,
          cn:
            Array.isArray(data.subCn[di]) || !isNaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
            ? data.subHit[di].length
            : 0
        }<br>Hits: ${
          Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
            ? matsDataUtils.sum(data.subHit[di])
            : null
        }<br>False alarms: ${
          Array.isArray(data.subFa[di]) || !isNaN(data.subFa[di])
            ? matsDataUtils.sum(data.subFa[di])
            : null
        }<br>Misses: ${
          Array.isArray(data.subMiss[di]) || !isNaN(data.subMiss[di])
            ? matsDataUtils.sum(data.subMiss[di])
            : null
        }<br>Correct Nulls: ${
          Array.isArray(data.subCn[di]) || !isNaN(data.subCn[di])
            ? matsDataUtils.sum(data.subCn[di])
            : null
        }<br>Errorbars: ${Number(data.y[di] - errorLength).toPrecision(4)} to ${Number(
          data.y[di] + errorLength
        ).toPrecision(4)}`;
      } else if (statType === "met-mode_pair") {
        data.stats[di] = {
          stat: data.y[di],
          n:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          raw_stat: data.y[di],
          n_good:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          avgInterest:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
            ? data.subInterest[di].length
            : 0
        }<br>Average Interest: ${
          Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
            ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
            : null
        }`;
      } else if (statType === "met-mode_single") {
        data.stats[di] = {
          stat: data.y[di],
          n_forecast: data.n_forecast[di],
          n_matched: data.n_matched[di],
          n_simple: data.n_simple[di],
          n_total: data.n_total[di],
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>Forecast objects: ${
          data.n_forecast[di] === null ? null : data.n_forecast[di].toString()
        }<br>Matched objects: ${
          data.n_matched[di] === null ? null : data.n_matched[di].toString()
        }<br>Simple objects: ${
          data.n_simple[di] === null ? null : data.n_simple[di].toString()
        }<br>Total objects: ${
          data.n_total[di] === null ? null : data.n_total[di].toString()
        }`;
      } else {
        data.stats[di] = {
          stat: data.y[di],
          n: errorResult.n_good,
          mean:
            statisticSelect === "N" ||
            statisticSelect ===
              "N times*levels(*stations if station plot) per graph point"
              ? errorResult.sum
              : errorResult.d_mean,
          sd: errorResult.sd,
          n_good: errorResult.n_good,
          lag1: errorResult.lag1,
          stde_betsy: errorResult.stde_betsy,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.y[di] === null ? null : data.y[di].toPrecision(4)
        }<br>sd: ${
          errorResult.sd === null ? null : errorResult.sd.toPrecision(4)
        }<br>mean: ${
          errorResult.d_mean === null ? null : errorResult.d_mean.toPrecision(4)
        }<br>n: ${errorResult.n_good}<br>stde: ${
          errorResult.stde_betsy
        }<br>errorbars: ${Number(
          data.y[di] - errorResult.stde_betsy * 1.96
        ).toPrecision(4)} to ${Number(
          data.y[di] + errorResult.stde_betsy * 1.96
        ).toPrecision(4)}`;
      }

      di++;
    }

    // enable error bars if matching and they aren't null.
    if (appParams.matching && data.error_y.array.filter((x) => x).length > 0) {
      if (statType !== "ctc" || (diffFrom !== undefined && diffFrom !== null)) {
        data.error_y.visible = true;
      }
    }

    // get the overall stats for the text output.
    const stats = matsDataUtils.get_err(values, indVars, [], appParams);
    const filteredValues = values.filter((x) => x);
    let miny = Math.min(...filteredValues);
    let maxy = Math.max(...filteredValues);
    if (values.indexOf(0) !== -1 && miny > 0) {
      miny = 0;
    }
    if (values.indexOf(0) !== -1 && maxy < 0) {
      maxy = 0;
    }
    stats.miny = miny;
    stats.maxy = maxy;
    dataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const filteredIndVars = [];
    for (let vidx = 0; vidx < values.length; vidx++) {
      if (values[vidx] !== null) filteredIndVars.push(indVars[vidx]);
    }
    const minx = Math.min(...filteredIndVars);
    const maxx = Math.max(...filteredIndVars);
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax < maxy ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxy
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin > miny ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? miny
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax < maxx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin > minx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? minx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin;

    // recalculate curve annotation after QC and matching
    const newMean = matsDataUtils.average(filteredValues);
    const newMedian = matsDataUtils.median(filteredValues);
    const newStdev = matsDataUtils.stdev(filteredValues);
    if (newMean !== undefined && newMean !== null) {
      dataset[curveIndex].annotation = `${label} mean = ${newMean.toPrecision(4)}`;
      dataset[curveIndex].annotation = `${
        dataset[curveIndex].annotation
      }, median = ${newMedian.toPrecision(4)}`;
      dataset[curveIndex].annotation = `${
        dataset[curveIndex].annotation
      }, stdev = ${newStdev.toPrecision(4)}`;
    } else {
      dataset[
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

  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    // remove sub values and times to save space
    data = dataset[curveIndex];
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
    data.n_forecast = [];
    data.n_matched = [];
    data.n_simple = [];
    data.n_total = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  // generate plot options
  let resultOptions;
  switch (appParams.plotType) {
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dailyModelCycle:
      resultOptions = matsDataPlotOpsUtils.generateSeriesPlotOptions(
        curveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.dieoff:
      resultOptions = matsDataPlotOpsUtils.generateDieoffPlotOptions(
        curveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.threshold:
      resultOptions = matsDataPlotOpsUtils.generateThresholdPlotOptions(
        dataset,
        curveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.validtime:
      resultOptions = matsDataPlotOpsUtils.generateValidTimePlotOptions(
        curveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.gridscale:
      resultOptions = matsDataPlotOpsUtils.generateGridScalePlotOptions(
        curveInfoParams.axisMap,
        errorMax
      );
      break;
    case matsTypes.PlotTypes.yearToYear:
      resultOptions = matsDataPlotOpsUtils.generateYearToYearPlotOptions(
        curveInfoParams.axisMap,
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
    matsTypes.ReservedWords.zero
  );
  dataset.push(zeroLine);

  // add ideal value lines, if any
  let idealValueLine;
  let idealLabel;
  for (let ivIdx = 0; ivIdx < curveInfoParams.idealValues.length; ivIdx++) {
    idealLabel = `ideal${ivIdx.toString()}`;
    idealValueLine = matsDataCurveOpsUtils.getHorizontalValueLine(
      resultOptions.xaxis.range[1],
      resultOptions.xaxis.range[0],
      curveInfoParams.idealValues[ivIdx],
      "bottom left",
      matsTypes.ReservedWords[idealLabel]
    );
    dataset.push(idealValueLine);
  }

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataProfile = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  // variable to store maximum error bar length
  let errorMax = Number.MIN_VALUE;
  const error = "";

  const { appName } = matsCollections.Settings.findOne({});
  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (var curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] !== undefined;
    const { diffFrom } = curveInfoParams.curves[curveIndex];
    const statisticSelect =
      appName.indexOf("anomalycor") !== -1
        ? "ACC"
        : curveInfoParams.curves[curveIndex].statistic;
    var data = dataset[curveIndex];
    var statType;
    if (curveInfoParams.statType === undefined) {
      statType = "default"; // dummy stat type
    } else if (Array.isArray(curveInfoParams.statType)) {
      statType = curveInfoParams.statType[curveIndex];
    } else {
      statType = curveInfoParams.statType;
    }
    const { label } = dataset[curveIndex];

    let di = 0;
    const values = [];
    const levels = [];

    while (di < data.y.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      // These don't make sense for aggregated MODE stats, so skip for them.
      if (!statType.includes("met-mode")) {
        var errorResult = matsDataUtils.get_err(
          data.subVals[di],
          data.subSecs[di],
          data.subLevs[di],
          appParams
        );
      }

      if (diffFrom !== null && diffFrom !== undefined) {
        if (
          dataset[diffFrom[0]].x[di] !== null &&
          dataset[diffFrom[1]].x[di] !== null
        ) {
          // make sure that the diff curve actually shows the difference when matching.
          // otherwise outlier filtering etc. can make it slightly off.
          data.x[di] = dataset[diffFrom[0]].x[di] - dataset[diffFrom[1]].x[di];
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
            Array.isArray(dataset[diffFrom[0]].subHit[di]) ||
            !isNaN(dataset[diffFrom[0]].subHit[di])
          ) ||
          !(
            Array.isArray(dataset[diffFrom[1]].subHit[di]) ||
            !isNaN(dataset[diffFrom[1]].subHit[di])
          )
        ) {
          data.error_x.array[di] = null;
        } else {
          const minuendData = {
            hit: dataset[diffFrom[0]].subHit[di],
            fa: dataset[diffFrom[0]].subFa[di],
            miss: dataset[diffFrom[0]].subMiss[di],
            cn: dataset[diffFrom[0]].subCn[di],
          };
          const subtrahendData = {
            hit: dataset[diffFrom[1]].subHit[di],
            fa: dataset[diffFrom[1]].subFa[di],
            miss: dataset[diffFrom[1]].subMiss[di],
            cn: dataset[diffFrom[1]].subCn[di],
          };
          errorLength = matsDataUtils.ctcErrorPython(
            statisticSelect,
            minuendData,
            subtrahendData
          );
          errorMax = errorMax > errorLength ? errorMax : errorLength;
          data.error_x.array[di] = errorLength;
        }
      } else {
        const errorBar = errorResult.stde_betsy * 1.96;
        errorMax = errorMax > errorBar ? errorMax : errorBar;
        data.error_x.array[di] = errorBar;
      }

      // store statistics for this di datapoint
      if (statType === "ctc") {
        data.stats[di] = {
          stat: data.x[di],
          n:
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? data.subHit[di].length
              : 0,
          hit:
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null,
          fa:
            Array.isArray(data.subFa[di]) || !isNaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null,
          miss:
            Array.isArray(data.subMiss[di]) || !isNaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null,
          cn:
            Array.isArray(data.subCn[di]) || !isNaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null,
        };
        data.text[di] =
          `${label}<br>${data.y[di]}mb` +
          `<br>${statisticSelect}: ${
            data.x[di] === null ? null : data.x[di].toPrecision(4)
          }<br>n: ${
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? data.subHit[di].length
              : 0
          }<br>Hits: ${
            Array.isArray(data.subHit[di]) || !isNaN(data.subHit[di])
              ? matsDataUtils.sum(data.subHit[di])
              : null
          }<br>False alarms: ${
            Array.isArray(data.subFa[di]) || !isNaN(data.subFa[di])
              ? matsDataUtils.sum(data.subFa[di])
              : null
          }<br>Misses: ${
            Array.isArray(data.subMiss[di]) || !isNaN(data.subMiss[di])
              ? matsDataUtils.sum(data.subMiss[di])
              : null
          }<br>Correct Nulls: ${
            Array.isArray(data.subCn[di]) || !isNaN(data.subCn[di])
              ? matsDataUtils.sum(data.subCn[di])
              : null
          }<br>Errorbars: ${Number(data.x[di] - errorLength).toPrecision(
            4
          )} to ${Number(data.x[di] + errorLength).toPrecision(4)}`;
      } else if (statType === "met-mode_pair") {
        data.stats[di] = {
          stat: data.x[di],
          n:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          raw_stat: data.x[di],
          n_good:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? data.subInterest[di].length
              : 0,
          avgInterest:
            Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
              ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
              : null,
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.x[di] === null ? null : data.x[di].toPrecision(4)
        }<br>n: ${
          Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
            ? data.subInterest[di].length
            : 0
        }<br>Average Interest: ${
          Array.isArray(data.subInterest[di]) || !isNaN(data.subInterest[di])
            ? matsDataUtils.average(data.subInterest[di]).toPrecision(4)
            : null
        }`;
      } else if (statType === "met-mode_single") {
        data.stats[di] = {
          stat: data.x[di],
          n_forecast: data.n_forecast[di],
          n_matched: data.n_matched[di],
          n_simple: data.n_simple[di],
          n_total: data.n_total[di],
        };
        data.text[di] = `${data.text[di]}<br>${statisticSelect}: ${
          data.x[di] === null ? null : data.x[di].toPrecision(4)
        }<br>Forecast objects: ${
          data.n_forecast[di] === null ? null : data.n_forecast[di].toString()
        }<br>Matched objects: ${
          data.n_matched[di] === null ? null : data.n_matched[di].toString()
        }<br>Simple objects: ${
          data.n_simple[di] === null ? null : data.n_simple[di].toString()
        }<br>Total objects: ${
          data.n_total[di] === null ? null : data.n_total[di].toString()
        }`;
      } else {
        data.stats[di] = {
          stat: data.x[di],
          n: errorResult.n_good,
          mean:
            statisticSelect === "N" ||
            statisticSelect ===
              "N times*levels(*stations if station plot) per graph point"
              ? errorResult.sum
              : errorResult.d_mean,
          sd: errorResult.sd,
          n_good: errorResult.n_good,
          lag1: errorResult.lag1,
          stde_betsy: errorResult.stde_betsy,
        };
        data.text[di] =
          `${label}<br>${data.y[di]}mb` +
          `<br>${statisticSelect}: ${
            data.x[di] === null ? null : data.x[di].toPrecision(4)
          }<br>sd: ${
            errorResult.sd === null ? null : errorResult.sd.toPrecision(4)
          }<br>mean: ${
            errorResult.d_mean === null ? null : errorResult.d_mean.toPrecision(4)
          }<br>n: ${errorResult.n_good}<br>stde: ${
            errorResult.stde_betsy
          }<br>errorbars: ${Number(
            data.x[di] - errorResult.stde_betsy * 1.96
          ).toPrecision(4)} to ${Number(
            data.x[di] + errorResult.stde_betsy * 1.96
          ).toPrecision(4)}`;
      }

      di++;
    }

    // enable error bars if matching and they aren't null.
    if (appParams.matching && data.error_x.array.filter((x) => x).length > 0) {
      if (statType !== "ctc" || (diffFrom !== undefined && diffFrom !== null)) {
        data.error_x.visible = true;
      }
    }

    // get the overall stats for the text output.
    const stats = matsDataUtils.get_err(
      values.reverse(),
      levels.reverse(),
      [],
      appParams
    ); // have to reverse because of data inversion
    const filteredValues = values.filter((x) => x);
    let minx = Math.min(...filteredValues);
    let maxx = Math.max(...filteredValues);
    if (values.indexOf(0) !== -1 && minx > 0) {
      minx = 0;
    }
    if (values.indexOf(0) !== -1 && maxx < 0) {
      maxx = 0;
    }
    stats.minx = minx;
    stats.maxx = maxx;
    dataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const filteredLevels = [];
    for (let vidx = 0; vidx < values.length; vidx++) {
      if (values[vidx] !== null) filteredLevels.push(levels[vidx]);
    }
    const miny = Math.min(...filteredLevels);
    const maxy = Math.max(...filteredLevels);
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax < maxy ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxy
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin > miny ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? miny
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax < maxx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin > minx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? minx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin;

    // recalculate curve annotation after QC and matching
    const newMean = matsDataUtils.average(filteredValues);
    const newMedian = matsDataUtils.median(filteredValues);
    const newStdev = matsDataUtils.stdev(filteredValues);
    if (newMean !== undefined && newMean !== null) {
      dataset[curveIndex].annotation = `${label} mean = ${newMean.toPrecision(4)}`;
      dataset[curveIndex].annotation = `${
        dataset[curveIndex].annotation
      }, median = ${newMedian.toPrecision(4)}`;
      dataset[curveIndex].annotation = `${
        dataset[curveIndex].annotation
      }, stdev = ${newStdev.toPrecision(4)}`;
    } else {
      dataset[
        curveIndex
      ].annotation = `${label} mean = NoData, median = NoData, stdev = NoData`;
    }
  }

  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    // remove sub values and times to save space
    data = dataset[curveIndex];
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
    data.n_forecast = [];
    data.n_matched = [];
    data.n_simple = [];
    data.n_total = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  // generate plot options
  const resultOptions = matsDataPlotOpsUtils.generateProfilePlotOptions(
    curveInfoParams.axisMap,
    errorMax
  );

  // add black 0 line curve
  // need to define the minimum and maximum y value for making the zero curve
  const zeroLine = matsDataCurveOpsUtils.getVerticalValueLine(
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    0,
    "bottom right",
    matsTypes.ReservedWords.zero
  );
  dataset.push(zeroLine);

  // add ideal value lines, if any
  let idealValueLine;
  let idealLabel;
  for (let ivIdx = 0; ivIdx < curveInfoParams.idealValues.length; ivIdx++) {
    idealLabel = `ideal${ivIdx.toString()}`;
    idealValueLine = matsDataCurveOpsUtils.getVerticalValueLine(
      resultOptions.yaxis.range[1],
      resultOptions.yaxis.range[0],
      curveInfoParams.idealValues[ivIdx],
      "bottom left",
      matsTypes.ReservedWords[idealLabel]
    );
    dataset.push(idealValueLine);
  }

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataReliability = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";

  // sort data statistics for each curve
  for (let curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    var data = dataset[curveIndex];
    const { label } = dataset[curveIndex];
    var { sample_climo } = data;

    let di = 0;
    while (di < data.x.length) {
      // store statistics for this di datapoint
      data.stats[di] = {
        prob_bin: data.x[di],
        hit_rate: data.y[di],
        obs_y: data.oy_all[di],
        obs_n: data.on_all[di],
      };
      // the tooltip is stored in data.text
      data.text[di] = label;
      data.text[di] = `${data.text[di]}<br>probability bin: ${data.x[di]}`;
      data.text[di] = `${data.text[di]}<br>hit rate: ${data.y[di]}`;
      data.text[di] = `${data.text[di]}<br>oy: ${data.oy_all[di]}`;
      data.text[di] = `${data.text[di]}<br>on: ${data.on_all[di]}`;

      di++;
    }
    dataset[curveIndex].glob_stats = {
      sample_climo,
    };
  }

  // generate plot options
  const resultOptions = matsDataPlotOpsUtils.generateReliabilityPlotOptions();

  // add black perfect reliability line curve
  const perfectLine = matsDataCurveOpsUtils.getLinearValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    matsTypes.ReservedWords.perfectReliability,
    "top left",
    matsTypes.ReservedWords.perfectReliability
  );
  dataset.push(perfectLine);

  if (sample_climo >= data.ymin) {
    var skillmin = sample_climo - (sample_climo - data.xmin) / 2;
  } else {
    var skillmin = data.xmin - (data.xmin - sample_climo) / 2;
  }
  if (sample_climo >= data.ymax) {
    var skillmax = sample_climo - (sample_climo - data.xmax) / 2;
  } else {
    var skillmax = data.xmax - (data.xmax - sample_climo) / 2;
  }

  // add black no skill line curve
  const noSkillLine = matsDataCurveOpsUtils.getLinearValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    skillmax,
    skillmin,
    matsTypes.ReservedWords.noSkill,
    "bottom right",
    matsTypes.ReservedWords.noSkill
  );
  dataset.push(noSkillLine);

  // add sample climo lines
  const xClimoLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    sample_climo,
    "top left",
    matsTypes.ReservedWords.zero
  );
  dataset.push(xClimoLine);

  const yClimoLine = matsDataCurveOpsUtils.getVerticalValueLine(
    resultOptions.yaxis.range[1],
    resultOptions.yaxis.range[0],
    sample_climo,
    "bottom right",
    matsTypes.ReservedWords.zero
  );
  dataset.push(yClimoLine);

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataROC = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";

  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (let curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    var data = dataset[curveIndex];
    var statType;
    if (curveInfoParams.statType === undefined) {
      statType = "scalar";
    } else if (Array.isArray(curveInfoParams.statType)) {
      statType = curveInfoParams.statType[curveIndex];
    } else {
      statType = curveInfoParams.statType;
    }
    const { label } = dataset[curveIndex];
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

      di++;
    }
    dataset[curveIndex].glob_stats = {
      auc,
    };
  }

  // generate plot options
  const resultOptions = matsDataPlotOpsUtils.generateROCPlotOptions();

  // add black no skill line curve
  const noSkillLine = matsDataCurveOpsUtils.getLinearValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    resultOptions.yaxis.range[1],
    data.ymin,
    matsTypes.ReservedWords.noSkill,
    "top left",
    matsTypes.ReservedWords.noSkill
  );
  dataset.push(noSkillLine);

  // add perfect forecast lines
  const xPerfectLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[0],
    resultOptions.xaxis.range[1],
    resultOptions.yaxis.range[1],
    "bottom right",
    matsTypes.ReservedWords.perfectForecast
  );
  dataset.push(xPerfectLine);

  const yPerfectLine = matsDataCurveOpsUtils.getVerticalValueLine(
    resultOptions.yaxis.range[0],
    resultOptions.yaxis.range[1],
    resultOptions.xaxis.range[1],
    "top left",
    matsTypes.ReservedWords.perfectForecast
  );
  dataset.push(yPerfectLine);

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataPerformanceDiagram = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";

  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (var curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    var data = dataset[curveIndex];
    var statType;
    if (curveInfoParams.statType === undefined) {
      statType = "scalar";
    } else if (Array.isArray(curveInfoParams.statType)) {
      statType = curveInfoParams.statType[curveIndex];
    } else {
      statType = curveInfoParams.statType;
    }
    const { label } = dataset[curveIndex];

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

      di++;
    }
    dataset[curveIndex].glob_stats = {};
  }

  // generate plot options
  const resultOptions = matsDataPlotOpsUtils.generatePerformanceDiagramPlotOptions();

  // add black lines of constant bias
  let biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.125,
    0,
    1,
    0,
    " 0.125",
    "bottom right",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.25,
    0,
    1,
    0,
    " 0.25",
    "bottom right",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    0.5,
    0,
    1,
    0,
    " 0.5",
    "bottom right",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    1,
    0,
    "1.0  ",
    "bottom left",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.5,
    0,
    "2.0",
    "bottom left",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.25,
    0,
    "4.0",
    "top left",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);
  biasLine = matsDataCurveOpsUtils.getDashedLinearValueLine(
    1,
    0,
    0.125,
    0,
    "8.0",
    "top left",
    matsTypes.ReservedWords.constantBias
  );
  dataset.push(biasLine);

  let xvals;
  let yvals;
  let textVals;
  let cval;
  let csiLine;
  for (let csiidx = 1; csiidx < 10; csiidx++) {
    cval = csiidx / 10;
    xvals = _.range(cval, 1.01, 0.01);
    yvals = [];
    textVals = [];
    var xval;
    var yval;
    for (let xidx = 0; xidx < xvals.length; xidx++) {
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
      matsTypes.ReservedWords.constantCSI
    );
    dataset.push(csiLine);
  }

  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    // remove sub values and times to save space
    data = dataset[curveIndex];
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
    data.n_forecast = [];
    data.n_matched = [];
    data.n_simple = [];
    data.n_total = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataEnsembleHistogram = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";
  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // we may need to recalculate the axis limits after unmatched data and outliers are removed
  const axisLimitReprocessed = {};

  // calculate data statistics (including error bars) for each curve
  for (let curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] =
      axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey] !== undefined;
    const { diffFrom } = curveInfoParams.curves[curveIndex];
    const data = dataset[curveIndex];
    const { label } = dataset[curveIndex];

    let di = 0;
    const values = [];
    const indVars = [];
    var rawStat;

    while (di < data.x.length) {
      // errorResult holds all the calculated curve stats like mean, sd, etc.
      var errorResult;
      if (appParams.hasLevels) {
        errorResult = matsDataUtils.get_err(
          data.subVals[di],
          data.subSecs[di],
          data.subLevs[di],
          appParams
        );
      } else {
        errorResult = matsDataUtils.get_err(
          data.subVals[di],
          data.subSecs[di],
          [],
          appParams
        );
      }

      // store raw statistic from query before recalculating that statistic to account for data removed due to matching, QC, etc.
      rawStat = data.y[di];
      if (diffFrom === null || diffFrom === undefined || !appParams.matching) {
        // assign recalculated statistic to data[di][1], which is the value to be plotted
        data.y[di] = errorResult.sum;
      } else if (
        dataset[diffFrom[0]].y[di] !== null &&
        dataset[diffFrom[1]].y[di] !== null
      ) {
        // make sure that the diff curve actually shows the difference. Otherwise outlier filtering etc. can make it slightly off.
        data.y[di] =
          dataset[diffFrom[0]].bin_stats[di].bin_n -
          dataset[diffFrom[1]].bin_stats[di].bin_n;
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

      di++;
    }

    const valueTotal = values.reduce((a, b) => Math.abs(a) + Math.abs(b), 0);

    // calculate the relative frequency for all the bins.
    // for diff curves, there's no good way to produce a diff of only matching data, so just diff the two parent curves.
    let diffIndexVal = 0;
    for (let d_idx = 0; d_idx < data.y.length; d_idx++) {
      if (data.y[d_idx] !== null) {
        if (diffFrom === null || diffFrom === undefined) {
          data.bin_stats[d_idx].bin_rf = data.bin_stats[d_idx].bin_rf / valueTotal;
        } else {
          for (let diffIndex = diffIndexVal; diffIndex < data.x.length; diffIndex++) {
            if (dataset[diffFrom[0]].x[d_idx] === dataset[diffFrom[1]].x[diffIndex]) {
              data.bin_stats[d_idx].bin_rf =
                dataset[diffFrom[0]].bin_stats[d_idx].bin_rf -
                dataset[diffFrom[1]].bin_stats[diffIndex].bin_rf;
              diffIndexVal = diffIndex;
              break;
            }
            data.bin_stats[d_idx].bin_rf = null;
          }
        }
      } else {
        data.bin_stats[d_idx].bin_rf = null;
      }
      if (curveInfoParams.yAxisFormat === "Relative frequency") {
        // replace the bin number with the bin relative frequency for the plotted statistic
        data.y[d_idx] = data.bin_stats[d_idx].bin_rf;
        values[d_idx] = data.y[d_idx];
      }
      data.text[d_idx] =
        `${data.text[d_idx]}<br>` +
        `bin rel freq for this curve: ${
          data.bin_stats[d_idx].bin_rf === null
            ? null
            : data.bin_stats[d_idx].bin_rf.toPrecision(4)
        }`;
    }

    // get the overall stats for the text output - this uses the means not the stats.
    const stats = matsDataUtils.get_err(values, indVars, [], appParams);
    const filteredValues = values.filter((x) => x);
    let miny = Math.min(...filteredValues);
    let maxy = Math.max(...filteredValues);
    if (values.indexOf(0) !== -1 && miny > 0) {
      miny = 0;
    }
    if (values.indexOf(0) !== -1 && maxy < 0) {
      maxy = 0;
    }
    stats.miny = miny;
    stats.maxy = maxy;
    dataset[curveIndex].glob_stats = stats;

    // recalculate axis options after QC and matching
    const minx = Math.min(...indVars);
    const maxx = Math.max(...indVars);
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax < maxy ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxy
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin > miny ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? miny
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].ymin;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax < maxx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? maxx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmax;
    curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin =
      curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin > minx ||
      !axisLimitReprocessed[curveInfoParams.curves[curveIndex].axisKey]
        ? minx
        : curveInfoParams.axisMap[curveInfoParams.curves[curveIndex].axisKey].xmin;
  } // end curves

  const resultOptions = matsDataPlotOpsUtils.generateEnsembleHistogramPlotOptions(
    dataset,
    curveInfoParams.curves,
    curveInfoParams.axisMap
  );

  // add black 0 line curve
  // need to define the minimum and maximum x value for making the zero curve
  const zeroLine = matsDataCurveOpsUtils.getHorizontalValueLine(
    resultOptions.xaxis.range[1],
    resultOptions.xaxis.range[0],
    0,
    "top left",
    matsTypes.ReservedWords.zero
  );
  dataset.push(zeroLine);

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataHistogram = function (
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
  const error = "";
  let curvesLengthSoFar = 0;
  let xmax = -1 * Number.MAX_VALUE;
  let ymax = -1 * Number.MAX_VALUE;
  let xmin = Number.MAX_VALUE;
  let ymin = Number.MAX_VALUE;

  // flatten all the returned data into one stats array and one secs array in order to calculate histogram bins over the whole range.
  const curveSubStats = [].concat.apply([], allReturnedSubStats);
  const curveSubSecs = [].concat.apply([], allReturnedSubSecs);

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
  for (let b_idx = 0; b_idx < binStats.binMeans.length; b_idx++) {
    plotBins.binMeans.push(binStats.binMeans[b_idx]);
    plotBins.binLabels.push(binStats.binLabels[b_idx]);
  }

  // post process curves
  let sortedData;
  let curve;
  let diffFrom;
  let label;
  for (var curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    curve = curveInfoParams.curves[curveIndex];
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
      n_forecast: [],
      n_matched: [],
      n_simple: [],
      n_total: [],
      glob_stats: {},
      bin_stats: [],
      xmin: Number.MAX_VALUE,
      xmax: Number.MIN_VALUE,
      ymin: Number.MAX_VALUE,
      ymax: Number.MIN_VALUE,
      sum: 0,
    };

    if (!diffFrom) {
      if (curveInfoParams.dataFoundForCurve[curveIndex]) {
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
      if (appParams.matching && !bookkeepingParams.alreadyMatched) {
        const originalCurvesLength = curveInfoParams.curvesLength;
        curveInfoParams.curvesLength = curvesLengthSoFar;
        dataset = matsDataMatchUtils.getMatchedDataSet(
          dataset,
          curveInfoParams,
          appParams,
          binStats
        );
        curveInfoParams.curvesLength = originalCurvesLength;
        bookkeepingParams.alreadyMatched = true;
      }

      // then take diffs. isCTC and isScalar are always false, as histograms show distribution of sub-values and not overall stat
      const diffResult = matsDataDiffUtils.getDataForDiffCurve(
        dataset,
        diffFrom,
        appParams,
        false,
        false
      );

      // adjust axis stats based on new data from diff curve
      d = diffResult.dataset;
    }

    // set curve annotation to be the curve mean -- may be recalculated later
    // also pass previously calculated axis stats to curve options
    curve.annotation = "";
    curve.axisKey = curveInfoParams.curves[curveIndex].axisKey;
    if (d.length > 0) {
      d.xmin = d.bin_stats[0].binUpBound;
      d.xmax = d.bin_stats[d.bin_stats.length - 1].binLowBound;
    }
    d.ymin =
      curveInfoParams.yAxisFormat === "Relative frequency"
        ? (d.ymin / d.glob_stats.glob_n) * 100
        : d.ymin;
    d.ymax =
      curveInfoParams.yAxisFormat === "Relative frequency"
        ? (d.ymax / d.glob_stats.glob_n) * 100
        : d.ymax;
    xmin = d.xmin < xmin ? d.xmin : xmin;
    xmax = d.xmax > xmax ? d.xmax : xmax;
    ymin = d.ymin < ymin ? d.ymin : ymin;
    ymax = d.ymax > ymax ? d.ymax : ymax;
    const cOptions = matsDataCurveOpsUtils.generateBarChartCurveOptions(
      curve,
      curveIndex,
      curveInfoParams.axisMap,
      d,
      appParams
    ); // generate plot with data, curve annotation, axis labels, etc.
    dataset.push(cOptions);
    curvesLengthSoFar++;
  } // end for curves

  // if matching, pare down dataset to only matching data. Only do this if we didn't already do it while calculating diffs.
  if (
    curveInfoParams.curvesLength > 1 &&
    appParams.matching &&
    !bookkeepingParams.alreadyMatched
  ) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      binStats
    );
  }

  // calculate data statistics (including error bars) for each curve
  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    const statisticSelect = curveInfoParams.curves[curveIndex].statistic;
    diffFrom = curveInfoParams.curves[curveIndex].diffFrom;
    var data = dataset[curveIndex];
    label = dataset[curveIndex].label;

    let di = 0;
    while (di < data.x.length) {
      if (curveInfoParams.yAxisFormat === "Relative frequency") {
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

      di++;
    }
  } // end curves

  // generate plot options
  curveInfoParams.axisMap[curveInfoParams.curves[0].axisKey].xmin = xmin;
  curveInfoParams.axisMap[curveInfoParams.curves[0].axisKey].xmax = xmax;
  curveInfoParams.axisMap[curveInfoParams.curves[0].axisKey].ymin = ymin;
  curveInfoParams.axisMap[curveInfoParams.curves[0].axisKey].ymax = ymax;

  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    // remove sub values and times to save space
    data = dataset[curveIndex];
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
    data.n_forecast = [];
    data.n_matched = [];
    data.n_simple = [];
    data.n_total = [];
    data.subVals = [];
    data.subSecs = [];
    data.subLevs = [];
  }

  const resultOptions = matsDataPlotOpsUtils.generateHistogramPlotOptions(
    curveInfoParams.curves,
    curveInfoParams.axisMap,
    curveInfoParams.varUnits,
    plotBins
  );
  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataContour = function (
  dataset,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";
  const { appName } = matsCollections.Settings.findOne({});
  const statisticSelect =
    appName.indexOf("anomalycor") !== -1 ? "ACC" : curveInfoParams.curve[0].statistic;
  const data = dataset[0];
  const { label } = dataset[0];

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
  let currX;
  let currY;
  let currText;
  let currYTextArray;
  for (j = 0; j < data.y.length; j++) {
    currY = data.y[j];
    currYTextArray = [];
    for (i = 0; i < data.x.length; i++) {
      currX = data.x[i];
      currText = `${label}<br>${data.xAxisKey}: ${data.x[i]}<br>${data.yAxisKey}: ${
        data.y[j]
      }<br>${statisticSelect}: ${
        data.z[j][i] === undefined || data.z[j][i] === null || data.z[j][i] === "null"
          ? null
          : data.z[j][i].toPrecision(4)
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
  data.n_forecast = [];
  data.n_matched = [];
  data.n_simple = [];
  data.n_total = [];
  data.subVals = [];
  data.subSecs = [];
  data.subLevs = [];

  // generate plot options
  const resultOptions = matsDataPlotOpsUtils.generateContourPlotOptions(dataset);

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

const processDataSimpleScatter = function (
  dataset,
  appParams,
  curveInfoParams,
  plotParams,
  bookkeepingParams
) {
  const error = "";

  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;

  // if matching, pare down dataset to only matching data. METexpress takes care of matching in its python query code
  if (curveInfoParams.curvesLength > 1 && appParams.matching && !isMetexpress) {
    dataset = matsDataMatchUtils.getMatchedDataSet(
      dataset,
      curveInfoParams,
      appParams,
      {}
    );
  }

  // sort data statistics for each curve
  for (var curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    var data = dataset[curveIndex];
    var statType;
    if (curveInfoParams.statType === undefined) {
      statType = "scalar";
    } else if (Array.isArray(curveInfoParams.statType)) {
      statType = curveInfoParams.statType[curveIndex];
    } else {
      statType = curveInfoParams.statType;
    }
    const { label } = dataset[curveIndex];

    const statisticXSelect =
      curveInfoParams.curves[curveIndex]["x-statistic"] === undefined
        ? curveInfoParams.curves[curveIndex].statistic
        : curveInfoParams.curves[curveIndex]["x-statistic"];
    const statisticYSelect = curveInfoParams.curves[curveIndex]["y-statistic"];
    const variableXSelect =
      curveInfoParams.curves[curveIndex]["x-variable"] === undefined
        ? curveInfoParams.curves[curveIndex].variable
        : curveInfoParams.curves[curveIndex]["x-variable"];
    const variableYSelect = curveInfoParams.curves[curveIndex]["y-variable"];

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

      di++;
    }
    dataset[curveIndex].glob_stats = {};
  }

  for (curveIndex = 0; curveIndex < curveInfoParams.curvesLength; curveIndex++) {
    // remove sub values and times to save space
    data = dataset[curveIndex];
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
  const resultOptions = matsDataPlotOpsUtils.generateScatterPlotOptions(
    curveInfoParams.axisXMap,
    curveInfoParams.axisYMap
  );

  const totalProcessingFinish = moment();
  bookkeepingParams.dataRequests["total retrieval and processing time for curve set"] =
    {
      begin: bookkeepingParams.totalProcessingStart.format(),
      finish: totalProcessingFinish.format(),
      duration: `${moment
        .duration(totalProcessingFinish.diff(bookkeepingParams.totalProcessingStart))
        .asSeconds()} seconds`,
    };

  // pass result to client-side plotting functions
  return {
    error,
    data: dataset,
    options: resultOptions,
    basis: {
      plotParams,
      queries: bookkeepingParams.dataRequests,
    },
  };
};

export default matsDataProcessUtils = {
  processDataXYCurve,
  processDataProfile,
  processDataReliability,
  processDataROC,
  processDataPerformanceDiagram,
  processDataHistogram,
  processDataEnsembleHistogram,
  processDataContour,
  processDataSimpleScatter,
};
