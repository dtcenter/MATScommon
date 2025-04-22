/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsGraphUtils,
  matsParamUtils,
  matsMethods,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, setError */

const Datepicker = require("vanillajs-datepicker");

let datepicker;

Template.scorecardHome.onCreated(function () {
  this.subscribe("matsPlotUtils").ready();
  this.subscribe("matsTypes").ready();
  this.subscribe("matsCollections").ready();
  this.subscribe("matsCurveUtils").ready();
  this.subscribe("matsParamUtils").ready();
  this.subscribe("plotType").ready();
});

Template.scorecardHome.helpers({
  isUnderConstruction() {
    return (
      matsCollections.underConstruction !== undefined &&
      matsCollections.underConstruction.findOne({
        name: "underConstruction",
      }) !== undefined
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
      matsCollections.Settings.findOne(
        {},
        {
          fields: {
            Title: 1,
          },
        }
      ) === undefined
    ) {
      return "";
    }
    return matsCollections.Settings.findOne(
      {},
      {
        fields: {
          Title: 1,
        },
      }
    ).Title;
  },
});

Template.scorecardHome.events({
  "click #controlButton-scorecard-ends-on-value"() {
    const today = new Date();
    if (datepicker === undefined) {
      // declared at top of file - lazy instantiation
      datepicker = new Datepicker(
        document.getElementById("scorecard-ends-on-textInput"),
        {
          buttonClass: "btn",
          autohide: true,
          defaultViewDate: today,
          minDate: today,
          container: "controlButton-scorecard-ends-on-value",
          orientation: "top",
          title: "Scorecard ends on",
        }
      );
    }
    datepicker.setDate(today);
    datepicker.refresh();
    datepicker.show();
  },
  "click #display-status"() {
    matsMethods.getScorecardInfo
      .callAsync(function (error, ret) {
        if (error !== undefined) {
          setError(error);
        } else {
          Session.set("updateStatusPage", ret);
        }
      })
      .then(function (ret) {
        Session.set("updateStatusPage", ret);
      })
      .catch(function (error) {
        setError(error);
      });
    matsGraphUtils.setScorecardDisplayView();
  },
  "click #scorecard-schedule-mode-radioGroup-recurring"() {
    // this event is only fired when 'recurring' is selected
    // firing off a blur event will cause the hideForOthers stuff in radiogroup.js to happen
    const defaultOption = matsParamUtils.getParameterForName(
      "scorecard-recurrence-interval"
    ).default;
    const elem = document.getElementById(
      `scorecard-recurrence-interval-radioGroup-${defaultOption}`
    );
    elem.dispatchEvent(new Event("blur"));
  },
  "change #scorecard-color-theme-radioGroup-RedGreen"() {
    document.querySelector('[name="major-truth-color-icon"]').style.color = "#ff0000";
    document.getElementById("major-truth-color-color").value = "#ff0000";
    document.querySelector('[name="minor-truth-color-icon"]').style.color = "#ff0000";
    document.getElementById("minor-truth-color-color").value = "#ff0000";
    document.querySelector('[name="major-source-color-icon"]').style.color = "#00ff00";
    document.getElementById("major-source-color-color").value = "#00ff00";
    document.querySelector('[name="minor-source-color-icon"]').style.color = "#00ff00";
    document.getElementById("minor-source-color-color").value = "#00ff00";
  },
  "change #scorecard-color-theme-radioGroup-RedBlue"() {
    document.querySelector('[name="major-truth-color-icon"]').style.color = "#ff0000";
    document.getElementById("major-truth-color-color").value = "#ff0000";
    document.querySelector('[name="minor-truth-color-icon"]').style.color = "#ff0000";
    document.getElementById("minor-truth-color-color").value = "#ff0000";
    document.querySelector('[name="major-source-color-icon"]').style.color = "#0000ff";
    document.getElementById("major-source-color-color").value = "#0000ff";
    document.querySelector('[name="minor-source-color-icon"]').style.color = "#0000ff";
    document.getElementById("minor-source-color-color").value = "#0000ff";
  },
  "change [name='major-truth-color-icon']"() {
    document.getElementById("major-truth-color-color").value = document.querySelector(
      '[name="major-truth-color-icon"]'
    ).style.color;
  },
  "change [name='minor-truth-color-icon']"() {
    document.getElementById("minor-truth-color-color").value = document.querySelector(
      '[name="minor-truth-color-icon"]'
    ).style.color;
  },
  "change [name='major-source-color-icon']"() {
    document.getElementById("major-source-color-color").value = document.querySelector(
      '[name="major-source-color-icon"]'
    ).style.color;
  },
  "change [name='minor-source-color-icon']"() {
    document.getElementById("minor-source-color-color").value = document.querySelector(
      '[name="minor-source-color-icon"]'
    ).style.color;
  },
});
