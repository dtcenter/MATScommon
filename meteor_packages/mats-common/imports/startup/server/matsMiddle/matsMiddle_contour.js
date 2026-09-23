/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsTypes, matsMiddleUtils } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleContour {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpochArrayObs = [];

  fcstValidEpochArray = [];

  fcstLengthArray = [];

  levelArray = [];

  xVarArray = [];

  yVarArray = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  xParam = null;

  yParam = null;

  statType = null;

  varNames = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  level = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  utcCycleStart = [];

  filterInfo = {};

  elevMap = {};

  writeOutput = false;

  mmUtils = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
    this.mmUtils = new matsMiddleUtils.MatsMiddleUtils(cbPool);
  }

  /* eslint-disable global-require */
  /* eslint-disable no-console */
  /* eslint-disable class-methods-use-this */

  processStationQuery = async (
    xParam,
    yParam,
    statType,
    varNames,
    stationNames,
    model,
    fcstLen,
    threshold,
    level,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    filterInfo,
    elevMap
  ) => {
    let rv = [];
    try {
      rv = await this.processStationQueryInt(
        xParam,
        yParam,
        statType,
        varNames,
        stationNames,
        model,
        fcstLen,
        threshold,
        level,
        fromSecs,
        toSecs,
        validTimes,
        utcCycleStart,
        filterInfo,
        elevMap
      );
    } catch (err) {
      console.log(`MatsMiddleContour.processStationQuery ERROR: ${err.message}`);
      rv = `MatsMiddleContour.processStationQuery ERROR: ${err.message}`;
    }
    return rv;
  };

  processStationQueryInt = async (
    xParam,
    yParam,
    statType,
    varNames,
    stationNames,
    model,
    fcstLen,
    threshold,
    level,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    filterInfo,
    elevMap
  ) => {
    try {
      this.xParam = xParam;
      this.yParam = yParam;
      this.statType = statType;
      this.varNames = varNames;
      this.stationNames = stationNames;
      this.model = model;
      this.fcstLen = Number(fcstLen);
      this.threshold = threshold;
      this.fromSecs = fromSecs;
      this.toSecs = toSecs;

      if (level) {
        this.level = Number(level);
      }

      if (
        validTimes &&
        validTimes.length !== 0 &&
        validTimes !== matsTypes.InputTypes.unused
      ) {
        this.validTimes = validTimes.map(function (vt) {
          return Number(vt);
        });
      }

      if (
        utcCycleStart &&
        utcCycleStart.length !== 0 &&
        utcCycleStart !== matsTypes.InputTypes.unused
      ) {
        this.utcCycleStart = utcCycleStart.map(function (utc) {
          return Number(utc);
        });
      }

      this.filterInfo = filterInfo;

      this.elevMap = elevMap;

      this.conn = await this.cbPool.getConnection();

      this.fcstValidEpochArray = await this.mmUtils.getFcstValidEpochArray(
        this.fromSecs,
        this.toSecs
      );

      this.fcstLengthArray = await this.mmUtils.getFcstLenOrLevelArray(
        this.model,
        "fcstLen",
        this.fcstValidEpochArray[0],
        this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1]
      );
      this.fcstLengthArray.sort((a, b) => Number(a) - Number(b));

      // create distinct xVar array
      if (this.xParam === "Fcst lead time") {
        this.xVarArray = this.fcstLengthArray;
      } else if (this.xParam === "Level") {
        this.levelArray = await this.mmUtils.getFcstLenOrLevelArray(
          this.model,
          "level",
          this.fcstValidEpochArray[0],
          this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1]
        );
        this.levelArray.sort((a, b) => Number(a) - Number(b));
        this.xVarArray = this.levelArray;
      } else if (this.xParam === "Threshold") {
        this.xVarArray = [this.threshold];
      } else {
        for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
          const ofve = this.fcstValidEpochArray[iofve];
          let xVar;
          switch (this.xParam) {
            case "Init UTC hour":
              xVar = ((ofve - this.fcstLen * 3600) % (24 * 3600)) / 3600;
              break;
            case "Valid UTC hour":
              xVar = (ofve % (24 * 3600)) / 3600;
              break;
            case "Init Date":
              xVar = ofve - this.fcstLen * 3600;
              break;
            case "Valid Date":
            default:
              xVar = ofve;
              break;
          }
          if (!this.xVarArray.includes(xVar)) {
            this.xVarArray.push(xVar);
          }
        }
        this.xVarArray.sort((a, b) => Number(a) - Number(b));
      }

      // create distinct yVar array
      if (this.yParam === "Fcst lead time") {
        this.yVarArray = this.fcstLengthArray;
      } else if (this.yParam === "Level") {
        this.levelArray = await this.mmUtils.getFcstLenOrLevelArray(
          this.model,
          "level",
          this.fcstValidEpochArray[0],
          this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1]
        );
        this.levelArray.sort((a, b) => Number(a) - Number(b));
        this.yVarArray = this.levelArray;
      } else if (this.yParam === "Threshold") {
        this.yVarArray = [this.threshold];
      } else {
        for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
          const ofve = this.fcstValidEpochArray[iofve];
          let yVar;
          switch (this.yParam) {
            case "Init UTC hour":
              yVar = ((ofve - this.fcstLen * 3600) % (24 * 3600)) / 3600;
              break;
            case "Valid UTC hour":
              yVar = (ofve % (24 * 3600)) / 3600;
              break;
            case "Init Date":
              yVar = ofve - this.fcstLen * 3600;
              break;
            case "Valid Date":
            default:
              yVar = ofve;
              break;
          }
          if (!this.yVarArray.includes(yVar)) {
            this.yVarArray.push(yVar);
          }
        }
        this.yVarArray.sort((a, b) => Number(a) - Number(b));
      }

      await this.createObsData();
      await this.createModelData();

      if (this.logToFile === true) {
        this.mmUtils.writeToLocalFile(
          "/scratch/matsMiddle/output/fveObs.json",
          JSON.stringify(this.fveObs, null, 2)
        );
        this.mmUtils.writeToLocalFile(
          "/scratch/matsMiddle/output/fveModels.json",
          JSON.stringify(this.fveModels, null, 2)
        );
        this.mmUtils.writeToLocalFile(
          "/scratch/matsMiddle/output/stats.json",
          JSON.stringify(this.stats, null, 2)
        );
      }

      return this.stats;
    } catch (err) {
      console.log(`MatsMiddleContour.processStationQueryInt ERROR: ${err.message}`);
      throw new Error(`MatsMiddleContour.processStationQueryInt ERROR: ${err.message}`);
    }
  };

  createObsData = async () => {
    try {
      const tmplGetNStationsMfveObs = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql"
      );

      let stationNamesObs = "";
      for (let i = 0; i < this.stationNames.length; i += 1) {
        // if we're querying for elevation, retrieve it from the map we passed in instead of the database
        let wantedValue = "";
        if (this.varNames[1] === "Elevation") {
          const station = this.stationNames[i];
          wantedValue = this.elevMap[station];
        } else {
          wantedValue = `obs.data.${this.stationNames[i]}.\`${this.varNames[1]}\``;
        }

        // if we're filtering by elevation, retrieve it from the map we passed in instead of the database
        let filterObsValue = "";
        if (this.filterInfo.filterObsBy) {
          if (this.filterInfo.filterObsBy === "Elevation") {
            const station = this.stationNames[i];
            filterObsValue = this.elevMap[station];
          } else {
            filterObsValue = `obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\``;
          }
        }

        if (i === 0) {
          if (this.filterInfo.filterObsBy) {
            stationNamesObs = `CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValue} ELSE "NULL" END ${this.stationNames[i]}`;
          } else {
            stationNamesObs = `${wantedValue} ${this.stationNames[i]}`;
          }
        } else if (this.filterInfo.filterObsBy) {
          stationNamesObs += `, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValue} ELSE "NULL" END ${this.stationNames[i]}`;
        } else {
          stationNamesObs += `, ${wantedValue} ${this.stationNames[i]}`;
        }
      }

      let tmplWithStationNamesObs;
      tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveObs,
        "{{vxAVERAGE}}"
      );
      if (this.level === null) {
        tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
          tmplWithStationNamesObs,
          "{{vxLEVEL}}"
        );
      } else {
        tmplWithStationNamesObs = tmplWithStationNamesObs.replace(
          /{{vxLEVEL}}/g,
          this.level
        );
      }
      if (this.xParam !== "Level" && this.yParam !== "Level") {
        tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
          tmplWithStationNamesObs,
          "level avVal"
        );
      }
      tmplWithStationNamesObs = tmplWithStationNamesObs.replace(
        /{{stationNamesList}}/g,
        stationNamesObs
      );

      tmplWithStationNamesObs = global.cbPool.trfmSQLForDbTarget(
        tmplWithStationNamesObs
      );

      if (
        (this.utcCycleStart && this.utcCycleStart.length > 0) ||
        (this.singleCycle && this.singleCycle > 0)
      ) {
        this.fcstValidEpochArrayObs = await this.mmUtils.getFcstValidEpochArray(
          this.fromSecs,
          this.toSecs + 3600 * this.fcstLengthArray[this.fcstLengthArray.length - 1]
        );
      } else {
        this.fcstValidEpochArrayObs = this.fcstValidEpochArray;
      }

      const promises = [];
      for (let iofve = 0; iofve < this.fcstValidEpochArrayObs.length; iofve += 100) {
        const fveArraySlice = this.fcstValidEpochArrayObs.slice(iofve, iofve + 100);
        const sql = tmplWithStationNamesObs.replace(
          /{{fcstValidEpoch}}/g,
          JSON.stringify(fveArraySlice)
        );
        if (this.logToFile === true && iofve === 0) {
          this.mmUtils.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
        }
        const prSlice = this.conn.cluster.query(sql);
        promises.push(prSlice);
        prSlice.then((qr) => {
          for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
            const fveDataSingleEpoch = qr.rows[jmfve];
            let xVarKey;
            switch (this.xParam) {
              case "Fcst lead time":
                xVarKey = "0"; // obs don't have a lead time
                break;
              case "Level":
                xVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Threshold":
                xVarKey = this.threshold.toString();
                break;
              case "Init UTC hour":
                xVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                xVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                xVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                xVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveObs[xVarKey]) {
              this.fveObs[xVarKey] = {};
            }
            let yVarKey;
            switch (this.yParam) {
              case "Fcst lead time":
                yVarKey = "0"; // obs don't have a lead time
                break;
              case "Level":
                yVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Threshold":
                yVarKey = this.threshold.toString();
                break;
              case "Init UTC hour":
                yVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                yVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                yVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                yVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveObs[xVarKey][yVarKey]) {
              this.fveObs[xVarKey][yVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (fveDataSingleEpoch[this.stationNames[i]]) {
                const varValStation =
                  fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                    ? null
                    : fveDataSingleEpoch[this.stationNames[i]];
                stationsSingleEpoch[this.stationNames[i]] = varValStation;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveObs[xVarKey][yVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }

      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
    } catch (err) {
      console.log(`MatsMiddleContour.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleContour.createObsData ERROR: ${err.message}`);
    }
  };

  createModelData = async () => {
    try {
      let tmplGetNStationsMfveModel = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
      );

      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "{{vxAVERAGE}}"
      );
      if (this.level === null) {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxLEVEL}}"
        );
      } else {
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxLEVEL}}/g,
          this.level
        );
      }
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{vxMODEL}}/g,
        `"${this.model}"`
      );

      if (this.xParam !== "Level" && this.yParam !== "Level") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "level avVal"
        );
      }
      if (this.xParam !== "Fcst lead time" && this.yParam !== "Fcst lead time") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "fcstLen fcst_lead"
        );
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxFCST_LEN}}/g,
          this.fcstLen
        );
      } else {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxFCST_LEN}}"
        );
      }
      if (
        (this.xParam === "Init Date" || this.yParam === "Init Date") &&
        this.xParam !== "Valid Date" &&
        this.yParam !== "Valid Date"
      ) {
        // set the time variable for init times
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch - fcstLen * 3600"
        );
      } else {
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch"
        );
      }
      if (
        this.xParam !== "Valid UTC hour" &&
        this.yParam !== "Valid UTC hour" &&
        this.validTimes &&
        this.validTimes.length > 0
      ) {
        // remove the UTC Cycle Start part of the query
        tmplGetNStationsMfveModel = global.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxUTC_CYCLE_START}}"
        );
        // if we have valid times place them in the query
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxVALID_TIMES}}/g,
          global.cbPool.trfmListToCSVString(this.validTimes, null, false)
        );
      } else if (
        this.xParam !== "Init UTC hour" &&
        this.yParam !== "Init UTC hour" &&
        this.utcCycleStart &&
        this.utcCycleStart.length > 0
      ) {
        // remove the Valid Times part of the query
        tmplGetNStationsMfveModel = global.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxVALID_TIMES}}"
        );
        // if we have UTC cycle start times place them in the query
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxUTC_CYCLE_START}}/g,
          global.cbPool.trfmListToCSVString(this.utcCycleStart, null, false)
        );
      } else {
        // remove both the UTC Cycle Start and Valid Times clauses from the query
        tmplGetNStationsMfveModel = global.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxUTC_CYCLE_START}}"
        );
        tmplGetNStationsMfveModel = global.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxVALID_TIMES}}"
        );
      }

      tmplGetNStationsMfveModel = global.cbPool.trfmSQLForDbTarget(
        tmplGetNStationsMfveModel
      );

      let stationNamesModels = "";
      for (let i = 0; i < this.stationNames.length; i += 1) {
        if (i === 0) {
          if (this.filterInfo.filterModelBy) {
            stationNamesModels = `CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNames[0]}\` ELSE "NULL" END ${this.stationNames[i]}`;
          } else {
            stationNamesModels = `models.data.${this.stationNames[i]}.\`${this.varNames[0]}\` ${this.stationNames[i]}`;
          }
        } else if (this.filterInfo.filterModelBy) {
          stationNamesModels += `, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNames[0]}\` ELSE "NULL" END ${this.stationNames[i]}`;
        } else {
          stationNamesModels += `, models.data.${this.stationNames[i]}.\`${this.varNames[0]}\` ${this.stationNames[i]}`;
        }
      }

      const tmplWithStationNamesModels = tmplGetNStationsMfveModel.replace(
        /{{stationNamesList}}/g,
        stationNamesModels
      );

      const promises = [];
      for (let imfve = 0; imfve < this.fcstValidEpochArray.length; imfve += 100) {
        const fveArraySlice = this.fcstValidEpochArray.slice(imfve, imfve + 100);
        const sql = tmplWithStationNamesModels.replace(
          /{{fcstValidEpoch}}/g,
          JSON.stringify(fveArraySlice)
        );
        if (this.logToFile === true && imfve === 0) {
          this.mmUtils.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
        }
        const prSlice = this.conn.cluster.query(sql);

        promises.push(prSlice);
        prSlice.then((qr) => {
          for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
            const fveDataSingleEpoch = qr.rows[jmfve];
            let xVarKey;
            switch (this.xParam) {
              case "Fcst lead time":
                xVarKey = fveDataSingleEpoch.fcst_lead.toString();
                break;
              case "Level":
                xVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Threshold":
                xVarKey = this.threshold.toString();
                break;
              case "Init UTC hour":
                xVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                xVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                xVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                xVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveModels[xVarKey]) {
              this.fveModels[xVarKey] = {};
            }
            let yVarKey;
            switch (this.yParam) {
              case "Fcst lead time":
                yVarKey = fveDataSingleEpoch.fcst_lead.toString();
                break;
              case "Level":
                yVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Threshold":
                yVarKey = this.threshold.toString();
                break;
              case "Init UTC hour":
                yVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                yVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                yVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                yVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveModels[xVarKey][yVarKey]) {
              this.fveModels[xVarKey][yVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (fveDataSingleEpoch[this.stationNames[i]]) {
                const varValStation =
                  fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                    ? null
                    : fveDataSingleEpoch[this.stationNames[i]];
                stationsSingleEpoch[this.stationNames[i]] = varValStation;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveModels[xVarKey][yVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }
      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });

      if (this.statType === "ctc") {
        this.generateCtc();
      } else {
        this.generateSums();
      }
    } catch (err) {
      console.log(`MatsMiddleContour.createModelData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleContour.createModelData ERROR: ${err.message}`);
    }
  };

  generateCtc = () => {
    try {
      const threshold = Number(this.threshold);
      let xVarsWithData;
      if (this.xParam === "Fcst lead time") {
        xVarsWithData = Object.keys(this.fveModels);
      } else {
        xVarsWithData = _.intersection(
          Object.keys(this.fveObs),
          Object.keys(this.fveModels)
        );
      }
      xVarsWithData.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (let xidx = 0; xidx < xVarsWithData.length; xidx += 1) {
        const xVar = xVarsWithData[xidx];
        let yVarsWithData;
        if (this.yParam === "Fcst lead time") {
          yVarsWithData = Object.keys(this.fveModels[xVar]);
        } else {
          yVarsWithData = _.intersection(
            Object.keys(this.fveObs[xVar]),
            Object.keys(this.fveModels[xVar])
          );
        }
        yVarsWithData.sort(function (a, b) {
          return Number(a) - Number(b);
        });

        for (let yidx = 0; yidx < yVarsWithData.length; yidx += 1) {
          const yVar = yVarsWithData[yidx];

          let ctcStats = {};
          ctcStats.xVal = Number(xVar);
          ctcStats.yVal = Number(yVar);
          ctcStats.hit = 0;
          ctcStats.miss = 0;
          ctcStats.fa = 0;
          ctcStats.cn = 0;
          ctcStats.n0 = 0;
          ctcStats.sub_data = [];

          // get all the fve for this xVar and yVar
          const indVarSingle = this.fveModels[xVar][yVar];
          const fveArray = Object.keys(indVarSingle);
          fveArray.sort();

          [ctcStats.min_secs] = fveArray;
          ctcStats.max_secs = fveArray[fveArray.length - 1];
          ctcStats.nTimes = fveArray.length;
          for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
            const fve = fveArray[imfve];
            let obsSingleFve;
            if (this.xParam === "Fcst lead time") {
              obsSingleFve = this.fveObs["0"];
            } else {
              obsSingleFve = this.fveObs[xVar];
            }
            if (this.yParam === "Fcst lead time") {
              obsSingleFve = obsSingleFve["0"][fve];
            } else {
              obsSingleFve = obsSingleFve[yVar][fve];
            }
            const modelSingleFve = indVarSingle[fve];

            if (obsSingleFve && modelSingleFve) {
              ctcStats = this.mmUtils.computeCtcForStations(
                fve,
                threshold,
                ctcStats,
                this.stationNames,
                obsSingleFve,
                modelSingleFve,
                ""
              );
            }
          }

          try {
            const statsSummedByIndVar = this.mmUtils.sumUpCtc(ctcStats);
            this.stats.push(statsSummedByIndVar);
          } catch (ex) {
            throw new Error(ex);
          }
        }
      }
    } catch (err) {
      console.log(`MatsMiddleContour.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleContour.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = () => {
    try {
      let xVarsWithData;
      if (this.xParam === "Fcst lead time") {
        xVarsWithData = Object.keys(this.fveModels);
      } else {
        xVarsWithData = _.intersection(
          Object.keys(this.fveObs),
          Object.keys(this.fveModels)
        );
      }
      xVarsWithData.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (let xidx = 0; xidx < xVarsWithData.length; xidx += 1) {
        const xVar = xVarsWithData[xidx];
        let yVarsWithData;
        if (this.yParam === "Fcst lead time") {
          yVarsWithData = Object.keys(this.fveModels[xVar]);
        } else {
          yVarsWithData = _.intersection(
            Object.keys(this.fveObs[xVar]),
            Object.keys(this.fveModels[xVar])
          );
        }
        yVarsWithData.sort(function (a, b) {
          return Number(a) - Number(b);
        });

        for (let yidx = 0; yidx < yVarsWithData.length; yidx += 1) {
          const yVar = yVarsWithData[yidx];

          let sumsStats = {};
          sumsStats.xVal = Number(xVar);
          sumsStats.yVal = Number(yVar);
          sumsStats.square_diff_sum = 0;
          sumsStats.N_sum = 0;
          sumsStats.obs_model_diff_sum = 0;
          sumsStats.model_sum = 0;
          sumsStats.obs_sum = 0;
          sumsStats.abs_sum = 0;
          sumsStats.n0 = 0;
          sumsStats.sub_data = [];

          // get all the fve for this xVar and yVar
          const indVarSingle = this.fveModels[xVar][yVar];
          const fveArray = Object.keys(indVarSingle);
          fveArray.sort();

          [sumsStats.min_secs] = fveArray;
          sumsStats.max_secs = fveArray[fveArray.length - 1];
          sumsStats.nTimes = fveArray.length;
          for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
            const fve = fveArray[imfve];
            let obsSingleFve;
            if (this.xParam === "Fcst lead time") {
              obsSingleFve = this.fveObs["0"];
            } else {
              obsSingleFve = this.fveObs[xVar];
            }
            if (this.yParam === "Fcst lead time") {
              obsSingleFve = obsSingleFve["0"][fve];
            } else {
              obsSingleFve = obsSingleFve[yVar][fve];
            }
            const modelSingleFve = indVarSingle[fve];

            if (obsSingleFve && modelSingleFve) {
              sumsStats = this.mmUtils.computeSumsForStations(
                fve,
                sumsStats,
                this.stationNames,
                obsSingleFve,
                modelSingleFve,
                ""
              );
            }
          }

          try {
            const statsSummedByIndVar = this.mmUtils.sumUpSums(sumsStats);
            this.stats.push(statsSummedByIndVar);
          } catch (ex) {
            throw new Error(ex);
          }
        }
      }
    } catch (err) {
      console.log(`MatsMiddleContour.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleContour.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleContour = {
  MatsMiddleContour,
};
