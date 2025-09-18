/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import { Meteor } from "meteor/meteor";
import { matsCollections, matsTypes } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

const windowLocation = window.location.href.includes("scorecardDisplay")
  ? window.location.href.split("/scorecardDisplay/")[0]
  : window.location.href;

Template.topNav.helpers({
  govLogo() {
    return `${windowLocation}/packages/randyp_mats-common/public/img/icon-dot-gov.svg`;
  },
  httpsLogo() {
    return `${windowLocation}/packages/randyp_mats-common/public/img/icon-https.svg`;
  },
  lockLogo() {
    return `${windowLocation}/packages/randyp_mats-common/public/img/lock-fill.svg`;
  },
  flagLogo() {
    return `${windowLocation}/packages/randyp_mats-common/public/img/us_flag_small.png`;
  },
  transparentGif() {
    return `${windowLocation}/packages/randyp_mats-common/public/img/noaa_transparent.png`;
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
      ? `https://${windowLocation.split("/")[2]}`
      : Meteor.settings.public.home;
  },
  githubText() {
    return "GitHub";
  },
  githubLink() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress
        ? "https://github.com/dtcenter/METexpress"
        : "https://github.com/NOAA-GSL/MATS";
    }
    return "https://github.com/NOAA-GSL/MATS";
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
