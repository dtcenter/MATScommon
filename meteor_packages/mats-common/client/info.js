/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Session, $ */
/* eslint-disable no-undef */

setInfo = function (info) {
  Session.set("infoMessage", info);
  $("#info").modal("show");
};

clearInfo = function () {
  Session.set("infoMessage", "");
  $("#info").modal("hide");
};

getInfo = function () {
  return Session.get("infoMessage");
};
