/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.

The scorecardStatus page has a visit link which is really a FlowRouter route
"/scorecard_display/' + userName + '/' + name + '/' + submitted + '/' + processedAt"
which is a route to this template (scorecardDisplay). The userName, name, submitted, and processedAt are passed as params.
That makes them available in "this" at the top level of the template.
*/

import { Meteor } from "meteor/meteor";
import { matsMethods, matsCollections } from "meteor/randyp:mats-common";
import "./scorecardDisplay.html";
import { Template } from "meteor/templating";

/* global Session, $, setError */

const { jsPDF: JsPDF } = require("jspdf");
const html2canvas = require("html2canvas");
const LightenDarkenColor = require("lighten-darken-color");
const hash = require("object-hash");

const getTableCellId = function (
  fcstlen,
  blockName,
  region,
  stat,
  variable,
  threshold,
  level
) {
  // un-pad the possibly padded fcstlen
  const fcstlenStr = `${Number(fcstlen)}`;
  return `${blockName}-${region}-${stat}-${variable}-${threshold}-${level}-${fcstlenStr}`;
};

const getAppSourceByApplication = function (application) {
  if (
    matsCollections.application.findOne({ name: "application" }).sourceMap !== undefined
  ) {
    return matsCollections.application.findOne({ name: "application" }).sourceMap[
      application
    ];
  }
  return application.toLowerCase();
};

const getAllStats = function (blockName) {
  const myScorecard = Session.get("myScorecard");
  if (myScorecard === undefined) {
    return null;
  }
  const myRegions = Object.keys(myScorecard.scorecard.results.blocks[blockName].data);
  const myStats = new Set();
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard.scorecard.results.blocks[blockName].data[r]);
    rStats.forEach(function (s) {
      myStats.add(s);
    });
  });
  return Array.from(myStats).sort();
};

const getAllVariables = function (blockName) {
  const myScorecard = Session.get("myScorecard");
  if (myScorecard === undefined) {
    return null;
  }
  const myVars = new Set();
  const myRegions = Object.keys(myScorecard.scorecard.results.blocks[blockName].data);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard.scorecard.results.blocks[blockName].data[r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(
        myScorecard.scorecard.results.blocks[blockName].data[r][s]
      );
      rVars.forEach(function (v) {
        myVars.add(v);
      });
    });
  });
  return Array.from(myVars).sort();
};

const getAllThresholds = function (blockName) {
  const myScorecard = Session.get("myScorecard");
  if (myScorecard === undefined) {
    return null;
  }
  const myThreshs = new Set();
  const myRegions = Object.keys(myScorecard.scorecard.results.blocks[blockName].data);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard.scorecard.results.blocks[blockName].data[r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(
        myScorecard.scorecard.results.blocks[blockName].data[r][s]
      );
      rVars.forEach(function (v) {
        const rThreshs = Object.keys(
          myScorecard.scorecard.results.blocks[blockName].data[r][s][v]
        );
        rThreshs.forEach(function (t) {
          myThreshs.add(t);
        });
      });
    });
  });
  if (Array.from(myThreshs).length > 1) {
    return Array.from(myThreshs).sort(function (a, b) {
      const numA = Number(a.split(" (")[0]);
      const numB = Number(b.split(" (")[0]);
      return numA - numB;
    });
  }
  return Array.from(myThreshs).sort();
};

const getAllLevels = function (blockName) {
  const myScorecard = Session.get("myScorecard");
  if (myScorecard === undefined) {
    return null;
  }
  let allNumbers = true;
  const myLevs = new Set();
  const myRegions = Object.keys(myScorecard.scorecard.results.blocks[blockName].data);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard.scorecard.results.blocks[blockName].data[r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(
        myScorecard.scorecard.results.blocks[blockName].data[r][s]
      );
      rVars.forEach(function (v) {
        const rThreshs = Object.keys(
          myScorecard.scorecard.results.blocks[blockName].data[r][s][v]
        );
        rThreshs.forEach(function (t) {
          const rLevs = Object.keys(
            myScorecard.scorecard.results.blocks[blockName].data[r][s][v][t]
          );
          rLevs.forEach(function (l) {
            if (Number.isNaN(Number(l))) {
              allNumbers = false;
            }
            myLevs.add(l);
          });
        });
      });
    });
  });
  if (allNumbers) {
    return Array.from(myLevs).sort(function (a, b) {
      return Number(a) - Number(b);
    });
  }
  return Array.from(myLevs).sort();
};

