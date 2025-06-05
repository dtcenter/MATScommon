/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import { Meteor } from "meteor/meteor";
import { matsCollections, matsTypes } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global $ */

Template.topNav.helpers({
  govLogo() {
    return `${window.location.href}/packages/randyp_mats-common/public/img/icon-dot-gov.svg`;
  },
  httpsLogo() {
    return `${window.location.href}/packages/randyp_mats-common/public/img/icon-https.svg`;
  },
  flagLogo() {
    return `${window.location.href}/packages/randyp_mats-common/public/img/us_flag_small.png`;
  },
  transparentGif() {
    return `${window.location.href}/packages/randyp_mats-common/public/img/noaa_transparent.png`;
  },
  emailText() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress ? "METexpress" : "MATS";
    }
    return "MATS";
  },
  agencyText() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).agency !== undefined
    ) {
      const { agency } = matsCollections.Settings.findOne({});
      return agency;
    }
    return "Unknown Agency";
  },
  agencyLink() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).agencyURL !== undefined
    ) {
      const { agencyURL } = matsCollections.Settings.findOne({});
      return agencyURL;
    }
    return "#";
  },
  productText() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress
        ? "METexpress"
        : "Model Analysis Tool Suite (MATS)";
    }
    return "Model Analysis Tool Suite (MATS)";
  },
  productLink() {
    return Meteor.settings.public.home === undefined
      ? `https://${window.location.href.split("/")[2]}`
      : Meteor.settings.public.home;
  },
  bugsText() {
    return "Bugs/Issues (GitHub)";
  },
  bugsLink() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress
        ? "https://github.com/dtcenter/METexpress/issues"
        : "https://github.com/NOAA-GSL/MATS/issues";
    }
    return "https://github.com/NOAA-GSL/MATS/issues";
  },
  isMetexpress() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress;
    }
    return false;
  },
  alertMessageHidden() {
    if (
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}) === undefined
    )
      return "none";
    const alertMessage = matsCollections.Settings.findOne({}).appMessage;
    if (alertMessage === undefined || alertMessage === "") {
      return "none";
    }
    return "block";
  },
  alertMessage() {
    if (
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}) === undefined
    )
      return "none";
    const alertMessage = matsCollections.Settings.findOne({}).appMessage;
    if (alertMessage === undefined || alertMessage === "") {
      return "";
    }
    return alertMessage;
  },
});

Template.topNav.events({
  "click .about"() {
    $("#modal-display-about").modal();
    return false;
  },
});
