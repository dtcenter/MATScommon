/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

Template.footer.helpers({
  isMetexpress() {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const { appType } = matsCollections.Settings.findOne({});
      return appType === matsTypes.AppTypes.metexpress;
    }
    return false;
  },
});
