/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/**
 * Created by pierce on 8/31/16.
 */
import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import { curveParamsByApp } from "./mats-curve-params";

/* eslint-disable no-console */

const params = curveParamsByApp[Meteor.settings.public.app];
if (!params) {
  console.log(
    "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
  );
  throw new Meteor.Error(
    "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
  );
}
const paramCollections = {};
let currParam;
for (let i = 0; i < params.length; i += 1) {
  currParam = params[i];
  paramCollections[currParam] = new Mongo.Collection(currParam);
}

const CurveParamsInfo = new Mongo.Collection("CurveParamsInfo");
const AppsToScore = new Mongo.Collection("AppsToScore");
const Scatter2dParams = new Mongo.Collection("Scatter2dParams");
const CurveTextPatterns = new Mongo.Collection("CurveTextPatterns");
const ScatterAxisTextPattern = new Mongo.Collection("ScatterAxisTextPattern");
const SavedCurveParams = new Mongo.Collection("SavedCurveParams");
const PlotParams = new Mongo.Collection("PlotParams");
const SavedPlotParams = new Mongo.Collection("SavedPlotParams");
const PlotGraphFunctions = new Mongo.Collection("PlotGraphFunctions");
const SavedPlotGraphFunctions = new Mongo.Collection("SavedPlotGraphFunctions");
const CurveSettings = new Mongo.Collection("CurveSettings");
const Settings = new Mongo.Collection("Settings");
const ColorScheme = new Mongo.Collection("ColorScheme");
const SentAddresses = new Mongo.Collection("SentAddresses");
const Authorization = new Mongo.Collection("Authorization");
const Roles = new Mongo.Collection("Roles");
const SavedRoles = new Mongo.Collection("SavedRoles");
const Databases = new Mongo.Collection("Databases");
const SavedDatabases = new Mongo.Collection("SavedDatabases");
const Credentials = new Mongo.Collection("Credentials");
const SavedCredentials = new Mongo.Collection("SavedCredentials");
const SiteMap = new Mongo.Collection("SiteMap");
const StationMap = new Mongo.Collection("StationMap");
const Scorecard = new Mongo.Collection("Scorecard");

// expire after 24 hours from when the scorecard is last upserted
if (Meteor.isServer) {
  try {
    Scorecard.createIndex({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
  } catch (e) {
    // ignore this - this isn't a scorecard
  }
}

const explicitCollections = {
  CurveParamsInfo,
  AppsToScore,
  Scatter2dParams,
  CurveTextPatterns,
  ScatterAxisTextPattern,
  SavedCurveParams,
  PlotParams,
  SavedPlotParams,
  PlotGraphFunctions,
  SavedPlotGraphFunctions,
  CurveSettings,
  Settings,
  ColorScheme,
  SentAddresses,
  Authorization,
  Roles,
  SavedRoles,
  Databases,
  SavedDatabases,
  Credentials,
  SavedCredentials,
  SiteMap,
  StationMap,
  Scorecard,
};

// eslint-disable-next-line no-undef
export default matsCollections = {
  ...paramCollections,
  ...explicitCollections,
};
