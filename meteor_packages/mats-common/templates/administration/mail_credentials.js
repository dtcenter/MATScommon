import { Meteor } from 'meteor/meteor';
import {matsCollections} from 'meteor/randyp:mats-common';
import {methods} from 'meteor/randyp:mats-common';

Template.mailCredentials.helpers({
    name : function() {
        var credentials = matsCollections.Credentials.findOne({});
        return credentials === undefined ? "" : credentials.name;
    },
    client_id: function(){
        var credentials = matsCollections.Credentials.findOne({});
        return credentials === undefined ? "" : credentials.clientId;
    },
    client_secret: function(){
        var credentials = matsCollections.Credentials.findOne({});
        return credentials === undefined ? "" : credentials.clientSecret;
    },
    refresh_token: function(){
        var credentials = matsCollections.Credentials.findOne({});
        return credentials === undefined ? "" : credentials.refresh_token;
    }

});

Template.mailCredentials.events({
    'click .apply_credentials': function () {
        var name = document.getElementById("credentials-name").value;
        var clientId = document.getElementById("credentials_client_id").value;
        var clientSecret = document.getElementById("credentials_client_secret").value;
        var clientRefreshToken = document.getElementById("credentials_client_refresh_token").value;

        var settings = {};
        settings.name = name;
        settings.clientId = clientId;
        settings.clientSecret = clientSecret;
        settings.clientRefreshToken = clientRefreshToken;
        methods.setCredentials( settings, function (error) {
            if (error) {
                setError(new Error(error.message));
            }
        });
        // reset modal
        document.getElementById("credentials-name").value = "";
        document.getElementById("credentials_client_id").value = "";
        document.getElementById("credentials_client_secret").value = "";
        document.getElementById("credentials_client_refresh_token").value = "";
        $("#authorizationModal").modal('hide');
        return false;
    },
    'click .cancel-credentials': function() {
        // reset the form
        var credentials = matsCollections.Credentials.findOne({});
        document.getElementById("credentials-name").value = credentials.name;
        document.getElementById("credentials_client_id").value = credentials.clientId;
        document.getElementById("credentials_client_secret").value = credentials.clientSecret;
        document.getElementById("credentials_client_refresh_token").value = credentials.refresh_token;
    }
});


