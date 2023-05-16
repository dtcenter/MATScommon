/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes } from "meteor/randyp:mats-common";
import { matsCollections } from "meteor/randyp:mats-common";
import matsMethods from "../../imports/startup/api/matsMethods";

var notes;

Template.About.helpers({
  isMetexpress: function () {
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      const appType = matsCollections.Settings.findOne({}).appType;
      return appType === matsTypes.AppTypes.metexpress;
    } else {
      return false;
    }
  },
  version: function () {
    var settings = matsCollections.Settings.findOne({});
    var version = "unknown";
    var commit = "unknown";
    if (settings) {
      version = settings.appVersion;
      commit = settings.commit;
    }
    let versionStr =
      "<div class='row' style='text-align:center'>Version: " + version + "</div>";
    return (
      versionStr +
      "<div class='row' style='text-align:center'> Last commit: " +
      commit +
      "</div>"
    );
  },
  releaseNotes: function () {
    Session.get("notesUpdated");
    return notes;
  },
});

Template.About.events({
  "click .show-release-notes": function () {
    matsMethods.getReleaseNotes.call({}, function (error, result) {
      if (error !== undefined) {
        setError(error);
        return "<p>" + error + "</p>";
      }
      notes = result;
      Session.set("notesUpdated", Date.now());
    });
    document.getElementById("showNotes").style.display = "none";
    document.getElementById("hideNotes").style.display = "block";
    document.getElementById("releaseNotes").style.display = "block";
  },
  "click .hide-release-notes": function () {
    document.getElementById("showNotes").style.display = "block";
    document.getElementById("hideNotes").style.display = "none";
    document.getElementById("releaseNotes").style.display = "none";
  },
});
