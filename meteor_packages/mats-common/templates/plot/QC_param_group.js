/*
 * Copyright (c) 2019 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections } from 'meteor/randyp:mats-common';
import { matsParamUtils } from 'meteor/randyp:mats-common';
import { matsTypes } from 'meteor/randyp:mats-common';
import { plotParamHandler } from 'meteor/randyp:mats-common';

Template.QCParamGroup.helpers({
    completenessNumber: function () {
        var appType = matsCollections.Settings.findOne({}).appType;
        if (appType === 'anomalycor' || appType === matsTypes.AppTypes.metexpress) {
            return '0';
        } else {
            return '75';
        }
    },
    noQC: function () {
        var appType = matsCollections.Settings.findOne({}).appType;
        return appType === 'anomalycor' || appType === matsTypes.AppTypes.metexpress
    }
});

Template.QCParamGroup.events({

});