/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";

Template.QCParamGroup.helpers({
  completenessNumber() {
    return "0";
  },
  noQC() {
    return true;
  },
  notScorecard() {
    return !Meteor.settings.public.scorecard;
  },
});
