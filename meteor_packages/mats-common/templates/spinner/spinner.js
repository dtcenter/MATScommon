/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import {
  matsCollections,
  matsCurveUtils,
  matsPlotUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session */

Template.spinner.helpers({
  spinnerUrl() {
    let img = Session.get("spinner_img");
    if (img === undefined) {
      img = "spinner.gif";
      Session.set("spinner_img", "spinner.gif");
    }
    const urlComponents = document.location.href.split("/");
    const baseURL =
      Meteor.settings.public.home === undefined
        ? `https://${urlComponents}`
        : Meteor.settings.public.home;
    const appName =
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}) === undefined ||
      matsCollections.Settings.findOne({}).appName === undefined
        ? `${urlComponents[urlComponents.length - 1]}`
        : matsCollections.Settings.findOne({}).appName;
    if (baseURL.includes("localhost")) {
      return `${baseURL}/packages/randyp_mats-common/public/img/spinner.gif`;
    }
    return `${baseURL}/${appName}/packages/randyp_mats-common/public/img/spinner.gif`;
  },
});

Template.spinner.events({
  "click .cancel"() {
    matsCurveUtils.hideSpinner();
    matsPlotUtils.enableActionButtons();
  },
});
