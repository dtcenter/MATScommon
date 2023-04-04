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

function getprocessedAtsForUserName(userName, name){
    let processedAts=[];
    let dt = new Date('07/1/2022');
    let end = new Date('08/1/2022');
    while (dt <= end) {
        processedAts.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return processedAts;
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
        if (Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number"){
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
        return Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number" ? [] : Object.keys(Session.get("updateStatusPage")).sort();
    },
    names: function(userName) {
        // uses reactive var
        // myScorecardInfo[userName] is keyed by scorecard names
            return Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number" ? [] : Object.keys(Session.get("updateStatusPage")[userName]).sort();
    },
    submittedTimes: function(userName, name) {
        // uses reactive var
        // myScorecardInfo[userName][name] is keyed by scorecard processedAts
            return Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number" ? [] : Object.keys(Session.get("updateStatusPage")[userName][name]).sort();
    },

    processedAtTimes: function(userName, name, submitted) {
        // uses reactive var
        // myScorecardInfo[userName][name] is keyed by scorecard processedAts
            return Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number" ? [] : Object.keys(Session.get("updateStatusPage")[userName][name][submitted]).sort();
    },
    status: function(userName, name, submitted, processedAt) {
            return Session.get("updateStatusPage") === undefined || typeof Session.get("updateStatusPage") === "number" ? "" : Session.get("updateStatusPage")[userName][name][submitted][processedAt]['status']
    },
    statusType: function(userName, name, submitted, processedAt) {
            if (Session.get("updateStatusPage") !== undefined && typeof Session.get("updateStatusPage") !== "number" && Session.get("updateStatusPage")[userName][name][submitted][processedAt]['status'] === "Pending") {
                return "danger";
            } else {
                return 'Success';
            }
    },
    visitLink: function(userName, name, submitted, processedAt) {
        const baseURL = Meteor.settings.public.home === undefined ? "https://" + document.location.href.split('/')[2] : Meteor.settings.public.home;
        if (baseURL.includes("localhost")) {
            return baseURL + "/scorecardDisplay/" + userName + '/' + name + '/' + submitted + '/' + processedAt
        } else {
            return baseURL + "/scorecard/scorecardDisplay/" + userName + '/' + name + '/' + submitted + '/' + processedAt
        }
    },
    scid:  function(userName, name, submitted, processedAt) {
        return userName + '_' + name + '_' + submitted + '_' + processedAt;
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
        const submitted=e.currentTarget.dataset.submit_time;
        const processedAt=e.currentTarget.dataset.processedAt;

        matsMethods.dropScorecardInstance.call({userName:userName,name:name,submitted:submitted,processedAt:processedAt}, function (error) {
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