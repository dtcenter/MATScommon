/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import {
  matsPlotUtils,
  matsGraphUtils,
  matsCurveUtils,
  matsMethods,
} from "meteor/randyp:mats-common";

function toggleDisplay(divId) {
  const x = document.getElementById(divId);
  if (x.style.display === "none") {
    x.style.display = "block";
  } else {
    x.style.display = "none";
  }
}

function getUserNames() {
  // userlist is subscribed in init.js
  // return Meteor.allUsers.find();
  ids = [];
  if (Meteor.users.find().fetch()[0] !== undefined) {
    users = Meteor.users.find().fetch();
    users.forEach(function addUserEmail(user) {
      ids.push(user.emails[0].address);
    });
    return ids;
  }
}

function getNamesForUser(userName) {
  // myScorecardInfo is keyed by userName
  return Object.keys(myScorecardInfo);
}

function getprocessedAtsForUserName(userName, name) {
  const processedAts = [];
  const dt = new Date("07/1/2022");
  const end = new Date("08/1/2022");
  while (dt <= end) {
    processedAts.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return processedAts;
}

function refreshPage() {
  // refresh the page
  matsMethods.getScorecardInfo.call(function (error, ret) {
    if (error !== undefined) {
      setError(error);
    } else {
      Session.set("updateStatusPage", ret);
    }
  });
}

Template.scorecardStatusPage.created = function () {
  refreshPage();
  const cursor = matsCollections.Scorecard.find({}).observeChanges({
    added(id, fields) {
      refreshPage();
    },
    changed(id, fields) {
      refreshPage();
    },
  });
};

Template.scorecardStatusPage.helpers({
  refresh() {
    if (
      Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
    ) {
      refreshPage();
    }
  },
  image() {
    const img = "underConstruction.jpg";
    return img;
  },
  userNames() {
    // uses reactive var
    // myScorecardInfo is keyed by userNames
    return Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
      ? []
      : Object.keys(Session.get("updateStatusPage")).sort();
  },
  names(userName) {
    // uses reactive var
    // myScorecardInfo[userName] is keyed by scorecard names
    return Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
      ? []
      : Object.keys(Session.get("updateStatusPage")[userName]).sort();
  },
  submittedTimes(userName, name) {
    // uses reactive var
    // myScorecardInfo[userName][name] is keyed by scorecard processedAts
    return Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
      ? []
      : Object.keys(Session.get("updateStatusPage")[userName][name]).sort();
  },

  processedAtTimes(userName, name, submitted) {
    // uses reactive var
    // myScorecardInfo[userName][name] is keyed by scorecard processedAts
    return Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
      ? []
      : Object.keys(Session.get("updateStatusPage")[userName][name][submitted]).sort();
  },
  status(userName, name, submitted, processedAt) {
    return Session.get("updateStatusPage") === undefined ||
      typeof Session.get("updateStatusPage") === "number"
      ? ""
      : Session.get("updateStatusPage")[userName][name][submitted][processedAt].status;
  },
  statusType(userName, name, submitted, processedAt) {
    if (
      Session.get("updateStatusPage") !== undefined &&
      typeof Session.get("updateStatusPage") !== "number" &&
      Session.get("updateStatusPage")[userName][name][submitted][processedAt].status ===
        "Pending"
    ) {
      return "danger";
    }
    return "Success";
  },
  visitLink(userName, name, submitted, processedAt) {
    const baseURL =
      Meteor.settings.public.home === undefined
        ? `https://${document.location.href.split("/")[2]}`
        : Meteor.settings.public.home;
    if (baseURL.includes("localhost")) {
      return `${baseURL}/scorecardDisplay/${userName}/${name}/${submitted}/${processedAt}`;
    }
    return `${baseURL}/scorecard/scorecardDisplay/${userName}/${name}/${submitted}/${processedAt}`;
  },
  scid(userName, name, submitted, processedAt) {
    return `${userName}_${name}_${submitted}_${processedAt}`;
  },
  timeStr(epoch) {
    if (Number(epoch) === 0) {
      return "none";
    }
    const d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(Number(epoch));
    return d.toUTCString();
  },
});

Template.scorecardStatusPage.events({
  "click .back"(event) {
    matsPlotUtils.enableActionButtons();
    matsGraphUtils.setDefaultView();
    matsCurveUtils.resetPlotResultData();
    return false;
  },
  "click .refresh-scorecard"(event) {
    refreshPage();
  },
  "click .userName-control"(event) {
    toggleDisplay(event.currentTarget.attributes["data-target"].value);
  },
  "click .userName-name-control"(event) {
    toggleDisplay(event.currentTarget.attributes["data-target"].value);
  },
  "click .drop-sc-instance"(e) {
    const userName = e.currentTarget.dataset.user_name;
    const { name } = e.currentTarget.dataset;
    const submitted = e.currentTarget.dataset.submit_time;
    const processedAt = e.currentTarget.dataset.run_time;

    matsMethods.dropScorecardInstance.call(
      {
        userName,
        name,
        submitted,
        processedAt,
      },
      function (error) {
        if (error !== undefined) {
          setError(error);
        } else {
          // refresh the page
          refreshPage();
        }
      }
    );
  },
  "click .restore-sc-instance"(e) {
    const userName = e.currentTarget.dataset.user_name;
    const { name } = e.currentTarget.dataset;
    const submitted = e.currentTarget.dataset.submit_time;
    const processedAt = e.currentTarget.dataset.run_time;

    matsMethods.getPlotParamsFromScorecardInstance.call(
      {
        userName,
        name,
        submitted,
        processedAt,
      },
      function (error, ret) {
        if (error !== undefined) {
          setError(error);
        } else {
          plotParams = ret;
          matsPlotUtils.enableActionButtons();
          matsGraphUtils.setDefaultView();
          matsCurveUtils.resetPlotResultData();
          const p = { data: {} };
          p.data = plotParams.plotParams;
          p.data.paramData = {};
          p.data.paramData.curveParams = plotParams.plotParams.curves;
          p.data.paramData.plotParams = plotParams.plotParams;
          matsPlotUtils.restoreSettings(p);
        }
      }
    );
    return false;
  },
});
