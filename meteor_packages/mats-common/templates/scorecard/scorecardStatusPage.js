/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import {
    matsPlotUtils,
    matsGraphUtils,
    matsCurveUtils,
    matsMethods,
} from 'meteor/randyp:mats-common';


function toggleDisplay(divId) {
    var x = document.getElementById(divId);
    if (x.style.display === "none") {
      x.style.display = "block";
    } else {
      x.style.display = "none";
    }
}

function getUserNames(){
    // userlist is subscribed in init.js
    //return Meteor.allUsers.find();
    ids = []
    if (Meteor.users.find().fetch()[0] !== undefined) {
        users=Meteor.users.find().fetch()
        users.forEach(function addUserEmail(user){
            ids.push(user.emails[0].address);
        })
        return ids;
    }
}

function getNamesForUser(userName) {
    // myScorecardInfo is keyed by userName
    return Object.keys(myScorecardInfo);
};

function getRunTimesForUserName(userName, name){
    let runtimes=[];
    let dt = new Date('07/1/2022');
    let end = new Date('08/1/2022');
    while (dt <= end) {
        runtimes.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return runtimes;
}


Template.scorecardStatusPage.created = function (){
    matsMethods.getScorecardInfo.call(function (error, ret) {
        if (error !== undefined) {
            setError(error);
        } else {
            Session.set("updateStatusPage", ret);
        }
    });
};

Template.scorecardStatusPage.helpers({
    refresh: function(){
        if (Session.get("updateStatusPage") === undefined){
            matsMethods.getScorecardInfo.call(function (error, ret) {
                if (error !== undefined) {
                    setError(error);
                } else {
                    Session.set("updateStatusPage", ret);
                }
            });
        }
    },
    image: function () {
        var img = "underConstruction.jpg";
        return img;
    },
    userNames: function() {
        // uses reactive var
        // myScorecardInfo is keyed by userNames
        return Session.get("updateStatusPage") === undefined? [] : Object.keys(Session.get("updateStatusPage")).sort();
    },
    names: function(userName) {
        // uses reactive var
        // myScorecardInfo[userName] is keyed by scorecard names
            return Session.get("updateStatusPage") === undefined? [] : Object.keys(Session.get("updateStatusPage")[userName]).sort();
    },
    submitTimes: function(userName, name) {
        // uses reactive var
        // myScorecardInfo[userName][name] is keyed by scorecard runtimes
            return Session.get("updateStatusPage") === undefined? [] : Object.keys(Session.get("updateStatusPage")[userName][name]).sort();
    },

    runTimes: function(userName, name, submitTime) {
        // uses reactive var
        // myScorecardInfo[userName][name] is keyed by scorecard runtimes
            return Session.get("updateStatusPage") === undefined? [] : Object.keys(Session.get("updateStatusPage")[userName][name][submitTime]).sort();
    },
    status: function(userName, name, submitTime, runTime) {
            return Session.get("updateStatusPage")[userName][name][submitTime][runTime]['status']
    },
    statusType: function(userName, name, submitTime, runTime) {
            if (Session.get("updateStatusPage") !== undfined && Session.get("updateStatusPage")[userName][name][submitTime][runTime]['status'] === "Pending") {
                return "danger";
            } else {
                return 'Success';
            }
    },
    visitLink: function(userName, name, submitTime, runTime) {
            return '/scorecard_display/' + userName + '/' + name + '/' + submitTime + '/' + runTime
    },
    scid:  function(userName, name, submitTime, runTime) {
        return userName + '_' + name + '_' + submitTime + '_' + runTime;
    },
    timeStr: function (epoch) {
        if (Number(epoch) === 0) {
            return "none"
        } else {
            let d = new Date(0); // The 0 there is the key, which sets the date to the epoch
            d.setUTCSeconds(Number(epoch));
            return d.toUTCString();
        }
    }
});

Template.scorecardStatusPage.events({
    'click .back': function (event) {
        matsPlotUtils.enableActionButtons();
        matsGraphUtils.setDefaultView();
        matsCurveUtils.resetPlotResultData();
        return false;
    },
    'click .refresh-scorecard': function(event) {
        matsMethods.getScorecardInfo.call(function (error, ret) {
            if (error !== undefined) {
                setError(error);
            } else {
                Session.set("updateStatusPage", ret);
            }
        });
    },
    'click .userName-control': function(event) {
        toggleDisplay(event.currentTarget.attributes['data-target'].value);
    },
    'click .userName-name-control': function(event) {
        toggleDisplay(event.currentTarget.attributes['data-target'].value);
    },
    'click .drop-sc-instance': function(e) {
        const userName=e.currentTarget.dataset.user_name;
        const name=e.currentTarget.dataset.name;
        const submitTime=e.currentTarget.dataset.submit_time;
        const runTime=e.currentTarget.dataset.run_time;

        matsMethods.dropScorecardInstance.call({userName:userName,name:name,submitTime:submitTime,runTime}, function (error) {
            if (error !== undefined) {
                setError(error);
            } else {
                // refresh the list
                matsMethods.getScorecardInfo.call(function (error, ret) {
                    if (error !== undefined) {
                        setError(error);
                    } else {
                        Session.set("updateStatusPage", ret);
                    }
                });
            }
        });
    },
});