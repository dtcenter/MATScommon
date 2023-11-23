/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsDataUtils } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

// returns the data for whichever curve has the larger interval in its independent variable
const getLargeIntervalCurveData = function (dataset, diffFrom, independentVarName) {
  let dataMaxInterval = Number.MIN_VALUE;
  let largeIntervalCurveData = dataset[diffFrom[0]];
  // set up the indexes and determine the minimum independentVarName value for the dataset
  for (let ci = 0; ci < dataset.length; ci += 1) {
    if (
      dataset[ci][independentVarName] === undefined ||
      dataset[ci][independentVarName].length === 0
    ) {
      // one of the curves has no data. No match possible. Just use interval from first curve
      break;
    }
    if (dataset[ci][independentVarName].length > 1) {
      let diff;
      for (let di = 0; di < dataset[ci][independentVarName].length - 1; di += 1) {
        // don't go all the way to the end - one shy
        diff =
          dataset[ci][independentVarName][di + 1] - dataset[ci][independentVarName][di];
        if (diff > dataMaxInterval) {
          dataMaxInterval = diff;
          largeIntervalCurveData = dataset[ci];
        }
      }
    }
  }
  return largeIntervalCurveData;
};

// generates diff curves for all plot types that have diff curves.
const getDataForDiffCurve = function (dataset, diffFrom, appParams, isCTC, isScalar) {
  /*
     DATASET ELEMENTS:
        series: [data,data,data ...... ]   each data is itself an object
        d = {
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
            subInterest: [],
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
            xmin: Number.MAX_VALUE,
            xmax: Number.MIN_VALUE,
            ymin: Number.MAX_VALUE,
            ymax: Number.MIN_VALUE,
            sum: 0
        };

     NOTE -- for profiles, x is the statVarName and y is the independentVarName, because profiles plot the statVarName
        on the x axis and the independentVarName on the y axis.

     */

  const { plotType } = appParams;
  const { hasLevels } = appParams;

  // determine whether data[0] or data[1] is the independent variable, and which is the stat value
  let independentVarName;
  let statVarName;
  if (plotType !== matsTypes.PlotTypes.profile) {
    independentVarName = "x";
    statVarName = "y";
  } else {
    independentVarName = "y";
    statVarName = "x";
  }

  // initialize variables
  const minuendData = dataset[diffFrom[0]];
  const subtrahendData = dataset[diffFrom[1]];
  let subtrahendIndex = 0;
  let minuendIndex = 0;

  const d = {
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
    subInterest: [],
    subData: [],
    subHeaders: [],
    subVals: [],
    subSecs: [],
    subLevs: [],
    stats: [],
    text: [],
    bin_stats: [],
    glob_stats: {
      glob_mean: null,
      glob_sd: null,
      glob_n: 0,
      glob_max: null,
      glob_min: null,
    },
    n_forecast: [],
    n_matched: [],
    n_simple: [],
    n_total: [],
    xmin: Number.MAX_VALUE,
    xmax: Number.MIN_VALUE,
    ymin: Number.MAX_VALUE,
    ymax: Number.MIN_VALUE,
    sum: 0,
  };

  // make sure neither curve is empty
  if (minuendData.x.length === 0 || subtrahendData.x.length === 0) {
    return { dataset: d };
  }

  // this is a difference curve - we are differencing diffFrom[0] - diffFrom[1] based on the
  // independentVarName values of whichever has the largest interval
  // find the largest interval between diffFrom[0] curve and diffFrom[1] curve
  const largeIntervalCurveData = getLargeIntervalCurveData(
    dataset,
    diffFrom,
    independentVarName
  );

  // calculate the differences
  for (
    let largeIntervalCurveIndex = 0;
    largeIntervalCurveIndex < largeIntervalCurveData[independentVarName].length;
    largeIntervalCurveIndex += 1
  ) {
    // make sure that we are actually on the same independentVarName value for each curve
    let subtrahendIndependentVar = subtrahendData[independentVarName][subtrahendIndex];
    let minuendIndependentVar = minuendData[independentVarName][minuendIndex];
    const largeIntervalIndependentVar =
      largeIntervalCurveData[independentVarName][largeIntervalCurveIndex];

    // increment the minuendIndex until it reaches this iteration's largeIntervalIndependentVar
    let minuendChanged = false;
    while (
      largeIntervalIndependentVar > minuendIndependentVar &&
      minuendIndex < minuendData[independentVarName].length - 1
    ) {
      minuendIndex += 1;
      minuendIndependentVar = minuendData[independentVarName][minuendIndex];
      minuendChanged = true;
    }
    // if the end of the curve was reached without finding the largeIntervalIndependentVar, increase the minuendIndex to trigger the end conditions.
    if (!minuendChanged && minuendIndex >= minuendData[independentVarName].length - 1) {
      minuendIndex += 1;
    }

    // increment the subtrahendIndex until it reaches this iteration's largeIntervalIndependentVar
    let subtrahendChanged = false;
    while (
      largeIntervalIndependentVar > subtrahendIndependentVar &&
      subtrahendIndex < subtrahendData[independentVarName].length - 1
    ) {
      subtrahendIndex += 1;
      subtrahendIndependentVar = subtrahendData[independentVarName][subtrahendIndex];
      subtrahendChanged = true;
    }
    // if the end of the curve was reached without finding the largeIntervalIndependentVar, increase the subtrahendIndex to trigger the end conditions.
    if (
      !subtrahendChanged &&
      subtrahendIndex >= subtrahendData[independentVarName].length - 1
    ) {
      subtrahendIndex += 1;
    }

    let diffValue = null;
    let tempSubHitArray;
    let tempSubFaArray;
    let tempSubMissArray;
    let tempSubCnArray;
    let tempSubSquareDiffSumArray;
    let tempSubNSumArray;
    let tempSubObsModelDiffSumArray;
    let tempSubModelSumArray;
    let tempSubObsSumArray;
    let tempSubAbsSumArray;
    let tempSubValsArray;
    let tempSubSecsArray;
    let tempSubLevsArray;

    // make sure both curves actually have data at this index
    if (
      minuendData[independentVarName][minuendIndex] !== undefined &&
      subtrahendData[independentVarName][subtrahendIndex] !== undefined
    ) {
      if (
        minuendData[statVarName][minuendIndex] !== null &&
        subtrahendData[statVarName][subtrahendIndex] !== null &&
        minuendData[independentVarName][minuendIndex] ===
          subtrahendData[independentVarName][subtrahendIndex]
      ) {
        // make sure data is not null at this point and the independentVars actually match

        // if they do both have data then calculate the difference and initialize the other data fields
        diffValue =
          minuendData[statVarName][minuendIndex] -
          subtrahendData[statVarName][subtrahendIndex];
        d[independentVarName].push(largeIntervalIndependentVar);
        d[statVarName].push(diffValue);
        d.error_x.push(null);
        d.error_y.push(null);
        tempSubHitArray = [];
        tempSubFaArray = [];
        tempSubMissArray = [];
        tempSubCnArray = [];
        tempSubSquareDiffSumArray = [];
        tempSubNSumArray = [];
        tempSubObsModelDiffSumArray = [];
        tempSubModelSumArray = [];
        tempSubObsSumArray = [];
        tempSubAbsSumArray = [];
        tempSubValsArray = [];
        tempSubSecsArray = [];
        if (hasLevels) {
          tempSubLevsArray = [];
        }

        let minuendDataSubHit;
        let minuendDataSubFa;
        let minuendDataSubMiss;
        let minuendDataSubCn;
        let subtrahendDataSubHit;
        let subtrahendDataSubFa;
        let subtrahendDataSubMiss;
        let subtrahendDataSubCn;
        let minuendDataSubSquareDiffSum;
        let minuendDataSubNSum;
        let minuendDataSubObsModelDiffSum;
        let minuendDataSubModelSum;
        let minuendDataSubObsSum;
        let minuendDataSubAbsSum;
        let subtrahendDataSubSquareDiffSum;
        let subtrahendDataSubNSum;
        let subtrahendDataSubObsModelDiffSum;
        let subtrahendDataSubModelSum;
        let subtrahendDataSubObsSum;
        let subtrahendDataSubAbsSum;
        let minuendDataNForecast;
        let minuendDataNMatched;
        let minuendDataNSimple;
        let minuendDataNTotal;
        let subtrahendDataNForecast;
        let subtrahendDataNMatched;
        let subtrahendDataNSimple;
        let subtrahendDataNTotal;
        let minuendDataSubValues;
        let subtrahendDataSubValues;
        let minuendDataSubSeconds;
        let subtrahendDataSubSeconds;
        let minuendDataSubLevels;
        let subtrahendDataSubLevels;
        // calculate the differences in sub values. If it's a MODE curve we don't care.
        if (
          (minuendData.subInterest === undefined ||
            minuendData.subInterest.length === 0) &&
          (subtrahendData.subInterest === undefined ||
            subtrahendData.subInterest.length === 0)
        ) {
          if (plotType !== matsTypes.PlotTypes.histogram) {
            if (isCTC) {
              minuendDataSubHit = minuendData.subHit[minuendIndex];
              minuendDataSubFa = minuendData.subFa[minuendIndex];
              minuendDataSubMiss = minuendData.subMiss[minuendIndex];
              minuendDataSubCn = minuendData.subCn[minuendIndex];
              subtrahendDataSubHit = subtrahendData.subHit[subtrahendIndex];
              subtrahendDataSubFa = subtrahendData.subFa[subtrahendIndex];
              subtrahendDataSubMiss = subtrahendData.subMiss[subtrahendIndex];
              subtrahendDataSubCn = subtrahendData.subCn[subtrahendIndex];
            } else if (isScalar) {
              minuendDataSubSquareDiffSum = minuendData.subSquareDiffSum[minuendIndex];
              minuendDataSubNSum = minuendData.subNSum[minuendIndex];
              minuendDataSubObsModelDiffSum =
                minuendData.subObsModelDiffSum[minuendIndex];
              minuendDataSubModelSum = minuendData.subModelSum[minuendIndex];
              minuendDataSubObsSum = minuendData.subObsSum[minuendIndex];
              minuendDataSubAbsSum = minuendData.subAbsSum[minuendIndex];
              subtrahendDataSubSquareDiffSum =
                subtrahendData.subSquareDiffSum[subtrahendIndex];
              subtrahendDataSubNSum = subtrahendData.subNSum[subtrahendIndex];
              subtrahendDataSubObsModelDiffSum =
                subtrahendData.subObsModelDiffSum[subtrahendIndex];
              subtrahendDataSubModelSum = subtrahendData.subModelSum[subtrahendIndex];
              subtrahendDataSubObsSum = subtrahendData.subObsSum[subtrahendIndex];
              subtrahendDataSubAbsSum = subtrahendData.subAbsSum[subtrahendIndex];
            } else if (
              minuendData.n_total.length > 0 &&
              subtrahendData.n_total.length
            ) {
              minuendDataNForecast = minuendData.n_forecast[minuendIndex];
              minuendDataNMatched = minuendData.n_matched[minuendIndex];
              minuendDataNSimple = minuendData.n_simple[minuendIndex];
              minuendDataNTotal = minuendData.n_total[minuendIndex];
              subtrahendDataNForecast = subtrahendData.n_forecast[subtrahendIndex];
              subtrahendDataNMatched = subtrahendData.n_matched[subtrahendIndex];
              subtrahendDataNSimple = subtrahendData.n_simple[subtrahendIndex];
              subtrahendDataNTotal = subtrahendData.n_total[subtrahendIndex];
            }
            minuendDataSubValues = minuendData.subVals[minuendIndex];
            subtrahendDataSubValues = subtrahendData.subVals[subtrahendIndex];
            minuendDataSubSeconds = minuendData.subSecs[minuendIndex];
            subtrahendDataSubSeconds = subtrahendData.subSecs[subtrahendIndex];
            if (hasLevels) {
              minuendDataSubLevels = minuendData.subLevs[minuendIndex];
              subtrahendDataSubLevels = subtrahendData.subLevs[subtrahendIndex];
            }

            // find matching sub values and diff those
            for (
              let mvalIdx = 0;
              mvalIdx < minuendDataSubSeconds.length;
              mvalIdx += 1
            ) {
              for (
                let svalIdx = 0;
                svalIdx < subtrahendDataSubSeconds.length;
                svalIdx += 1
              ) {
                if (
                  (hasLevels &&
                    minuendDataSubSeconds[mvalIdx] ===
                      subtrahendDataSubSeconds[svalIdx] &&
                    minuendDataSubLevels[mvalIdx] ===
                      subtrahendDataSubLevels[svalIdx]) ||
                  (!hasLevels &&
                    minuendDataSubSeconds[mvalIdx] ===
                      subtrahendDataSubSeconds[svalIdx])
                ) {
                  if (isCTC) {
                    tempSubHitArray.push(
                      minuendDataSubHit[mvalIdx] - subtrahendDataSubHit[svalIdx]
                    );
                    tempSubFaArray.push(
                      minuendDataSubFa[mvalIdx] - subtrahendDataSubFa[svalIdx]
                    );
                    tempSubMissArray.push(
                      minuendDataSubMiss[mvalIdx] - subtrahendDataSubMiss[svalIdx]
                    );
                    tempSubCnArray.push(
                      minuendDataSubCn[mvalIdx] - subtrahendDataSubCn[svalIdx]
                    );
                  } else if (isScalar) {
                    tempSubSquareDiffSumArray.push(
                      minuendDataSubSquareDiffSum[mvalIdx] -
                        subtrahendDataSubSquareDiffSum[svalIdx]
                    );
                    tempSubNSumArray.push(
                      minuendDataSubNSum[mvalIdx] - subtrahendDataSubNSum[svalIdx]
                    );
                    tempSubObsModelDiffSumArray.push(
                      minuendDataSubObsModelDiffSum[mvalIdx] -
                        subtrahendDataSubObsModelDiffSum[svalIdx]
                    );
                    tempSubModelSumArray.push(
                      minuendDataSubModelSum[mvalIdx] -
                        subtrahendDataSubModelSum[svalIdx]
                    );
                    tempSubObsSumArray.push(
                      minuendDataSubObsSum[mvalIdx] - subtrahendDataSubObsSum[svalIdx]
                    );
                    tempSubAbsSumArray.push(
                      minuendDataSubAbsSum[mvalIdx] - subtrahendDataSubAbsSum[svalIdx]
                    );
                  }
                  tempSubValsArray.push(
                    minuendDataSubValues[mvalIdx] - subtrahendDataSubValues[svalIdx]
                  );
                  tempSubSecsArray.push(minuendDataSubSeconds[mvalIdx]);
                  if (hasLevels) {
                    tempSubLevsArray.push(minuendDataSubLevels[mvalIdx]);
                  }
                  d.glob_stats.glob_n += 1;
                }
              }
            }

            d.subHit.push(tempSubHitArray);
            d.subFa.push(tempSubFaArray);
            d.subMiss.push(tempSubMissArray);
            d.subCn.push(tempSubCnArray);
            d.subSquareDiffSum.push(tempSubSquareDiffSumArray);
            d.subNSum.push(tempSubNSumArray);
            d.subObsModelDiffSum.push(tempSubObsModelDiffSumArray);
            d.subModelSum.push(tempSubModelSumArray);
            d.subObsSum.push(tempSubObsSumArray);
            d.subAbsSum.push(tempSubAbsSumArray);
            d.subVals.push(tempSubValsArray);
            d.subSecs.push(tempSubSecsArray);
            if (hasLevels) {
              d.subLevs.push(tempSubLevsArray);
            }
            if (minuendData.n_total.length > 0 && subtrahendData.n_total.length) {
              d.n_forecast.push(minuendDataNForecast - subtrahendDataNForecast);
              d.n_matched.push(minuendDataNMatched - subtrahendDataNMatched);
              d.n_simple.push(minuendDataNSimple - subtrahendDataNSimple);
              d.n_total.push(minuendDataNTotal - subtrahendDataNTotal);
            }
            d.sum += d[independentVarName][largeIntervalCurveIndex];
          } else {
            d.bin_stats.push({
              bin_mean: null,
              bin_sd: null,
              bin_n: diffValue,
              bin_rf:
                minuendData.bin_stats[minuendIndex].bin_rf -
                subtrahendData.bin_stats[subtrahendIndex].bin_rf,
              binLowBound: minuendData.bin_stats[minuendIndex].binLowBound,
              binUpBound: minuendData.bin_stats[minuendIndex].binUpBound,
              binLabel: minuendData.bin_stats[minuendIndex].binLabel,
            });
          }
        }
      } else {
        // no match for this independentVarName
        d[independentVarName].push(largeIntervalIndependentVar);
        d[statVarName].push(null);
        d.error_x.push(null);
        d.error_y.push(null);
        d.subHit.push([]);
        d.subFa.push([]);
        d.subMiss.push([]);
        d.subCn.push([]);
        d.subSquareDiffSum.push([]);
        d.subNSum.push([]);
        d.subObsModelDiffSum.push([]);
        d.subModelSum.push([]);
        d.subObsSum.push([]);
        d.subAbsSum.push([]);
        d.subVals.push([]);
        d.subSecs.push([]);
        if (hasLevels) {
          d.subLevs.push([]);
        }
        if (plotType === matsTypes.PlotTypes.histogram) {
          d.bin_stats.push({
            bin_mean: null,
            bin_sd: null,
            bin_n: null,
            bin_rf: null,
            binLowBound: minuendData.bin_stats[minuendIndex].binLowBound,
            binUpBound: minuendData.bin_stats[minuendIndex].binUpBound,
            binLabel: minuendData.bin_stats[minuendIndex].binLabel,
          });
        }
      }
    } else if (
      (!subtrahendChanged &&
        subtrahendIndex >= subtrahendData[independentVarName].length - 1) ||
      (!minuendChanged && minuendIndex >= minuendData[independentVarName].length - 1)
    ) {
      // we've reached the end of at least one curve, so end the diffing.
      break;
    }
  }

  // calculate the max and min for this curve
  const filteredx = d.x.filter((x) => x);
  const filteredy = d.y.filter((y) => y);
  d.xmin = Math.min(...filteredx);
  if (d.x.indexOf(0) !== -1 && d.xmin > 0) {
    d.xmin = 0;
  }
  d.xmax = Math.max(...filteredx);
  if (d.x.indexOf(0) !== -1 && d.xmax < 0) {
    d.xmax = 0;
  }
  d.ymin = Math.min(...filteredy);
  if (d.y.indexOf(0) !== -1 && d.ymin > 0) {
    d.ymin = 0;
  }
  d.ymax = Math.max(...filteredy);
  if (d.y.indexOf(0) !== -1 && d.ymax < 0) {
    d.ymax = 0;
  }

  return { dataset: d };
};

