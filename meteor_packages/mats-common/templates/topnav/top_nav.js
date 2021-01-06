/*
 * Copyright (c) 2020 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import matsMethods from "../../imports/startup/api/matsMethods";

const getRunEnvironment = function () {
    if (Session.get('deployment_environment') == undefined) {
        matsMethods.getRunEnvironment.call({}, function (error, result) {
            if (error !== undefined) {
                setError(error);
                return "<p>" + error + "</p>";
            }
            Session.set('deployment_environment', result);
            return result;
        });
    } else {
        return Session.get('deployment_environment')
    }
}

Template.topNav.helpers({
    transparentGif: function() {
        return  document.location.href + "/img/noaa_transparent.gif";
    },
    emailText: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "METexpress";
                break;
            default:
                if (matsCollections.Settings.findOne({}) !== undefined && matsCollections.Settings.findOne({}).appType !== undefined) {
                    const appType = matsCollections.Settings.findOne({}).appType;
                    return appType === matsTypes.AppTypes.metexpress ? "METexpress" : "MATS";
                } else {
                    return "MATS";
                }
        }
    },
    agencyText: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "National Weather Service";
                break;
            default:
                return "Global Systems Laboratory";
        }
    },
    agencyLink: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "https://www.weather.gov/";
                break;
            default:
                return "http://esrl.noaa.gov/gsd/";
        }
    },
    productText: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "METexpress";
                break;
            default:
                if (matsCollections.Settings.findOne({}) !== undefined && matsCollections.Settings.findOne({}).appType !== undefined) {
                    const appType = matsCollections.Settings.findOne({}).appType;
                    return appType === matsTypes.AppTypes.metexpress ? "METexpress" : "Model Analysis Tool Suite (MATS)";
                } else {
                    return "Model Analysis Tool Suite (MATS)";
                }
        }
    },
    productLink: function () {
            const location = document.location.href;
            const locationArr = location.split('/');
            locationArr.pop();
            return locationArr.join('/');
    },
    bugsText: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "Bugs/Issues (GitHub)";
                break;
            default:
                if (matsCollections.Settings.findOne({}) !== undefined && matsCollections.Settings.findOne({}).appType !== undefined) {
                    const appType = matsCollections.Settings.findOne({}).appType;
                    return appType === matsTypes.AppTypes.metexpress ? "Bugs/Issues (GitHub)" : "Bugs/Issues (Vlab)";
                } else {
                    return "Bugs/Issues (Vlab)";
                }
        }
    },
    bugsLink: function () {
        switch (getRunEnvironment()) {
            case "metexpress":
                return "https://github.com/dtcenter/METexpress/issues";
                break;
            default:
                if (matsCollections.Settings.findOne({}) !== undefined && matsCollections.Settings.findOne({}).appType !== undefined) {
                    const appType = matsCollections.Settings.findOne({}).appType;
                    return appType === matsTypes.AppTypes.metexpress ? "https://github.com/dtcenter/METexpress/issues" : "https://vlab.ncep.noaa.gov/redmine/projects/mats-users/issues";
                } else {
                    return "https://vlab.ncep.noaa.gov/redmine/projects/mats-users/issues";
                }
        }
    },
    isMetexpress: function () {
        if (matsCollections.Settings.findOne({}) !== undefined && matsCollections.Settings.findOne({}).appType !== undefined) {
            const appType = matsCollections.Settings.findOne({}).appType;
            return appType === matsTypes.AppTypes.metexpress;
        } else {
            return false;
        }
    }
});

Template.topNav.events({
    'click .about': function () {
        $("#modal-display-about").modal();
        return false;
    }
});
