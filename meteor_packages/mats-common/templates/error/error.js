/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsPlotUtils } from "meteor/randyp:mats-common";

Template.error.helpers({
  errorMessage() {
    return getError();
  },
  stackTrace() {
    return getStack();
  },
});

Template.error.events({
  "click .clear-error"() {
    clearError();
    document.getElementById("stack").style.display = "none";
    matsPlotUtils.enableActionButtons();
    return false;
  },
  "click .show-stack"() {
    document.getElementById("stack").style.display = "block";
  },
  "click .hide-stack"() {
    document.getElementById("stack").style.display = "none";
  },
});
