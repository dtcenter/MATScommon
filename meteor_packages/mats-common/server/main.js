/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import "../imports/startup/server/index.js";
import "../imports/startup/both/index.js";
import { ServiceConfiguration } from "meteor/service-configuration";

const setGoogleCred = function () {
  /*
     from developer console:
     console.developers.google.apis
     */
  if (Meteor.isServer) {
    const os = Npm.require("os");
    const hostname = os.hostname();
    let cid = "";
    let cSecret = "";
    let gid = "";
    let gSecret = "";
    let _id = "";
    let cred;
    try {
      cred = ServiceConfiguration.configurations.findOne({ service: "google" });
      if (cred) {
        cid = cred.clientId;
        cSecret = cred.secret;
        _id = cred._id;
      }
    } catch (ignore) {}
    switch (hostname.split(".")[0]) {
      case "mats":
        gid =
          "499180266722-d4rn615s4s8tenra4tdisbl1i34uvu82.apps.googleusercontent.com";
        gSecret = "U0QuFoFkMnZwNck1nJfPK1Uv";
        break;
      case "mats-dev":
        gid =
          "499180266722-m8qusll2n5sc57u0hdefans35noqkt13.apps.googleusercontent.com";
        gSecret = "Ra1xCSDnr-ZZX1wgyAHHSbIU";
        break;
      case "mats-int":
        gid =
          "499180266722-31eikjprn2lek2jmv8q31adhdbi5cc4b.apps.googleusercontent.com";
        gSecret = "WLaPaYq4MdU4nEUSh_Pw3MDJ";
        break;
      case "localhost":
        gid =
          "499180266722-b4j64bso7ncfick2cgku7iib516tkhsh.apps.googleusercontent.com";
        gSecret = "j4EZvOdAgOrDH_Lkg82uebpu";
        break;
      default:
        gid =
          "499180266722-mu5h3she61fgicuro1kjrlv0m4rd7brt.apps.googleusercontent.com";
        gSecret = "oVViBi9TgLrLPWt6ZTv7M95k";
        break;
    }
    if (gid !== cid || gSecret !== cSecret) {
      // reset gid and gSecret
      if (cred) {
        ServiceConfiguration.configurations.update(_id, {
          $set: { secret: gSecret, clientId: gid },
        });
      } else {
        ServiceConfiguration.configurations.insert({
          service: "google",
          loginStyle: "popup",
          secret: gSecret,
          clientId: gid,
        });
      }
    }
  }
};

setGoogleCred();
