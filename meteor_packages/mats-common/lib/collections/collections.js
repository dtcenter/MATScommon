CurveParams = new Meteor.Collection("CurveParams");
CurveTextPatterns = new Meteor.Collection("CurveTextPatterns");
SavedCurveParams = new Meteor.Collection("SavedCurveParams");
PlotParams = new Meteor.Collection("PlotParams");
SavedPlotParams = new Meteor.Collection("SavedPlotParams");
PlotGraphFunctions = new Meteor.Collection("PlotGraphFunctions");
SavedPlotGraphFunctions = new Meteor.Collection("SavedPlotGraphFunctions");
RegionsPerModel = new Meteor.Collection("RegionsPerModel");
SitesPerModel = new Meteor.Collection("SitesPerModel");
RegionDescriptions = new Meteor.Collection("RegionDescriptions");
Models = new Meteor.Collection("Models");
FcstLensPerModel = new Meteor.Collection("FcstLensPerModel");
CurveSettings = new Meteor.Collection("CurveSettings");
Settings = new Meteor.Collection("Settings");
ColorScheme = new Meteor.Collection("ColorScheme");
SentAddresses = new Meteor.Collection("SentAddresses");
Authorization = new Meteor.Collection("Authorization");
Roles = new Meteor.Collection("Roles");
SavedRoles = new Meteor.Collection("SavedRoles");
Databases = new Meteor.Collection("Databases");
SavedDatabases = new Meteor.Collection("SavedDatabases");
Credentials = new Meteor.Collection("Credentials");
SavedCredentials = new Meteor.Collection("SavedCredentials");


InputTypes = {
    textInput : 'textInput',
    select : 'select',
    numberSpinner : 'numberSpinner',
    dateRange: 'dateRange',
    radioGroup: 'radioGroup',
    checkBoxGroup: 'checkBoxGroup',
    resetButton: 'resetButton',
    controlButton: 'controlButton',
    element: 'element',
    selectMap: 'selectMap',
    custom: 'custom'
};

getCurves = function() {
    return Session.get('Curves');
};
