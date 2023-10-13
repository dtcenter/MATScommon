/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

Package.describe({
  name: "randyp:mats-common",
  version: "5.1.3",
  // Brief, one-line summary of the package.
  summary: "MATScommon files provides common functionality for MATS/METexpress apps",
  // URL to the Git repository containing the source code for this package.
  git: "",
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: "README.md",
});

Package.onUse(function (api) {
  api.versionsFrom("2.13");
  Npm.depends({
    "@fortawesome/fontawesome-free": "6.4.2",
    "fs-extra": "11.1.1",
    "@babel/runtime": "7.23.2",
    "meteor-node-stubs": "1.2.5",
    url: "0.11.3",
    jquery: "3.7.1",
    "datatables.net-bs": "1.13.6",
    "datatables.net-dt": "1.13.6",
    "jquery-ui": "1.13.2",
    "csv-stringify": "6.4.4",
    "node-file-cache": "1.0.2",
    "python-shell": "5.0.0",
    couchbase: "4.2.7",
    "simpl-schema": "3.4.1",
    "vanillajs-datepicker": "1.3.4",
    daterangepicker: "3.1.0",
    "lighten-darken-color": "1.0.0",
  });
  api.mainModule("server/main.js", "server");
  api.mainModule("client/main.js", "client");

  // meteor packages
  api.use("natestrauser:select2", "client");
  api.use("mdg:validated-method");
  api.use("ecmascript");
  api.use("modules");
  api.imply("ecmascript");
  api.use(["templating"], "client");
  api.use("accounts-ui", "client");
  api.use("accounts-password", "client");
  api.use("service-configuration", "server");
  api.use("yasinuslu:json-view", "client");
  api.use("mdg:validated-method");
  api.use("session");
  api.imply("session");
  api.use("twbs:bootstrap");
  api.use("msavin:mongol");
  api.use("differential:event-hooks");
  api.use("risul:bootstrap-colorpicker");
  api.use("logging");
  api.use("reload");
  api.use("random");
  api.use("ejson");
  api.use("spacebars");
  api.use("check");
  api.use("ostrio:flow-router-extra");
  api.use("meteorhacks:picker");
  api.use("momentjs:moment");
  api.use("pcel:mysql");
  api.use("reactive-var");

  // modules
  api.export("matsCollections", ["client", "server"]);
  api.export("matsTypes", ["client", "server"]);
  api.export("matsMethods", ["client", "server"]);
  api.export("matsCurveUtils", ["client"]);
  api.export("matsSelectUtils", ["client"]);
  api.export("matsGraphUtils", ["client"]);
  api.export("matsParamUtils", ["client", "server"]);
  api.export("matsMathUtils", ["client", "server"]);
  api.export("matsPlotUtils", ["client", "server"]);
  api.export("matsDataUtils", ["server"]);
  api.export("matsDataQueryUtils", ["server"]);
  api.export("matsCouchbaseUtils", ["server"]);
  api.export("matsDataDiffUtils", ["server"]);
  api.export("matsDataMatchUtils", ["server"]);
  api.export("matsDataCurveOpsUtils", ["server"]);
  api.export("matsDataPlotOpsUtils", ["server"]);
  api.export("matsDataProcessUtils", ["server"]);
  api.export("regression", ["client", "server"]);
  api.export("matsCache", ["server"]);
  api.export("versionInfo", ["server", "client"]);
  api.export("matsMiddleCommon", ["server"]);
  api.export("matsMiddleDieoff", ["server"]);
  api.export("matsMiddleTimeSeries", ["server"]);
  api.export("matsMiddleValidTime", ["server"]);
  api.export("matsMiddleDailyModelCycle", ["server"]);
  api.export("matsMiddleMap", ["server"]);

  // add imports
  // both
  api.addFiles("imports/startup/both/index.js");
  api.addFiles("imports/startup/both/mats-types.js");
  api.addFiles("imports/startup/both/mats-collections.js");

  // api
  api.addFiles("imports/startup/api/matsMethods.js");
  api.addFiles("imports/startup/api/version-info.js");

  // layouts
  api.addFiles("imports/startup/ui/layouts/notFound.html", "client");
  api.addFiles("imports/startup/ui/layouts/appBody.html", "client");
  api.addFiles("imports/startup/ui/layouts/appBody.js", "client");

  // client
  api.addFiles("imports/startup/client/curve_util.js");
  api.addFiles("imports/startup/client/graph_util.js");
  api.addFiles("imports/startup/client/select_util.js");
  api.addFiles("imports/startup/client/index.js");
  api.addFiles("imports/startup/client/init.js");
  api.addFiles("imports/startup/client/routes.js");
  api.addFiles("imports/stylesheets/app.css", "client");

  // server
  api.addFiles("imports/startup/server/data_util.js");
  api.addFiles("imports/startup/server/data_query_util.js");
  api.addFiles("imports/startup/server/cb_utilities.js");
  api.addFiles("imports/startup/server/data_diff_util.js");
  api.addFiles("imports/startup/server/data_match_util.js");
  api.addFiles("imports/startup/server/data_curve_ops_util.js");
  api.addFiles("imports/startup/server/data_plot_ops_util.js");
  api.addFiles("imports/startup/server/data_process_util.js");
  api.addFiles("imports/startup/server/index.js");
  api.addFiles("imports/startup/server/publications.js");
  api.addFiles("imports/startup/server/cache.js");
  api.addFiles("imports/startup/server/matsMiddle_common.js");
  api.addFiles("imports/startup/server/matsMiddle_timeSeries.js");
  api.addFiles("imports/startup/server/matsMiddle_dieoff.js");
  api.addFiles("imports/startup/server/matsMiddle_validTime.js");
  api.addFiles("imports/startup/server/matsMiddle_dailyModelCycle.js");
  api.addFiles("imports/startup/server/matsMiddle_map.js");

  // files outside of imports
  // client
  api.addFiles("client/main.html", "client");
  api.addFiles("client/error.js", "client");
  api.addFiles("client/info.js", "client");

  // lib
  api.addFiles("lib/regression.js", ["client", "server"]);
  api.addFiles("lib/param_util.js", ["client", "server"]);
  api.addFiles("lib/plot_util.js", ["client", "server"]);
  api.addFiles("lib/math_util.js", ["client", "server"]);

  // templates
  api.addFiles("templates/Home.html", "client");
  api.addFiles("templates/Home.js", "client");
  api.addFiles("templates/ScorecardHome.html", "client");
  api.addFiles("templates/ScorecardHome.js", "client");
  api.addFiles("templates/CustomHome.html", "client");
  api.addFiles("templates/CustomHome.js", "client");
  api.addFiles("templates/Configure.html", "client");
  api.addFiles("templates/Configure.js", "client");

  api.addFiles("templates/about/about.html", "client");
  api.addFiles("templates/about/about.js", "client");

  api.addFiles("templates/changePlotType/changePlotType.html", "client");
  api.addFiles("templates/changePlotType/changePlotType.js", "client");

  api.addFiles("templates/curves/curve_item.html", "client");
  api.addFiles("templates/curves/curve_item.js", "client");

  api.addFiles("templates/curves/curve_list.html", "client");
  api.addFiles("templates/curves/curve_list.js", "client");

  api.addFiles("templates/curves/curve_param_item_group.html", "client");
  api.addFiles("templates/curves/curve_param_item_group.js", "client");

  api.addFiles("templates/curves/scorecard_curve_list.html", "client");
  api.addFiles("templates/curves/scorecard_curve_list.js", "client");

  api.addFiles("templates/error/error.html", "client");
  api.addFiles("templates/error/error.js", "client");

  api.addFiles("templates/footer/footer.html", "client");
  api.addFiles("templates/footer/footer.js", "client");

  api.addFiles("templates/graph/graph.html", "client");
  api.addFiles("templates/graph/graph.js", "client");

  api.addFiles("templates/graph/displayFunctions/graph_plotly.js", "client");

  api.addFiles("templates/graphStandAlone/graphStandAlone.html", "client");
  api.addFiles("templates/graphStandAlone/graphStandAlone.js", "client");

  api.addFiles("templates/help/help.html", "client");

  api.addFiles("templates/info/info.html", "client");
  api.addFiles("templates/info/info.js", "client");

  api.addFiles("templates/params/curve_param_group.html", "client");
  api.addFiles("templates/params/curve_param_group.js", "client");

  api.addFiles("templates/params/param_list.html", "client");
  api.addFiles("templates/params/param_list.js", "client");

  api.addFiles("templates/params/plot_param_group.html", "client");
  api.addFiles("templates/params/plot_param_group.js", "client");

  api.addFiles("templates/params/scatter_axis.html", "client");
  api.addFiles("templates/params/scatter_axis.js", "client");

  api.addFiles("templates/params/scorecard_param_list.html", "client");
  api.addFiles("templates/params/scorecard_param_list.js", "client");

  api.addFiles("templates/plot/plot_list.html", "client");
  api.addFiles("templates/plot/plot_list.js", "client");

  api.addFiles("templates/plotType/plot_type.html", "client");
  api.addFiles("templates/plotType/plot_type.js", "client");

  api.addFiles("templates/QCParamGroup/QC_param_group.html", "client");
  api.addFiles("templates/QCParamGroup/QC_param_group.js", "client");

  api.addFiles("templates/scorecard/scorecardStatusPage.html", "client");
  api.addFiles("templates/scorecard/scorecardStatusPage.js", "client");

  api.addFiles("templates/scorecardDisplay/scorecardDisplay.html", "client");
  api.addFiles("templates/scorecardDisplay/scorecardDisplay.js", "client");

  api.addFiles("templates/selectorItems/checkbox_group.html", "client");
  api.addFiles("templates/selectorItems/checkbox_group.js", "client");

  api.addFiles("templates/selectorItems/color.html", "client");
  api.addFiles("templates/selectorItems/color.js", "client");

  api.addFiles("templates/selectorItems/date_range.html", "client");
  api.addFiles("templates/selectorItems/date_range.js", "client");

  api.addFiles("templates/selectorItems/item.html", "client");
  api.addFiles("templates/selectorItems/item.js", "client");

  api.addFiles("templates/selectorItems/map.html", "client");
  api.addFiles("templates/selectorItems/map.js", "client");

  api.addFiles("templates/selectorItems/number_spinner.html", "client");
  api.addFiles("templates/selectorItems/number_spinner.js", "client");

  api.addFiles("templates/selectorItems/radio_group_option.html", "client");
  api.addFiles("templates/selectorItems/radio_group_option.js", "client");

  api.addFiles("templates/selectorItems/select.html", "client");
  api.addFiles("templates/selectorItems/select.js", "client");

  api.addFiles("templates/selectorItems/text_input.html", "client");
  api.addFiles("templates/selectorItems/text_input.js", "client");

  api.addFiles("templates/spinner/spinner.html", "client");
  api.addFiles("templates/spinner/spinner.js", "client");

  api.addFiles("templates/textOutput/textOutput.html", "client");
  api.addFiles("templates/textOutput/textOutput.js", "client");

  api.addFiles("templates/topnav/top_nav.html", "client");
  api.addFiles("templates/topnav/top_nav.js", "client");

  api.addFiles("templates/underConstruction/underConstruction.html", "client");
  api.addFiles("templates/underConstruction/underConstruction.js", "client");

  api.addFiles("templates/version/version.html", "client");
  api.addFiles("templates/version/version.js", "client");

  // static assets
  api.addAssets("public/img/bootstrap-colorpicker/alpha-horizontal.png", "client");
  api.addAssets("public/img/bootstrap-colorpicker/alpha.png", "client");
  api.addAssets("public/img/bootstrap-colorpicker/hue-horizontal.png", "client");
  api.addAssets("public/img/bootstrap-colorpicker/hue.png", "client");
  api.addAssets("public/img/bootstrap-colorpicker/saturation.png", "client");
  api.addAssets("public/img/arrow-down.gif", "client");
  api.addAssets("public/img/arrow-left.gif", "client");
  api.addAssets("public/img/arrow-right.gif", "client");
  api.addAssets("public/img/arrow-up.gif", "client");
  api.addAssets("public/img/bg.png", "client");
  api.addAssets("public/img/noaa_transparent.png", "client");
  api.addAssets("public/img/spinner.gif", "client");
  api.addAssets("public/img/building_spinner.gif", "client");
  api.addAssets("public/img/drawing_spinner.gif", "client");
  api.addAssets("public/img/texturetastic_gray.png", "client");
  api.addAssets("public/img/subtle_grunge_@2X.png", "client");
  api.addAssets("public/img/underConstruction.jpg", "client");
  api.addAssets("public/MATSReleaseNotes.html", "server");
  api.addAssets("public/python/python_query_util.py", "server");
  api.addAssets("public/python/python_ctc_error.py", "server");
  api.addAssets("public/python/calc_stats.py", "server");
  api.addAssets("public/python/calc_ens_stats.py", "server");
  api.addAssets("public/python/mode_stats.py", "server");
  api.addAssets("public/fonts/PublicSans-Black.ttf", "client");
  api.addAssets("public/fonts/PublicSans-BlackItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Bold.ttf", "client");
  api.addAssets("public/fonts/PublicSans-BoldItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-ExtraBold.ttf", "client");
  api.addAssets("public/fonts/PublicSans-ExtraBoldItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-ExtraLight.ttf", "client");
  api.addAssets("public/fonts/PublicSans-ExtraLightItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Italic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Light.ttf", "client");
  api.addAssets("public/fonts/PublicSans-LightItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Medium.ttf", "client");
  api.addAssets("public/fonts/PublicSans-MediumItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Regular.ttf", "client");
  api.addAssets("public/fonts/PublicSans-SemiBold.ttf", "client");
  api.addAssets("public/fonts/PublicSans-SemiBoldItalic.ttf", "client");
  api.addAssets("public/fonts/PublicSans-Thin.ttf", "client");
  api.addAssets("public/fonts/PublicSans-ThinItalic.ttf", "client");
  api.addAssets("public/help/axis-selector.html", "client");
  api.addAssets("public/help/axisMatchingHelp.html", "client");
  api.addAssets("public/help/best-fit.html", "client");
  api.addAssets("public/help/bottom-help.html", "client");
  api.addAssets("public/help/completeness.html", "client");
  api.addAssets("public/help/dateHelp.html", "client");
  api.addAssets("public/help/label.html", "client");
  api.addAssets("public/help/map-help.html", "client");
  api.addAssets("public/help/region.html", "client");
  api.addAssets("public/help/scatter-help.html", "client");
  api.addAssets("public/help/StdErrorcalculationonEMBverificationpages.html", "client");
  api.addAssets("public/help/top-help.html", "client");
  api.addAssets("public/help/wfip2-statistic.html", "client");
  api.addAssets(
    "imports/startup/server/matsMiddle/sqlTemplates/tmpl_distinct_fcstValidEpoch_obs.sql",
    "server"
  );
  api.addAssets(
    "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_distinct_fcstLen.sql",
    "server"
  );
  api.addAssets(
    "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql",
    "server"
  );
  api.addAssets(
    "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql",
    "server"
  );
});

