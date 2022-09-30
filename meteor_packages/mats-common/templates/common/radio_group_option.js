/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes } from 'meteor/randyp:mats-common';
Template.radioGroup.helpers({
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

 /*
    NOTE: hideOtherFor - radio button groups.
    The hideOtherFor plotParam option for radio groups is similar to hideOtherFor for select params.
    The key in the map is the param name that is to be hidden for any of the values in the value array.
    hideOtherFor: {
        'param-name-to-be-hidden':['checked-option-that-hides','other-checked-option-that-hides', ...]
    }

    example:
    hideOtherFor: {
        'scorecard-recurrence-interval':['once'],
        'these-hours-of-the-day':['once'],
        'these-days-of-the-week':['once'],
        'these-days-of-the-month':['once'],
        'these-months':['once'],
        'dates':['recurring']
    },

    */
Template.radioGroup.events({
    'change, blur': function (event) {
        try {
            var text = event.currentTarget.value;
            matsParamUtils.setValueTextForParamName(event.target.name,text);
            // check hide other for
            /*
            document.getElementById(event.currentTarget.id).value
            matsParamUtils.getParameterForName(event.currentTarget.name).hideOtherFor
            Object.keys(matsParamUtils.getParameterForName(event.currentTarget.name).hideOtherFor)
            document.getElementById(event.currentTarget.id).parentElement.style.display="none"
            */
            const value = document.getElementById(event.currentTarget.id).value;
            if (matsParamUtils.getParameterForName(event.currentTarget.name) === undefined) {
                return;
            }
            const hideOthersFor = matsParamUtils.getParameterForName(event.currentTarget.name).hideOtherFor
            if (hideOthersFor === undefined) {
                return;
            }
            const paramsOfConcern = Object.keys(hideOthersFor);
            paramsOfConcern.forEach(function(p,i) {
                let itemElem = document.getElementById(p + "-item");
                if (itemElem === undefined) {
                    return;
                }
                if (hideOthersFor[p].includes(value)) {
                    // got to hide this one
                    itemElem.style.display="none";
                } else {
                    // got to show this one
                    itemElem.style.display="block"
                }
            });
        } catch (error){
            matsParamUtils.setValueTextForParamName(event.target.name, "");
        }
    }
});

