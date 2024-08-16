/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

import { Template } from "meteor/templating";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";
import "./appBody.html";

Template.appBody.onCreated(function () {
  console.log("in appBody onCreated");
});
