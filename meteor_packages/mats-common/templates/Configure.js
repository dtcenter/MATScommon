/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
import { Template } from "meteor/templating";
import { Meteor } from "meteor/meteor";
import matsMethods from "../imports/startup/api/matsMethods";

Template.Configure.helpers({
  app() {
    return Meteor.settings.public.title;
  },

  title() {
    return Meteor.settings.public.title;
  },
  roles() {
    if (Meteor.settings.public.undefinedRoles) {
      return Meteor.settings.public.undefinedRoles;
    }
    return [];
  },
  role() {
    return this;
  },
  status() {
    return "active";
  },
  proxy_prefix_path() {
    return Meteor.settings.public.proxy_prefix_path;
  },
  run_environment() {
    return Meteor.settings.public.run_environment;
  },
  home() {
    return Meteor.settings.public.home;
  },
  group() {
    return Session.get("selectedGroup");
  },
  app_order() {
    document.getElementById("app_order").value;
  },
  show_copy_icon() {
    const roles = Meteor.settings.public.undefinedRoles;
    if (this === roles[0]) {
      return "none";
    }
    return "block";
  },
  color() {
    return Meteor.settings.public.color;
  },
  groups() {
    if (Session.get("defaultGroups") === undefined) {
      matsMethods.getDefaultGroupList.call({}, function (error, result) {
        if (error !== undefined) {
          setError(error);
          return `<p>${error}</p>`;
        }
        Session.set("defaultGroups", result);
      });
    }
    if (
      Session.get("selectedGroup") === undefined &&
      Session.get("defaultGroups") !== undefined
    ) {
      Session.set("selectedGroup", Session.get("defaultGroups")[0]);
    }
    return Session.get("defaultGroups");
  },
  group_name() {
    return this;
  },
  apps_length(group) {
    return 10;
  },
  baseUrl() {
    return document.location.href;
  },
});

Template.Configure.events({
  "submit .configure-settings-form"(event) {
    // Prevent default browser form submit
    event.preventDefault();
    // Get value from form element
    const { target } = event;
    const inputs = target.getElementsByTagName("input");
    const data = { private: { databases: [] }, public: {} };
    const roles = Meteor.settings.public.undefinedRoles;
    // private database values
    for (var ri = 0; ri < roles.length; ri++) {
      // look for all the inputs that go with this role
      const roleData = {};
      roleData.role = roles[ri];
      roleData.status = "active"; // default to active
      for (var i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        let name = input.id;
        const { value } = input;
        if (name.indexOf(roles[ri]) !== -1) {
          name = name.replace(`${roles[ri]}-`, "");
          roleData[name] = value;
        }
      }
      data.private.databases.push(roleData);
    }
    // public values
    for (var i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const name = input.id;
      if (name === "colorValue") {
        continue;
      }
      const { value } = input;
      let roleVal = false;
      for (ri = 0; ri < roles.length; ri++) {
        if (name.indexOf(roles[ri]) !== -1) {
          roleVal = true;
        }
      }
      if (roleVal === false) {
        data.public[name] = value;
      }
    }
    matsMethods.applySettingsData.call({ settings: data }, function (error) {
      if (error) {
        setError(new Error(`matsMethods.applySettingsData error: ${error.message}`));
      }
    });
  },
  "change select.groupSelect"(event) {
    document.getElementById("group").value =
      document.getElementById("groupSelect").selectedOptions[0].value;
  },
  "click .test"(event) {
    event.preventDefault();
    const role = event.target.id.replace("-test", "");
    const successButton = document.getElementById(`${role}-success`);
    const failButton = document.getElementById(`${role}-fail`);
    const roleIdStr = event.target.id;
    const roleStr = roleIdStr.replace("-test", "");
    failButton.style.display = "none";
    successButton.style.display = "none";
    document.getElementById(`${role}-spinner`).style.display = "block";
    matsMethods.testGetTables.call(
      {
        host: document.getElementById(`${roleStr}-host`).value,
        port: document.getElementById(`${roleStr}-port`).value,
        user: document.getElementById(`${roleStr}-user`).value,
        password: document.getElementById(`${roleStr}-password`).value,
        database: document.getElementById(`${roleStr}-database`).value,
        database_type: document.getElementById(`${roleStr}-database_type`).value,
      },
      function (error, result) {
        document.getElementById(`${role}-spinner`).style.display = "none";
        if (error) {
          setError(error);
          failButton.style.display = "block";
          successButton.style.display = "none";
        } else {
          successButton.style.display = "block";
          failButton.style.display = "none";
        }
      }
    );
  },
  "click .copy"(event) {
    console.log(event);
    event.preventDefault();
    const baseHost = document.getElementById(
      `${Meteor.settings.public.undefinedRoles[0]}-host`
    ).value;
    const basePort = document.getElementById(
      `${Meteor.settings.public.undefinedRoles[0]}-port`
    ).value;
    const baseUser = document.getElementById(
      `${Meteor.settings.public.undefinedRoles[0]}-user`
    ).value;
    const basePassword = document.getElementById(
      `${Meteor.settings.public.undefinedRoles[0]}-password`
    ).value;
    const thisRole = event.target.id.replace("-copy", "");
    document.getElementById(`${thisRole}-host`).value = baseHost;
    document.getElementById(`${thisRole}-port`).value = basePort;
    document.getElementById(`${thisRole}-user`).value = baseUser;
    document.getElementById(`${thisRole}-password`).value = basePassword;
  },
  "change .color"(event) {
    document.getElementById("colorValue").value =
      document.getElementById("color").value;
  },
});
