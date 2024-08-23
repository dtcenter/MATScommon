/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections, plotParamHandler } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* eslint-disable no-console */

Template.plotParamGroup.helpers({
  PlotParams(num) {
    const params = matsCollections.PlotParams.find(
      { displayGroup: num },
      { sort: ["displayOrder", "asc"] }
    ).fetch();
    return params;
  },
  displayGroup() {
    return "block";
  },
  log() {
    console.log(this);
  },
});

Template.plotParamGroup.events({
  click(event) {
    if (plotParamHandler !== undefined) {
      plotParamHandler(event); // call app specific handler with event.
    }
  },
});
