/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global cbPool, Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";

class MatsMiddleDieoff {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

  fcstLenArray = [];

  fveObs = {};

  fveModels = {};

  stats = [];

  statType = null;

  varName = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  utcCycleStart = [];

  singleCycle = null;

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
    fcstLen,
    threshold,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle
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
        fcstLen,
        threshold,
        fromSecs,
        toSecs,
        validTimes,
        utcCycleStart,
        singleCycle
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
    fcstLen,
    threshold,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle
  ) => {
    const fs = require("fs");

    this.statType = statType;
    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;
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

    this.singleCycle = singleCycle;

    this.conn = await cbPool.getConnection();

    this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
      fromSecs,
      toSecs
    );

    // =============== get distinct fcstLen in time frame ==================
    this.fcstLenArray = await this.mmCommon.get_fcstLen_Array(
      this.model,
      this.fcstValidEpoch_Array[0],
      this.fcstValidEpoch_Array[this.fcstValidEpoch_Array.length - 1]
    );
    this.fcstLenArray = this.fcstLenArray.filter((fl) => Number(fl) % 3 === 0);
    await this.createObsData();
    await this.createModelData();

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
    let tmplWithStationNamesObs = cbPool.trfmSQLRemoveClause(
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
          dataSingleEpoch.fcst = fveDataSingleEpoch.fcst;
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
      "{{vxFCST_LEN}}"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "{{vxAVERAGE}}"
    );
    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
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

    const flaIncr = 3;
    for (let flai = 0; flai < this.fcstLenArray.length; flai += flaIncr) {
      this.fveModels = {};
      const flaSlice = this.fcstLenArray.slice(flai, flai + flaIncr);
      const tmplWithStationNamesModelsFcstArray = tmplWithStationNamesModels.replace(
        /{{vxFCST_LEN_ARRAY}}/g,
        JSON.stringify(flaSlice)
      );
      const promises = [];
      for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100) {
        const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
        const sql = tmplWithStationNamesModelsFcstArray.replace(
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
            dataSingleEpoch.stations = stationsSingleEpoch;
            if (!this.fveModels[fveDataSingleEpoch.fcst_lead]) {
              this.fveModels[fveDataSingleEpoch.fcst_lead] = {};
            }
            this.fveModels[fveDataSingleEpoch.fcst_lead][fveDataSingleEpoch.fve] =
              dataSingleEpoch;
          }

          if (this.logMemUsage === true) {
            try {
              const obsSize =
                new TextEncoder().encode(JSON.stringify(this.fveObs)).length /
                (1024 * 1024);
              const modelsSize =
                new TextEncoder().encode(JSON.stringify(this.fveModels)).length /
                (1024 * 1024);
              const statsSize =
                new TextEncoder().encode(JSON.stringify(this.stats)).length /
                (1024 * 1024);
              console.log(
                `sizes (MB), obs:${obsSize},model:${modelsSize},stats:${statsSize}`
              );
            } catch (ex) {
              console.log(`exception getting sizes:${ex}`);
            }
          }
        });
      }
      await Promise.all(promises);
      if (this.statType === "ctc") {
        this.generateCtc();
      } else {
        this.generateSums();
      }
    }
  };

  generateCtc = () => {
    const { threshold } = this;

    const fcstLeadArray = Object.keys(this.fveModels);
    fcstLeadArray.sort(function (a, b) {
      return a - b;
    });
    for (let flai = 0; flai < fcstLeadArray.length; flai += 1) {
      const ctcFcstLead = {};

      const fcstLead = Number(fcstLeadArray[flai]);
      ctcFcstLead.fcst_lead = fcstLead;
      ctcFcstLead.hit = 0;
      ctcFcstLead.miss = 0;
      ctcFcstLead.fa = 0;
      ctcFcstLead.cn = 0;
      ctcFcstLead.N0 = 0;
      ctcFcstLead.N_times = new Set(fcstLeadArray).size;
      ctcFcstLead.sub_data = [];

      // get all the fve for this fcst_lead
      const fcstLeadSingle = this.fveModels[fcstLeadArray[flai]];
      const fveArray = Object.keys(fcstLeadSingle);
      fveArray.sort();

      [ctcFcstLead.min_secs] = fveArray;
      ctcFcstLead.max_secs = fveArray[fveArray.length - 1];
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[fve];
        const modelSingleFve = fcstLeadSingle[fve];

        if (!obsSingleFve || !modelSingleFve) {
          continue;
        }

        if (this.validTimes && this.validTimes.length > 0) {
          // m0.fcstValidEpoch%(24*3600)/3600 IN[vxVALID_TIMES]
          if (!this.validTimes.includes((fve % (24 * 3600)) / 3600)) {
            continue;
          }
        }

        if (this.utcCycleStart && this.utcCycleStart.length > 0) {
          // (obs.fcstValidEpoch - obs.fcstLen*3600)%(24*3600)/3600 IN[vxUTC_CYCLE_START])
          if (
            !this.utcCycleStart.includes(((fve - fcstLead * 3600) % (24 * 3600)) / 3600)
          ) {
            continue;
          }
        }

        if (this.singleCycle !== null) {
          // obs.fcstValidEpoch-obs.fcstLen*3600 = vxFROM_SECS
          if (fve - fcstLead * 3600 === this.singleCycle) {
            continue;
          }
        }
        this.mmCommon.computeCtcForStations(
          fve,
          threshold,
          ctcFcstLead,
          this.stationNames,
          obsSingleFve,
          modelSingleFve
        );
      }
      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpCtc(ctcFcstLead);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };

  generateSums = () => {
    const fcstLeadArray = Object.keys(this.fveModels);
    fcstLeadArray.sort(function (a, b) {
      return a - b;
    });
    for (let flai = 0; flai < fcstLeadArray.length; flai += 1) {
      const sumsFcstLead = {};

      const fcstLead = Number(fcstLeadArray[flai]);
      sumsFcstLead.fcst_lead = fcstLead;
      sumsFcstLead.square_diff_sum = 0;
      sumsFcstLead.N_sum = 0;
      sumsFcstLead.obs_model_diff_sum = 0;
      sumsFcstLead.model_sum = 0;
      sumsFcstLead.obs_sum = 0;
      sumsFcstLead.abs_sum = 0;
      sumsFcstLead.N0 = 0;
      sumsFcstLead.N_times = new Set(fcstLeadArray).size;
      sumsFcstLead.sub_data = [];

      // get all the fve for this fcst_lead
      const fcstLeadSingle = this.fveModels[fcstLeadArray[flai]];
      const fveArray = Object.keys(fcstLeadSingle);
      fveArray.sort();

      [sumsFcstLead.min_secs] = fveArray;
      sumsFcstLead.max_secs = fveArray[fveArray.length - 1];
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[fve];
        const modelSingleFve = fcstLeadSingle[fve];

        if (!obsSingleFve || !modelSingleFve) {
          continue;
        }

        if (this.validTimes && this.validTimes.length > 0) {
          // m0.fcstValidEpoch%(24*3600)/3600 IN[vxVALID_TIMES]
          if (!this.validTimes.includes((fve % (24 * 3600)) / 3600)) {
            continue;
          }
        }

        if (this.utcCycleStart && this.utcCycleStart.length > 0) {
          // (obs.fcstValidEpoch - obs.fcstLen*3600)%(24*3600)/3600 IN[vxUTC_CYCLE_START])
          if (
            !this.utcCycleStart.includes(((fve - fcstLead * 3600) % (24 * 3600)) / 3600)
          ) {
            continue;
          }
        }

        if (this.singleCycle !== null) {
          // obs.fcstValidEpoch-obs.fcstLen*3600 = vxFROM_SECS
          if (fve - fcstLead * 3600 === this.singleCycle) {
            continue;
          }
        }
        this.mmCommon.computeSumsForStations(
          fve,
          sumsFcstLead,
          this.stationNames,
          obsSingleFve,
          modelSingleFve
        );
      }
      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpSums(sumsFcstLead);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };
}

export default matsMiddleDieoff = {
  MatsMiddleDieoff,
};
