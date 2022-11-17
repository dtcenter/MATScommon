/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsTypes} from 'meteor/randyp:mats-common';
import {matsCollections} from 'meteor/randyp:mats-common';
import {matsPlotUtils} from 'meteor/randyp:mats-common';

var duplicate = function (param) {
    var obj = {};
    var keys = Object.keys(param);
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] !== "_id") {
            obj[keys[i]] = param[keys[i]];
        }
    }
    return obj;
};

var filterParams = function (params) {
    /*
    If the plottype is a 2d scatter plot we need to basically create a new set of parameters (except for the label)
    for each axis. The double set of parameters will get sent back to the backend.
     */
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
        var xparams = [];
        var yparams = [];
        var newParams = [];
        for (var i = 0; i < params.length; i++) {
            var xp = duplicate(params[i]);
            xp.name = "xaxis-" + params[i].name;
            xp.hidden = true;
            xparams.push(xp);
            var yp = duplicate(params[i]);
            yp.name = "yaxis-" + params[i].name;
            yp.hidden = true;
            yparams.push(yp);
        }
        newParams = newParams.concat(params);
        newParams = newParams.concat(xparams);
        newParams = newParams.concat(yparams);
        return newParams;
    } else {
        return params;
    }
};

const getParams = function (num) {
    var paramNames = matsCollections.CurveParamsInfo.find({"curve_params": {"$exists": true}}).fetch()[0]["curve_params"];
    var paramMap = {};
    var params = [];
    var param;
    for (var i = 0; i < paramNames.length; i++) {
        param = matsCollections[paramNames[i]].find({}).fetch()[0];
        if (param.displayGroup === num) {
            paramMap[param.displayOrder] = param;
        }
    }
    const displayOrders = Object.keys(paramMap).sort(function (a, b) {
        return a - b
    });
    for (var dor = 0; dor < displayOrders.length; dor++) {
        params.push(paramMap[displayOrders[dor]]);
    }
    params = filterParams(params);
    return params;
}

Template.curveParamGroup.helpers({
    CurveParams: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
        return getParams(num);
    },
    gapAbove: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
        const params = getParams(num);
        for (var i = 0; i < params.length; i++) {
            if (params[i].gapAbove) {
                return "margin-top: 1em; border-top: 2px solid gray;";
            }
        }
        return "";
    },
    gapMessage: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
        let plotType = Session.get('plotType');
        const params = getParams(num);
        for (var i = 0; i < params.length; i++) {
            if (params[i].gapAbove) {
                if (params[i].name === "aggregation-method") {
                    switch (plotType) {
                        case matsTypes.PlotTypes.profile:
                        case matsTypes.PlotTypes.dieoff:
                        case matsTypes.PlotTypes.threshold:
                        case matsTypes.PlotTypes.validtime:
                        case matsTypes.PlotTypes.gridscale:
                        case matsTypes.PlotTypes.roc:
                        case matsTypes.PlotTypes.performanceDiagram:
                        case matsTypes.PlotTypes.histogram:
                        case matsTypes.PlotTypes.ensembleHistogram:
                        case matsTypes.PlotTypes.simpleScatter:
                            return "Aggregation / Date range:";
                        case matsTypes.PlotTypes.timeSeries:
                        case matsTypes.PlotTypes.dailyModelCycle:
                        case matsTypes.PlotTypes.yearToYear:
                        case matsTypes.PlotTypes.reliability:
                        case matsTypes.PlotTypes.map:
                        case matsTypes.PlotTypes.contour:
                        case matsTypes.PlotTypes.contourDiff:
                        case matsTypes.PlotTypes.scatter2d:
                        default:
                            return "Aggregation:";
                    }
                } else {
                    return "Filter by parameters:";
                }
            } else if (params[i].name === "label") {
                return "Define the curve:";
            }
        }
        return "";
    },
    gapMessageSpacing: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
        const params = getParams(num);
        for (var i = 0; i < params.length; i++) {
            if (params[i].gapAbove) {
                return "margin-left: 10px; margin-top: 1em;";
            }
        }
        return "margin-left: 10px;";
    },
    gapBelow: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
        const params = getParams(num);
        for (var i = 0; i < params.length; i++) {
            if (params[i].gapBelow) {
                return "margin-bottom: 2em;";
            }
        }
        return "";
    },
    displayGroup: function () {
        return "block";
    },
    log: function () {
        console.log(this);
    }
});