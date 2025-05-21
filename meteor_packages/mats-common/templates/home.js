/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsParamUtils,
  matsMethods,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global setError */

Template.home.onCreated(function () {
  this.subscribe("matsPlotUtils").ready();
  this.subscribe("matsTypes").ready();
  this.subscribe("matsCollections").ready();
  this.subscribe("matsCurveUtils").ready();
  this.subscribe("matsParamUtils").ready();
  this.subscribe("plotType").ready();
});

Template.home.helpers({
  isUnderConstruction() {
    return (
      matsCollections.underConstruction !== undefined &&
      matsCollections.underConstruction.findOne({ name: "underConstruction" }) !==
        undefined
    );
  },
  resetDefaults() {
    matsMethods.refreshMetaData
      .callAsync({})
      .then(function () {
        matsParamUtils.setAllParamsToDefault();
      })
      .catch(function (error) {
        setError(new Error(error.message));
      });
  },
  title() {
    if (
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}, { fields: { Title: 1 } }) === undefined
    ) {
      return "";
    }
    return matsCollections.Settings.findOne({}, { fields: { Title: 1 } }).Title;
  },
});
