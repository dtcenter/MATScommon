/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.

The scorecardStatus page has a visit link which is really a FlowRouter route
"/scorecard_display/' + userName + '/' + name + '/' + submitted + '/' + processedAt"
which is a route to this template (ScorecardDisplay). The userName, name, submitted, and processedAt are passed as params.
That makes them available in "this" at the top level of the template.
*/

import { Meteor } from 'meteor/meteor';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { matsMethods, matsCollections } from 'meteor/randyp:mats-common';
import { Template } from 'meteor/templating';
import { LightenDarkenColor } from 'lighten-darken-color';
import './scorecardDisplay.html';

const getTableCellId = function(fcstlen, blockName, region, stat, variable, threshold, level) {
  // un-pad the possibly padded fcstlen
  let fcstlenStr = Number(fcstlen) + '';
  return blockName + '-' + region + '-' + stat + '-' + variable + '-' + threshold + '-' + level + '-' + fcstlenStr;
}

const getAppSourceByApplication = function (application) {
  if (matsCollections["application"].findOne({ name: "application" }).sourceMap !== undefined) {
    return matsCollections["application"].findOne({ name: "application" }).sourceMap[application];
  } else {
    return application.toLowerCase();
  }
}

const getAllStats = function (blockName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }
  const myRegions = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data']);
  let myStats = new Set();
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r]);
    rStats.forEach(function (s) {
      myStats.add(s);
    });
  });
  return Array.from(myStats).sort();
};

const getAllVariables = function (blockName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }
  let myVars = new Set();
  const myRegions = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data']);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s]);
      rVars.forEach(function (v) {
        myVars.add(v);
      });
    });
  });
  return Array.from(myVars).sort();
};

const getAllThresholds = function (blockName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }
  let myThreshs = new Set();
  const myRegions = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data']);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s]);
      rVars.forEach(function (v) {
        const rThreshs = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s][v]);
        rThreshs.forEach(function (t) {
          myThreshs.add(t);
        });
      });
    });
  });
  if (Array.from(myThreshs).length > 1) {
    return Array.from(myThreshs).sort(function (a, b) {
      a = Number(a.split(" (")[0]);
      b = Number(b.split(" (")[0]);
      return a - b;
    });
  } else {
    return Array.from(myThreshs).sort();
  }
};

const getAllLevels = function (blockName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }
  let allNumbers = true;
  let myLevs = new Set();
  const myRegions = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data']);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s]);
      rVars.forEach(function (v) {
        const rThreshs = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s][v]);
        rThreshs.forEach(function (t) {
          const rLevs = Object.keys(myScorecard['scorecard']['results']['blocks'][blockName]['data'][r][s][v][t]);
          rLevs.forEach(function (l) {
            if (isNaN(Number(l))) {
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
  } else {
    return Array.from(myLevs).sort();
  }
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
      userName: userName,
      name: name,
      submitted: submitted,
      processedAt: processedAt,
    },
    function (error, scorecard) {
      if (error !== undefined) {
        setError(error);
        return;
      }
      Session.set('myScorecard', scorecard);
      const cursor = matsCollections.Scorecard.find({"_id": scorecard.docID});
      const handle = cursor.observeChanges({
        changed(id, fields) {
          refreshScorecard(userName, name, submitted, processedAt)
        }
      });
      return;
    }
  );
};

const refreshScorecard = function (userName, name, submitted, processedAt) {
  myScorecard = matsCollections.Scorecard.findOne(
    {
      'scorecard.name': name,
      'scorecard.userName': userName,
      'scorecard.submitted': Number(submitted),
      'scorecard.processedAt': Number(processedAt),
    },
    { fields: { scorecard: 1 } }
  );
  Session.set('myScorecard', myScorecard);
};

const hideLoading = function () {
  // hide the little green loading indicator (called as the last {{hideLoading}} in the html)
  if (document.querySelector('#scorecardDisplayLoading')
      && document.querySelector('#scorecardDisplayLoading').style
      && document.querySelector('#scorecardDisplayLoading').style.display) {
    document.querySelector('#scorecardDisplayLoading').style.display = 'none';
  }
};

Template.ScorecardDisplay.onRendered(function () {
  //  onVisible(document.querySelector("#scorecard-display-container"), hideLoading());
  $(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
  });
  refreshScorecard(this.data.userName, this.data.name, this.data.submitted, this.data.processedAt);
});

