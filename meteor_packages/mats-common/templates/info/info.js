/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsPlotUtils } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global getInfo, clearInfo */

Template.info.helpers({
  infoMessage() {
    return getInfo();
  },
});

Template.info.events({
  "click .clear-info"() {
    clearInfo();
    matsPlotUtils.enableActionButtons();
    return false;
  },
});
