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

const getAllStats = function (rowName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }
  const myRegions = Object.keys(myScorecard['scorecard']['results']['rows'][rowName]['data']);
  let myStats = new Set();
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['rows'][rowName]['data'][r]);
    rStats.forEach(function (s) {
      myStats.add(s);
    });
  });
  return Array.from(myStats).sort();
};

const getAllVariables = function (rowName) {
  let myScorecard = Session.get('myScorecard');
  if (myScorecard === undefined) {
    return;
  }

  let myVars = new Set();
  let myStats = new Set();
  const myRegions = Object.keys(myScorecard['scorecard']['results']['rows'][rowName]['data']);
  myRegions.forEach(function (r) {
    const rStats = Object.keys(myScorecard['scorecard']['results']['rows'][rowName]['data'][r]);
    rStats.forEach(function (s) {
      const rVars = Object.keys(myScorecard['scorecard']['results']['rows'][rowName]['data'][r][s]);
      rVars.forEach(function (v) {
        myVars.add(v);
      });
    });
  });
  return Array.from(myVars).sort();
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
      var myScorecard = scorecard;
      Session.set('myScorecard', myScorecard);
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
  document.querySelector('#scorecardDisplayLoading').style.display = 'none';
};

Template.ScorecardDisplay.onRendered(function () {
  //  onVisible(document.querySelector("#scorecard-display-container"), hideLoading());
  refreshScorecard(this.data.userName, this.data.name, this.data.submitted, this.data.processedAt);
});

Template.ScorecardDisplay.onCreated(function () {
  getScorecard(this.data.userName, this.data.name, this.data.submitted, this.data.processedAt);
});