const refreshScorecard = function (userName, name, submitted, processedAt) {
  const myScorecard = matsCollections.Scorecard.findOne(
    {
      "scorecard.name": name,
      "scorecard.userName": userName,
      "scorecard.submitted": Number(submitted),
      "scorecard.processedAt": Number(processedAt),
    },
    { fields: { scorecard: 1 } }
  );
  Session.set("myScorecard", myScorecard);
};

// retrieves the Scorecard from Couchbase
// using the userName, name, submitted, processedAt from params
// and inserts the scorecard data into the mongo Scorecard collection.
// The scorecard in couchbase and in mongo can be identified by
// userName, name, submitted, and processedAt
// The insertCBscorecard needs to be synchronous because the page needs the data from the mongo scorecard
const getScorecard = function (userName, name, submitted, processedAt) {
  matsMethods.getScorecardData.call(
    {
      userName,
      name,
      submitted,
      processedAt,
    },
    function (error, scorecard) {
      if (error !== undefined) {
        setError(error);
        return;
      }
      Session.set("myScorecard", scorecard);
      const cursor = matsCollections.Scorecard.find({ _id: scorecard.docID });
      cursor.observeChanges({
        changed() {
          refreshScorecard(userName, name, submitted, processedAt);
        },
      });
    }
  );
};

const hideLoading = function () {
  // hide the little green loading indicator (called as the last {{hideLoading}} in the html)
  if (
    document.querySelector("#scorecardDisplayLoading") &&
    document.querySelector("#scorecardDisplayLoading").style &&
    document.querySelector("#scorecardDisplayLoading").style.display
  ) {
    document.querySelector("#scorecardDisplayLoading").style.display = "none";
  }
};

Template.scorecardDisplay.onRendered(function () {
  //  onVisible(document.querySelector("#scorecard-display-container"), hideLoading());
  $(document).ready(function () {
    $('[data-toggle="tooltip"]').tooltip();
  });
  refreshScorecard(
    this.data.userName,
    this.data.name,
    this.data.submitted,
    this.data.processedAt
  );
});

Template.scorecardDisplay.onCreated(function () {
  getScorecard(
    this.data.userName,
    this.data.name,
    this.data.submitted,
    this.data.processedAt
  );
});

