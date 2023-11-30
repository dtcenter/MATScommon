/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global cbPool, Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";

class MatsMiddleDailyModelCycle {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  statType = null;

  varName = null;

  stationNames = null;

  model = null;

  threshold = null;

  average = null;

  fromSecs = null;

  toSecs = null;

  utcCycleStart = null;

  writeOutput = false;

  mmCommon = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
    this.mmCommon = new matsMiddleCommon.MatsMiddleCommon(cbPool);
  }

  processStationQuery = (
    statType,
    varName,
    stationNames,
    model,
    threshold,
    fromSecs,
    toSecs,
    utcCycleStart
  ) => {
    const Future = require("fibers/future");

    let rv = [];
    const dFuture = new Future();
    (async () => {
      rv = await this.processStationQuery_int(
        statType,
        varName,
        stationNames,
        model,
        threshold,
        fromSecs,
        toSecs,
        utcCycleStart
      );
      dFuture.return();
    })();
    dFuture.wait();
    return rv;
  };

  processStationQuery_int = async (
    statType,
    varName,
    stationNames,
    model,
    threshold,
    fromSecs,
    toSecs,
    utcCycleStart
  ) => {
    const fs = require("fs");

    this.statType = statType;
    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.threshold = threshold;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;
    this.utcCycleStart = utcCycleStart;

    this.conn = await cbPool.getConnection();

    this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
      this.fromSecs,
      this.toSecs
    );

    const prObs = this.createObsData();
    const prModel = this.createModelData();
    await Promise.all([prObs, prModel]);
    if (statType === "ctc") {
      this.generateCtc(threshold);
      for (let i = 0; i < this.stats.length; i += 1) {
        this.stats[i] = this.mmCommon.sumUpCtc(this.stats[i]);
      }
    } else {
      this.generateSums();
      for (let i = 0; i < this.stats.length; i += 1) {
        this.stats[i] = this.mmCommon.sumUpSums(this.stats[i]);
      }
    }

    if (this.logToFile === true) {
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/fveObs.json",
        JSON.stringify(this.fveObs, null, 2)
      );
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/fveModels.json",
        JSON.stringify(this.fveModels, null, 2)
      );
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/stats.json",
        JSON.stringify(this.stats, null, 2)
      );
    }

    return this.stats;
  };

  createObsData = async () => {
    const fs = require("fs");

    const tmplGetNStationsMfveObs = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql"
    );

    let stationNamesObs = "";
    for (let i = 0; i < this.stationNames.length; i += 1) {
      if (i === 0) {
        stationNamesObs = `obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else {
        stationNamesObs += `,obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }
    let tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveObs,
      "{{vxAVERAGE}}"
    );
    tmplWithStationNamesObs = tmplWithStationNamesObs.replace(
      /{{stationNamesList}}/g,
      stationNamesObs
    );

    const promises = [];
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(iofve, iofve + 100);
      const sql = tmplWithStationNamesObs.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && iofve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);
      promises.push(prSlice);
      prSlice.then((qr) => {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.avtime = fveDataSingleEpoch.fve;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveObs[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
      });
    }

    await Promise.all(promises);
  };

  createModelData = async () => {
    const fs = require("fs");

    let tmplGetNStationsMfveModel = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "{{vxFCST_LEN_ARRAY}}"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "{{vxAVERAGE}}"
    );
    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );
    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /fcstLen = {{vxFCST_LEN}}/g,
      `fcstLen < 24 AND (models.fcstValidEpoch - models.fcstLen*3600)%(24*3600)/3600 IN [${this.utcCycleStart}]`
    );

    let stationNamesModels = "";
    for (let i = 0; i < this.stationNames.length; i += 1) {
      if (i === 0) {
        stationNamesModels = `models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else {
        stationNamesModels += `,models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }

    const tmplWithStationNamesModels = tmplGetNStationsMfveModel.replace(
      /{{stationNamesList}}/g,
      stationNamesModels
    );

    const promises = [];
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
      const sql = tmplWithStationNamesModels.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && imfve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);

      promises.push(prSlice);
      prSlice.then((qr) => {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.avtime = fveDataSingleEpoch.fve;
          dataSingleEpoch.fcst_lead = fveDataSingleEpoch.fcst_lead;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveModels[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
      });
    }
    await Promise.all(promises);
  };

  generateCtc = async (threshold) => {
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 1) {
      const fve = this.fcstValidEpoch_Array[imfve];

      const obsSingleFve = this.fveObs[fve];
      const modelSingleFve = this.fveModels[fve];

      if (obsSingleFve && modelSingleFve) {
        const ctcFve = {};
        ctcFve.avtime = fve;
        ctcFve.min_secs = fve;
        ctcFve.max_secs = fve;
        ctcFve.hit = 0;
        ctcFve.miss = 0;
        ctcFve.fa = 0;
        ctcFve.cn = 0;
        ctcFve.N0 = 0;
        ctcFve.N_times = 1;
        ctcFve.sub_data = [];

        this.mmCommon.computeCtcForStations(
          fve,
          threshold,
          ctcFve,
          this.stationNames,
          obsSingleFve,
          modelSingleFve
        );
        if (ctcFve.N0 > 0) {
          this.stats.push(ctcFve);
        }
      }
    }
  };

  generateSums = async () => {
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 1) {
      const fve = this.fcstValidEpoch_Array[imfve];

      const obsSingleFve = this.fveObs[fve];
      const modelSingleFve = this.fveModels[fve];

      if (obsSingleFve && modelSingleFve) {
        const sumsFve = {};
        sumsFve.avtime = fve;
        sumsFve.min_secs = fve;
        sumsFve.max_secs = fve;
        sumsFve.square_diff_sum = 0;
        sumsFve.N_sum = 0;
        sumsFve.obs_model_diff_sum = 0;
        sumsFve.model_sum = 0;
        sumsFve.obs_sum = 0;
        sumsFve.abs_sum = 0;
        sumsFve.N0 = 0;
        sumsFve.N_times = 1;
        sumsFve.sub_data = [];

        this.mmCommon.computeSumsForStations(
          fve,
          sumsFve,
          this.stationNames,
          obsSingleFve,
          modelSingleFve
        );
        if (sumsFve.N0 > 0) {
          this.stats.push(sumsFve);
        }
      }
    }
  };
}

export default matsMiddleDailyModelCycle = {
  MatsMiddleDailyModelCycle,
};
