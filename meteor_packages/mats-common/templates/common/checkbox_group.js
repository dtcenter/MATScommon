/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes } from 'meteor/randyp:mats-common';
Template.checkboxGroup.helpers({
    checkedByDefault: function (def) {
        if (def == this) {
            return "checked";
        } else {
           return "";
        }
    },
    labelValue: function (optionsMap) {
        if (optionsMap !== undefined) {
            return optionsMap[this];
        } else {
            return this;
        }
    }
});

Template.checkboxGroup.events({
    'change, blur': function (event) {
        try {
            var text = event.currentTarget.value;
            matsParamUtils.setValueTextForParamName(event.target.name, text);
        } catch (error) {
            matsParamUtils.setValueTextForParamName(event.target.name, "");
        }
    }
});
