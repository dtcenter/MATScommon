/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCurveUtils, matsParamUtils, matsTypes } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session */
/* eslint-disable no-console */

Template.textInput.helpers({
  defaultTextInput() {
    if (this.name === "label") {
      // labels are handled specially
      let label;
      const input = document.getElementById("label-textInput");
      const value = document.getElementById("controlButton-label-value");
      if (input && value) {
        if (label !== input.value || label !== value.textContent) {
          if (!Session.get("NextCurveLabel")) {
            label = matsCurveUtils.getNextCurveLabel();
          } else {
            label = Session.get("NextCurveLabel");
          }
          input.value = label;
          value.textContent = label;
          return label;
        }
      } else {
        // must be initialization
        label = matsCurveUtils.getNextCurveLabel();
        return label;
      }
    } else {
      return this.default;
    }
    return null;
  },
});

Template.textInput.events({
  "click, blur"(event) {
    try {
      // label is handled differently - special case because of NextCurveLabel stored in Session
      const text = event.currentTarget.value;
      if (!(event.target.name === "label" && Session.get("NextCurveLabel") === text)) {
        matsParamUtils.setValueTextForParamName(event.target.name, text);
      }
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
  change(event) {
    try {
      // label is handled differently - special case because of NextCurveLabel stored in Session
      const text = event.currentTarget.value;
      if (event.target.name === "label" && Session.get("NextCurveLabel") === text) {
        if (Object.values(matsTypes.ReservedWords).indexOf(text) === -1) {
          matsParamUtils.setValueTextForParamName(event.target.name, text);
          Session.set("NextCurveLabel", text);
        } else {
          console.log("that curve label is not allowed");
          setTimeout(function () {
            matsParamUtils.setValueTextForParamName(
              event.target.name,
              "LabelNotAllowed"
            );
          }, 10);
        }
      } else {
        matsParamUtils.setValueTextForParamName(event.target.name, text);
      }
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
});
