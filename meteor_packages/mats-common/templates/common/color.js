/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils } from 'meteor/randyp:mats-common'
Template.color.helpers({
    defaultColor: function() {
        return this.default;
    },
});

Template.color.events({
    'click, blur': function (event) {
        try {
            event.target.checkValidity();
            var value = event.currentTarget.value;
            matsParamUtils.setValueTextForParamName(event.target.name,value);
        } catch (error){
            matsParamUtils.setValueTextForParamName(event.target.name, "#000000"); // make it black
        }
    }
});