Package.onTest(function (api) {
  api.use("ecmascript");
  api.use("meteortesting:mocha");
  api.use("randyp:mats-common");
  api.addFiles("imports/startup/api/version-info-tests.js");

  // try duplicating the runtime deps
  Npm.depends({
    "fs-extra": "7.0.0",
    "@babel/runtime": "7.10.4",
    "meteor-node-stubs": "0.4.1",
    url: "0.11.0",
    "jquery-ui": "1.12.1",
    "csv-stringify": "4.3.1",
    "node-file-cache": "1.0.2",
    "python-shell": "3.0.1",
    couchbase: "3.2.3",
    "simpl-schema": "1.12.0",
  });
  api.use("natestrauser:select2", "client");
  api.use("mdg:validated-method");
  api.use("ecmascript");
  api.use("modules");
  api.imply("ecmascript");
  api.use(["templating"], "client");
  api.use("accounts-ui", "client");
  api.use("accounts-password", "client");
  api.use("service-configuration", "server");
  api.use("yasinuslu:json-view", "client");
  api.use("mdg:validated-method");
  api.use("session");
  api.imply("session");
  api.use("twbs:bootstrap");
  api.use("msavin:mongol");
  api.use("differential:event-hooks");
  api.use("risul:bootstrap-colorpicker");
  api.use("logging");
  api.use("reload");
  api.use("random");
  api.use("ejson");
  api.use("spacebars");
  api.use("check");
  api.use("ostrio:flow-router-extra");
  api.use("meteorhacks:picker");
  api.use("momentjs:moment");
  api.use("pcel:mysql");
});
