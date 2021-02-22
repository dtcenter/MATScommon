/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes } from 'meteor/randyp:mats-common';
 import { matsCollections } from 'meteor/randyp:mats-common';
import { matsPlotUtils } from 'meteor/randyp:mats-common';

var duplicate = function(param) {
    var obj = {};
    var keys = Object.keys(param);
    for (var i=0; i<keys.length;i++){
        if (keys[i] !== "_id") {
            obj[keys[i]] = param[keys[i]];
        }
    }
    return obj;
};

var filterParams = function(params) {
/*
If the plottype is a 2d scatter plot we need to basically create a new set of parameters (except for the label)
for each axis. The double set of parameters will get sent back to the backend.
 */
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
        var xparams = [];
        var yparams = [];
        var newParams = [];
        for (var i = 0; i < params.length;i++) {
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

Template.curveParamGroup.helpers({
    CurveParams: function (num) {
        var restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
        var lastUpdate = Session.get('lastUpdate');
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
        const displayOrders = Object.keys(paramMap).sort(function(a, b){return a - b});
        for (var dor = 0; i < displayOrders.length; dor++) {
            params.push(paramMap[displayOrders[dor]]);
        }
        params = filterParams(params);
        return params;
    },
    displayGroup: function() {
        return "block";
    },
    log: function() {
        console.log(this);
    }
});