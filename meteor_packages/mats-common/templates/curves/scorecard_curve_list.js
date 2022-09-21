/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsTypes} from "meteor/randyp:mats-common";
import {matsCollections} from "meteor/randyp:mats-common";
import {matsMethods} from "meteor/randyp:mats-common";
import {matsCurveUtils} from 'meteor/randyp:mats-common';
import {matsPlotUtils} from 'meteor/randyp:mats-common';
import {matsParamUtils} from 'meteor/randyp:mats-common';

Template.scorecardCurveList.helpers({
    curves: function () {
        return Session.get('Curves');
    },
    displayCurves: function () {
        if (Session.get('Curves') === undefined || Session.get('Curves').length === 0) {
            return "none";
        } else {
            return "block";
        }
    },
    log: function () {
        console.log(this);
    },
    editMode: function() {
        if (Session.get('editMode') === '') {
            return '';
        } else {
            return "Changing " + Session.get('editMode');
        }
    },
});

Template.scorecardCurveList.events({
    'click .remove-all': function () {
        if (Session.get("confirmRemoveAll")) {
            matsCurveUtils.clearAllUsed();
            matsParamUtils.setAllParamsToDefault();
            Session.set("editMode", "");
            Session.set("paramWellColor", "#f5f5f5");  // default grey
            Session.set("lastUpdate", Date.now());
            Session.set("confirmRemoveAll","");
            return false;
        } else {
            if (Session.get("Curves").length > 0 ) {
                $("#modal-confirm-remove-all").modal();
            }
        }
    },
    'click .confirm-remove-all': function () {
        Session.set("confirmRemoveAll", Date.now());
        $("#remove-all").trigger('click');
    },
    'click .submit-rows': function (event) {
        document.getElementById("spinner").style.display = "block";
        matsPlotUtils.disableActionButtons();
        event.preventDefault();
        return false;
    },
});