Template.ScorecardDisplay.helpers({
  application: function (rowName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const application = myScorecard['scorecard'].plotParams.curves
      .find((r) => r['label'] == rowName)
      ['application'].toLowerCase();
    return application;
  },
  rowTitle: function (rowName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const rowTitle = myScorecard['scorecard']['results']['rows'][rowName]['rowTitle'];
    return (
      'Scorecard Row: ' +
      rowName +
      ' Datasource: ' +
      rowTitle['datasource'] +
      ' ValidationDatasource: ' +
      rowTitle['validationDatasource']
    );
  },
  scorecardRows: function () {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return Object.keys(myScorecard['scorecard']['results']['rows']).sort();
  },
  regions: function (rowName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return myScorecard['scorecard']['results']['rows'][rowName]['regions'].sort();
  },
  fcstlens: function (rowName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    let myFcstlenStrs = myScorecard['scorecard']['results']['rows'][rowName]['fcstlens'];
    let myFcstLengths = [];
    let fcstLength = myFcstlenStrs.length;
    // padd the fcst lengths with leading '0' for single digit fcsts
    for (let i = 0; i < fcstLength; i++) {
      myFcstLengths[i] = (Number(myFcstlenStrs[i]) < 10 ? '0' : '') + myFcstlenStrs[i];
    }
    return myFcstLengths.sort();
  },
  numFcsts: function (rowName) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    return myScorecard['scorecard']['results']['rows'][rowName]['fcstlens'].length;
  },
  sigIconId: function (rowName, region, stat, variable, fcstlen) {
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    return rowName + '-' + region + '-' + stat + '-' + variable + '-' + fcstlenStr;
  },
  significanceClass: function (rowName, region, stat, variable, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    const sigVal =
      myScorecard['scorecard']['results']['rows'][rowName]['data'][region][stat][variable][
        fcstlenStr
      ];
    const majorTruthIcon = 'fa fa-caret-down fa-lg';
    const minorTruthIcon = 'fa fa-caret-down fa-sm';
    const majorSourceIcon = 'fa fa-caret-up fa-lg';
    const minorSourceIcon = 'fa fa-caret-up fa-sm';
    const neutralIcon = 'fa icon-check-empty fa-sm';
    if (sigVal == -2) {
      return majorSourceIcon;
    }
    if (sigVal == -1) {
      return minorSourceIcon;
    }
    if (sigVal == 0) {
      return neutralIcon;
    }
    if (sigVal == 2) {
      return majorTruthIcon;
    }
    if (sigVal == 1) {
      return minorTruthIcon;
    }
  },
  significanceColor: function (rowName, region, stat, variable, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    const sigVal =
      myScorecard['scorecard']['results']['rows'][rowName]['data'][region][stat][variable][
        fcstlenStr
      ];
    if (sigVal == -2) {
      return myScorecard['scorecard']['significanceColors']['major-truth-color'];
    }
    if (sigVal == -1) {
      return myScorecard['scorecard']['significanceColors']['minor-truth-color'];
    }
    if (sigVal == 0) {
      return 'lightgrey ';
    }
    if (sigVal == 2) {
      return myScorecard['scorecard']['significanceColors']['major-source-color'];
    }
    if (sigVal == 1) {
      return myScorecard['scorecard']['significanceColors']['minor-source-color'];
    }
  },
  significanceBackgroundColor: function (rowName, region, stat, variable, fcstlen) {
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    //un padd the possibly padded fcstlen
    let fcstlenStr = Number(fcstlen) + '';
    const sigVal =
      myScorecard['scorecard']['results']['rows'][rowName]['data'][region][stat][variable][
        fcstlenStr
      ];
    if (sigVal == -2) {
      return LightenDarkenColor(
        myScorecard['scorecard']['significanceColors']['major-truth-color'],
        180
      );
    }
    if (sigVal == -1) {
      return LightenDarkenColor(
        myScorecard['scorecard']['significanceColors']['minor-truth-color'],
        220
      );
    }
    if (sigVal == 0) {
      return 'lightgrey';
    }
    if (sigVal == 2) {
      return LightenDarkenColor(
        myScorecard['scorecard']['significanceColors']['major-source-color'],
        180
      );
    }
    if (sigVal == 1) {
      return LightenDarkenColor(
        myScorecard['scorecard']['significanceColors']['minor-source-color'],
        220
      );
    }
  },
  stats: function (rowName) {
    // return a distinct list of all the possible stats
    return getAllStats(rowName);
  },

  variables: function (rowName) {
    // return the distinct list of all the possible variables for this stat
    return getAllVariables(rowName);
  },

  varsLength: function (rowName) {
    let maxLength = 0;
    const varList = getAllVariables(rowName);
    varList.forEach(function (aVar) {
      maxLength = aVar.length > maxLength ? aVar.length : maxLength;
    });
    return maxLength;
  },

  statsLength: function (rowName) {
    let maxLength = 0;
    const statList = getAllStats(rowName);
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
    if (this.processedAt != 0) {
      processedAtstamp = new Date(this.processedAt * 1000).toUTCString();
    }
    return this.userName + ' : ' + this.name + ' : ' + processedAtstamp;
  },
  fileNamePlaceholder: function () {
    let x = new Date(this.submitted * 1000);
    let y = x.getFullYear().toString();
    let m = (x.getMonth() + 1).toString();
    let d = x.getDate().toString();
    d.length == 1 && (d = '0' + d);
    m.length == 1 && (m = '0' + m);
    let yyyymmdd = y + m + d;
    return this.name + '-' + yyyymmdd;
  },
  hideLoading: function () {
    hideLoading();
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
    // this needs to be a lot more intelligent
    let myScorecard = Session.get('myScorecard');
    if (myScorecard === undefined) {
      return;
    }
    const row = e.currentTarget.dataset.scorecardrow;
    const region = e.currentTarget.dataset.region;
    const stat = e.currentTarget.dataset.stat;
    const variable = e.currentTarget.dataset.variable;
    const fcstlen = e.currentTarget.dataset.fcstlen;
    const plotParams = myScorecard.plotParams;
    const plotParamsJSON = JSON.stringify(plotParams);
    const application = myScorecard['scorecard'].plotParams.curves
      .find((r) => r['label'] == row)
      ['application'].toLowerCase();
    e.view.window.open('https://www.esrl.noaa.gov/gsd/mats/' + application, '_blank');
  },
});
