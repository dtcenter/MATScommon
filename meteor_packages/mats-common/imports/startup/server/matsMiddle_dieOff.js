import { matsTypes, matsDataQueryUtils } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";

class MatsMiddleDieOff
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

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  writeOutput = false;

  constructor(cbPool)
  {
    this.cbPool = cbPool;
  }

  writeToLocalFile(filePath, contentStr)
  {
    const fs = require("fs");
    const homedir = require('os').homedir();
    fs.writeFileSync(homedir + filePath, contentStr);
  }

  processStationQuery = (
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
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
        fromSecs,
        toSecs,
        validTimes
      );
      dFuture.return();
    })();
    dFuture.wait();
    return rv;
  };

  // this method queries the database for specialty curves such as profiles, dieoffs, threshold plots, valid time plots, grid scale plots, and histograms
  queryDBSpecialtyCurve = (pool, rows, appParams, statisticStr) =>
  {
    if (Meteor.isServer)
    {
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
        bin_stats: [],
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
      }
      else
      {
        if (appParams.plotType !== matsTypes.PlotTypes.histogram)
        {
          parsedData = matsDataQueryUtils.parseQueryDataXYCurve(
            rows,
            d,
            appParams,
            statisticStr,
            null,
            null,
            null
          );
        } else
        {
          parsedData = matsDataQueryUtils.parseQueryDataHistogram(rows, d, appParams, statisticStr);
        }
      }
      console.log("parsedData(keys):" + JSON.stringify(Object.keys(parsedData), null, 2));
      d = parsedData.d;
      N0 = parsedData.N0;
      N_times = parsedData.N_times;
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
    fromSecs,
    toSecs,
    validTimes
  ) =>
  {
    console.log(
      `processStationQuery(${varName},${stationNames.length
      },${model},${fcstLen},${threshold},${fromSecs},${toSecs},${JSON.stringify(
        validTimes
      )})`
    );

    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;
    const fs = require("fs");

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
    this.writeToLocalFile("/scratch/matsMiddle/output/fveObs.json", JSON.stringify(this.fveObs, null, 2));
    this.writeToLocalFile("/scratch/matsMiddle/output/fveModels.json", JSON.stringify(this.fveModels, null, 2));
    this.writeToLocalFile("/scratch/matsMiddle/output/ctc.json", JSON.stringify(this.ctc, null, 2));

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
    let tmplWithStationNames_obs = cbPool.trfmSQLRemoveClause(tmpl_get_N_stations_mfve_obs, "{{vxAVERAGE}}");
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
      if (iofve === 0)
      {
        this.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
      }
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
          dataSingleEpoch.fcst = fveDataSingleEpoch.fcst;
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
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(tmpl_get_N_stations_mfve_model, "{{vxFCST_LEN}}");
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(tmpl_get_N_stations_mfve_model, "{{vxAVERAGE}}");
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxFCST_LEN}}/g,
      this.fcstLen
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
      if (imfve === 0)
      {
        this.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
      }
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
          dataSingleEpoch.stations = stationsSingleEpoch;
          if (!this.fveModels[fveDataSingleEpoch.fcst_lead])
          {
            this.fveModels[fveDataSingleEpoch.fcst_lead] = {};
          }
          this.fveModels[fveDataSingleEpoch.fcst_lead][fveDataSingleEpoch.fve] = dataSingleEpoch;
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

    let fcst_lead_array = Object.keys(this.fveModels);
    fcst_lead_array.sort(function (a, b) { return a - b });
    for (let flai = 0; flai < fcst_lead_array.length; flai++)
    {
      const stats_fcst_lead = {};

      stats_fcst_lead.fcst_lead = Number(fcst_lead_array[flai]);
      stats_fcst_lead.hit = 0;
      stats_fcst_lead.miss = 0;
      stats_fcst_lead.fa = 0;
      stats_fcst_lead.cn = 0;
      stats_fcst_lead.N0 = 0;
      stats_fcst_lead.N_times = new Set(fcst_lead_array).size;
      stats_fcst_lead.sub_data = [];

      // get all the fve for this fcst_lead
      let fcst_lead_single = this.fveModels[fcst_lead_array[flai]];
      let fve_array = Object.keys(fcst_lead_single);
      fve_array.sort();

      stats_fcst_lead.min_secs = fve_array[0];
      stats_fcst_lead.max_secs = fve_array[fve_array.length - 1];
      for (let imfve = 0; imfve < fve_array.length; imfve++)
      {
        const fve = fve_array[imfve];
        const obsSingleFve = this.fveObs[fve];
        const modelSingleFve = fcst_lead_single[fve];

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

        for (let i = 0; i < this.stationNames.length; i++)
        {
          const station = this.stationNames[i];
          const varVal_o = obsSingleFve.stations[station];
          const varVal_m = modelSingleFve.stations[station];

          if (varVal_o && varVal_m)
          {
            stats_fcst_lead.N0 += 1;
            let sub = `${fve};`;
            if (varVal_o < threshold && varVal_m < threshold)
            {
              stats_fcst_lead.hit += 1;
              sub += "1;";
            } else
            {
              sub += "0;";
            }

            if (varVal_o >= threshold && varVal_m < threshold)
            {
              stats_fcst_lead.fa += 1;
              sub += "1;";
            } else
            {
              sub += "0;";
            }

            if (varVal_o < threshold && varVal_m >= threshold)
            {
              stats_fcst_lead.miss += 1;
              sub += "1;";
            } else
            {
              sub += "0;";
            }

            if (varVal_o >= threshold && varVal_m >= threshold)
            {
              stats_fcst_lead.cn += 1;
              sub += "1";
            } else
            {
              sub += "0";
            }
            stats_fcst_lead.sub_data.push(sub);
          }
        }
      }
      this.ctc.push(stats_fcst_lead);
    }

    const endTime = new Date().valueOf();
    console.log(`generateCtc:` + ` in ${endTime - startTime} ms.`);
  };
}

export default matsMiddleDieOff = {
  MatsMiddleDieOff: MatsMiddleDieOff
};
