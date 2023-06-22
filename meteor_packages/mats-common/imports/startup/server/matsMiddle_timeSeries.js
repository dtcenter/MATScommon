import { matsTypes, matsDataQueryUtils } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";

class MatsMiddleTimeSeries
{
  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  ctc = [];

  varName = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  average = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  writeOutput = false;

  constructor(cbPool)
  {
    this.cbPool = cbPool;
  }

  processStationQuery = (
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes
  ) =>
  {
    const Future = require("fibers/future");

    let rv = [];
    const dFuture = new Future();
    (async () =>
    {
      rv = await this.processStationQuery_int(
        varName,
        stationNames,
        model,
        fcstLen,
        threshold,
        average,
        fromSecs,
        toSecs,
        validTimes
      );
      dFuture.return();
    })();
    dFuture.wait();
    return rv;
  };

  queryDBTimeSeries = (
    pool,
    rows,
    dataSource,
    forecastOffset,
    startDate,
    endDate,
    averageStr,
    statisticStr,
    validTimes,
    appParams,
    forceRegularCadence
  ) =>
  {
    if (Meteor.isServer)
    {
      // upper air is only verified at 00Z and 12Z, so you need to force irregular models to verify at that regular cadence
      let cycles = matsDataQueryUtils.getModelCadence(pool, dataSource, startDate, endDate); // if irregular model cadence, get cycle times. If regular, get empty array.
      if (validTimes.length > 0 && validTimes !== matsTypes.InputTypes.unused)
      {
        if (typeof validTimes === "string" || validTimes instanceof String)
        {
          validTimes = validTimes.split(",");
        }
        let vtCycles = validTimes.map(function (x)
        {
          return (Number(x) - forecastOffset) * 3600 * 1000;
        }); // selecting validTimes makes the cadence irregular
        vtCycles = vtCycles.map(function (x)
        {
          return x < 0 ? x + 24 * 3600 * 1000 : x;
        }); // make sure no cycles are negative
        vtCycles = vtCycles.sort(function (a, b)
        {
          return Number(a) - Number(b);
        }); // sort 'em
        cycles = cycles.length > 0 ? _.intersection(cycles, vtCycles) : vtCycles; // if we already had cycles get the ones that correspond to valid times
      }
      const regular =
        forceRegularCadence ||
        averageStr !== "None" ||
        !(cycles !== null && cycles.length > 0); // If curves have averaging, the cadence is always regular, i.e. it's the cadence of the average

      var d = {
        // d will contain the curve data
        x: [],
        y: [],
        error_x: [],
        error_y: [],
        subHit: [],
        subFa: [],
        subMiss: [],
        subCn: [],
        subSquareDiffSum: [],
        subNSum: [],
        subObsModelDiffSum: [],
        subModelSum: [],
        subObsSum: [],
        subAbsSum: [],
        subData: [],
        subHeaders: [],
        subVals: [],
        subSecs: [],
        subLevs: [],
        stats: [],
        text: [],
        n_forecast: [],
        n_matched: [],
        n_simple: [],
        n_total: [],
        glob_stats: {},
        xmin: Number.MAX_VALUE,
        xmax: Number.MIN_VALUE,
        ymin: Number.MAX_VALUE,
        ymax: Number.MIN_VALUE,
        sum: 0,
      };
      var error = "";
      var N0 = [];
      var N_times = [];
      let parsedData;

      if (rows === undefined || rows === null || rows.length === 0)
      {
        error = matsTypes.Messages.NO_DATA_FOUND;
      } else
      {
        parsedData = matsDataQueryUtils.parseQueryDataXYCurve(
          rows,
          d,
          appParams,
          statisticStr,
          forecastOffset,
          cycles,
          regular
        );
        d = parsedData.d;
        N0 = parsedData.N0;
        N_times = parsedData.N_times;
      }
    }

    return {
      data: d,
      error,
      N0,
      N_times,
    };
  };

