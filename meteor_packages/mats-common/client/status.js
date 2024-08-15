/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Session */
/* eslint-disable no-undef */

setStatus = function (status) {
  Session.set("statusMessage", status);
};

clearStatus = function () {
  Session.set("statusMessage", "");
};

getStatus = function () {
  return Session.get("statusMessage");
};