Template.ScorecardDisplay.onCreated(function () {
  getScorecard(this.data.userName, this.data.name, this.data.submitted, this.data.processedAt);
});

Template.ScorecardDisplay.helpers({
  application: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return myScorecard['scorecard'].plotParams.curves
      .find((r) => r['label'] === blockName)
      ['application'];
  },
  blockTitle: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const blockTitle = myScorecard['scorecard']['results']['blocks'][blockName]['blockTitle'];
    return (
        'Scorecard ' +
        blockName +
        ': Experimental Data Source = ' +
        blockTitle['dataSource'] +
        ', Control Data Source = ' +
        blockTitle['controlDataSource']
    );
  },
  constantFields: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const blockConstantFields = myScorecard['scorecard']['results']['blocks'][blockName]['blockParameters'];
    const actuallyAddedFields = myScorecard['scorecard'].plotParams.curves.find((r) => r['label'] === blockName);
    let CFString = "";
    for (let fidx = 0; fidx < blockConstantFields.length; fidx++) {
      const currentField = blockConstantFields[fidx];
      if (currentField !== "application" && actuallyAddedFields[currentField] !== undefined) {
        if (CFString.length > 0) CFString = CFString + "; ";
        CFString = CFString + currentField + " = " + actuallyAddedFields[currentField];
      }
    }
    if (CFString.length > 0) CFString = CFString + "; ";
    CFString = CFString + "dates = " + myScorecard['scorecard'].plotParams.dates;
    return (
        'Constant fields: ' + CFString
    );
  },
  scorecardBlocks: function () {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return Object.keys(myScorecard['scorecard']['results']['blocks']).sort();
  },
  regions: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return myScorecard['scorecard']['results']['blocks'][blockName]['regions'].sort();
  },
  fcstlens: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    let myFcstlenStrs = myScorecard['scorecard']['results']['blocks'][blockName]['fcstlens'];
    let myFcstLengths = [];
    let fcstLength = myFcstlenStrs.length;
    // padd the fcst lengths with leading '0' for single digit fcsts
    for (let i = 0; i < fcstLength; i++) {
      myFcstLengths[i] = (Number(myFcstlenStrs[i]) < 10 ? '0' : '') + myFcstlenStrs[i];
    }
    return myFcstLengths.sort();
  },
  numFcsts: function (blockName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return myScorecard['scorecard']['results']['blocks'][blockName]['fcstlens'].length;
  },
  sigIconId: function (blockName, region, stat, variable, threshold, level, fcstlen) {
    return getTableCellId(fcstlen, blockName, region, stat, variable, threshold, level);
  },
  significanceIconHTML: function (blockName, region, stat, variable, threshold, level, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    const sigVal =
      typeof myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr] === "object" ?
        myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['Value'] :
        myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr];
    let icon;
    let color;
    switch(sigVal) {
      case -2:
        icon = 'fa fa-caret-down fa-lg';
        color = myScorecard['scorecard']['significanceColors']['major-truth-color'];
        break;
      case -1:
        icon = 'fa fa-caret-down fa-sm';
        color = myScorecard['scorecard']['significanceColors']['minor-truth-color'];
        break;
      case 2:
        icon = 'fa fa-caret-up fa-lg';
        color = myScorecard['scorecard']['significanceColors']['major-source-color'];
        break;
      case 1:
        icon = 'fa fa-caret-up fa-sm';
        color = myScorecard['scorecard']['significanceColors']['minor-source-color'];
        break;
      case 0:
        icon = 'fa icon-check-empty fa-sm';
        color = 'lightgrey';
        break;
      case -9999:
      default:
        icon = 'fa icon-check-empty fa-sm';
        color = 'white';
        break;
      }
    // clear previous icon
    const outerTableCellId = getTableCellId(fcstlen, blockName, region, stat, variable, threshold, level);
    const outerTableCellElement = document.getElementById(outerTableCellId);
    if (outerTableCellElement && !outerTableCellElement.children[0].className.baseVal.includes(icon)) {
      outerTableCellElement.innerHTML = "";
    }
    return "<i style='color:" + color + "' class='" + icon + "'></i>"
  },
  significanceBackgroundColor: function (blockName, region, stat, variable, threshold, level, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    // the value of the significance can be an object or an integer depending on if the scorecard was recently processed
    // newer scorecards have an object with the value and the other data associated with the significance - which is used
    // to form a tooltip
    const sigVal =
      typeof myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr] === "object" ?
        myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['Value'] :
        myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr];
    switch(sigVal) {
      case -2:
        return LightenDarkenColor(
          myScorecard['scorecard']['significanceColors']['major-truth-color'],
          180
        );
      case -1:
        return LightenDarkenColor(
          myScorecard['scorecard']['significanceColors']['minor-truth-color'],
          220
        );
      case 2:
        return LightenDarkenColor(
          myScorecard['scorecard']['significanceColors']['major-source-color'],
          180
        );
      case 1:
        return LightenDarkenColor(
          myScorecard['scorecard']['significanceColors']['minor-source-color'],
          220
        );
      case 0:
        return 'lightgrey';
      case -9999:
      default:
        return 'white';
    }
  },
  tooltip: function (blockName, region, stat, variable, threshold, level, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return "";
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    let tooltip = "";
    let gp = myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['GoodnessPolarity'] === 1 ? "positive" : "negative";
    if (typeof myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr] === "object") {
      tooltip = "Value:" + myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['Value'] + "\n" +
        "Path:" + myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['Path'] + "\n" +
        "MajorThreshold:" + myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['MajorThreshold'] + "\n" +
        "MinorThreshold:" + myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['MinorThreshold'] + "\n" +
        "StatisticType:" + String(myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['StatisticType']) + "\n" +
        "Pvalue:" + myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]['Pvalue'] + "\n" +
        "GoodnessPolarity:" + gp;
      } else {
      tooltip = String(myScorecard['scorecard']['results']['blocks'][blockName]['data'][region][stat][variable][threshold][level][fcstlenStr]);
    }
    return tooltip;
  },

  stats: function (blockName) {
    // return a distinct list of all the possible stats
    return getAllStats(blockName);
  },

  variables: function (blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllVariables(blockName);
  },

  thresholds: function (blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllThresholds(blockName);
  },

  levels: function (blockName) {
    // return the distinct list of all the possible variables for this stat
    return getAllLevels(blockName);
  },

  varsLength: function (blockName) {
    let maxLength = 0;
    const varList = getAllVariables(blockName);
    varList.forEach(function (aVar) {
      maxLength = aVar.length > maxLength ? aVar.length : maxLength;
    });
    return maxLength;
  },

  statsLength: function (blockName) {
    let maxLength = 0;
    const statList = getAllStats(blockName);
    statList.forEach(function (aStat) {
      maxLength = aStat.length > maxLength ? aStat.length : maxLength;
    });
    return maxLength;
  },

  plotParams: function () {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return JSON.stringify(myScorecard['scorecard']['results']['plotParams']);
  },

  Title: function () {
    let processedAtstamp = 'unprocessed';
    if (Number(this.processedAt) !== 0) {
      processedAtstamp = new Date(this.processedAt * 1000).toUTCString();
    }
    return this.userName + ' : ' + this.name + ' : ' + processedAtstamp;
  },
  fileNamePlaceholder: function () {
    let x = new Date(this.submitted * 1000);
    let y = x.getFullYear().toString();
    let m = (x.getMonth() + 1).toString();
    let d = x.getDate().toString();
    d.length === 1 && (d = '0' + d);
    m.length === 1 && (m = '0' + m);
    let yyyymmdd = y + m + d;
    return this.name + '-' + yyyymmdd;
  },
  hideLoading: function () {
    hideLoading();
  },
  trimmedText: function (text) {
    if (typeof text === 'string' || text instanceof String) {
      text = text.replace(/__DOT__/g, ".");
      text = text.split(" (")[0];
    }
      return text
  },
  thresholdHider: function (blockName) {
    const thresholds = getAllThresholds(blockName);
    return thresholds[0] === "threshold_NA" ? "display: none;" : "";
  },
  levelHider: function (blockName) {
    const levels = getAllLevels(blockName);
    return levels[0] === "level_NA" ? "display: none;" : "";
  },
});

