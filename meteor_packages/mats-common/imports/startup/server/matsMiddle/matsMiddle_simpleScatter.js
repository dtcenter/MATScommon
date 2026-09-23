/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsTypes, matsMiddleUtils } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleSimpleScatter {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpochArrayObs = [];

  fcstValidEpochArray = [];

  fcstLengthArray = [];

  levelArray = [];

  indVarArray = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  binParam = null;

  statTypeX = null;

  statTypeY = null;

  varNamesX = null;

  varNamesY = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  thresholdX = null;

  thresholdY = null;

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
    binParam,
    statTypeX,
    statTypeY,
    varNamesX,
    varNamesY,
    stationNames,
    model,
    fcstLen,
    thresholdX,
    thresholdY,
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
        binParam,
        statTypeX,
        statTypeY,
        varNamesX,
        varNamesY,
        stationNames,
        model,
        fcstLen,
        thresholdX,
        thresholdY,
        level,
        fromSecs,
        toSecs,
        validTimes,
        utcCycleStart,
        filterInfo,
        elevMap
      );
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.processStationQuery ERROR: ${err.message}`);
      rv = `MatsMiddleSimpleScatter.processStationQuery ERROR: ${err.message}`;
    }
    return rv;
  };

  processStationQueryInt = async (
    binParam,
    statTypeX,
    statTypeY,
    varNamesX,
    varNamesY,
    stationNames,
    model,
    fcstLen,
    thresholdX,
    thresholdY,
    level,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    filterInfo,
    elevMap
  ) => {
    try {
      this.binParam = binParam;
      this.statTypeX = statTypeX;
      this.statTypeY = statTypeY;
      this.varNamesX = varNamesX;
      this.varNamesY = varNamesY;
      this.stationNames = stationNames;
      this.model = model;
      this.fcstLen = Number(fcstLen);
      this.thresholdX = thresholdX;
      this.thresholdY = thresholdY;
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

      // create distinct indVar array
      if (this.binParam === "Fcst lead time") {
        this.indVarArray = this.fcstLengthArray;
      } else if (this.binParam === "Level") {
        this.levelArray = await this.mmUtils.getFcstLenOrLevelArray(
          this.model,
          "level",
          this.fcstValidEpochArray[0],
          this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1]
        );
        this.levelArray.sort((a, b) => Number(a) - Number(b));
        this.indVarArray = this.levelArray;
      } else {
        for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
          const ofve = this.fcstValidEpochArray[iofve];
          let indVar;
          switch (this.binParam) {
            case "Init UTC hour":
              indVar = ((ofve - this.fcstLen * 3600) % (24 * 3600)) / 3600;
              break;
            case "Valid UTC hour":
              indVar = (ofve % (24 * 3600)) / 3600;
              break;
            case "Init Date":
              indVar = ofve - this.fcstLen * 3600;
              break;
            case "Valid Date":
            default:
              indVar = ofve;
              break;
          }
          if (!this.indVarArray.includes(indVar)) {
            this.indVarArray.push(indVar);
          }
        }
        this.indVarArray.sort((a, b) => Number(a) - Number(b));
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
      console.log(
        `MatsMiddleSimpleScatter.processStationQueryInt ERROR: ${err.message}`
      );
      throw new Error(
        `MatsMiddleSimpleScatter.processStationQueryInt ERROR: ${err.message}`
      );
    }
  };

  createObsData = async () => {
    try {
      let tmplGetNStationsMfveObs = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql"
      );

      let stationNamesObs = "";
      for (let i = 0; i < this.stationNames.length; i += 1) {
        // if we're querying for elevation, retrieve it from the map we passed in instead of the database
        let wantedValueX = "";
        let wantedValueY = "";
        if (this.varNamesX[1] === "Elevation") {
          const station = this.stationNames[i];
          wantedValueX = this.elevMap[station];
        } else {
          wantedValueX = `obs.data.${this.stationNames[i]}.\`${this.varNamesX[1]}\``;
        }
        if (this.varNamesY[1] === "Elevation") {
          const station = this.stationNames[i];
          wantedValueY = this.elevMap[station];
        } else {
          wantedValueY = `obs.data.${this.stationNames[i]}.\`${this.varNamesY[1]}\``;
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
            stationNamesObs = `CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueX} ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueY} ELSE "NULL" END ${this.stationNames[i]}_Y`;
          } else {
            stationNamesObs = `${wantedValueX} ${this.stationNames[i]}_X, ${wantedValueY} ${this.stationNames[i]}_Y`;
          }
        } else if (this.filterInfo.filterObsBy) {
          stationNamesObs += `, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueX} ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueY} ELSE "NULL" END ${this.stationNames[i]}_Y`;
        } else {
          stationNamesObs += `, ${wantedValueX} ${this.stationNames[i]}_X, ${wantedValueY} ${this.stationNames[i]}_Y`;
        }
      }

      // remove average clause because this isn't a timeseries.
      tmplGetNStationsMfveObs = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveObs,
        "{{vxAVERAGE}}"
      );

      // remove level clause if levels are not relevant to the app that called this middleware.
      if (this.level === null) {
        tmplGetNStationsMfveObs = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveObs,
          "{{vxLEVEL}}"
        );
      } else {
        tmplGetNStationsMfveObs = tmplGetNStationsMfveObs.replace(
          /{{vxLEVEL}}/g,
          this.level
        );
      }

      // remove the level query value if we're not binning by level.
      if (this.binParam !== "Level") {
        tmplGetNStationsMfveObs = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveObs,
          "level avVal"
        );
      }

      // replace in the station names generated above into the SQL template
      tmplGetNStationsMfveObs = tmplGetNStationsMfveObs.replace(
        /{{stationNamesList}}/g,
        stationNamesObs
      );

      // specify the target bucket, score, collection, etc. for the database query
      tmplGetNStationsMfveObs = global.cbPool.trfmSQLForDbTarget(
        tmplGetNStationsMfveObs
      );

      // get the appropriate date range
      if (this.binParam === "Init Date") {
        this.fcstValidEpochArrayObs = await this.mmUtils.getFcstValidEpochArray(
          this.fromSecs + 3600 * this.fcstLen,
          this.toSecs + 3600 * this.fcstLen
        );
      } else {
        this.fcstValidEpochArrayObs = this.fcstValidEpochArray;
      }

      const promises = [];
      for (let iofve = 0; iofve < this.fcstValidEpochArrayObs.length; iofve += 100) {
        // query 100 dates at a time, in parallel
        const fveArraySlice = this.fcstValidEpochArrayObs.slice(iofve, iofve + 100);
        const sql = tmplGetNStationsMfveObs.replace(
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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = "0"; // obs don't have a lead time
                break;
              case "Level":
                indVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Init UTC hour":
                indVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                indVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                indVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveObs[indVarKey]) {
              this.fveObs[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (
                fveDataSingleEpoch[`${this.stationNames[i]}_X`] &&
                fveDataSingleEpoch[`${this.stationNames[i]}_Y`]
              ) {
                const varValStationX =
                  fveDataSingleEpoch[`${this.stationNames[i]}_X`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_X`];
                stationsSingleEpoch[`${this.stationNames[i]}_X`] = varValStationX;
                const varValStationY =
                  fveDataSingleEpoch[`${this.stationNames[i]}_Y`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_Y`];
                stationsSingleEpoch[`${this.stationNames[i]}_Y`] = varValStationY;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveObs[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }

      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleSimpleScatter.createObsData ERROR: ${err.message}`);
    }
  };

  createModelData = async () => {
    try {
      let tmplGetNStationsMfveModel = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
      );

      let stationNamesModels = "";
      for (let i = 0; i < this.stationNames.length; i += 1) {
        if (i === 0) {
          if (this.filterInfo.filterModelBy) {
            stationNamesModels = `CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNamesX[0]}\` ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNamesY[0]}\` ELSE "NULL" END ${this.stationNames[i]}_Y`;
          } else {
            stationNamesModels = `models.data.${this.stationNames[i]}.\`${this.varNamesX[0]}\` ${this.stationNames[i]}_X, models.data.${this.stationNames[i]}.\`${this.varNamesY[0]}\` ${this.stationNames[i]}_Y`;
          }
        } else if (this.filterInfo.filterModelBy) {
          stationNamesModels += `, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNamesX[0]}\` ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNamesY[0]}\` ELSE "NULL" END ${this.stationNames[i]}_Y`;
        } else {
          stationNamesModels += `, models.data.${this.stationNames[i]}.\`${this.varNamesX[0]}\` ${this.stationNames[i]}_X, models.data.${this.stationNames[i]}.\`${this.varNamesY[0]}\` ${this.stationNames[i]}_Y`;
        }
      }

      // set the model in the SQL template
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{vxMODEL}}/g,
        `"${this.model}"`
      );

      // remove average clause because this isn't a timeseries.
      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "{{vxAVERAGE}}"
      );

      // remove level clause if levels are not relevant to the app that called this middleware.
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

      // remove the level query value if we're not binning by level.
      if (this.binParam !== "Level") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "level avVal"
        );
      }

      // remove forecast lead clause if fcst leads are not relevant to the app that called this middleware.
      if (this.binParam === "Fcst lead time") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxFCST_LEN}}"
        );
      } else {
        // remove the forecast lead query value if we're not binning by fcst lead.
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "fcstLen fcst_lead"
        );
        // we have one forecast lead that we want, set it in the query
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxFCST_LEN}}/g,
          this.fcstLen
        );
      }
      if (this.validTimes && this.validTimes.length > 0) {
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
      } else if (this.utcCycleStart && this.utcCycleStart.length > 0) {
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
      if (this.binParam === "Init Date") {
        // set the time variable for init times
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch - fcstLen * 3600"
        );
      } else {
        // set the time variable for valid epochs
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch"
        );
      }

      // replace in the station names generated above into the SQL template
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{stationNamesList}}/g,
        stationNamesModels
      );

      // specify the target bucket, score, collection, etc. for the database query
      tmplGetNStationsMfveModel = global.cbPool.trfmSQLForDbTarget(
        tmplGetNStationsMfveModel
      );

      const promises = [];
      for (let imfve = 0; imfve < this.fcstValidEpochArray.length; imfve += 100) {
        // query 100 dates at a time, in parallel
        const fveArraySlice = this.fcstValidEpochArray.slice(imfve, imfve + 100);
        const sql = tmplGetNStationsMfveModel.replace(
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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = fveDataSingleEpoch.fcst_lead.toString();
                break;
              case "Level":
                indVarKey = fveDataSingleEpoch.avVal.toString();
                break;
              case "Init UTC hour":
                indVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen * 3600) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                indVarKey = (fveDataSingleEpoch.fve - this.fcstLen * 3600).toString();
                break;
              case "Valid Date":
              default:
                indVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveModels[indVarKey]) {
              this.fveModels[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (
                fveDataSingleEpoch[`${this.stationNames[i]}_X`] &&
                fveDataSingleEpoch[`${this.stationNames[i]}_Y`]
              ) {
                const varValStationX =
                  fveDataSingleEpoch[`${this.stationNames[i]}_X`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_X`];
                stationsSingleEpoch[`${this.stationNames[i]}_X`] = varValStationX;
                const varValStationY =
                  fveDataSingleEpoch[`${this.stationNames[i]}_Y`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_Y`];
                stationsSingleEpoch[`${this.stationNames[i]}_Y`] = varValStationY;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveModels[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }
      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });

      let indVarsWithData;
      if (this.binParam === "Fcst lead time") {
        indVarsWithData = Object.keys(this.fveModels);
      } else {
        indVarsWithData = _.intersection(
          Object.keys(this.fveObs),
          Object.keys(this.fveModels)
        );
      }
      indVarsWithData.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (let idx = 0; idx < indVarsWithData.length; idx += 1) {
        const indVar = indVarsWithData[idx];
        if (this.statTypeX === "ctc") {
          this.generateCtc("X", indVar);
        } else {
          this.generateSums("X", indVar);
        }
        if (this.statTypeY === "ctc") {
          this.generateCtc("Y", indVar);
        } else {
          this.generateSums("Y", indVar);
        }
      }
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.createModelData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleSimpleScatter.createModelData ERROR: ${err.message}`);
    }
  };

  generateCtc = (axis, indVar) => {
    try {
      const threshold = Number(this[`threshold${axis}`]);
      let ctcStats = {};
      ctcStats.binVal = Number(indVar);
      ctcStats[`hit${axis}`] = 0;
      ctcStats[`miss${axis}`] = 0;
      ctcStats[`fa${axis}`] = 0;
      ctcStats[`cn${axis}`] = 0;
      ctcStats.n0 = 0;
      ctcStats.sub_data = [];

      // get all the fve for this indVar
      const indVarSingle = this.fveModels[indVar];
      const fveArray = Object.keys(indVarSingle);
      fveArray.sort();

      [ctcStats.min_secs] = fveArray;
      ctcStats.max_secs = fveArray[fveArray.length - 1];
      ctcStats.nTimes = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        let obsSingleFve;
        if (this.binParam === "Fcst lead time") {
          obsSingleFve = this.fveObs["0"][fve];
        } else {
          obsSingleFve = this.fveObs[indVar][fve];
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
            axis
          );
        }
      }

      try {
        const statsSummedByIndVar = this.mmUtils.sumUpCtc(ctcStats);
        if (axis === "X") {
          this.stats.push(statsSummedByIndVar);
        } else {
          this.stats[this.stats.length - 1].hitY = statsSummedByIndVar.hitY;
          this.stats[this.stats.length - 1].missY = statsSummedByIndVar.missY;
          this.stats[this.stats.length - 1].faY = statsSummedByIndVar.faY;
          this.stats[this.stats.length - 1].cnY = statsSummedByIndVar.cnY;
          for (let sdidx = 0; sdidx < statsSummedByIndVar.sub_data.length; sdidx += 1) {
            const subDataSansFVE = statsSummedByIndVar.sub_data[sdidx]
              .split(";")
              .slice(1)
              .join(";");
            this.stats[this.stats.length - 1].sub_data[sdidx] += `;${subDataSansFVE}`;
          }
        }
      } catch (ex) {
        throw new Error(ex);
      }
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleSimpleScatter.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = (axis, indVar) => {
    try {
      let sumsStats = {};
      sumsStats.binVal = Number(indVar);
      sumsStats[`square_diff_sum${axis}`] = 0;
      sumsStats[`N_sum${axis}`] = 0;
      sumsStats[`obs_model_diff_sum${axis}`] = 0;
      sumsStats[`model_sum${axis}`] = 0;
      sumsStats[`obs_sum${axis}`] = 0;
      sumsStats[`abs_sum${axis}`] = 0;
      sumsStats.n0 = 0;
      sumsStats.sub_data = [];

      // get all the fve for this indVar
      const indVarSingle = this.fveModels[indVar];
      const fveArray = Object.keys(indVarSingle);
      fveArray.sort();

      [sumsStats.min_secs] = fveArray;
      sumsStats.max_secs = fveArray[fveArray.length - 1];
      sumsStats.nTimes = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        let obsSingleFve;
        if (this.binParam === "Fcst lead time") {
          obsSingleFve = this.fveObs["0"][fve];
        } else {
          obsSingleFve = this.fveObs[indVar][fve];
        }
        const modelSingleFve = indVarSingle[fve];

        if (obsSingleFve && modelSingleFve) {
          sumsStats = this.mmUtils.computeSumsForStations(
            fve,
            sumsStats,
            this.stationNames,
            obsSingleFve,
            modelSingleFve,
            axis
          );
        }
      }

      try {
        const statsSummedByIndVar = this.mmUtils.sumUpSums(sumsStats);
        if (axis === "X") {
          this.stats.push(statsSummedByIndVar);
        } else {
          this.stats[this.stats.length - 1].square_diff_sumY =
            statsSummedByIndVar.square_diff_sumY;
          this.stats[this.stats.length - 1].N_sumY = statsSummedByIndVar.N_sumY;
          this.stats[this.stats.length - 1].obs_model_diff_sumY =
            statsSummedByIndVar.obs_model_diff_sumY;
          this.stats[this.stats.length - 1].model_sumY = statsSummedByIndVar.model_sumY;
          this.stats[this.stats.length - 1].obs_sumY = statsSummedByIndVar.obs_sumY;
          this.stats[this.stats.length - 1].abs_sumY = statsSummedByIndVar.abs_sumY;
          for (let sdidx = 0; sdidx < statsSummedByIndVar.sub_data.length; sdidx += 1) {
            const subDataSansFVE = statsSummedByIndVar.sub_data[sdidx]
              .split(";")
              .slice(1)
              .join(";");
            this.stats[this.stats.length - 1].sub_data[sdidx] += `;${subDataSansFVE}`;
          }
        }
      } catch (ex) {
        throw new Error(ex);
      }
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleSimpleScatter.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleSimpleScatter = {
  MatsMiddleSimpleScatter,
};
