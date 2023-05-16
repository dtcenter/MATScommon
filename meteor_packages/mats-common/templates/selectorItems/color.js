/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils } from "meteor/randyp:mats-common";
Template.color.helpers({
  defaultColor: function () {
    return this.default;
  },
});

Template.color.events({
  "click, blur": function (event) {
    try {
      event.target.checkValidity();
      var value = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, value);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, this.default); // make it black
    }
  },
  change: function (event) {
    if (
      document.getElementById(
        "controlButton-" + event.currentTarget.name + "-value"
      ) !== null
    ) {
      document.getElementById(
        "controlButton-" + event.currentTarget.name + "-value"
      ).style.backgroundColor = event.currentTarget.value;
      this.value = event.currentTarget.value;
    } else {
      document.querySelector(
        '[name="' + event.currentTarget.name + "-icon" + '"]'
      ).style.color = event.currentTarget.value;
      document.querySelector(
        '[name="' + event.currentTarget.name + "-icon" + '"]'
      ).value = event.currentTarget.value;
    }
  },
});