Template.ScorecardDisplay.events({
  'click .refresh-scorecard': function (event) {
    refreshScorecard(this.userName, this.name, this.submitted, this.processedAt);
  },
  'click .exportpdf': function (e) {
    $('.previewCurveButtons').each(function (i, obj) {
      obj.style.display = 'none';
    });
    html2canvas(document.querySelector('#graph-container'), {
      scale: 3.0,
    }).then((canvas) => {
      var h = 419.53;
      var w = 595.28;
      var filename = document.getElementById('exportFileName').value;
      let pdf = new jsPDF('letter', 'pt', 'a5');
      pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, 0, w, h);
      pdf.save(filename);
      $('.previewCurveButtons').each(function (i, obj) {
        obj.style.display = 'block';
      });
    });
  },
  'click .exportpng': function (e) {
    $('.previewCurveButtons').each(function (i, obj) {
      obj.style.display = 'none';
    });
    html2canvas(document.querySelector('#graph-container'), {
      scale: 3.0,
    }).then((canvas) => {
      var h = 419.53;
      var w = 595.28;
      var filename = document.getElementById('exportFileName').value;
      saveAs(canvas.toDataURL(), filename + '.png');
      $('.previewCurveButtons').each(function (i, obj) {
        obj.style.display = 'block';
      });
    });

    function saveAs(uri, filename) {
      var link = document.createElement('a');
      if (typeof link.download === 'string') {
        link.href = uri;
        link.download = filename;

        //Firefox requires the link to be in the body
        document.body.appendChild(link);

        //simulate click
        link.click();

        //remove the link when done
        document.body.removeChild(link);
      } else {
        window.open(uri);
      }
    }
  },
  'click .scTableSigTd': function (e) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const block = e.currentTarget.dataset.scorecardblock;
    const blockData = myScorecard['scorecard'].plotParams.curves.find((r) => r['label'] === block);
    const application = blockData['application'];
    // When comparing models, you want forecast minus truth.
    // MATS differences are calculated by Curve1 - Curve0,
    // so Curve1 is the data-source and Curve0 is the control-data-source
    const curve0Model = blockData['control-data-source'];
    const curve1Model = blockData['data-source'];
    const scorecardSettings = {
      "appName": application,
      "dateRange": myScorecard['scorecard'].plotParams.dates,
      "curve0DataSource": curve0Model,
      "curve1DataSource": curve1Model,
      "commonCurveParams":
      {
        "region": e.currentTarget.dataset.region
            ? e.currentTarget.dataset.region.replace(/__DOT__/g, ".") : "undefined",
        "forecast-length": e.currentTarget.dataset.fcstlen && !blockData['forecast-type']
            ? parseInt(e.currentTarget.dataset.fcstlen).toString().replace(/__DOT__/g, ".") : "undefined",
        "statistic": e.currentTarget.dataset.stat
            ? e.currentTarget.dataset.stat.replace(/__DOT__/g, ".") : "undefined",
        "variable": e.currentTarget.dataset.variable
            ? e.currentTarget.dataset.variable.replace(/__DOT__/g, ".") : "undefined",
        "threshold": e.currentTarget.dataset.threshold && e.currentTarget.dataset.threshold !== "threshold_NA"
            ? e.currentTarget.dataset.threshold.replace(/__DOT__/g, ".") : "undefined",
        "level": e.currentTarget.dataset.level && e.currentTarget.dataset.level !== "level_NA"
            ? e.currentTarget.dataset.level.replace(/__DOT__/g, ".") : "undefined",
        "scale": blockData['scale'] ? blockData['scale'] : "undefined",
        "truth": blockData['truth'] ? blockData['truth'] : "undefined",
        "forecast-type": blockData['forecast-type'] ? blockData['forecast-type'] : "undefined",
        "valid-time": blockData['valid-time'] ? blockData['valid-time'] : "undefined",
      }
    };
    const baseURL = Meteor.settings.public.home === undefined ? "https://" + document.location.href.split('/')[2] : Meteor.settings.public.home;
    const appSource = getAppSourceByApplication(application);

    const settingsJSON = JSON.stringify(scorecardSettings);
    const hash = require('object-hash');
    const key = hash(settingsJSON);
    matsMethods.saveScorecardSettings.call({
      settingsKey: key,
      scorecardSettings: settingsJSON
    }, function (error) {
      if (error !== undefined) {
        setError(error);
      } else {
        // now that the settings are saved, open a new window and pass the key to it.
        if (baseURL.includes("localhost")) {
          e.view.window.open(baseURL + "/scorecardTimeseries/" + key, '_blank');
        } else {
          e.view.window.open(baseURL + "/" + appSource + "/scorecardTimeseries/" + key, '_blank');
        }
      }
    });
  },
});
