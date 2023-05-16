/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCurveUtils, matsPlotUtils } from "meteor/randyp:mats-common";

Template.spinner.helpers({
  spinnerUrl() {
    let img = Session.get("spinner_img");
    if (img === undefined) {
      img = "spinner.gif";
      Session.set("spinner_img", "spinner.gif");
    }
    const baseURL =
      Meteor.settings.public.home === undefined
        ? `https://${document.location.href.split("/")[2]}`
        : Meteor.settings.public.home;
    if (baseURL.includes("localhost")) {
      return `${baseURL}/packages/randyp_mats-common/public/img/spinner.gif`;
    }
    return `${baseURL}/${
      matsCollections.Settings.findOne({}).appName
    }/packages/randyp_mats-common/public/img/spinner.gif`;
  },
});

Template.spinner.events({
  "click .cancel"() {
    matsCurveUtils.hideSpinner();
    matsPlotUtils.enableActionButtons();
  },
});