// generates diff of two contours.
const getDataForDiffContour = function (
  dataset,
  appParams,
  showSignificance,
  sigType,
  allStatistics,
  allStatTypes
) {
  /*
     DATASET ELEMENTS:
        d[i] = {
            label: string,
            curveId: string,
            name: string,
            annotateColor: string,
            annotation: string,             -----
            x: [],                          *****
            y: [],                          *****
            z: [[]],                        *****
            n: [[]],                        *****
            text: [],
            stdev: [[]],                    *****
            stats: [],
            glob_stats: object,             -----
            type: string,
            autocontour: boolean,
            ncontours: number,
            colorbar: object,
            colorscale: string,
            reversescale: boolean,
            connectgaps: connectgaps,
            contours: object,
            marker: object,
            xAxisKey: [],
            yAxisKey: [],
            visible: boolean,
            showlegend: boolean,
            xTextOutput: [],                *****
            yTextOutput: [],                *****
            zTextOutput: [],                *****
            nTextOutput: [],                *****
            hitTextOutput: [],              *****
            faTextOutput: [],               *****
            missTextOutput: [],             *****
            cnTextOutput: [],               *****
            squareDiffSumTextOutput: [],    *****
            NSumTextOutput: [],             *****
            obsModelDiffSumTextOutput: [],  *****
            modelSumTextOutput: [],         *****
            obsSumTextOutput: [],           *****
            absSumTextOutput: [],           *****
            maxDateTextOutput: [],          *****
            minDateTextOutput: [],          *****
            xmax: number,                   -----
            xmin: number,                   -----
            ymax: number,                   -----
            ymin: number,                   -----
            zmax: number,                   -----
            zmin: number,                   -----
            sum: number                     *****
        };

        ***** indicates calculation in loops
        ----- indicates calculation after loops
     */

  // initialize output object
  const diffDataset = {};
  diffDataset.label = `${dataset[1].label}-${dataset[0].label}`;
  diffDataset.curveId = `${dataset[1].curveId}-${dataset[0].curveId}`;
  diffDataset.name = `${dataset[1].label}-${dataset[0].label}`;
  diffDataset.annotateColor = "rgb(255,165,0)";
  diffDataset.annotation = "";
  diffDataset.text = [];
  diffDataset.type = dataset[0].type;
  diffDataset.marker = dataset[0].marker;
  diffDataset.xAxisKey = dataset[0].xAxisKey;
  diffDataset.yAxisKey = dataset[0].yAxisKey;
  diffDataset.visible = dataset[0].visible;
  diffDataset.showlegend = dataset[0].showlegend;
  diffDataset.x = [];
  diffDataset.y = [];
  diffDataset.z = [];
  diffDataset.n = [];
  diffDataset.xTextOutput = [];
  diffDataset.yTextOutput = [];
  diffDataset.zTextOutput = [];
  diffDataset.nTextOutput = [];
  diffDataset.hitTextOutput = [];
  diffDataset.faTextOutput = [];
  diffDataset.missTextOutput = [];
  diffDataset.cnTextOutput = [];
  diffDataset.squareDiffSumTextOutput = [];
  diffDataset.NSumTextOutput = [];
  diffDataset.obsModelDiffSumTextOutput = [];
  diffDataset.modelSumTextOutput = [];
  diffDataset.obsSumTextOutput = [];
  diffDataset.absSumTextOutput = [];
  diffDataset.maxDateTextOutput = [];
  diffDataset.minDateTextOutput = [];
  diffDataset.stats = [];
  diffDataset.stdev = [];
  diffDataset.glob_stats = {};
  diffDataset.xmax = -1 * Number.MAX_VALUE;
  diffDataset.xmin = Number.MAX_VALUE;
  diffDataset.ymax = -1 * Number.MAX_VALUE;
  diffDataset.ymin = Number.MAX_VALUE;
  diffDataset.zmax = -1 * Number.MAX_VALUE;
  diffDataset.zmin = Number.MAX_VALUE;
  diffDataset.sum = 0;

  // initialize local variables
  const { hasLevels } = appParams;
  const isMatching = appParams.matching;
  const minuendData = dataset[1];
  const subtrahendData = dataset[0];
  const minuendIsCTC = allStatTypes[1] === "ctc";
  const subtrahendIsCTC = allStatTypes[0] === "ctc";
  const minuendIsScalar = allStatTypes[1] === "scalar";
  const subtrahendIsScalar = allStatTypes[0] === "scalar";
  const minuendStatistic = allStatistics[1];
  const subtrahendStatistic = allStatistics[0];

  // get common x and y
  diffDataset.x = _.intersection(minuendData.x, subtrahendData.x).sort(function (a, b) {
    return a - b;
  });
  diffDataset.y = _.intersection(minuendData.y, subtrahendData.y).sort(function (a, b) {
    return a - b;
  });

  // make we actually have matches
  if (diffDataset.x.length === 0 || diffDataset.y.length === 0) {
    diffDataset.x = [];
    diffDataset.y = [];
    return [diffDataset];
  }

  // make sure neither dataset is empty
  if (
    minuendData.x.length === 0 ||
    subtrahendData.x.length === 0 ||
    minuendData.y.length === 0 ||
    subtrahendData.y.length === 0
  ) {
    return [diffDataset];
  }

  let minuendYIndex = 0;
  let subtrahendYIndex = 0;
  let nPoints = 0;

  // loop through common Ys
  for (
    let diffDataYIndex = 0;
    diffDataYIndex < diffDataset.y.length;
    diffDataYIndex += 1
  ) {
    // make sure that we are actually on the same y value for each curve
    const diffDataY = diffDataset.y[diffDataYIndex];
    let minuendY = minuendData.y[minuendYIndex];
    let subtrahendY = subtrahendData.y[subtrahendYIndex];

    // increment the minuendYIndex until it reaches this iteration's diffDataY
    while (diffDataY > minuendY && minuendYIndex < minuendData.y.length - 1) {
      minuendYIndex += 1;
      minuendY = minuendData.y[minuendYIndex];
    }

    // increment the subtrahendYIndex until it reaches this iteration's diffDataY
    while (diffDataY > subtrahendY && subtrahendYIndex < subtrahendData.y.length - 1) {
      subtrahendYIndex += 1;
      subtrahendY = subtrahendData.y[subtrahendYIndex];
    }

    // initialize n and z arrays for this Y
    diffDataset.z[diffDataYIndex] = [];
    diffDataset.stdev[diffDataYIndex] = [];
    diffDataset.n[diffDataYIndex] = [];

    let minuendXIndex = 0;
    let subtrahendXIndex = 0;
    for (
      let diffDataXIndex = 0;
      diffDataXIndex < diffDataset.x.length;
      diffDataXIndex += 1
    ) {
      // make sure that we are actually on the same x value for each curve
      const diffDataX = diffDataset.x[diffDataXIndex];
      let minuendX = minuendData.x[minuendXIndex];
      let subtrahendX = subtrahendData.x[subtrahendXIndex];

      // increment the minuendXIndex until it reaches this iteration's diffDataX
      while (diffDataX > minuendX && minuendXIndex < minuendData.x.length - 1) {
        minuendXIndex += 1;
        minuendX = minuendData.x[minuendXIndex];
      }

      // increment the subtrahendXIndex until it reaches this iteration's diffDataX
      while (
        diffDataX > subtrahendX &&
        subtrahendXIndex < subtrahendData.x.length - 1
      ) {
        subtrahendXIndex += 1;
        subtrahendX = subtrahendData.x[subtrahendXIndex];
      }

      let diffValue = null;
      let diffNumber = 0;
      let diffHit = null;
      let diffFa = null;
      let diffMiss = null;
      let diffCn = null;
      let diffSquareDiffSum = null;
      let diffNSum = null;
      let diffObsModelDiffSum = null;
      let diffModelSum = null;
      let diffObsSum = null;
      let diffAbsSum = null;
      let diffMinDate = null;
      let diffMaxDate = null;
      let isDiffSignificant = null;
      let matchingSeconds = [];
      let matchingSecLevs = [];
      let newMinuendSubHitArray;
      let newMinuendSubFaArray;
      let newMinuendSubMissArray;
      let newMinuendSubCnArray;
      let newMinuendSubSquareDiffSumArray;
      let newMinuendSubNSumArray;
      let newMinuendSubObsModelDiffSumArray;
      let newMinuendSubModelSumArray;
      let newMinuendSubObsSumArray;
      let newMinuendSubAbsSumArray;
      let newMinuendSubValsArray;
      let newMinuendSubSecsArray;
      let newMinuendSubLevsArray;
      let newSubtrahendSubHitArray;
      let newSubtrahendSubFaArray;
      let newSubtrahendSubMissArray;
      let newSubtrahendSubCnArray;
      let newSubtrahendSubSquareDiffSumArray;
      let newSubtrahendSubNSumArray;
      let newSubtrahendSubObsModelDiffSumArray;
      let newSubtrahendSubModelSumArray;
      let newSubtrahendSubObsSumArray;
      let newSubtrahendSubAbsSumArray;
      let newSubtrahendSubValsArray;
      let newSubtrahendSubSecsArray;
      let newSubtrahendSubLevsArray;
      let minuendDataSubHit;
      let minuendDataSubFa;
      let minuendDataSubMiss;
      let minuendDataSubCn;
      let subtrahendDataSubHit;
      let subtrahendDataSubFa;
      let subtrahendDataSubMiss;
      let subtrahendDataSubCn;
      let minuendDataSubSquareDiffSum;
      let minuendDataSubNSum;
      let minuendDataSubObsModelDiffSum;
      let minuendDataSubModelSum;
      let minuendDataSubObsSum;
      let minuendDataSubAbsSum;
      let subtrahendDataSubSquareDiffSum;
      let subtrahendDataSubNSum;
      let subtrahendDataSubObsModelDiffSum;
      let subtrahendDataSubModelSum;
      let subtrahendDataSubObsSum;
      let subtrahendDataSubAbsSum;
      let minuendDataSubValues;
      let subtrahendDataSubValues;
      let minuendDataSubSeconds;
      let subtrahendDataSubSeconds;
      let minuendDataSubLevels;
      let subtrahendDataSubLevels;

      if (
        minuendData.z[minuendYIndex][minuendXIndex] !== undefined &&
        subtrahendData.z[subtrahendYIndex][subtrahendXIndex] !== undefined &&
        minuendData.z[minuendYIndex][minuendXIndex] !== null &&
        subtrahendData.z[subtrahendYIndex][subtrahendXIndex] !== null &&
        minuendX === subtrahendX &&
        minuendY === subtrahendY
      ) {
        // make sure both contours actually have data at these indices, data is not null at this point, and the x and y actually match

        if (isMatching) {
          // match the sub-values and overwrite z with a new, matched value.
          newMinuendSubHitArray = [];
          newMinuendSubFaArray = [];
          newMinuendSubMissArray = [];
          newMinuendSubCnArray = [];
          newMinuendSubSquareDiffSumArray = [];
          newMinuendSubNSumArray = [];
          newMinuendSubObsModelDiffSumArray = [];
          newMinuendSubModelSumArray = [];
          newMinuendSubObsSumArray = [];
          newMinuendSubAbsSumArray = [];
          newMinuendSubValsArray = [];
          newMinuendSubSecsArray = [];
          newSubtrahendSubHitArray = [];
          newSubtrahendSubFaArray = [];
          newSubtrahendSubMissArray = [];
          newSubtrahendSubCnArray = [];
          newSubtrahendSubSquareDiffSumArray = [];
          newSubtrahendSubNSumArray = [];
          newSubtrahendSubObsModelDiffSumArray = [];
          newSubtrahendSubModelSumArray = [];
          newSubtrahendSubObsSumArray = [];
          newSubtrahendSubAbsSumArray = [];
          newSubtrahendSubValsArray = [];
          newSubtrahendSubSecsArray = [];
          if (hasLevels) {
            newMinuendSubLevsArray = [];
            newSubtrahendSubLevsArray = [];
          }

          if (minuendIsCTC) {
            minuendDataSubHit = minuendData.subHit[minuendYIndex][minuendXIndex];
            minuendDataSubFa = minuendData.subFa[minuendYIndex][minuendXIndex];
            minuendDataSubMiss = minuendData.subMiss[minuendYIndex][minuendXIndex];
            minuendDataSubCn = minuendData.subCn[minuendYIndex][minuendXIndex];
          } else if (minuendIsScalar) {
            minuendDataSubSquareDiffSum =
              minuendData.subSquareDiffSum[minuendYIndex][minuendXIndex];
            minuendDataSubNSum = minuendData.subNSum[minuendYIndex][minuendXIndex];
            minuendDataSubObsModelDiffSum =
              minuendData.subObsModelDiffSum[minuendYIndex][minuendXIndex];
            minuendDataSubModelSum =
              minuendData.subModelSum[minuendYIndex][minuendXIndex];
            minuendDataSubObsSum = minuendData.subObsSum[minuendYIndex][minuendXIndex];
            minuendDataSubAbsSum = minuendData.subAbsSum[minuendYIndex][minuendXIndex];
          } else {
            minuendDataSubValues = minuendData.subVals[minuendYIndex][minuendXIndex];
          }
          if (subtrahendIsCTC) {
            subtrahendDataSubHit =
              subtrahendData.subHit[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubFa =
              subtrahendData.subFa[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubMiss =
              subtrahendData.subMiss[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubCn =
              subtrahendData.subCn[subtrahendYIndex][subtrahendXIndex];
          } else if (subtrahendIsScalar) {
            subtrahendDataSubSquareDiffSum =
              subtrahendData.subSquareDiffSum[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubNSum =
              subtrahendData.subNSum[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubObsModelDiffSum =
              subtrahendData.subObsModelDiffSum[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubModelSum =
              subtrahendData.subModelSum[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubObsSum =
              subtrahendData.subObsSum[subtrahendYIndex][subtrahendXIndex];
            subtrahendDataSubAbsSum =
              subtrahendData.subAbsSum[subtrahendYIndex][subtrahendXIndex];
          } else {
            subtrahendDataSubValues =
              subtrahendData.subVals[subtrahendYIndex][subtrahendXIndex];
          }
          minuendDataSubSeconds = minuendData.subSecs[minuendYIndex][minuendXIndex];
          subtrahendDataSubSeconds =
            subtrahendData.subSecs[subtrahendYIndex][subtrahendXIndex];
          if (hasLevels) {
            minuendDataSubLevels = minuendData.subLevs[minuendYIndex][minuendXIndex];
            subtrahendDataSubLevels =
              subtrahendData.subLevs[subtrahendYIndex][subtrahendXIndex];
          }

          // find matching sub values and diff those
          if (hasLevels) {
            const minuendSecLevs = [];
            for (let midx = 0; midx < minuendDataSubSeconds.length; midx += 1) {
              minuendSecLevs.push([
                minuendDataSubSeconds[midx],
                minuendDataSubLevels[midx],
              ]);
            }
            matchingSecLevs = [];
            for (let sidx = 0; sidx < subtrahendDataSubSeconds.length; sidx += 1) {
              if (
                matsDataUtils.arrayContainsSubArray(minuendSecLevs, [
                  subtrahendDataSubSeconds[sidx],
                  subtrahendDataSubLevels[sidx],
                ])
              ) {
                matchingSecLevs.push([
                  subtrahendDataSubSeconds[sidx],
                  subtrahendDataSubLevels[sidx],
                ]);
              }
            }
          } else {
            matchingSeconds = _.intersection(
              minuendDataSubSeconds,
              subtrahendDataSubSeconds
            );
          }

          for (let mvalIdx = 0; mvalIdx < minuendDataSubSeconds.length; mvalIdx += 1) {
            if (
              (hasLevels &&
                matsDataUtils.arrayContainsSubArray(matchingSecLevs, [
                  minuendDataSubSeconds[mvalIdx],
                  minuendDataSubLevels[mvalIdx],
                ])) ||
              (!hasLevels && matchingSeconds.includes(minuendDataSubSeconds[mvalIdx]))
            ) {
              if (minuendIsCTC) {
                newMinuendSubHitArray.push(minuendDataSubHit[mvalIdx]);
                newMinuendSubFaArray.push(minuendDataSubFa[mvalIdx]);
                newMinuendSubMissArray.push(minuendDataSubMiss[mvalIdx]);
                newMinuendSubCnArray.push(minuendDataSubCn[mvalIdx]);
              } else if (minuendIsScalar) {
                newMinuendSubSquareDiffSumArray.push(
                  minuendDataSubSquareDiffSum[mvalIdx]
                );
                newMinuendSubNSumArray.push(minuendDataSubNSum[mvalIdx]);
                newMinuendSubObsModelDiffSumArray.push(
                  minuendDataSubObsModelDiffSum[mvalIdx]
                );
                newMinuendSubModelSumArray.push(minuendDataSubModelSum[mvalIdx]);
                newMinuendSubObsSumArray.push(minuendDataSubObsSum[mvalIdx]);
                newMinuendSubAbsSumArray.push(minuendDataSubAbsSum[mvalIdx]);
              } else {
                newMinuendSubValsArray.push(minuendDataSubValues[mvalIdx]);
              }
              newMinuendSubSecsArray.push(minuendDataSubSeconds[mvalIdx]);
              if (hasLevels) {
                newMinuendSubLevsArray.push(minuendDataSubLevels[mvalIdx]);
              }
            }
          }
          for (
            let svalIdx = 0;
            svalIdx < subtrahendDataSubSeconds.length;
            svalIdx += 1
          ) {
            if (
              (hasLevels &&
                matsDataUtils.arrayContainsSubArray(matchingSecLevs, [
                  subtrahendDataSubSeconds[svalIdx],
                  subtrahendDataSubLevels[svalIdx],
                ])) ||
              (!hasLevels &&
                matchingSeconds.includes(subtrahendDataSubSeconds[svalIdx]))
            ) {
              if (subtrahendIsCTC) {
                newSubtrahendSubHitArray.push(subtrahendDataSubHit[svalIdx]);
                newSubtrahendSubFaArray.push(subtrahendDataSubFa[svalIdx]);
                newSubtrahendSubMissArray.push(subtrahendDataSubMiss[svalIdx]);
                newSubtrahendSubCnArray.push(subtrahendDataSubCn[svalIdx]);
              } else if (subtrahendIsScalar) {
                newSubtrahendSubSquareDiffSumArray.push(
                  subtrahendDataSubSquareDiffSum[svalIdx]
                );
                newSubtrahendSubNSumArray.push(subtrahendDataSubNSum[svalIdx]);
                newSubtrahendSubObsModelDiffSumArray.push(
                  subtrahendDataSubObsModelDiffSum[svalIdx]
                );
                newSubtrahendSubModelSumArray.push(subtrahendDataSubModelSum[svalIdx]);
                newSubtrahendSubObsSumArray.push(subtrahendDataSubObsSum[svalIdx]);
                newSubtrahendSubAbsSumArray.push(subtrahendDataSubAbsSum[svalIdx]);
              } else {
                newSubtrahendSubValsArray.push(subtrahendDataSubValues[svalIdx]);
              }
              newSubtrahendSubSecsArray.push(subtrahendDataSubSeconds[svalIdx]);
              if (hasLevels) {
                newSubtrahendSubLevsArray.push(subtrahendDataSubLevels[svalIdx]);
              }
            }
          }
          if (minuendIsCTC) {
            minuendData.subHit[minuendYIndex][minuendXIndex] = newMinuendSubHitArray;
            minuendData.subFa[minuendYIndex][minuendXIndex] = newMinuendSubFaArray;
            minuendData.subMiss[minuendYIndex][minuendXIndex] = newMinuendSubMissArray;
            minuendData.subCn[minuendYIndex][minuendXIndex] = newMinuendSubCnArray;

            const mHit = matsDataUtils.sum(newMinuendSubHitArray);
            const mFa = matsDataUtils.sum(newMinuendSubFaArray);
            const mMiss = matsDataUtils.sum(newMinuendSubMissArray);
            const mCn = matsDataUtils.sum(newMinuendSubCnArray);
            minuendData.z[minuendYIndex][minuendXIndex] =
              matsDataUtils.calculateStatCTC(
                mHit,
                mFa,
                mMiss,
                mCn,
                newMinuendSubHitArray.length,
                minuendStatistic
              );
          } else if (minuendIsScalar) {
            minuendData.subSquareDiffSum[minuendYIndex][minuendXIndex] =
              newMinuendSubSquareDiffSumArray;
            minuendData.subNSum[minuendYIndex][minuendXIndex] = newMinuendSubNSumArray;
            minuendData.subObsModelDiffSum[minuendYIndex][minuendXIndex] =
              newMinuendSubObsModelDiffSumArray;
            minuendData.subModelSum[minuendYIndex][minuendXIndex] =
              newMinuendSubModelSumArray;
            minuendData.subObsSum[minuendYIndex][minuendXIndex] =
              newMinuendSubObsSumArray;
            minuendData.subAbsSum[minuendYIndex][minuendXIndex] =
              newMinuendSubAbsSumArray;

            const mSquareDiffSum = matsDataUtils.sum(newMinuendSubSquareDiffSumArray);
            const mNSum = matsDataUtils.sum(newMinuendSubNSumArray);
            const mObsModelDiffSum = matsDataUtils.sum(
              newMinuendSubObsModelDiffSumArray
            );
            const mModelSum = matsDataUtils.sum(newMinuendSubModelSumArray);
            const mObsSum = matsDataUtils.sum(newMinuendSubObsSumArray);
            const mAbsSum = matsDataUtils.sum(newMinuendSubAbsSumArray);
            minuendData.z[minuendYIndex][minuendXIndex] =
              matsDataUtils.calculateStatScalar(
                mSquareDiffSum,
                mNSum,
                mObsModelDiffSum,
                mModelSum,
                mObsSum,
                mAbsSum,
                minuendStatistic
              );
            // need to populate subVals so stdev of them can be taken (Bill's method for determining significance)
            for (
              let msvIdx = 0;
              msvIdx < newMinuendSubSquareDiffSumArray.length;
              msvIdx += 1
            ) {
              newMinuendSubValsArray.push(
                matsDataUtils.calculateStatScalar(
                  newMinuendSubSquareDiffSumArray[msvIdx],
                  newMinuendSubNSumArray[msvIdx],
                  newMinuendSubObsModelDiffSumArray[msvIdx],
                  newMinuendSubModelSumArray[msvIdx],
                  newMinuendSubObsSumArray[msvIdx],
                  newMinuendSubAbsSumArray[msvIdx],
                  minuendStatistic
                )
              );
            }
            minuendData.stdev[minuendYIndex][minuendXIndex] =
              newMinuendSubValsArray.length > 0
                ? matsDataUtils.stdev(newMinuendSubValsArray)
                : 0;
          } else {
            minuendData.subVals[minuendYIndex][minuendXIndex] = newMinuendSubValsArray;
            minuendData.z[minuendYIndex][minuendXIndex] =
              newMinuendSubValsArray.length > 0
                ? matsDataUtils.average(newMinuendSubValsArray)
                : null;
            minuendData.stdev[minuendYIndex][minuendXIndex] =
              newMinuendSubValsArray.length > 0
                ? matsDataUtils.stdev(newMinuendSubValsArray)
                : 0;
          }
          if (subtrahendIsCTC) {
            subtrahendData.subHit[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubHitArray;
            subtrahendData.subFa[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubFaArray;
            subtrahendData.subMiss[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubMissArray;
            subtrahendData.subCn[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubCnArray;

            const sHit = matsDataUtils.sum(newSubtrahendSubHitArray);
            const sFa = matsDataUtils.sum(newSubtrahendSubFaArray);
            const sMiss = matsDataUtils.sum(newSubtrahendSubMissArray);
            const sCn = matsDataUtils.sum(newSubtrahendSubCnArray);
            subtrahendData.z[subtrahendYIndex][subtrahendXIndex] =
              matsDataUtils.calculateStatCTC(
                sHit,
                sFa,
                sMiss,
                sCn,
                newSubtrahendSubHitArray.length,
                subtrahendStatistic
              );
          } else if (subtrahendIsScalar) {
            subtrahendData.subSquareDiffSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubSquareDiffSumArray;
            subtrahendData.subNSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubNSumArray;
            subtrahendData.subObsModelDiffSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubObsModelDiffSumArray;
            subtrahendData.subModelSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubModelSumArray;
            subtrahendData.subObsSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubObsSumArray;
            subtrahendData.subAbsSum[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubAbsSumArray;

            const sSquareDiffSum = matsDataUtils.sum(
              newSubtrahendSubSquareDiffSumArray
            );
            const sNSum = matsDataUtils.sum(newSubtrahendSubNSumArray);
            const sObsModelDiffSum = matsDataUtils.sum(
              newSubtrahendSubObsModelDiffSumArray
            );
            const sModelSum = matsDataUtils.sum(newSubtrahendSubModelSumArray);
            const sObsSum = matsDataUtils.sum(newSubtrahendSubObsSumArray);
            const sAbsSum = matsDataUtils.sum(newSubtrahendSubAbsSumArray);
            subtrahendData.z[subtrahendYIndex][subtrahendXIndex] =
              matsDataUtils.calculateStatScalar(
                sSquareDiffSum,
                sNSum,
                sObsModelDiffSum,
                sModelSum,
                sObsSum,
                sAbsSum,
                subtrahendStatistic
              );
            // need to populate subVals so stdev of them can be taken (Bill's method for determining significance)
            for (
              let ssvIdx = 0;
              ssvIdx < newSubtrahendSubSquareDiffSumArray.length;
              ssvIdx += 1
            ) {
              newSubtrahendSubValsArray.push(
                matsDataUtils.calculateStatScalar(
                  newSubtrahendSubSquareDiffSumArray[ssvIdx],
                  newSubtrahendSubNSumArray[ssvIdx],
                  newSubtrahendSubObsModelDiffSumArray[ssvIdx],
                  newSubtrahendSubModelSumArray[ssvIdx],
                  newSubtrahendSubObsSumArray[ssvIdx],
                  newSubtrahendSubAbsSumArray[ssvIdx],
                  subtrahendStatistic
                )
              );
            }
            subtrahendData.stdev[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubValsArray.length > 0
                ? matsDataUtils.stdev(newSubtrahendSubValsArray)
                : 0;
          } else {
            subtrahendData.subVals[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubValsArray;
            subtrahendData.z[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubValsArray.length > 0
                ? matsDataUtils.average(newSubtrahendSubValsArray)
                : null;
            subtrahendData.stdev[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubValsArray.length > 0
                ? matsDataUtils.stdev(newSubtrahendSubValsArray)
                : 0;
          }
          minuendData.n[minuendYIndex][minuendXIndex] = newMinuendSubSecsArray.length;
          subtrahendData.n[subtrahendYIndex][subtrahendXIndex] =
            newSubtrahendSubSecsArray.length;
          minuendData.subSecs[minuendYIndex][minuendXIndex] = newMinuendSubSecsArray;
          subtrahendData.subSecs[subtrahendYIndex][subtrahendXIndex] =
            newSubtrahendSubSecsArray;
          if (hasLevels) {
            minuendData.subLevs[minuendYIndex][minuendXIndex] = newMinuendSubLevsArray;
            subtrahendData.subLevs[subtrahendYIndex][subtrahendXIndex] =
              newSubtrahendSubLevsArray;
          }
        }
        // calculate the difference values
        diffValue =
          minuendData.z[minuendYIndex][minuendXIndex] !== null &&
          subtrahendData.z[subtrahendYIndex][subtrahendXIndex] !== null
            ? minuendData.z[minuendYIndex][minuendXIndex] -
              subtrahendData.z[subtrahendYIndex][subtrahendXIndex]
            : null;
        diffNumber =
          minuendData.n[minuendYIndex][minuendXIndex] <=
          subtrahendData.n[subtrahendYIndex][subtrahendXIndex]
            ? minuendData.n[minuendYIndex][minuendXIndex]
            : subtrahendData.n[subtrahendYIndex][subtrahendXIndex];
        if (minuendIsCTC && subtrahendIsCTC) {
          diffHit =
            matsDataUtils.sum(minuendData.subHit[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subHit[subtrahendYIndex][subtrahendXIndex]
            );
          diffFa =
            matsDataUtils.sum(minuendData.subFa[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(subtrahendData.subFa[subtrahendYIndex][subtrahendXIndex]);
          diffMiss =
            matsDataUtils.sum(minuendData.subMiss[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subMiss[subtrahendYIndex][subtrahendXIndex]
            );
          diffCn =
            matsDataUtils.sum(minuendData.subCn[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(subtrahendData.subCn[subtrahendYIndex][subtrahendXIndex]);
        } else if (minuendIsScalar && subtrahendIsScalar) {
          diffSquareDiffSum =
            matsDataUtils.sum(
              minuendData.subSquareDiffSum[minuendYIndex][minuendXIndex]
            ) -
            matsDataUtils.sum(
              subtrahendData.subSquareDiffSum[subtrahendYIndex][subtrahendXIndex]
            );
          diffNSum =
            matsDataUtils.sum(minuendData.subNSum[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subNSum[subtrahendYIndex][subtrahendXIndex]
            );
          diffObsModelDiffSum =
            matsDataUtils.sum(
              minuendData.subObsModelDiffSum[minuendYIndex][minuendXIndex]
            ) -
            matsDataUtils.sum(
              subtrahendData.subObsModelDiffSum[subtrahendYIndex][subtrahendXIndex]
            );
          diffModelSum =
            matsDataUtils.sum(minuendData.subModelSum[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subModelSum[subtrahendYIndex][subtrahendXIndex]
            );
          diffObsSum =
            matsDataUtils.sum(minuendData.subObsSum[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subObsSum[subtrahendYIndex][subtrahendXIndex]
            );
          diffAbsSum =
            matsDataUtils.sum(minuendData.subAbsSum[minuendYIndex][minuendXIndex]) -
            matsDataUtils.sum(
              subtrahendData.subAbsSum[subtrahendYIndex][subtrahendXIndex]
            );
        }
        if (
          showSignificance &&
          ((diffNumber > 1 &&
            minuendData.stdev[minuendYIndex][minuendXIndex] !== null &&
            subtrahendData.stdev[subtrahendYIndex][subtrahendXIndex] !== null) ||
            ((minuendIsCTC || subtrahendIsCTC) && diffValue !== null))
        ) {
          switch (sigType) {
            case "95th percentile -- bootstrapping (SKILL SCORES ONLY)":
            case "significance at 95th percentile":
              if (minuendIsCTC && subtrahendIsCTC) {
                isDiffSignificant = matsDataUtils.checkDiffContourSignificanceCTC(
                  diffValue,
                  minuendData.subHit[minuendYIndex][minuendXIndex],
                  minuendData.subFa[minuendYIndex][minuendXIndex],
                  minuendData.subMiss[minuendYIndex][minuendXIndex],
                  minuendData.subCn[minuendYIndex][minuendXIndex],
                  subtrahendData.subHit[minuendYIndex][minuendXIndex],
                  subtrahendData.subFa[minuendYIndex][minuendXIndex],
                  subtrahendData.subMiss[minuendYIndex][minuendXIndex],
                  subtrahendData.subCn[minuendYIndex][minuendXIndex],
                  sigType,
                  minuendStatistic
                )
                  ? 1
                  : null;
              } else {
                throw new Error(
                  "INFO: For this type of statistical significance, both of your component curves need to be skill score statistics, and both need to be the same statistic."
                );
              }
              break;
            case "95th percentile -- standard t-test (CONTINUOUS VARIABLES ONLY)":
            case "95th percentile -- t-test with infinite degrees of freedom (CONTINUOUS VARIABLES ONLY)":
            case "standard":
            case "assume infinite degrees of freedom":
            default:
              if (minuendIsScalar && subtrahendIsScalar) {
                isDiffSignificant = matsDataUtils.checkDiffContourSignificance(
                  minuendData.z[minuendYIndex][minuendXIndex],
                  subtrahendData.z[subtrahendYIndex][subtrahendXIndex],
                  minuendData.stdev[minuendYIndex][minuendXIndex],
                  subtrahendData.stdev[subtrahendYIndex][subtrahendXIndex],
                  minuendData.n[minuendYIndex][minuendXIndex],
                  subtrahendData.n[subtrahendYIndex][subtrahendXIndex],
                  sigType
                )
                  ? 1
                  : null;
              } else {
                throw new Error(
                  "INFO: For this type of statistical significance, both of your component curves need to be continuous variables."
                );
              }
              break;
          }
        }
        diffMinDate =
          minuendData.minDateTextOutput[
            minuendYIndex * minuendData.x.length + minuendXIndex
          ] <=
          subtrahendData.minDateTextOutput[
            subtrahendYIndex * subtrahendData.x.length + subtrahendXIndex
          ]
            ? minuendData.minDateTextOutput[
                minuendYIndex * minuendData.x.length + minuendXIndex
              ]
            : subtrahendData.minDateTextOutput[
                subtrahendYIndex * subtrahendData.x.length + subtrahendXIndex
              ];
        diffMaxDate =
          minuendData.maxDateTextOutput[
            minuendYIndex * minuendData.x.length + minuendXIndex
          ] >=
          subtrahendData.maxDateTextOutput[
            subtrahendYIndex * subtrahendData.x.length + subtrahendXIndex
          ]
            ? minuendData.maxDateTextOutput[
                minuendYIndex * minuendData.x.length + minuendXIndex
              ]
            : subtrahendData.maxDateTextOutput[
                subtrahendYIndex * subtrahendData.x.length + subtrahendXIndex
              ];
        diffDataset.sum += diffValue;
        nPoints += 1;
      }
      diffDataset.z[diffDataYIndex].push(diffValue);
      diffDataset.stdev[diffDataYIndex].push(isDiffSignificant);
      diffDataset.n[diffDataYIndex].push(diffNumber);
      diffDataset.xTextOutput.push(diffDataX);
      diffDataset.yTextOutput.push(diffDataY);
      diffDataset.zTextOutput.push(diffValue);
      diffDataset.nTextOutput.push(diffNumber);
      if (minuendIsCTC && subtrahendIsCTC) {
        diffDataset.hitTextOutput.push(diffHit);
        diffDataset.faTextOutput.push(diffFa);
        diffDataset.missTextOutput.push(diffMiss);
        diffDataset.cnTextOutput.push(diffCn);
      } else if (minuendIsScalar && subtrahendIsScalar) {
        diffDataset.squareDiffSumTextOutput.push(diffSquareDiffSum);
        diffDataset.NSumTextOutput.push(diffNSum);
        diffDataset.obsModelDiffSumTextOutput.push(diffObsModelDiffSum);
        diffDataset.modelSumTextOutput.push(diffModelSum);
        diffDataset.obsSumTextOutput.push(diffObsSum);
        diffDataset.absSumTextOutput.push(diffAbsSum);
      }
      diffDataset.minDateTextOutput.push(diffMinDate);
      diffDataset.maxDateTextOutput.push(diffMaxDate);
    }
  }

  // trim empty points at the bottom of the plot
  let dataLength = diffDataset.y.length;
  for (let diffDataYIndex = 0; diffDataYIndex < dataLength; diffDataYIndex += 1) {
    // always check the 0-index, if points were previously removed something new will become 0-index.
    if (
      !diffDataset.z[0].some(function (m) {
        return m !== null;
      })
    ) {
      diffDataset.y.splice(0, 1);
      diffDataset.z.splice(0, 1);
      diffDataset.stdev.splice(0, 1);
      diffDataset.n.splice(0, 1);
    } else {
      break;
    }
  }

  // trim empty points at the end of the curve
  dataLength = diffDataset.y.length;
  for (let diffDataYIndex = dataLength - 1; diffDataYIndex >= 0; diffDataYIndex -= 1) {
    // always check the 0-index, if points were previously removed something new will become 0-index.
    if (
      !diffDataset.z[diffDataYIndex].some(function (m) {
        return m !== null;
      })
    ) {
      diffDataset.y.splice(diffDataYIndex, 1);
      diffDataset.z.splice(diffDataYIndex, 1);
      diffDataset.stdev.splice(diffDataYIndex, 1);
      diffDataset.n.splice(diffDataYIndex, 1);
    } else {
      break;
    }
  }

  // calculate statistics
  const filteredx = diffDataset.x.filter((x) => x);
  const filteredy = diffDataset.y.filter((y) => y);
  const filteredz = diffDataset.zTextOutput.filter((z) => z);
  diffDataset.xmin = Math.min(...filteredx);
  if (
    !Number.isFinite(diffDataset.xmin) ||
    (diffDataset.x.indexOf(0) !== -1 && diffDataset.xmin > 0)
  ) {
    diffDataset.xmin = 0;
  }
  diffDataset.xmax = Math.max(...filteredx);
  if (
    !Number.isFinite(diffDataset.xmax) ||
    (diffDataset.x.indexOf(0) !== -1 && diffDataset.xmax < 0)
  ) {
    diffDataset.xmax = 0;
  }
  diffDataset.ymin = Math.min(...filteredy);
  if (
    !Number.isFinite(diffDataset.ymin) ||
    (diffDataset.y.indexOf(0) !== -1 && diffDataset.ymin > 0)
  ) {
    diffDataset.ymin = 0;
  }
  diffDataset.ymax = Math.max(...filteredy);
  if (
    !Number.isFinite(diffDataset.ymax) ||
    (diffDataset.y.indexOf(0) !== -1 && diffDataset.ymax < 0)
  ) {
    diffDataset.ymax = 0;
  }
  diffDataset.zmin = Math.min(...filteredz);
  if (
    !Number.isFinite(diffDataset.zmin) ||
    (diffDataset.z.indexOf(0) !== -1 && diffDataset.zmin > 0)
  ) {
    diffDataset.zmin = 0;
  }
  diffDataset.zmax = Math.max(...filteredz);
  if (
    !Number.isFinite(diffDataset.zmax) ||
    (diffDataset.z.indexOf(0) !== -1 && diffDataset.zmax < 0)
  ) {
    diffDataset.zmax = 0;
  }

  const filteredMinDate = diffDataset.minDateTextOutput.filter((t) => t);
  const filteredMaxDate = diffDataset.maxDateTextOutput.filter((t) => t);
  diffDataset.glob_stats.mean = diffDataset.sum / nPoints;
  diffDataset.glob_stats.minDate = Math.min(...filteredMinDate);
  diffDataset.glob_stats.maxDate = Math.max(...filteredMaxDate);
  diffDataset.glob_stats.n = nPoints;
  diffDataset.annotation =
    diffDataset.glob_stats.mean === undefined
      ? `${diffDataset.label}- mean = NaN`
      : `${diffDataset.label}- mean = ${diffDataset.glob_stats.mean.toPrecision(4)}`;

  // make contours symmetrical around 0
  diffDataset.autocontour = false;
  diffDataset.ncontours = 15;
  diffDataset.colorbar = dataset[0].colorbar;
  diffDataset.colorbar.title =
    dataset[0].colorbar.title === dataset[1].colorbar.title
      ? dataset[0].colorbar.title
      : `${dataset[1].colorbar.title} - ${dataset[0].colorbar.title}`;
  diffDataset.colorscale = dataset[0].colorscale;
  diffDataset.reversescale = dataset[0].reversescale;
  diffDataset.connectgaps = dataset[0].connectgaps;
  diffDataset.contours = dataset[0].contours;
  const maxZ =
    Math.abs(diffDataset.zmax) > Math.abs(diffDataset.zmin)
      ? Math.abs(diffDataset.zmax)
      : Math.abs(diffDataset.zmin);
  diffDataset.contours.start = -1 * maxZ + (2 * maxZ) / 16;
  diffDataset.contours.end = maxZ - (2 * maxZ) / 16;
  diffDataset.contours.size = (2 * maxZ) / 16;

  return [diffDataset];
};

// eslint-disable-next-line no-undef
export default matsDataDiffUtils = {
  getDataForDiffCurve,
  getDataForDiffContour,
};
