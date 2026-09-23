/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsTypes, matsMiddleUtils } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleXYCurve {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpochArrayObs = [];

  fcstValidEpochArray = [];

  fcstLengthArray = [];

  indVarArray = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  binParam = null;

  statType = null;

  varNames = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  average = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  utcCycleStart = [];

  singleCycle = null;

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
    statType,
    varNames,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle,
    filterInfo,
    elevMap
  ) => {
    let rv = [];
    try {
      rv = await this.processStationQueryInt(
        binParam,
        statType,
        varNames,
        stationNames,
        model,
        fcstLen,
        threshold,
        average,
        fromSecs,
        toSecs,
        validTimes,
        utcCycleStart,
        singleCycle,
        filterInfo,
        elevMap
      );
    } catch (err) {
      console.log(`MatsMiddleXYCurve.processStationQuery ERROR: ${err.message}`);
      rv = `MatsMiddleXYCurve.processStationQuery ERROR: ${err.message}`;
    }
    return rv;
  };

  processStationQueryInt = async (
    binParam,
    statType,
    varNames,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle,
    filterInfo,
    elevMap
  ) => {
    try {
      this.binParam = binParam;
      this.statType = statType;
      this.varNames = varNames;
      this.stationNames = stationNames;
      this.model = model;
      this.fcstLen = Number(fcstLen);
      this.threshold = threshold;
      this.fromSecs = fromSecs;
      this.toSecs = toSecs;

      if (average && average.length !== 0 && average !== matsTypes.InputTypes.unused) {
        this.average = average.replace(/m0./g, "");
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
      if (singleCycle) {
        this.singleCycle = singleCycle;
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
      } else if (this.binParam === "Threshold") {
        this.indVarArray = [this.threshold];
      } else {
        for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
          const ofve = this.fcstValidEpochArray[iofve];
          let indVar;
          switch (this.binParam) {
            case "Valid UTC hour":
              indVar = (ofve % (24 * 3600)) / 3600;
              break;
            case "Valid Date":
            default:
              if (this.average === null || this.average === "m0.fcstValidEpoch") {
                indVar = ofve;
              } else {
                const avgConst = Number(
                  this.average.substring(5, this.average.indexOf("*"))
                );
                indVar = Math.ceil(
                  avgConst * Math.floor((ofve + avgConst / 2) / avgConst)
                );
              }
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
      console.log(`MatsMiddleXYCurve.processStationQueryInt ERROR: ${err.message}`);
      throw new Error(`MatsMiddleXYCurve.processStationQueryInt ERROR: ${err.message}`);
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
      if (this.average === null) {
        tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveObs,
          "{{vxAVERAGE}}"
        );
      } else {
        tmplWithStationNamesObs = tmplGetNStationsMfveObs.replace(
          /{{vxAVERAGE}}/g,
          this.average
        );
      }
      tmplWithStationNamesObs = tmplWithStationNamesObs.replace(
        /{{stationNamesList}}/g,
        stationNamesObs
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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = "0"; // obs don't have a lead time
                break;
              case "Threshold":
                indVarKey = this.threshold.toString();
                break;
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Valid Date":
              default:
                if (this.average === null) {
                  indVarKey = fveDataSingleEpoch.fve.toString();
                } else {
                  indVarKey = fveDataSingleEpoch.avtime.toString();
                }
                break;
            }
            if (!this.fveObs[indVarKey]) {
              this.fveObs[indVarKey] = {};
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
            this.fveObs[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }

      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
    } catch (err) {
      console.log(`MatsMiddleXYCurve.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleXYCurve.createObsData ERROR: ${err.message}`);
    }
  };

  createModelData = async () => {
    try {
      let tmplGetNStationsMfveModel = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
      );

      if (this.average === null) {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxAVERAGE}}"
        );
      } else {
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxAVERAGE}}/g,
          this.average
        );
      }
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{vxMODEL}}/g,
        `"${this.model}"`
      );

      if (this.binParam === "Fcst lead time") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxFCST_LEN}}"
        );
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxFCST_LEN_ARRAY}}/g,
          JSON.stringify(this.indVarArray)
        );
      } else {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "fcstLen fcst_lead"
        );
        if (this.binParam === "Valid Date" && !this.fcstLen) {
          tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
            /fcstLen = {{vxFCST_LEN}}/g,
            `fcstLen < 24 AND (models.fcstValidEpoch - models.fcstLen*3600)%(24*3600)/3600 IN [${this.utcCycleStart}]`
          );
          tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
            tmplGetNStationsMfveModel,
            "{{vxFCST_LEN_ARRAY}}"
          );
        } else {
          tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
            /{{vxFCST_LEN}}/g,
            this.fcstLen
          );
          tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
            tmplGetNStationsMfveModel,
            "{{vxFCST_LEN_ARRAY}}"
          );
        }
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
        // set the time variable
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch"
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
        // set the time variable for init times
        tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
          /{{vxTIME_VAR}}/g,
          "fcstValidEpoch - fcstLen * 3600"
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
        if (this.singleCycle && this.singleCycle > 0) {
          // set the time variable for one init cycle
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
      }

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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = fveDataSingleEpoch.fcst_lead.toString();
                break;
              case "Threshold":
                indVarKey = this.threshold.toString();
                break;
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Valid Date":
              default:
                if (this.average === null) {
                  indVarKey = fveDataSingleEpoch.fve.toString();
                } else {
                  indVarKey = fveDataSingleEpoch.avtime.toString();
                }
                break;
            }
            if (!this.fveModels[indVarKey]) {
              this.fveModels[indVarKey] = {};
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
            this.fveModels[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }
      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
      if (this.statType === "ctc" || this.statType === "Performance Diagram") {
        this.generateCtc();
      } else {
        this.generateSums();
      }
    } catch (err) {
      console.log(`MatsMiddleXYCurve.createModelData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleXYCurve.createModelData ERROR: ${err.message}`);
    }
  };

  generateCtc = () => {
    try {
      const threshold = Number(this.threshold);
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
        let ctcStats = {};

        const indVar = indVarsWithData[idx];
        switch (this.binParam) {
          case "Fcst lead time":
            ctcStats.fcst_lead = Number(indVar);
            break;
          case "Threshold":
            ctcStats.thresh = Number(indVar);
            break;
          case "Valid UTC hour":
            ctcStats.hr_of_day = Number(indVar);
            break;
          case "Valid Date":
          default:
            ctcStats.avtime = Number(indVar);
            break;
        }
        ctcStats.hit = 0;
        ctcStats.miss = 0;
        ctcStats.fa = 0;
        ctcStats.cn = 0;
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
              ""
            );
          }
        }

        try {
          const statsSummedByIndVar = this.mmUtils.sumUpCtc(ctcStats);
          if (this.statType === "Performance Diagram") {
            statsSummedByIndVar.pod =
              statsSummedByIndVar.hit /
              (statsSummedByIndVar.hit + statsSummedByIndVar.miss);
            statsSummedByIndVar.far =
              statsSummedByIndVar.fa /
              (statsSummedByIndVar.fa + statsSummedByIndVar.hit);
            statsSummedByIndVar.oy_all =
              statsSummedByIndVar.hit + statsSummedByIndVar.miss;
            statsSummedByIndVar.on_all =
              statsSummedByIndVar.fa + statsSummedByIndVar.cn;
          }
          this.stats.push(statsSummedByIndVar);
        } catch (ex) {
          throw new Error(ex);
        }
      }
    } catch (err) {
      console.log(`MatsMiddleXYCurve.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleXYCurve.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = () => {
    try {
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
        let sumsStats = {};

        const indVar = indVarsWithData[idx];
        switch (this.binParam) {
          case "Fcst lead time":
            sumsStats.fcst_lead = Number(indVar);
            break;
          case "Threshold":
            sumsStats.thresh = Number(indVar);
            break;
          case "Valid UTC hour":
            sumsStats.hr_of_day = Number(indVar);
            break;
          case "Valid Date":
          default:
            sumsStats.avtime = Number(indVar);
            break;
        }
        sumsStats.square_diff_sum = 0;
        sumsStats.N_sum = 0;
        sumsStats.obs_model_diff_sum = 0;
        sumsStats.model_sum = 0;
        sumsStats.obs_sum = 0;
        sumsStats.abs_sum = 0;
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
    } catch (err) {
      console.log(`MatsMiddleXYCurve.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleXYCurve.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleXYCurve = {
  MatsMiddleXYCurve,
};