  processStationQuery_int = async (
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes
  ) =>
  {
    const fs = require("fs");

    console.log(
      `processStationQuery(${varName},${stationNames.length
      },${model},${fcstLen},${threshold},${average},${fromSecs},${toSecs},${JSON.stringify(
        validTimes
      )})`
    );

    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.average = average;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;

    this.average = this.average.replace(/m0./g, "");
    if (validTimes && validTimes.length > 0)
    {
      for (let i = 0; i < validTimes.length; i++)
      {
        if (validTimes[i] != null && Number(validTimes[i]) > 0)
        {
          this.validTimes.push(Number(validTimes[i]));
        }
      }
      console.log(`validTimes:${JSON.stringify(this.validTimes)}`);
    }

    this.conn = await cbPool.getConnection();

    const startTime = new Date().valueOf();

    let queryTemplate = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_distinct_fcstValidEpoch_obs.sql",
      "utf-8"
    );
    queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, this.fromSecs);
    queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, this.toSecs);
    console.log(`fromSecs:${this.fromSecs},toSecs:${this.toSecs}`);
    console.log(`queryTemplate:\n${queryTemplate}`);

    const qr_fcstValidEpoch = await this.conn.cluster.query(queryTemplate);

    for (let imfve = 0; imfve < qr_fcstValidEpoch.rows.length; imfve++)
    {
      this.fcstValidEpoch_Array.push(qr_fcstValidEpoch.rows[imfve].fcstValidEpoch);
    }
    let endTime = new Date().valueOf();
    console.log(
      `\tfcstValidEpoch_Array:${this.fcstValidEpoch_Array.length} in ${endTime - startTime
      } ms.`
    );

    const prObs = this.createObsData();
    const prModel = this.createModelData();
    await Promise.all([prObs, prModel]);
    this.generateCtc(threshold);

    endTime = new Date().valueOf();
    console.log(`\tprocessStationQuery in ${endTime - startTime} ms.`);

    return this.ctc;
  };

  createObsData = async () =>
  {
    console.log("createObsData()");
    const fs = require("fs");

    const startTime = new Date().valueOf();

    const tmpl_get_N_stations_mfve_obs = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql",
      "utf-8"
    );

    let stationNames_obs = "";
    for (let i = 0; i < this.stationNames.length; i++)
    {
      if (i === 0)
      {
        stationNames_obs = `obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else
      {
        stationNames_obs += `,obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }
    let tmplWithStationNames_obs = tmpl_get_N_stations_mfve_obs.replace(
      /{{vxAVERAGE}}/g,
      this.average
    );
    tmplWithStationNames_obs = tmplWithStationNames_obs.replace(
      /{{stationNamesList}}/g,
      stationNames_obs
    );
    let endTime = new Date().valueOf();
    console.log(`\tobs query:${stationNames_obs.length} in ${endTime - startTime} ms.`);

    const promises = [];
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 100)
    {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(iofve, iofve + 100);
      const sql = tmplWithStationNames_obs.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      const prSlice = this.conn.cluster.query(sql);
      promises.push(prSlice);
      prSlice.then((qr) =>
      {
        console.log(`qr:\n${qr.rows.length}`);
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve++)
        {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++)
          {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.avtime = fveDataSingleEpoch.avtime;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveObs[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
        if (iofve % 100 == 0)
        {
          endTime = new Date().valueOf();
          console.log(
            `iofve:${iofve}/${this.fcstValidEpoch_Array.length} in ${endTime - startTime
            } ms.`
          );
        }
      });
    }

    await Promise.all(promises);
    endTime = new Date().valueOf();
    console.log(`fveObs:` + ` in ${endTime - startTime} ms.`);
  };

  createModelData = async () =>
  {
    console.log("createModelData()");
    const fs = require("fs");

    const startTime = new Date().valueOf();

    let tmpl_get_N_stations_mfve_model = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql",
      "utf-8"
    );
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(tmpl_get_N_stations_mfve_model, "fcstLen fcst_lead");
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(tmpl_get_N_stations_mfve_model, "{{vxFCST_LEN_ARRAY}}");
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxFCST_LEN}}/g,
      this.fcstLen
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxAVERAGE}}/g,
      this.average
    );

    let stationNames_models = "";
    for (let i = 0; i < this.stationNames.length; i++)
    {
      if (i === 0)
      {
        stationNames_models = `models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else
      {
        stationNames_models += `,models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }

    const tmplWithStationNames_models = tmpl_get_N_stations_mfve_model.replace(
      /{{stationNamesList}}/g,
      stationNames_models
    );
    let endTime = new Date().valueOf();
    console.log(
      `\tmodel query:${stationNames_models.length} in ${endTime - startTime} ms.`
    );

    const promises = [];
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100)
    {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
      const sql = tmplWithStationNames_models.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      const prSlice = this.conn.cluster.query(sql);

      promises.push(prSlice);
      prSlice.then((qr) =>
      {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve++)
        {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++)
          {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.avtime = fveDataSingleEpoch.avtime;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveModels[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
        if (imfve % 100 == 0)
        {
          endTime = new Date().valueOf();
          console.log(
            `imfve:${imfve}/${this.fcstValidEpoch_Array.length} in ${endTime - startTime
            } ms.`
          );
        }
      });
    }
    await Promise.all(promises);
    endTime = new Date().valueOf();
    console.log(`fveModel:` + ` in ${endTime - startTime} ms.`);
  };

  generateCtc = async (threshold) =>
  {
    console.log(`generateCtc(${threshold})`);

    const startTime = new Date().valueOf();

    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve++)
    {
      const fve = this.fcstValidEpoch_Array[imfve];
      const obsSingleFve = this.fveObs[fve];
      const modelSingleFve = this.fveModels[fve];

      if (!obsSingleFve || !modelSingleFve)
      {
        continue;
      }

      if (this.validTimes && this.validTimes.length > 0)
      {
        if (this.validTimes.includes((fve % (24 * 3600)) / 3600) == false)
        {
          continue;
        }
      }

      const stats_fve = {};
      stats_fve.avtime = obsSingleFve.avtime;
      stats_fve.hit = 0;
      stats_fve.miss = 0;
      stats_fve.fa = 0;
      stats_fve.cn = 0;
      stats_fve.N0 = 0;
      stats_fve.N_times = 1;
      stats_fve.sub_data = [];

      for (let i = 0; i < this.stationNames.length; i++)
      {
        const station = this.stationNames[i];
        const varVal_o = obsSingleFve.stations[station];
        const varVal_m = modelSingleFve.stations[station];

        if (varVal_o && varVal_m)
        {
          stats_fve.N0 += 1;
          let sub = `${fve};`;
          if (varVal_o < threshold && varVal_m < threshold)
          {
            stats_fve.hit += 1;
            sub += "1;";
          } else
          {
            sub += "0;";
          }

          if (varVal_o >= threshold && varVal_m < threshold)
          {
            stats_fve.fa += 1;
            sub += "1;";
          } else
          {
            sub += "0;";
          }

          if (varVal_o < threshold && varVal_m >= threshold)
          {
            stats_fve.miss += 1;
            sub += "1;";
          } else
          {
            sub += "0;";
          }

          if (varVal_o >= threshold && varVal_m >= threshold)
          {
            stats_fve.cn += 1;
            sub += "1";
          } else
          {
            sub += "0";
          }
          stats_fve.sub_data.push(sub);
        }
      }
      this.ctc.push(stats_fve);
    }

    const endTime = new Date().valueOf();
    console.log(`generateCtc:` + ` in ${endTime - startTime} ms.`);
  };

}

export default matsMiddleTimeSeries = {
  MatsMiddleTimeSeries: MatsMiddleTimeSeries
};
