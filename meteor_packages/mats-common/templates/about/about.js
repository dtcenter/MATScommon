/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
import matsMethods from "../../imports/startup/api/matsMethods";

/* global Session, setError */

let notes;

Template.about.helpers({
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
  version() {
    const settings = matsCollections.Settings.findOne({});
    let version = "unknown";
    let commit = "unknown";
    if (settings) {
      version = settings.appVersion;
      commit = settings.commit;
    }
    const versionStr = `<div class='row' style='text-align:center'>Version: ${version}</div>`;
    return `${versionStr}<div class='row' style='text-align:center'> Last commit: ${commit}</div>`;
  },
  releaseNotes() {
    Session.get("notesUpdated");
    return notes;
  },
});

Template.about.events({
  "click .show-release-notes"() {
    matsMethods.getReleaseNotes.call({}, function (error, result) {
      if (error !== undefined) {
        setError(error);
        return `<p>${error}</p>`;
      }
      notes = result;
      Session.set("notesUpdated", Date.now());
      return null;
    });
    document.getElementById("showNotes").style.display = "none";
    document.getElementById("hideNotes").style.display = "block";
    document.getElementById("releaseNotes").style.display = "block";
  },
  "click .hide-release-notes"() {
    document.getElementById("showNotes").style.display = "block";
    document.getElementById("hideNotes").style.display = "none";
    document.getElementById("releaseNotes").style.display = "none";
  },
});
