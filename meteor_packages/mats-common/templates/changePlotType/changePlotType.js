/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils, matsCurveUtils } from "meteor/randyp:mats-common";

// moved here from plotType.html and plotType.js
Template.changePlotType.events({
  "click .confirm-remove-all": function (event) {
    event.preventDefault();
    matsCurveUtils.clearAllUsed();
    matsParamUtils.setAllParamsToDefault();
    Session.set("editMode", "");
    Session.set("paramWellColor", "#f5f5f5"); // default grey
    Session.set("lastUpdate", Date.now());

    Session.set("confirmPlotChange", Date.now());
    document.getElementById("plotTypes-selector").value = Session.get("plotChangeType");
    $("#plotTypes-selector").trigger("change");
  },
  "click .confirm-keep-all": function (event) {
    event.preventDefault();
    Session.set("confirmPlotChange", Date.now());
    document.getElementById("plotTypes-selector").value = Session.get("plotChangeType");
    $("#plotTypes-selector").trigger("change");
  },
});
