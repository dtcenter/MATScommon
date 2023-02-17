/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from 'meteor/meteor';
import matsCollections from 'meteor/randyp:mats-common';
if (Meteor.isClient) {
    const params = Meteor.settings.public.curve_params;
    for (var i = 0; i < params.length; i++) {
        Meteor.subscribe(params[i]);
    }
    Meteor.subscribe("Scatter2dParams");
    Meteor.subscribe("CurveParamsInfo");
    Meteor.subscribe("AppsToScore");
    Meteor.subscribe("SavedCurveParams");
    Meteor.subscribe("PlotParams");
    Meteor.subscribe("PlotGraphFunctions");
    Meteor.subscribe("ColorScheme");
    Meteor.subscribe("Settings");
    Meteor.subscribe("CurveSettings");
    Meteor.subscribe("SentAddresses");
    Meteor.subscribe("Roles");
    Meteor.subscribe("Authorization");
    Meteor.subscribe("Credentials");
    Meteor.subscribe("Databases");
    Meteor.subscribe("CurveTextPatterns");
    Meteor.subscribe("ScatterAxisTextPattern");
    Meteor.subscribe("RangePerDescriptor");
    Meteor.subscribe("SiteMap");
    Meteor.subscribe("StationMap");
    Meteor.subscribe("LayoutStoreCollection");
    Meteor.subscribe("ScorecardSettingsCollection");
    Meteor.subscribe("Scorecard");
    Session.set('Curves', []);
    Session.set('PlotParams', []);

    Accounts.ui.config({
        requestOfflineToken: {
            google: true
        }
    });

    const ref = location.href;
    const pathArray = location.href.split('/');
    const protocol = pathArray[0];
    const hostport = pathArray[2];
    const hostName = hostport.split(':')[0];
    const app = pathArray[3] == "" ? "/" : pathArray[3];
    const matsRef = protocol + "//" + hostport;
    const helpRef = ref.endsWith('/') ? ref + "packages/randyp_mats-common/public/help" : ref + "/packages/randyp_mats-common/public/help";
    Session.set("app", {appName: app, matsref: matsRef, appref: ref, helpref: helpRef, hostName: hostName});
    var collections = Object.keys(matsCollections).map(key => matsCollections[key]);
    Session.set("Mongol", {
        'collections': collections,
        'display': false,
        'opacity_normal': ".7",
        'opacity_expand': ".9",
        'disable_warning': true
    });
}