/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

Template.color.helpers({
  defaultColor() {
    return this.default;
  },
});

Template.color.events({
  "click, blur"(event) {
    try {
      event.target.checkValidity();
      const { value } = event.currentTarget;
      matsParamUtils.setValueTextForParamName(event.target.name, value);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, this.default); // make it black
    }
  },
  change(event) {
    if (
      document.getElementById(`controlButton-${event.currentTarget.name}-value`) !==
      null
    ) {
      document.getElementById(
        `controlButton-${event.currentTarget.name}-value`
      ).style.backgroundColor = event.currentTarget.value;
      this.value = event.currentTarget.value;
    } else {
      document.querySelector(`[name="${event.currentTarget.name}-icon"]`).style.color =
        event.currentTarget.value;
      document.querySelector(`[name="${event.currentTarget.name}-icon"]`).value =
        event.currentTarget.value;
    }
  },
});
