/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import { Meteor } from "meteor/meteor";
import { matsCollections, matsTypes } from "meteor/randyp:mats-common";
import matsMethods from "../../imports/startup/api/matsMethods";

const getRunEnvironment = function () {
  if (Session.get("deployment_environment") === undefined) {
    matsMethods.getRunEnvironment.call({}, function (error, result) {
      if (error !== undefined) {
        setError(error);
        return `<p>${error}</p>`;
      }
      Session.set("deployment_environment", result);
      return result;
    });
  } else {
    return Session.get("deployment_environment");
  }
};

Template.topNav.helpers({
  transparentGif() {
    const urlComponents = document.location.href.split("/");
    const baseURL =
      Meteor.settings.public.home === undefined
        ? `https://${urlComponents[2]}`
        : Meteor.settings.public.home;
    const appName =
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}) === undefined ||
      matsCollections.Settings.findOne({}).appName === undefined
        ? `${urlComponents[urlComponents.length - 1]}`
        : matsCollections.Settings.findOne({}).appName;
    if (baseURL.includes("localhost")) {
      return `${baseURL}/packages/randyp_mats-common/public/img/noaa_transparent.png`;
    }
    return `${baseURL}/${appName}/packages/randyp_mats-common/public/img/noaa_transparent.png`;
  },
  emailText() {
    switch (getRunEnvironment()) {
      case "metexpress":
        return "METexpress";
      default:
        if (
          matsCollections.Settings.findOne({}) !== undefined &&
          matsCollections.Settings.findOne({}).appType !== undefined
        ) {
          const { appType } = matsCollections.Settings.findOne({});
          return appType === matsTypes.AppTypes.metexpress ? "METexpress" : "MATS";
        }
        return "MATS";
    }
  },
  agencyText() {
    switch (getRunEnvironment()) {
      case "metexpress":
        return "National Weather Service";
      default:
        return "Global Systems Laboratory";
    }
  },
  agencyLink() {
    switch (getRunEnvironment()) {
      case "metexpress":
        return "https://www.weather.gov/";
      default:
        return "http://gsl.noaa.gov/";
    }
  },
  productText() {
    switch (getRunEnvironment()) {
      case "metexpress":
        return "METexpress";
      default:
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
    }
  },
  productLink() {
    return Meteor.settings.public.home === undefined
      ? `https://${document.location.href.split("/")[2]}`
      : Meteor.settings.public.home;
  },
  bugsText() {
    return "Bugs/Issues (GitHub)";
  },
  bugsLink() {
    switch (getRunEnvironment()) {
      case "metexpress":
        return "https://github.com/dtcenter/METexpress/issues";
        break;
      default:
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
    }
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
});

Template.topNav.events({
  "click .about"() {
    $("#modal-display-about").modal();
    return false;
  },
});
