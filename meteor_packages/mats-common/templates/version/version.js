/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections } from "meteor/randyp:mats-common";

Template.version.helpers({
  version() {
    if (matsCollections.Settings.findOne()) {
      const settings = matsCollections.Settings.findOne({});
      const version = settings.appVersion;
      return version;
    }
    return "unknown";
  },
});