Template.scorecardDisplay.helpers({
  application(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    return myScorecard.scorecard.plotParams.curves.find((r) => r.label === blockName)
      .application;
  },
  blockTitle(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    const { blockTitle } = myScorecard.scorecard.results.blocks[blockName];
    return `Scorecard ${blockName}: Experimental Data Source = ${blockTitle.dataSource}, Control Data Source = ${blockTitle.controlDataSource}`;
  },
  constantFields(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    const blockConstantFields =
      myScorecard.scorecard.results.blocks[blockName].blockParameters;
    const actuallyAddedFields = myScorecard.scorecard.plotParams.curves.find(
      (r) => r.label === blockName
    );
    let CFString = "";
    for (let fidx = 0; fidx < blockConstantFields.length; fidx += 1) {
      const currentField = blockConstantFields[fidx];
      if (
        currentField !== "application" &&
        actuallyAddedFields[currentField] !== undefined
      ) {
        if (CFString.length > 0) CFString += "; ";
        CFString = `${CFString + currentField} = ${actuallyAddedFields[currentField]}`;
      }
    }
    if (CFString.length > 0) CFString += "; ";
    CFString = `${CFString}dates = ${myScorecard.scorecard.plotParams.dates}`;
    return `Constant fields: ${CFString}`;
  },
  scorecardBlocks() {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    return Object.keys(myScorecard.scorecard.results.blocks).sort();
  },
  regions(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    return myScorecard.scorecard.results.blocks[blockName].regions.sort();
  },
  fcstlens(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    const myFcstlenStrs = myScorecard.scorecard.results.blocks[blockName].fcstlens;
    const myFcstLengths = [];
    const fcstLength = myFcstlenStrs.length;
    // padd the fcst lengths with leading '0' for single digit fcsts
    for (let i = 0; i < fcstLength; i += 1) {
      myFcstLengths[i] = (Number(myFcstlenStrs[i]) < 10 ? "0" : "") + myFcstlenStrs[i];
    }
    return myFcstLengths.sort();
  },
  numFcsts(blockName) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    return myScorecard.scorecard.results.blocks[blockName].fcstlens.length;
  },
  sigIconId(blockName, region, stat, variable, threshold, level, fcstlen) {
    return getTableCellId(fcstlen, blockName, region, stat, variable, threshold, level);
  },
  significanceIconHTML(blockName, region, stat, variable, threshold, level, fcstlen) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    // un padd the possibly padded fcstlen
    const fcstlenStr = `${Number(fcstlen)}`;
    const sigVal =
      typeof myScorecard.scorecard.results.blocks[blockName].data[region][stat][
        variable
      ][threshold][level][fcstlenStr] === "object"
        ? myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
            threshold
          ][level][fcstlenStr].Value
        : myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
            threshold
          ][level][fcstlenStr];
    let icon;
    let color;
    switch (sigVal) {
      case -2:
        icon = "fa fa-caret-down fa-lg";
        color = myScorecard.scorecard.significanceColors["major-truth-color"];
        break;
      case -1:
        icon = "fa fa-caret-down fa-sm";
        color = myScorecard.scorecard.significanceColors["minor-truth-color"];
        break;
      case 2:
        icon = "fa fa-caret-up fa-lg";
        color = myScorecard.scorecard.significanceColors["major-source-color"];
        break;
      case 1:
        icon = "fa fa-caret-up fa-sm";
        color = myScorecard.scorecard.significanceColors["minor-source-color"];
        break;
      case 0:
        icon = "fa icon-check-empty fa-sm";
        color = "lightgrey";
        break;
      case -9999:
      default:
        icon = "fa icon-check-empty fa-sm";
        color = "white";
        break;
    }
    // clear previous icon
    const outerTableCellId = getTableCellId(
      fcstlen,
      blockName,
      region,
      stat,
      variable,
      threshold,
      level
    );
    const outerTableCellElement = document.getElementById(outerTableCellId);
    if (
      outerTableCellElement &&
      !outerTableCellElement.children[0].className.baseVal.includes(icon)
    ) {
      outerTableCellElement.innerHTML = "";
    }
    return `<i style='color:${color}' class='${icon}'></i>`;
  },
  significanceBackgroundColor(
    blockName,
    region,
    stat,
    variable,
    threshold,
    level,
    fcstlen
  ) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    // un padd the possibly padded fcstlen
    const fcstlenStr = `${Number(fcstlen)}`;
    // the value of the significance can be an object or an integer depending on if the scorecard was recently processed
    // newer scorecards have an object with the value and the other data associated with the significance - which is used
    // to form a tooltip
    const sigVal =
      typeof myScorecard.scorecard.results.blocks[blockName].data[region][stat][
        variable
      ][threshold][level][fcstlenStr] === "object"
        ? myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
            threshold
          ][level][fcstlenStr].Value
        : myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
            threshold
          ][level][fcstlenStr];
    switch (sigVal) {
      case -2:
        return LightenDarkenColor(
          myScorecard.scorecard.significanceColors["major-truth-color"],
          180
        );
      case -1:
        return LightenDarkenColor(
          myScorecard.scorecard.significanceColors["minor-truth-color"],
          220
        );
      case 2:
        return LightenDarkenColor(
          myScorecard.scorecard.significanceColors["major-source-color"],
          180
        );
      case 1:
        return LightenDarkenColor(
          myScorecard.scorecard.significanceColors["minor-source-color"],
          220
        );
      case 0:
        return "lightgrey";
      case -9999:
      default:
        return "white";
    }
  },
  tooltip(blockName, region, stat, variable, threshold, level, fcstlen) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return "";
    }
    // un padd the possibly padded fcstlen
    const fcstlenStr = `${Number(fcstlen)}`;
    let tooltip = "";
    const gp =
      myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
        threshold
      ][level][fcstlenStr].GoodnessPolarity === 1
        ? "positive"
        : "negative";
    if (
      typeof myScorecard.scorecard.results.blocks[blockName].data[region][stat][
        variable
      ][threshold][level][fcstlenStr] === "object"
    ) {
      tooltip =
        `Value:${myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][threshold][level][fcstlenStr].Value}\n` +
        `Path:${myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][threshold][level][fcstlenStr].Path}\n` +
        `MajorThreshold:${myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][threshold][level][fcstlenStr].MajorThreshold}\n` +
        `MinorThreshold:${myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][threshold][level][fcstlenStr].MinorThreshold}\n` +
        `StatisticType:${String(
          myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
            threshold
          ][level][fcstlenStr].StatisticType
        )}\n` +
        `Pvalue:${myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][threshold][level][fcstlenStr].Pvalue}\n` +
        `GoodnessPolarity:${gp}`;
    } else {
      tooltip = String(
        myScorecard.scorecard.results.blocks[blockName].data[region][stat][variable][
          threshold
        ][level][fcstlenStr]
      );
    }
    return tooltip;
  },

  stats(blockName) {
    // return a distinct list of all the possible stats
    return getAllStats(blockName);
  },

  variables(blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllVariables(blockName);
  },

  thresholds(blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllThresholds(blockName);
  },

  levels(blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllLevels(blockName);
  },

  varsLength(blockName) {
    let maxLength = 0;
    const varList = getAllVariables(blockName);
    varList.forEach(function (aVar) {
      maxLength = aVar.length > maxLength ? aVar.length : maxLength;
    });
    return maxLength;
  },

  statsLength(blockName) {
    let maxLength = 0;
    const statList = getAllStats(blockName);
    statList.forEach(function (aStat) {
      maxLength = aStat.length > maxLength ? aStat.length : maxLength;
    });
    return maxLength;
  },

  plotParams() {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return null;
    }
    return JSON.stringify(myScorecard.scorecard.results.plotParams);
  },

  Title() {
    let processedAtstamp = "unprocessed";
    if (Number(this.processedAt) !== 0) {
      processedAtstamp = new Date(this.processedAt * 1000).toUTCString();
    }
    return `${this.userName} : ${this.name} : ${processedAtstamp}`;
  },
  fileNamePlaceholder() {
    const x = new Date(this.submitted * 1000);
    const y = x.getFullYear().toString();
    let m = (x.getMonth() + 1).toString();
    let d = x.getDate().toString();
    if (d.length === 1) d = `0${d}`;
    if (m.length === 1) m = `0${m}`;
    const yyyymmdd = y + m + d;
    return `${this.name}-${yyyymmdd}`;
  },
  hideLoading() {
    hideLoading();
  },
  trimmedText(text) {
    if (typeof text === "string" || text instanceof String) {
      let returnText = text.replace(/__DOT__/g, ".");
      [returnText] = returnText.split(" (");
      return returnText;
    }
    return undefined;
  },
  thresholdHider(blockName) {
    const thresholds = getAllThresholds(blockName);
    return thresholds[0] === "threshold_NA" ? "display: none;" : "";
  },
  levelHider(blockName) {
    const levels = getAllLevels(blockName);
    return levels[0] === "level_NA" ? "display: none;" : "";
  },
});

