/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Template } from "meteor/templating";

Template.underConstruction.helpers({
  image() {
    const img = "underConstruction.jpg";
    return img;
  },
});
