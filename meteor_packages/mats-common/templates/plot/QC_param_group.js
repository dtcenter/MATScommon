/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections } from 'meteor/randyp:mats-common';
import { matsParamUtils } from 'meteor/randyp:mats-common';
import { matsTypes } from 'meteor/randyp:mats-common';
import { plotParamHandler } from 'meteor/randyp:mats-common';

Template.QCParamGroup.helpers({
    completenessNumber: function () {
        return '0';
    },
    noQC: function () {
        return true;
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

Template.QCParamGroup.events({

});