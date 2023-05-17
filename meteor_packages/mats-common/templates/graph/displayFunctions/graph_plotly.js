/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { moment } from "meteor/momentjs:moment";
import { matsTypes, matsCurveUtils, matsGraphUtils } from "meteor/randyp:mats-common";

graphPlotly = function (key) {
  // get plot info
  const route = Session.get("route");

  // get dataset info and options
  const resultSet = matsCurveUtils.getGraphResult();
  if (resultSet === null || resultSet === undefined || resultSet.data === undefined) {
    return false;
  }

  // set options
  const { options } = resultSet;
  if (route !== undefined && route !== "") {
    options.selection = [];
  }

  // initialize show/hide button labels
  const dataset = resultSet.data;
  if (Session.get("graphPlotType") !== matsTypes.PlotTypes.map) {
    matsGraphUtils.setNoDataLabels(dataset);
  } else {
    matsGraphUtils.setNoDataLabelsMap(dataset);
  }
};
