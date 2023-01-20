/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {Meteor} from 'meteor/meteor';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    matsCollections,
    matsCurveUtils,
    matsGraphUtils,
    matsMethods,
    matsTypes
} from 'meteor/randyp:mats-common';
import {Template} from 'meteor/templating';
import './scorecardDisplay.html';

Template.ScorecardDisplay.created = function (){
    var self = this;
    self.myScorecard = new ReactiveVar();
    matsMethods.getScorecardData.call({userName:this.data.userName,name:this.data.name,submitTime:this.data.submitTime,runTime:this.data.runTime}, function (error, ret) {
        if (error !== undefined) {
            setError(error);
            self.myScorecard.set({"error":error.message});
        } else {
            self.myScorecard.set(ret);
        }
    });
};


Template.ScorecardDisplay.helpers({
    rows: function() {
        return [];
    },

    regions: function() {
        return [];
    },

    scorecardRows: function() {

    },

    scorecardDispay: function () {
        return "block";
    },
    Title: function () {
        return this.userName + " : " + this.name + " : " + this.timestamp;
    },
    fileNamePlaceholder: function() {
        let x = new Date(this.timestamp);
        let y = x.getFullYear().toString();
        let m = (x.getMonth() + 1).toString();
        let d = x.getDate().toString();
        (d.length == 1) && (d = '0' + d);
        (m.length == 1) && (m = '0' + m);
        let yyyymmdd = y + m + d;
        return this.name + '-' + yyyymmdd;
    }
});

Template.ScorecardDisplay.events({
    'click .exportpdf': function (e) {
        $(".previewCurveButtons").each(function (i, obj) {
            obj.style.display = "none";
        });
        html2canvas(document.querySelector('#graph-container'), {scale: 3.0}).then(canvas => {
            var h = 419.53;
            var w = 595.28;
            var filename = document.getElementById("exportFileName").value;
            let pdf = new jsPDF('letter', 'pt', 'a5');
            pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, 0, w, h);
            pdf.save(filename);
            $(".previewCurveButtons").each(function (i, obj) {
                obj.style.display = "block";
            });
        });
    },
    'click .exportpng': function (e) {
        $(".previewCurveButtons").each(function (i, obj) {
            obj.style.display = "none";
        });
        html2canvas(document.querySelector('#graph-container'), {scale: 3.0}).then(canvas => {
            var h = 419.53;
            var w = 595.28;
            var filename = document.getElementById("exportFileName").value;
            saveAs(canvas.toDataURL(), filename + '.png');
            $(".previewCurveButtons").each(function (i, obj) {
                obj.style.display = "block";
            });
        });

        function saveAs(uri, filename) {
            var link = document.createElement('a');
            if (typeof link.download === 'string') {
                link.href = uri;
                link.download = filename;

                //Firefox requires the link to be in the body
                document.body.appendChild(link);

                //simulate click
                link.click();

                //remove the link when done
                document.body.removeChild(link);
            } else {
                window.open(uri);
            }
        }
    }
});

