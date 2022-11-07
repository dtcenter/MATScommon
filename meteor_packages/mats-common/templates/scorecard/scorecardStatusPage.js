/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
function stringToHash(string) {
    var hash = 0;
    if (string.length == 0) return hash;
    for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

function toggleDisplay(divId) {
    var x = document.getElementById(divId);
    if (x.style.display === "none") {
      x.style.display = "block";
    } else {
      x.style.display = "none";
    }
}

function getUsers(){
    return ["amanda-back", "ben-green", "bonny-strong", "dave-turner", "eric-james", "ian-mcginnis", "jeffrey-a-hamilton", "keith-searight", "molly-b-smith", "ruifang-li", "shan-sun", "stephen-weygandt", "tanya-smirnova"];
}

function getNamesForUser(user) {
    return ["hrrr-ops-retro-33-hrrr-ops", "hrrr_ops-rap_ops-retro1","hrrr_ops-rap_ops"];
}

function getRunTimesForUserName(user, name){
    let runtimes=[];
    let dt = new Date('07/1/2022');
    let end = new Date('08/1/2022');
    while (dt <= end) {
        runtimes.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return runtimes;
}

Template.scorecardStatusPage.helpers({
    image: function () {
        var img = "underConstruction.jpg";
        return img;
    },
    users: function() {
        return getUsers();
    },
    names: function(user) {
        return getNamesForUser(user);
    },
    runtimes: function(user, name) {
        return getRunTimesForUserName(user, name);
    },
    status: function(user, name, runtime) {
        hash = stringToHash(user + "-" + name + "-" + runtime)
        if (hash % 2 == 0) {
            return "pending";
        } else {
            return "ready";
        }
    },
    statusType: function(user, name, runtime) {
        hash = stringToHash(user + "-" + name + "-" + runtime)
        if (hash % 2 == 0) {
            return "danger";
        } else {
            return "success";
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
        return false;
    },
    'click .user-control': function(event) {
        toggleDisplay(event.currentTarget.attributes['data-target'].value);
    },
    'click .user-name-control': function(event) {
        toggleDisplay(event.currentTarget.attributes['data-target'].value);
    }
});