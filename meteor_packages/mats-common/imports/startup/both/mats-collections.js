/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/**
 * Created by pierce on 8/31/16.
 */
import { Mongo } from 'meteor/mongo';
import {Meteor} from "meteor/meteor";

const params = Meteor.settings.public.curve_params;
var paramCollections = {};
var currParam;
for (var i = 0; i < params.length; i++) {
    currParam = params[i];
    paramCollections[currParam] = new Mongo.Collection(currParam);
}

var CurveParamsInfo = new Mongo.Collection("CurveParamsInfo");
var Scatter2dParams = new Mongo.Collection("Scatter2dParams");
var CurveTextPatterns = new Mongo.Collection("CurveTextPatterns");
var ScatterAxisTextPattern = new Mongo.Collection("ScatterAxisTextPattern");
var SavedCurveParams = new Mongo.Collection("SavedCurveParams");
var PlotParams = new Mongo.Collection("PlotParams");
var SavedPlotParams = new Mongo.Collection("SavedPlotParams");
var PlotGraphFunctions = new Mongo.Collection("PlotGraphFunctions");
var SavedPlotGraphFunctions = new Mongo.Collection("SavedPlotGraphFunctions");
var CurveSettings = new Mongo.Collection("CurveSettings");
var Settings = new Mongo.Collection("Settings");
var ColorScheme = new Mongo.Collection("ColorScheme");
var SentAddresses = new Mongo.Collection("SentAddresses");
var Authorization = new Mongo.Collection("Authorization");
var Roles = new Mongo.Collection("Roles");
var SavedRoles = new Mongo.Collection("SavedRoles");
var Databases = new Mongo.Collection("Databases");
var SavedDatabases = new Mongo.Collection("SavedDatabases");
var Credentials = new Mongo.Collection("Credentials");
var SavedCredentials = new Mongo.Collection("SavedCredentials");
var SiteMap = new Mongo.Collection("SiteMap");
var StationMap = new Mongo.Collection("StationMap");
var appName = new Mongo.Collection("appName");

const explicitCollections = {
    CurveParamsInfo:CurveParamsInfo,
    Scatter2dParams:Scatter2dParams,
    CurveTextPatterns:CurveTextPatterns,
    ScatterAxisTextPattern:ScatterAxisTextPattern,
    SavedCurveParams:SavedCurveParams,
    PlotParams:PlotParams,
    SavedPlotParams:SavedPlotParams,
    PlotGraphFunctions:PlotGraphFunctions,
    SavedPlotGraphFunctions:SavedPlotGraphFunctions,
    CurveSettings:CurveSettings,
    Settings:Settings,
    ColorScheme:ColorScheme,
    SentAddresses:SentAddresses,
    Authorization:Authorization,
    Roles:Roles,
    SavedRoles:SavedRoles,
    Databases:Databases,
    SavedDatabases:SavedDatabases,
    Credentials:Credentials,
    SavedCredentials:SavedCredentials,
    SiteMap:SiteMap,
    StationMap:StationMap,
    appName:appName
};

export default matsCollections = {
    ...paramCollections,
    ...explicitCollections
};