/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsDataUtils} from 'meteor/randyp:mats-common';
import {matsTypes} from 'meteor/randyp:mats-common';

// function for removing unmatched data from a dataset containing multiple curves
const getMatchedDataSet = function (dataset, curveInfoParams, appParams, binStats) {

    var subSecsRaw = [];
    var subLevsRaw = [];
    var subValues = [];
    var subSecs = [];
    var subLevs = [];
    var subHit = [];
    var subFa = [];
    var subMiss = [];
    var subCn = [];
    var newSubSecs = [];
    var newSubLevs = [];
    var newSubHit = [];
    var newSubFa = [];
    var newSubMiss = [];
    var newSubCn = [];
    var newSubValues = [];
    var newCurveData = {};
    var independentVarGroups = [];
    var independentVarHasPoint = [];
    var subIntersections = [];
    var subSecIntersection = [];
    var currIndependentVar;
    var tempSubIntersections;
    var tempPair;
    var curveIndex;
    var data;
    var di;
    var fi;
    var si;

    const plotType = appParams.plotType;
    const hasLevels = appParams.hasLevels;
    const curvesLength = curveInfoParams.curvesLength;
    const isCTC = curveInfoParams.statType === 'ctc' && plotType !== matsTypes.PlotTypes.histogram;
    const curveStats = curveInfoParams.curves.map(a => a.statistic);
    const curveDiffs = curveInfoParams.curves.map(a => a.diffFrom);
    var removeNonMatchingIndVars;
    switch (plotType) {
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.histogram:
        case matsTypes.PlotTypes.ensembleHistogram:
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

    //determine whether data.x or data.y is the independent variable, and which is the stat value
    var independentVarName;
    var statVarName;
    if (plotType !== matsTypes.PlotTypes.profile) {
        independentVarName = 'x';
        statVarName = 'y';
    } else {
        independentVarName = 'y';
        statVarName = 'x';
    }

    // find the matching independentVars shared across all curves
    for (curveIndex = 0; curveIndex < curvesLength; curveIndex++) { // every curve
        independentVarGroups[curveIndex] = [];  // store the independentVars for each curve that are not null
        independentVarHasPoint[curveIndex] = [];   // store the *all* of the independentVars for each curve
        subSecs[curveIndex] = {};  // store the individual record times (subSecs) going into each independentVar for each curve
        if (hasLevels) {
            subLevs[curveIndex] = {};  // store the individual record levels (subLevs) going into each independentVar for each curve
        }
        data = dataset[curveIndex];
        for (di = 0; di < data[independentVarName].length; di++) { // loop over every independentVar value in this curve
            currIndependentVar = data[independentVarName][di];
            if (data[statVarName][di] !== null) {
                subSecs[curveIndex][currIndependentVar] = data.subSecs[di];   // store raw secs for this independentVar value, since it's not a null point
                if (hasLevels) {
                    subLevs[curveIndex][currIndependentVar] = data.subLevs[di];   // store raw levs for this independentVar value, since it's not a null point
                }
                independentVarGroups[curveIndex].push(currIndependentVar);   // store this independentVar value, since it's not a null point
            }
            independentVarHasPoint[curveIndex].push(currIndependentVar);    // store all the independentVar values, regardless of whether they're null
        }
    }

    var matchingIndependentVars = _.intersection.apply(_, independentVarGroups);    // find all of the non-null independentVar values common across all the curves
    var matchingIndependentHasPoint = _.intersection.apply(_, independentVarHasPoint);    // find all of the independentVar values common across all the curves, regardless of whether or not they're null
    if (removeNonMatchingIndVars) {
        if (hasLevels) {
            for (fi = 0; fi < matchingIndependentVars.length; fi++) { // loop over each common non-null independentVar value
                currIndependentVar = matchingIndependentVars[fi];
                subIntersections[currIndependentVar] = [];
                var currSubIntersections = [];
                for (si = 0; si < subSecs[0][currIndependentVar].length; si++) {   // fill current intersection array with sec-lev pairs from the first curve
                    currSubIntersections.push([subSecs[0][currIndependentVar][si], subLevs[0][currIndependentVar][si]]);
                }
                for (curveIndex = 1; curveIndex < curvesLength; curveIndex++) { // loop over every curve after the first
                    tempSubIntersections = [];
                    for (si = 0; si < subSecs[curveIndex][currIndependentVar].length; si++) { // loop over every subSecs value
                        tempPair = [subSecs[curveIndex][currIndependentVar][si], subLevs[curveIndex][currIndependentVar][si]];    // create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                        if (matsDataUtils.arrayContainsSubArray(currSubIntersections, tempPair)) {   // see if the individual sec-lev pair matches a pair from the current intersection array
                            tempSubIntersections.push(tempPair);    // store matching pairs
                        }
                    }
                    currSubIntersections = tempSubIntersections;    // replace current intersection array with array of only pairs that matched from this loop through.
                }
                subIntersections[currIndependentVar] = currSubIntersections;   // store the final intersecting subSecs array for this common non-null independentVar value
            }
        } else {
            for (fi = 0; fi < matchingIndependentVars.length; fi++) { // loop over each common non-null independentVar value
                currIndependentVar = matchingIndependentVars[fi];
                var currSubSecIntersection = subSecs[0][currIndependentVar];   // fill current subSecs intersection array with subSecs from the first curve
                for (curveIndex = 1; curveIndex < curvesLength; curveIndex++) { // loop over every curve
                    currSubSecIntersection = _.intersection(currSubSecIntersection, subSecs[curveIndex][currIndependentVar]);   // keep taking the intersection of the current subSecs intersection array with each curve's subSecs array for this independentVar value
                }
                subSecIntersection[currIndependentVar] = currSubSecIntersection;   // store the final intersecting subSecs array for this common non-null independentVar value
            }
        }
    } else {
        // pull all subSecs and subLevs out of their bins, and back into one master array
        for (curveIndex = 0; curveIndex < curvesLength; curveIndex++) {
            data = dataset[curveIndex];
            subSecsRaw[curveIndex] = [];
            subSecs[curveIndex] = [];
            if (hasLevels) {
                subLevsRaw[curveIndex] = [];
                subLevs[curveIndex] = [];
            }
            for (di = 0; di < data.x.length; di++) {
                subSecsRaw[curveIndex].push(data.subSecs[di]);
                if (hasLevels) {
                    subLevsRaw[curveIndex].push(data.subLevs[di]);
                }
            }
            subSecs[curveIndex] = [].concat.apply([], subSecsRaw[curveIndex]);
            if (hasLevels) {
                subLevs[curveIndex] = [].concat.apply([], subLevsRaw[curveIndex]);
            }
        }

        if (hasLevels) {
            // determine which seconds and levels are present in all curves
            for (si = 0; si < subSecs[0].length; si++) {   // fill current intersection array with sec-lev pairs from the first curve
                subIntersections.push([subSecs[0][si], subLevs[0][si]]);
            }
            for (curveIndex = 1; curveIndex < curvesLength; curveIndex++) { // loop over every curve after the first
                tempSubIntersections = [];
                for (si = 0; si < subSecs[curveIndex].length; si++) { // loop over every subSecs value
                    tempPair = [subSecs[curveIndex][si], subLevs[curveIndex][si]];    // create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                    if (matsDataUtils.arrayContainsSubArray(subIntersections, tempPair)) {   // see if the individual sec-lev pair matches a pair from the current intersection array
                        tempSubIntersections.push(tempPair);    // store matching pairs
                    }
                }
                subIntersections = tempSubIntersections;    //replace current intersection array with array of only pairs that matched from this loop through.
            }
        } else {
            // determine which seconds are present in all curves
            subSecIntersection = subSecs[0];   // fill current subSecs intersection array with subSecs from the first curve
            for (curveIndex = 1; curveIndex < curvesLength; curveIndex++) { // loop over every curve
                subSecIntersection = _.intersection(subSecIntersection, subSecs[curveIndex]);   // keep taking the intersection of the current subSecs intersection array with each curve's subSecs array
            }
        }
    }

    // remove non-matching independentVars and subSecs
    for (curveIndex = 0; curveIndex < curvesLength; curveIndex++) { // loop over every curve
        data = dataset[curveIndex];

        // need to loop backwards through the data array so that we can splice non-matching indices
        // while still having the remaining indices in the correct order
        var dataLength = data[independentVarName].length;
        for (di = dataLength - 1; di >= 0; di--) {
            if (removeNonMatchingIndVars) {
                if (matchingIndependentVars.indexOf(data[independentVarName][di]) === -1) {  // if this is not a common non-null independentVar value, we'll have to remove some data
                    if (matchingIndependentHasPoint.indexOf(data[independentVarName][di]) === -1) {   // if at least one curve doesn't even have a null here, much less a matching value (beacause of the cadence), just drop this independentVar
                        data.x.splice(di, 1);
                        data.y.splice(di, 1);
                        if (data[('error_' + statVarName)].array !== undefined) {
                            data[('error_' + statVarName)].array.splice(di, 1);
                        }
                        if (isCTC) {
                            data.subHit.splice(di, 1);
                            data.subFa.splice(di, 1);
                            data.subMiss.splice(di, 1);
                            data.subCn.splice(di, 1);
                        } else {
                            data.subVals.splice(di, 1);
                        }
                        data.subSecs.splice(di, 1);
                        if (hasLevels) {
                            data.subLevs.splice(di, 1);
                        }
                        data.stats.splice(di, 1);
                        data.text.splice(di, 1);
                    } else {    // if all of the curves have either data or nulls at this independentVar, and there is at least one null, ensure all of the curves are null
                        data[statVarName][di] = null;
                        if (isCTC) {
                            data.subHit[di] = NaN;
                            data.subFa[di] = NaN;
                            data.subMiss[di] = NaN;
                            data.subCn[di] = NaN;
                        } else {
                            data.subVals[di] = NaN;
                        }
                        data.subSecs[di] = NaN;
                        if (hasLevels) {
                            data.subLevs[di] = NaN;
                        }
                    }
                    continue;   // then move on to the next independentVar. There's no need to mess with the subSecs or subLevs
                }
            }
            subSecs = data.subSecs[di];
            if (isCTC) {
                subHit = data.subHit[di];
                subFa = data.subFa[di];
                subMiss = data.subMiss[di];
                subCn = data.subCn[di];
            } else {
                subValues = data.subVals[di];
            }
            if (hasLevels) {
                subLevs = data.subLevs[di];
            }

            if ((!hasLevels && subSecs.length > 0) || (hasLevels && subSecs.length > 0 && subLevs.length > 0)) {
                currIndependentVar = data[independentVarName][di];
                newSubHit = [];
                newSubFa = [];
                newSubMiss = [];
                newSubCn = [];
                newSubValues = [];
                newSubSecs = [];
                if (hasLevels) {
                    newSubLevs = [];
                }
                for (si = 0; si < subSecs.length; si++) {  // loop over all subSecs for this independentVar
                    if (hasLevels) {
                        tempPair = [subSecs[si], subLevs[si]]; //create sec-lev pair for each sub value
                    }
                    if ((!removeNonMatchingIndVars && ((!hasLevels && subSecIntersection.indexOf(subSecs[si]) !== -1) || (hasLevels && matsDataUtils.arrayContainsSubArray(subIntersections, tempPair))))
                        || (removeNonMatchingIndVars && ((!hasLevels && subSecIntersection[currIndependentVar].indexOf(subSecs[si]) !== -1) || (hasLevels && matsDataUtils.arrayContainsSubArray(subIntersections[currIndependentVar], tempPair))))) { // keep the subValue only if its associated subSec/subLev is common to all curves for this independentVar
                        if (isCTC) {
                            var newHit = subHit[si];
                            var newFa = subFa[si];
                            var newMiss = subMiss[si];
                            var newCn = subCn[si];
                        } else {
                            var newVal = subValues[si];
                        }
                        var newSec = subSecs[si];
                        if (hasLevels) {
                            var newLev = subLevs[si];
                        }
                        if (isCTC) {
                            if (newHit !== undefined) {
                                newSubHit.push(newHit);
                                newSubFa.push(newFa);
                                newSubMiss.push(newMiss);
                                newSubCn.push(newCn);
                                newSubSecs.push(newSec);
                                if (hasLevels) {
                                    newSubLevs.push(newLev);
                                }
                            }
                        } else {
                            if (newVal !== undefined) {
                                newSubValues.push(newVal);
                                newSubSecs.push(newSec);
                                if (hasLevels) {
                                    newSubLevs.push(newLev);
                                }
                            }
                        }
                    }
                }
                if (!removeNonMatchingIndVars && newSubSecs.length === 0) {
                    data.x.splice(di, 1);
                    data.y.splice(di, 1);
                    if (plotType === matsTypes.PlotTypes.performanceDiagram) {
                        data.oy_all.splice(di, 1);
                        data.on_all.splice(di, 1);
                    }
                    data.y.splice(di, 1);
                    if (data[('error_' + statVarName)].array !== undefined) {
                        data[('error_' + statVarName)].array.splice(di, 1);
                    }
                    if (isCTC) {
                        data.subHit.splice(di, 1);
                        data.subFa.splice(di, 1);
                        data.subMiss.splice(di, 1);
                        data.subCn.splice(di, 1);
                    } else {
                        data.subVals.splice(di, 1);
                    }
                    data.subSecs.splice(di, 1);
                    if (hasLevels) {
                        data.subLevs.splice(di, 1);
                    }
                    data.stats.splice(di, 1);
                    data.text.splice(di, 1);
                } else {
                    // store the filtered data
                    data.subHit[di] = newSubHit;
                    data.subFa[di] = newSubFa;
                    data.subMiss[di] = newSubMiss;
                    data.subCn[di] = newSubCn;
                    data.subVals[di] = newSubValues;
                    data.subSecs[di] = newSubSecs;
                    if (hasLevels) {
                        data.subLevs[di] = newSubLevs;
                    }
                }
            }
        }

        if (isCTC && (curveDiffs[curveIndex] === undefined || curveDiffs[curveIndex] === null)) {
            // need to recalculate the primary statistic with the newly matched hits, false alarms, etc.
            dataLength = data[independentVarName].length;
            for (di = 0; di < dataLength; di++) {
                if (data.subHit[di] instanceof Array) {
                    const hit = data.subHit[di].reduce(function (sum, value) {
                        return value == null ? sum : sum + value;
                    }, 0);
                    const fa = data.subFa[di].reduce(function (sum, value) {
                        return value == null ? sum : sum + value;
                    }, 0);
                    const miss = data.subMiss[di].reduce(function (sum, value) {
                        return value == null ? sum : sum + value;
                    }, 0);
                    const cn = data.subCn[di].reduce(function (sum, value) {
                        return value == null ? sum : sum + value;
                    }, 0);
                    if (plotType === matsTypes.PlotTypes.performanceDiagram) {
                        data['x'][di] = 1 - Number(matsDataUtils.calculateStatCTC(hit, fa, miss, cn, 'FAR (False Alarm Ratio)')) / 100;
                        data['y'][di] = Number(matsDataUtils.calculateStatCTC(hit, fa, miss, cn, 'PODy (POD of value < threshold)')) / 100;
                        data['oy_all'][di] = Number(matsDataUtils.calculateStatCTC(hit, fa, miss, cn, 'All observed yes'));
                        data['on_all'][di] = Number(matsDataUtils.calculateStatCTC(hit, fa, miss, cn, 'All observed no'));
                    } else {
                        data[statVarName][di] = matsDataUtils.calculateStatCTC(hit, fa, miss, cn, curveStats[curveIndex]);
                    }
                }
            }
        } else if (plotType === matsTypes.PlotTypes.histogram) {
            var d = {// relevant fields to recalculate
                x: [],
                y: [],
                subVals: [],
                subSecs: [],
                subLevs: [],
                glob_stats: {},
                bin_stats: [],
                text: [],
                xmin: Number.MAX_VALUE,
                xmax: Number.MIN_VALUE,
                ymin: Number.MAX_VALUE,
                ymax: Number.MIN_VALUE
            };
            if (data.x.length > 0) {
                // need to recalculate bins and stats
                var curveSubVals = [].concat.apply([], data.subVals);
                var curveSubSecs = [].concat.apply([], data.subSecs);
                var curveSubLevs;
                if (hasLevels) {
                    curveSubLevs = [].concat.apply([], data.subLevs);
                } else {
                    curveSubLevs = [];
                }
                var sortedData = matsDataUtils.sortHistogramBins(curveSubVals, curveSubSecs, curveSubLevs, data.x.length, binStats, appParams, d);
                newCurveData = sortedData.d;
            } else {
                // if there are no matching values, set data to an empty dataset
                newCurveData = d;
            }
            var newCurveDataKeys = Object.keys(newCurveData);
            for (var didx = 0; didx < newCurveDataKeys.length; didx++) {
                dataset[curveIndex][newCurveDataKeys[didx]] = newCurveData[newCurveDataKeys[didx]];
            }
        }
        dataset[curveIndex] = data;
    }

    return dataset;
};

export default matsDataMatchUtils = {

    getMatchedDataSet: getMatchedDataSet

}