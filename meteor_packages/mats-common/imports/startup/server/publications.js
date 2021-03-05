/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from 'meteor/meteor';
import {matsCollections} from 'meteor/randyp:mats-common';

const _publishField = function(field) {
    Meteor.publish(field, function () {
        var data = matsCollections[field].find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
}

if (Meteor.isServer) {
    const params = Meteor.settings.public.curve_params;
    var currParam;
    for (var i = 0; i < params.length; i++) {
        currParam = params[i];
        _publishField(currParam);
    }
    Meteor.publish("CurveParamsInfo", function () {
        var data = matsCollections.CurveParamsInfo.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("CurveTextPatterns", function () {
        var data = matsCollections.CurveTextPatterns.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("ScatterAxisTextPattern", function () {
        var data = matsCollections.ScatterAxisTextPattern.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("SavedCurveParams", function () {
        var data = matsCollections.SavedCurveParams.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("PlotParams", function () {
        var data = matsCollections.PlotParams.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("Scatter2dParams", function () {
        var data = matsCollections.Scatter2dParams.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("PlotGraphFunctions", function () {
        var data = matsCollections.PlotGraphFunctions.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("ColorScheme", function () {
        var data = matsCollections.ColorScheme.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("Settings", function () {
        var data = matsCollections.Settings.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("CurveSettings", function () {
        var data = matsCollections.CurveSettings.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("SentAddresses", function () {
        var data = matsCollections.SentAddresses.find({userId: this.userId});
        if (data) {
            return data;
        }
        return this.ready();
    });
// do not publish roles
// Meteor.publish("Roles", function () {
//     var data = matsCollections.Roles.find({});
//     if (data) {
//         return data;
//     }
//     return this.ready();
// });

// do not publish Authorization
// Meteor.publish("Authorization", function () {
//     var data = matsCollections.Authorization.find({});
//     if (data) {
//         return data;
//     }
//     return this.ready();
// });

// do not publish credentials
// Meteor.publish("Credentials", function () {
//     var data = matsCollections.Credentials.find({});
//     if (data) {
//         return data;
//     }
//     return this.ready();
// });

//do not publish databases
// Meteor.publish("Databases", function () {
//     var data = matsCollections.Databases.find({});
//     if (data) {
//         return data;
//     }
//     return this.ready();
// });
    Meteor.publish("SiteMap", function () {
        var data = matsCollections.SiteMap.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("StationMap", function () {
        var data = matsCollections.StationMap.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
    Meteor.publish("appName", function () {
        var data = matsCollections.appName.find({});
        if (data) {
            return data;
        }
        return this.ready();
    });
}