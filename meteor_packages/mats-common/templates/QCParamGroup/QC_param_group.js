/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsParamUtils,
  matsTypes,
  plotParamHandler,
} from "meteor/randyp:mats-common";

Template.QCParamGroup.helpers({
  completenessNumber() {
    return "0";
  },
  noQC() {
    return true;
  },
});