Template.scorecardDisplay.events({
  "click .refresh-scorecard"() {
    refreshScorecard(this.userName, this.name, this.submitted, this.processedAt);
  },
  "click .exportpdf"() {
    $(".previewCurveButtons").each(function (i, obj) {
      // eslint-disable-next-line no-param-reassign
      obj.style.display = "none";
    });
    html2canvas(document.querySelector("#graph-container"), {
      scale: 3.0,
    }).then((canvas) => {
      const h = 419.53;
      const w = 595.28;
      const filename = document.getElementById("exportFileName").value;
      const pdf = new JsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [w, h],
      });
      pdf.addImage(canvas.toDataURL("image/jpeg"), "JPEG", 0, 0, w, h);
      pdf.save(filename);
      $(".previewCurveButtons").each(function (i, obj) {
        // eslint-disable-next-line no-param-reassign
        obj.style.display = "block";
      });
    });
  },
  "click .exportpng"() {
    $(".previewCurveButtons").each(function (i, obj) {
      // eslint-disable-next-line no-param-reassign
      obj.style.display = "none";
    });
    function saveAs(uri, filename) {
      const link = document.createElement("a");
      if (typeof link.download === "string") {
        link.href = uri;
        link.download = filename;

        // Firefox requires the link to be in the body
        document.body.appendChild(link);

        // simulate click
        link.click();

        // remove the link when done
        document.body.removeChild(link);
      } else {
        window.open(uri);
      }
    }
    html2canvas(document.querySelector("#graph-container"), {
      scale: 3.0,
    }).then((canvas) => {
      const filename = document.getElementById("exportFileName").value;
      saveAs(canvas.toDataURL(), `${filename}.png`);
      $(".previewCurveButtons").each(function (i, obj) {
        // eslint-disable-next-line no-param-reassign
        obj.style.display = "block";
      });
    });
  },

  "click .scTableSigTd"(event) {
    const myScorecard = Session.get("myScorecard");
    if (myScorecard === undefined) {
      return;
    }
    const block = event.currentTarget.dataset.scorecardblock;
    const blockData = myScorecard.scorecard.plotParams.curves.find(
      (r) => r.label === block
    );
    const { application } = blockData;
    // When comparing models, you want forecast minus truth.
    // MATS differences are calculated by Curve1 - Curve0,
    // so Curve1 is the data-source and Curve0 is the control-data-source
    const curve0Model = blockData["control-data-source"];
    const curve1Model = blockData["data-source"];
    const scorecardSettings = {
      appName: application,
      dateRange: myScorecard.scorecard.plotParams.dates,
      curve0DataSource: curve0Model,
      curve1DataSource: curve1Model,
      commonCurveParams: {
        region: event.currentTarget.dataset.region
          ? event.currentTarget.dataset.region.replace(/__DOT__/g, ".")
          : "undefined",
        "forecast-length":
          event.currentTarget.dataset.fcstlen && !blockData["forecast-type"]
            ? parseInt(event.currentTarget.dataset.fcstlen, 10)
                .toString()
                .replace(/__DOT__/g, ".")
            : "undefined",
        statistic: event.currentTarget.dataset.stat
          ? event.currentTarget.dataset.stat.replace(/__DOT__/g, ".")
          : "undefined",
        variable: event.currentTarget.dataset.variable
          ? event.currentTarget.dataset.variable.replace(/__DOT__/g, ".")
          : "undefined",
        threshold:
          event.currentTarget.dataset.threshold &&
          event.currentTarget.dataset.threshold !== "threshold_NA"
            ? event.currentTarget.dataset.threshold.replace(/__DOT__/g, ".")
            : "undefined",
        level:
          event.currentTarget.dataset.level &&
          event.currentTarget.dataset.level !== "level_NA"
            ? event.currentTarget.dataset.level.replace(/__DOT__/g, ".")
            : "undefined",
        scale: blockData.scale ? blockData.scale : "undefined",
        truth: blockData.truth ? blockData.truth : "undefined",
        "forecast-type": blockData["forecast-type"]
          ? blockData["forecast-type"]
          : "undefined",
        "valid-time": blockData["valid-time"] ? blockData["valid-time"] : "undefined",
      },
    };
    const baseURL =
      Meteor.settings.public.home === undefined
        ? `https://${document.location.href.split("/")[2]}`
        : Meteor.settings.public.home;
    const appSource = getAppSourceByApplication(application);

    const settingsJSON = JSON.stringify(scorecardSettings);
    const key = hash(settingsJSON);
    matsMethods.saveScorecardSettings.call(
      {
        settingsKey: key,
        scorecardSettings: settingsJSON,
      },
      function (error) {
        if (error !== undefined) {
          setError(error);
        } else if (baseURL.includes("localhost")) {
          event.view.window.open(`${baseURL}/scorecardTimeseries/${key}`, "_blank");
        } else {
          event.view.window.open(
            `${baseURL}/${appSource}/scorecardTimeseries/${key}`,
            "_blank"
          );
        }
      }
    );
  },
});
