/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsDataUtils, matsTypes } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

// function for removing unmatched data from a dataset containing multiple curves
const getMatchedDataSet = function (dataset, curveInfoParams, appParams, binStats) {
  const subSecsRaw = [];
  const subLevsRaw = [];
  let subValues = [];
  let subValuesX = [];
  let subValuesY = [];
  let subSecs = [];
  let subLevs = [];
  let subHit = [];
  let subFa = [];
  let subMiss = [];
  let subCn = [];
  let subSquareDiffSum = [];
  let subNSum = [];
  let subObsModelDiffSum = [];
  let subModelSum = [];
  let subObsSum = [];
  let subAbsSum = [];
  let subSquareDiffSumX = [];
  let subNSumX = [];
  let subObsModelDiffSumX = [];
  let subModelSumX = [];
  let subObsSumX = [];
  let subAbsSumX = [];
  let subSquareDiffSumY = [];
  let subNSumY = [];
  let subObsModelDiffSumY = [];
  let subModelSumY = [];
  let subObsSumY = [];
  let subAbsSumY = [];
  let subRelCount = [];
  let subRelRawCount = [];
  let subRelHit = [];
  let newSubSecs = [];
  let newSubLevs = [];
  let newSubHit = [];
  let newSubFa = [];
  let newSubMiss = [];
  let newSubCn = [];
  let newSubSquareDiffSum = [];
  let newSubNSum = [];
  let newSubObsModelDiffSum = [];
  let newSubModelSum = [];
  let newSubObsSum = [];
  let newSubAbsSum = [];
  let newSubValues = [];
  let newSubSquareDiffSumX = [];
  let newSubNSumX = [];
  let newSubObsModelDiffSumX = [];
  let newSubModelSumX = [];
  let newSubObsSumX = [];
  let newSubAbsSumX = [];
  let newSubValuesX = [];
  let newSubSquareDiffSumY = [];
  let newSubNSumY = [];
  let newSubObsModelDiffSumY = [];
  let newSubModelSumY = [];
  let newSubObsSumY = [];
  let newSubAbsSumY = [];
  let newSubValuesY = [];
  let newSubRelCount = [];
  let newSubRelRawCount = [];
  let newSubRelHit = [];
  let newCurveData = {};
  const independentVarGroups = [];
  const independentVarHasPoint = [];
  let subIntersections = [];
  let subSecIntersection = [];
  let currIndependentVar;
  let tempSubIntersections;
  let tempPair;
  let curveIndex;
  let data;
  let di;
  let fi;
  let si;

  const returnDataset = dataset;
  const { plotType } = appParams;
  const { hasLevels } = appParams;
  const { curvesLength } = curveInfoParams;
  const isCTC =
    !Array.isArray(curveInfoParams.statType) &&
    curveInfoParams.statType === "ctc" &&
    plotType !== matsTypes.PlotTypes.histogram;
  const isScalar =
    !Array.isArray(curveInfoParams.statType) &&
    curveInfoParams.statType === "scalar" &&
    plotType !== matsTypes.PlotTypes.histogram;
  const isSimpleScatter = plotType === matsTypes.PlotTypes.simpleScatter;
  const isReliability = plotType === matsTypes.PlotTypes.reliability;
  let curveXStats;
  let curveXVars;
  let curveYStats;
  let curveYVars;
  let curveStats;
  let curveVars;
  if (isSimpleScatter) {
    curveXStats = curveInfoParams.curves.map((a) => a["x-statistic"]);
    curveXVars = curveInfoParams.curves.map((a) => a["x-variable"]);
    curveYStats = curveInfoParams.curves.map((a) => a["y-statistic"]);
    curveYVars = curveInfoParams.curves.map((a) => a["y-variable"]);
  } else {
    curveStats = curveInfoParams.curves.map((a) => a.statistic);
    curveVars = isScalar ? curveInfoParams.curves.map((a) => a.variable) : [];
  }
  const curveDiffs = curveInfoParams.curves.map((a) => a.diffFrom);
  let removeNonMatchingIndVars;
  switch (plotType) {
    case matsTypes.PlotTypes.reliability:
    case matsTypes.PlotTypes.roc:
    case matsTypes.PlotTypes.performanceDiagram:
    case matsTypes.PlotTypes.histogram:
    case matsTypes.PlotTypes.ensembleHistogram:
    case matsTypes.PlotTypes.simpleScatter:
    case matsTypes.PlotTypes.map:
      removeNonMatchingIndVars = false;
      break;
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.profile:
    case matsTypes.PlotTypes.dieoff:
    case matsTypes.PlotTypes.threshold:
    case matsTypes.PlotTypes.validtime:
    case matsTypes.PlotTypes.gridscale:
    case matsTypes.PlotTypes.dailyModelCycle:
    case matsTypes.PlotTypes.gridscaleProb:
    case matsTypes.PlotTypes.yearToYear:
    case matsTypes.PlotTypes.scatter2d:
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
    default:
      removeNonMatchingIndVars = true;
      break;
  }

  // matching in this function is based on a curve's independent variable. For a timeseries, the independentVar is epoch,
  // for a profile, it's level, for a dieoff, it's forecast hour, for a threshold plot, it's threshold, and for a
  // valid time plot, it's hour of day. This function identifies the the independentVar values common across all of
  // the curves, and then the common sub times/levels/values for those independentVar values.

  // determine whether data.x or data.y is the independent variable, and which is the stat value
  let independentVarName;
  let statVarName;
  if (plotType !== matsTypes.PlotTypes.profile) {
    independentVarName = "x";
    statVarName = "y";
  } else {
    independentVarName = "y";
    statVarName = "x";
  }

  // find the matching independentVars shared across all curves
  for (curveIndex = 0; curveIndex < curvesLength; curveIndex += 1) {
    independentVarGroups[curveIndex] = []; // array for the independentVars for each curve that are not null
    independentVarHasPoint[curveIndex] = []; // array for the *all* of the independentVars for each curve
    subSecs[curveIndex] = {}; // map of the individual record times (subSecs) going into each independentVar for each curve
    if (hasLevels) {
      subLevs[curveIndex] = {}; // map of the individual record levels (subLevs) going into each independentVar for each curve
    }
    data = returnDataset[curveIndex];
    // loop over every independentVar value in this curve
    for (di = 0; di < data[independentVarName].length; di += 1) {
      currIndependentVar = data[independentVarName][di];
      if (data[statVarName][di] !== null) {
        // store raw secs for this independentVar value, since it's not a null point
        subSecs[curveIndex][currIndependentVar] = data.subSecs[di];
        if (hasLevels) {
          // store raw levs for this independentVar value, since it's not a null point
          subLevs[curveIndex][currIndependentVar] = data.subLevs[di];
        }
        // store this independentVar value, since it's not a null point
        independentVarGroups[curveIndex].push(currIndependentVar);
      }
      // store all the independentVar values, regardless of whether they're null
      independentVarHasPoint[curveIndex].push(currIndependentVar);
    }
  }

  const matchingIndependentVars = independentVarGroups.reduce((a, b) =>
    a.filter((c) => b.includes(c))
  ); // all of the non-null independentVar values common across all the curves
  const matchingIndependentHasPoint = independentVarHasPoint.reduce((a, b) =>
    a.filter((c) => b.includes(c))
  ); // all of the independentVar values common across all the curves, regardless of whether or not they're null

  if (removeNonMatchingIndVars) {
    if (hasLevels) {
      // loop over each common non-null independentVar value
      for (fi = 0; fi < matchingIndependentVars.length; fi += 1) {
        currIndependentVar = matchingIndependentVars[fi];
        subIntersections[currIndependentVar] = [];
        let currSubIntersections = [];
        for (si = 0; si < subSecs[0][currIndependentVar].length; si += 1) {
          // fill current intersection array with sec-lev pairs from the first curve
          currSubIntersections.push([
            subSecs[0][currIndependentVar][si],
            subLevs[0][currIndependentVar][si],
          ]);
        }
        // loop over every curve after the first
        for (curveIndex = 1; curveIndex < curvesLength; curveIndex += 1) {
          tempSubIntersections = [];
          for (si = 0; si < subSecs[curveIndex][currIndependentVar].length; si += 1) {
            // create an individual sec-lev pair for each index in the subSecs and subLevs arrays
            tempPair = [
              subSecs[curveIndex][currIndependentVar][si],
              subLevs[curveIndex][currIndependentVar][si],
            ];
            // see if the individual sec-lev pair matches a pair from the current intersection array
            if (matsDataUtils.arrayContainsSubArray(currSubIntersections, tempPair)) {
              // store matching pairs
              tempSubIntersections.push(tempPair);
            }
          }
          // replace current intersection array with array of only pairs that matched from this loop through.
          currSubIntersections = tempSubIntersections;
        }
        // store the final intersecting subSecs array for this common non-null independentVar value
        subIntersections[currIndependentVar] = currSubIntersections;
      }
    } else {
      // loop over each common non-null independentVar value
      for (fi = 0; fi < matchingIndependentVars.length; fi += 1) {
        currIndependentVar = matchingIndependentVars[fi];
        // fill current subSecs intersection array with subSecs from the first curve
        let currSubSecIntersection = subSecs[0][currIndependentVar];
        // loop over every curve after the first
        for (curveIndex = 1; curveIndex < curvesLength; curveIndex += 1) {
          // keep taking the intersection of the current subSecs intersection array with each curve's subSecs array for this independentVar value
          currSubSecIntersection = _.intersection(
            currSubSecIntersection,
            subSecs[curveIndex][currIndependentVar]
          );
        }
        // store the final intersecting subSecs array for this common non-null independentVar value
        subSecIntersection[currIndependentVar] = currSubSecIntersection;
      }
    }
  } else {
    // pull all subSecs and subLevs out of their bins, and back into one main array
    for (curveIndex = 0; curveIndex < curvesLength; curveIndex += 1) {
      data = returnDataset[curveIndex];
      subSecsRaw[curveIndex] = [];
      subSecs[curveIndex] = [];
      if (hasLevels) {
        subLevsRaw[curveIndex] = [];
        subLevs[curveIndex] = [];
      }
      for (di = 0; di < data.x.length; di += 1) {
        subSecsRaw[curveIndex].push(data.subSecs[di]);
        if (hasLevels) {
          subLevsRaw[curveIndex].push(data.subLevs[di]);
        }
      }
      subSecs[curveIndex] =
        subSecsRaw[curveIndex].length > 0
          ? subSecsRaw[curveIndex].reduce(function (a, b) {
              return a.concat(b);
            })
          : [];
      if (hasLevels) {
        subLevs[curveIndex] =
          subLevsRaw[curveIndex].length > 0
            ? subLevsRaw[curveIndex].reduce(function (a, b) {
                return a.concat(b);
              })
            : [];
      }
    }

    if (hasLevels) {
      // determine which seconds and levels are present in all curves
      for (si = 0; si < subSecs[0].length; si += 1) {
        // fill current intersection array with sec-lev pairs from the first curve
        subIntersections.push([subSecs[0][si], subLevs[0][si]]);
      }
      // loop over every curve after the first
      for (curveIndex = 1; curveIndex < curvesLength; curveIndex += 1) {
        tempSubIntersections = [];
        for (si = 0; si < subSecs[curveIndex].length; si += 1) {
          // create an individual sec-lev pair for each index in the subSecs and subLevs arrays
          tempPair = [subSecs[curveIndex][si], subLevs[curveIndex][si]];
          // see if the individual sec-lev pair matches a pair from the current intersection array
          if (matsDataUtils.arrayContainsSubArray(subIntersections, tempPair)) {
            // store matching pairs
            tempSubIntersections.push(tempPair);
          }
        }
        // replace current intersection array with array of only pairs that matched from this loop through.
        subIntersections = tempSubIntersections;
      }
    } else {
      // determine which seconds are present in all curves
      // fill current subSecs intersection array with subSecs from the first curve
      [subSecIntersection] = subSecs;
      // loop over every curve after the first
      for (curveIndex = 1; curveIndex < curvesLength; curveIndex += 1) {
        // keep taking the intersection of the current subSecs intersection array with each curve's subSecs array
        subSecIntersection = _.intersection(subSecIntersection, subSecs[curveIndex]);
      }
    }
  }

  // remove non-matching independentVars and subSecs
  for (curveIndex = 0; curveIndex < curvesLength; curveIndex += 1) {
    // loop over every curve
    data = returnDataset[curveIndex];
    // need to loop backwards through the data array so that we can splice non-matching indices
    // while still having the remaining indices in the correct order
    let dataLength = data[independentVarName].length;
    for (di = dataLength - 1; di >= 0; di -= 1) {
      let processSubData = true;
      if (removeNonMatchingIndVars) {
        if (matchingIndependentVars.indexOf(data[independentVarName][di]) === -1) {
          // if this is not a common non-null independentVar value, we'll have to remove some data
          if (
            matchingIndependentHasPoint.indexOf(data[independentVarName][di]) === -1
          ) {
            // if at least one curve doesn't even have a null here, much less a matching value (because of the cadence), just drop this independentVar
            data = matsDataUtils.removePoint(
              data,
              di,
              plotType,
              statVarName,
              isCTC,
              isScalar,
              hasLevels
            );
          } else {
            // if all of the curves have either data or nulls at this independentVar, and there is at least one null, ensure all of the curves are null
            data = matsDataUtils.nullPoint(
              data,
              di,
              statVarName,
              isCTC,
              isScalar,
              hasLevels
            );
          }
          // then move on to the next independentVar. There's no need to mess with the subSecs or subLevs
          processSubData = false;
        }
      }
      if (processSubData) {
        subSecs = data.subSecs[di];
        if (isCTC) {
          subHit = data.subHit[di];
          subFa = data.subFa[di];
          subMiss = data.subMiss[di];
          subCn = data.subCn[di];
        } else if (isScalar) {
          if (isSimpleScatter) {
            subSquareDiffSumX = data.subSquareDiffSumX[di];
            subNSumX = data.subNSumX[di];
            subObsModelDiffSumX = data.subObsModelDiffSumX[di];
            subModelSumX = data.subModelSumX[di];
            subObsSumX = data.subObsSumX[di];
            subAbsSumX = data.subAbsSumX[di];
            subSquareDiffSumY = data.subSquareDiffSumY[di];
            subNSumY = data.subNSumY[di];
            subObsModelDiffSumY = data.subObsModelDiffSumY[di];
            subModelSumY = data.subModelSumY[di];
            subObsSumY = data.subObsSumY[di];
            subAbsSumY = data.subAbsSumY[di];
          } else {
            subSquareDiffSum = data.subSquareDiffSum[di];
            subNSum = data.subNSum[di];
            subObsModelDiffSum = data.subObsModelDiffSum[di];
            subModelSum = data.subModelSum[di];
            subObsSum = data.subObsSum[di];
            subAbsSum = data.subAbsSum[di];
          }
        } else if (isReliability) {
          subRelHit = data.subRelHit[di];
          subRelRawCount = data.subRelRawCount[di];
          subRelCount = data.subRelCount[di];
        }
        if (isSimpleScatter) {
          subValuesX = data.subValsX[di];
          subValuesY = data.subValsY[di];
        } else {
          subValues = data.subVals[di];
        }
        if (hasLevels) {
          subLevs = data.subLevs[di];
        }

        if (
          (!hasLevels && subSecs.length > 0) ||
          (hasLevels && subSecs.length > 0 && subLevs.length > 0)
        ) {
          currIndependentVar = data[independentVarName][di];
          newSubHit = [];
          newSubFa = [];
          newSubMiss = [];
          newSubCn = [];
          newSubSquareDiffSum = [];
          newSubNSum = [];
          newSubObsModelDiffSum = [];
          newSubModelSum = [];
          newSubObsSum = [];
          newSubAbsSum = [];
          newSubValues = [];
          newSubSquareDiffSumX = [];
          newSubNSumX = [];
          newSubObsModelDiffSumX = [];
          newSubModelSumX = [];
          newSubObsSumX = [];
          newSubAbsSumX = [];
          newSubValuesX = [];
          newSubSquareDiffSumY = [];
          newSubNSumY = [];
          newSubObsModelDiffSumY = [];
          newSubModelSumY = [];
          newSubObsSumY = [];
          newSubAbsSumY = [];
          newSubValuesY = [];
          newSubRelCount = [];
          newSubRelRawCount = [];
          newSubRelHit = [];
          newSubSecs = [];
          if (hasLevels) {
            newSubLevs = [];
          }
          // loop over all subSecs for this independentVar
          for (si = 0; si < subSecs.length; si += 1) {
            let newHit;
            let newFa;
            let newMiss;
            let newCn;
            let newSquareDiffSumX;
            let newNSumX;
            let newObsModelDiffSumX;
            let newModelSumX;
            let newObsSumX;
            let newAbsSumX;
            let newSquareDiffSumY;
            let newNSumY;
            let newObsModelDiffSumY;
            let newModelSumY;
            let newObsSumY;
            let newAbsSumY;
            let newSquareDiffSum;
            let newNSum;
            let newObsModelDiffSum;
            let newModelSum;
            let newObsSum;
            let newAbsSum;
            let newRelCount;
            let newRelRawCount;
            let newRelHit;
            let newValX;
            let newValY;
            let newVal;
            let newSec;
            let newLev;

            if (hasLevels) {
              // create sec-lev pair for each sub value
              tempPair = [subSecs[si], subLevs[si]];
            }
            // keep the subValue only if its associated subSec/subLev is common to all curves for this independentVar
            if (
              (!removeNonMatchingIndVars &&
                ((!hasLevels && subSecIntersection.indexOf(subSecs[si]) !== -1) ||
                  (hasLevels &&
                    matsDataUtils.arrayContainsSubArray(
                      subIntersections,
                      tempPair
                    )))) ||
              (removeNonMatchingIndVars &&
                ((!hasLevels &&
                  subSecIntersection[currIndependentVar].indexOf(subSecs[si]) !== -1) ||
                  (hasLevels &&
                    matsDataUtils.arrayContainsSubArray(
                      subIntersections[currIndependentVar],
                      tempPair
                    ))))
            ) {
              if (isCTC) {
                newHit = subHit[si];
                newFa = subFa[si];
                newMiss = subMiss[si];
                newCn = subCn[si];
              } else if (isScalar) {
                if (isSimpleScatter) {
                  newSquareDiffSumX = subSquareDiffSumX[si];
                  newNSumX = subNSumX[si];
                  newObsModelDiffSumX = subObsModelDiffSumX[si];
                  newModelSumX = subModelSumX[si];
                  newObsSumX = subObsSumX[si];
                  newAbsSumX = subAbsSumX[si];
                  newSquareDiffSumY = subSquareDiffSumY[si];
                  newNSumY = subNSumY[si];
                  newObsModelDiffSumY = subObsModelDiffSumY[si];
                  newModelSumY = subModelSumY[si];
                  newObsSumY = subObsSumY[si];
                  newAbsSumY = subAbsSumY[si];
                } else {
                  newSquareDiffSum = subSquareDiffSum[si];
                  newNSum = subNSum[si];
                  newObsModelDiffSum = subObsModelDiffSum[si];
                  newModelSum = subModelSum[si];
                  newObsSum = subObsSum[si];
                  newAbsSum = subAbsSum[si];
                }
              } else if (isReliability) {
                newRelCount = subRelCount[si];
                newRelRawCount = subRelRawCount[si];
                newRelHit = subRelHit[si];
              }
              if (isSimpleScatter) {
                newValX = subValuesX[si];
                newValY = subValuesY[si];
              } else {
                newVal = subValues[si];
              }
              newSec = subSecs[si];
              if (hasLevels) {
                newLev = subLevs[si];
              }
              if (isCTC) {
                if (newHit !== undefined) {
                  newSubHit.push(newHit);
                  newSubFa.push(newFa);
                  newSubMiss.push(newMiss);
                  newSubCn.push(newCn);
                  newSubValues.push(newVal);
                  newSubSecs.push(newSec);
                  if (hasLevels) {
                    newSubLevs.push(newLev);
                  }
                }
              } else if (isScalar) {
                if (isSimpleScatter) {
                  if (newSquareDiffSumX !== undefined) {
                    newSubSquareDiffSumX.push(newSquareDiffSumX);
                    newSubNSumX.push(newNSumX);
                    newSubObsModelDiffSumX.push(newObsModelDiffSumX);
                    newSubModelSumX.push(newModelSumX);
                    newSubObsSumX.push(newObsSumX);
                    newSubAbsSumX.push(newAbsSumX);
                    newSubValuesX.push(newValX);
                  }
                  if (newSquareDiffSumY !== undefined) {
                    newSubSquareDiffSumY.push(newSquareDiffSumY);
                    newSubNSumY.push(newNSumY);
                    newSubObsModelDiffSumY.push(newObsModelDiffSumY);
                    newSubModelSumY.push(newModelSumY);
                    newSubObsSumY.push(newObsSumY);
                    newSubAbsSumY.push(newAbsSumY);
                    newSubValuesY.push(newValY);
                  }
                } else if (newSquareDiffSum !== undefined) {
                  newSubSquareDiffSum.push(newSquareDiffSum);
                  newSubNSum.push(newNSum);
                  newSubObsModelDiffSum.push(newObsModelDiffSum);
                  newSubModelSum.push(newModelSum);
                  newSubObsSum.push(newObsSum);
                  newSubAbsSum.push(newAbsSum);
                  newSubValues.push(newVal);
                }
                newSubSecs.push(newSec);
                if (hasLevels) {
                  newSubLevs.push(newLev);
                }
              } else if (isReliability) {
                if (newRelHit !== undefined) {
                  newSubRelCount.push(newRelCount);
                  newSubRelRawCount.push(newRelRawCount);
                  newSubRelHit.push(newRelHit);
                  newSubValues.push(newVal);
                  newSubSecs.push(newSec);
                  if (hasLevels) {
                    newSubLevs.push(newLev);
                  }
                }
              } else if (newVal !== undefined) {
                newSubValues.push(newVal);
                newSubSecs.push(newSec);
                if (hasLevels) {
                  newSubLevs.push(newLev);
                }
              }
            }
          }
          if (newSubSecs.length === 0) {
            // no matching sub-values, so null the point
            data = matsDataUtils.nullPoint(
              data,
              di,
              statVarName,
              isCTC,
              isScalar,
              hasLevels
            );
          } else {
            // store the filtered data
            if (isCTC) {
              data.subHit[di] = newSubHit;
              data.subFa[di] = newSubFa;
              data.subMiss[di] = newSubMiss;
              data.subCn[di] = newSubCn;
            } else if (isScalar) {
              if (isSimpleScatter) {
                data.subSquareDiffSumX[di] = newSubSquareDiffSumX;
                data.subNSumX[di] = newSubNSumX;
                data.subObsModelDiffSumX[di] = newSubObsModelDiffSumX;
                data.subModelSumX[di] = newSubModelSumX;
                data.subObsSumX[di] = newSubObsSumX;
                data.subAbsSumX[di] = newSubAbsSumX;
                data.subSquareDiffSumY[di] = newSubSquareDiffSumY;
                data.subNSumY[di] = newSubNSumY;
                data.subObsModelDiffSumY[di] = newSubObsModelDiffSumY;
                data.subModelSumY[di] = newSubModelSumY;
                data.subObsSumY[di] = newSubObsSumY;
                data.subAbsSumY[di] = newSubAbsSumY;
              } else {
                data.subSquareDiffSum[di] = newSubSquareDiffSum;
                data.subNSum[di] = newSubNSum;
                data.subObsModelDiffSum[di] = newSubObsModelDiffSum;
                data.subModelSum[di] = newSubModelSum;
                data.subObsSum[di] = newSubObsSum;
                data.subAbsSum[di] = newSubAbsSum;
              }
            } else if (isReliability) {
              data.subRelCount[di] = newSubRelCount;
              data.subRelRawCount[di] = newSubRelRawCount;
              data.subRelHit[di] = newSubRelHit;
            }
            if (isSimpleScatter) {
              data.subValsX[di] = newSubValuesX;
              data.subValsY[di] = newSubValuesY;
            } else {
              data.subVals[di] = newSubValues;
            }
            data.subSecs[di] = newSubSecs;
            if (hasLevels) {
              data.subLevs[di] = newSubLevs;
            }
          }
        } else {
          // no sub-values to begin with, so null the point
          data = matsDataUtils.nullPoint(
            data,
            di,
            statVarName,
            isCTC,
            isScalar,
            hasLevels
          );
        }
      }
    }

    if (
      isCTC &&
      (curveDiffs[curveIndex] === undefined || curveDiffs[curveIndex] === null)
    ) {
      // need to recalculate the primary statistic with the newly matched hits, false alarms, etc.
      dataLength = data[independentVarName].length;
      for (di = 0; di < dataLength; di += 1) {
        if (data.subHit[di] instanceof Array) {
          const hit = matsDataUtils.sum(data.subHit[di]);
          const fa = matsDataUtils.sum(data.subFa[di]);
          const miss = matsDataUtils.sum(data.subMiss[di]);
          const cn = matsDataUtils.sum(data.subCn[di]);
          if (plotType === matsTypes.PlotTypes.performanceDiagram) {
            data.x[di] =
              1 -
              Number(
                matsDataUtils.calculateStatCTC(
                  hit,
                  fa,
                  miss,
                  cn,
                  data.subHit[di].length,
                  "FAR (False Alarm Ratio)"
                )
              ) /
                100;
            data.y[di] =
              Number(
                matsDataUtils.calculateStatCTC(
                  hit,
                  fa,
                  miss,
                  cn,
                  data.subHit[di].length,
                  "PODy (POD of value < threshold)"
                )
              ) / 100;
            data.oy_all[di] = Number(
              matsDataUtils.calculateStatCTC(
                hit,
                fa,
                miss,
                cn,
                data.subHit[di].length,
                "All observed yes"
              )
            );
            data.on_all[di] = Number(
              matsDataUtils.calculateStatCTC(
                hit,
                fa,
                miss,
                cn,
                data.subHit[di].length,
                "All observed no"
              )
            );
          } else if (plotType === matsTypes.PlotTypes.roc) {
            data.x[di] =
              1 -
              Number(
                matsDataUtils.calculateStatCTC(
                  hit,
                  fa,
                  miss,
                  cn,
                  data.subHit[di].length,
                  "POFD (Probability of False Detection)"
                )
              ) /
                100;
            data.y[di] =
              Number(
                matsDataUtils.calculateStatCTC(
                  hit,
                  fa,
                  miss,
                  cn,
                  data.subHit[di].length,
                  "PODy (POD of value < threshold)"
                )
              ) / 100;
            data.oy_all[di] = Number(
              matsDataUtils.calculateStatCTC(
                hit,
                fa,
                miss,
                cn,
                data.subHit[di].length,
                "All observed yes"
              )
            );
            data.on_all[di] = Number(
              matsDataUtils.calculateStatCTC(
                hit,
                fa,
                miss,
                cn,
                data.subHit[di].length,
                "All observed no"
              )
            );
          } else {
            data[statVarName][di] = matsDataUtils.calculateStatCTC(
              hit,
              fa,
              miss,
              cn,
              data.subHit[di].length,
              curveStats[curveIndex]
            );
          }
        }
      }
    } else if (
      isScalar &&
      (curveDiffs[curveIndex] === undefined || curveDiffs[curveIndex] === null)
    ) {
      // need to recalculate the primary statistic with the newly matched partial sums.
      dataLength = data[independentVarName].length;
      for (di = 0; di < dataLength; di += 1) {
        if (plotType === matsTypes.PlotTypes.simpleScatter) {
          if (data.subSquareDiffSumX[di] instanceof Array) {
            const squareDiffSumX = matsDataUtils.sum(data.subSquareDiffSumX[di]);
            const NSumX = matsDataUtils.sum(data.subNSumX[di]);
            const obsModelDiffSumX = matsDataUtils.sum(data.subObsModelDiffSumX[di]);
            const modelSumX = matsDataUtils.sum(data.subModelSumX[di]);
            const obsSumX = matsDataUtils.sum(data.subObsSumX[di]);
            const absSumX = matsDataUtils.sum(data.subAbsSumX[di]);
            data.x[di] = matsDataUtils.calculateStatScalar(
              squareDiffSumX,
              NSumX,
              obsModelDiffSumX,
              modelSumX,
              obsSumX,
              absSumX,
              `${curveXStats[curveIndex]}_${curveXVars[curveIndex]}`
            );
            const squareDiffSumY = matsDataUtils.sum(data.subSquareDiffSumY[di]);
            const NSumY = matsDataUtils.sum(data.subNSumY[di]);
            const obsModelDiffSumY = matsDataUtils.sum(data.subObsModelDiffSumY[di]);
            const modelSumY = matsDataUtils.sum(data.subModelSumY[di]);
            const obsSumY = matsDataUtils.sum(data.subObsSumY[di]);
            const absSumY = matsDataUtils.sum(data.subAbsSumY[di]);
            data.y[di] = matsDataUtils.calculateStatScalar(
              squareDiffSumY,
              NSumY,
              obsModelDiffSumY,
              modelSumY,
              obsSumY,
              absSumY,
              `${curveYStats[curveIndex]}_${curveYVars[curveIndex]}`
            );
          }
        } else if (data.subSquareDiffSum[di] instanceof Array) {
          const squareDiffSum = matsDataUtils.sum(data.subSquareDiffSum[di]);
          const NSum = matsDataUtils.sum(data.subNSum[di]);
          const obsModelDiffSum = matsDataUtils.sum(data.subObsModelDiffSum[di]);
          const modelSum = matsDataUtils.sum(data.subModelSum[di]);
          const obsSum = matsDataUtils.sum(data.subObsSum[di]);
          const absSum = matsDataUtils.sum(data.subAbsSum[di]);
          data[statVarName][di] = matsDataUtils.calculateStatScalar(
            squareDiffSum,
            NSum,
            obsModelDiffSum,
            modelSum,
            obsSum,
            absSum,
            `${curveStats[curveIndex]}_${curveVars[curveIndex]}`
          );
        }
      }
    } else if (isReliability) {
      for (di = 0; di < dataLength; di += 1) {
        data.y[di] =
          matsDataUtils.sum(data.subRelHit[di]) /
          matsDataUtils.sum(data.subRelCount[di]);
        data.hitCount[di] = matsDataUtils.sum(data.subRelHit[di]);
        data.fcstCount[di] = matsDataUtils.sum(data.subRelCount[di]);
        data.fcstRawCount[di] = matsDataUtils.sum(data.subRelRawCount[di]);
      }
    } else if (plotType === matsTypes.PlotTypes.histogram) {
      const d = {
        // relevant fields to recalculate
        x: [],
        y: [],
        subData: [],
        subHeaders: [],
        subVals: [],
        subSecs: [],
        subLevs: [],
        glob_stats: {},
        bin_stats: [],
        text: [],
        xmin: Number.MAX_VALUE,
        xmax: Number.MIN_VALUE,
        ymin: Number.MAX_VALUE,
        ymax: Number.MIN_VALUE,
      };
      if (data.x.length > 0) {
        // need to recalculate bins and stats
        const curveSubVals =
          data.subVals.length > 0
            ? data.subVals.reduce(function (a, b) {
                return a.concat(b);
              })
            : [];
        const curveSubSecs =
          data.subSecs.length > 0
            ? data.subSecs.reduce(function (a, b) {
                return a.concat(b);
              })
            : [];
        let curveSubLevs;
        if (hasLevels) {
          curveSubLevs =
            data.subLevs.length > 0
              ? data.subLevs.reduce(function (a, b) {
                  return a.concat(b);
                })
              : [];
        } else {
          curveSubLevs = [];
        }
        const sortedData = matsDataUtils.sortHistogramBins(
          curveSubVals,
          curveSubSecs,
          curveSubLevs,
          data.x.length,
          binStats,
          appParams,
          d
        );
        newCurveData = sortedData.d;
      } else {
        // if there are no matching values, set data to an empty dataset
        newCurveData = d;
      }
      const newCurveDataKeys = Object.keys(newCurveData);
      for (let didx = 0; didx < newCurveDataKeys.length; didx += 1) {
        returnDataset[curveIndex][newCurveDataKeys[didx]] =
          newCurveData[newCurveDataKeys[didx]];
      }
    }

    if (isReliability) {
      data.sample_climo =
        matsDataUtils.sum(data.hitCount) / matsDataUtils.sum(data.fcstRawCount);
    }

    // save matched data and recalculate the max and min for this curve
    const filteredx = data.x.filter((x) => x || x === 0);
    const filteredy = data.y.filter((y) => y || y === 0);
    data.xmin = Math.min(...filteredx);
    data.xmax = Math.max(...filteredx);
    data.ymin = Math.min(...filteredy);
    data.ymax = Math.max(...filteredy);
    returnDataset[curveIndex] = data;
  }

  return returnDataset;
};

// eslint-disable-next-line no-undef
export default matsDataMatchUtils = {
  getMatchedDataSet,
};
