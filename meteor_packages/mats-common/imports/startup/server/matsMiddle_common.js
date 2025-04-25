/* global Assets */

class MatsMiddleCommon {
  cbPool = null;

  conn = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
  }

  /* eslint-disable global-require */
  /* eslint-disable no-console */
  /* eslint-disable class-methods-use-this */

  writeToLocalFile(filePath, contentStr) {
    const fs = require("fs");
    const homedir = require("os").homedir();
    fs.writeFileSync(homedir + filePath, contentStr);
  }

  getFcstValidEpochArray = async (fromSecs, toSecs) => {
    try {
      this.conn = await this.cbPool.getConnection();

      let queryTemplate = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_distinct_fcstValidEpoch_obs.sql"
      );
      queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
      queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);

      const qrFcstValidEpoch = await this.conn.cluster.query(queryTemplate);

      const fcstValidEpochArray = [];
      for (let imfve = 0; imfve < qrFcstValidEpoch.rows.length; imfve += 1) {
        fcstValidEpochArray.push(qrFcstValidEpoch.rows[imfve].fcstValidEpoch);
      }

      return fcstValidEpochArray;
    } catch (err) {
      console.log(`MatsMiddleCommon.getFcstValidEpochArray ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.getFcstValidEpochArray ERROR: ${err.message}`);
    }
  };

  getFcstLenArray = async (model, fromSecs, toSecs) => {
    try {
      this.conn = await this.cbPool.getConnection();

      let queryTemplate = await Assets.getTextAsync(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_distinct_fcstLen.sql"
      );
      queryTemplate = queryTemplate.replace(/{{vxMODEL}}/g, `"${model}"`);
      queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
      queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);

      const qrDistinctFcstLen = await this.conn.cluster.query(queryTemplate);

      const fcstLenArray = [];
      for (let ifcstLen = 0; ifcstLen < qrDistinctFcstLen.rows.length; ifcstLen += 1) {
        fcstLenArray.push(qrDistinctFcstLen.rows[ifcstLen].fcstLen);
      }

      return fcstLenArray;
    } catch (err) {
      console.log(`MatsMiddleCommon.getFcstLenArray ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.getFcstLenArray ERROR: ${err.message}`);
    }
  };

  sumUpCtc = (ctc) => {
    try {
      const rv = JSON.parse(JSON.stringify(ctc));

      rv.sub_data = [];

      let prevFve = null;
      const sumVals = [0, 0, 0, 0];
      for (let i = 0; i < ctc.sub_data.length; i += 1) {
        const sdiToks = ctc.sub_data[i].split(";");

        if (i === 0) {
          [prevFve] = sdiToks;
        }
        if (prevFve === sdiToks[0]) {
          sumVals[0] += Number(sdiToks[1]);
          sumVals[1] += Number(sdiToks[2]);
          sumVals[2] += Number(sdiToks[3]);
          sumVals[3] += Number(sdiToks[4]);
        } else {
          rv.sub_data.push(
            `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]}`
          );
          [prevFve] = sdiToks;
          sumVals[0] = Number(sdiToks[1]);
          sumVals[1] = Number(sdiToks[2]);
          sumVals[2] = Number(sdiToks[3]);
          sumVals[3] = Number(sdiToks[4]);
        }
        if (i === ctc.sub_data.length - 1) {
          rv.sub_data.push(
            `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]}`
          );
        }
      }
      return rv;
    } catch (err) {
      console.log(`MatsMiddleCommon.sumUpCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.sumUpCtc ERROR: ${err.message}`);
    }
  };

  sumUpSums = (sum) => {
    try {
      const rv = JSON.parse(JSON.stringify(sum));

      rv.sub_data = [];

      let prevFve = null;
      const sumVals = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < sum.sub_data.length; i += 1) {
        const sdiToks = sum.sub_data[i].split(";");

        if (i === 0) {
          [prevFve] = sdiToks;
        }
        if (prevFve === sdiToks[0]) {
          sumVals[0] += Number(sdiToks[1]);
          sumVals[1] += Number(sdiToks[2]);
          sumVals[2] += Number(sdiToks[3]);
          sumVals[3] += Number(sdiToks[4]);
          sumVals[4] += Number(sdiToks[5]);
          sumVals[5] += Number(sdiToks[6]);
        } else {
          rv.sub_data.push(
            `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]};${sumVals[4]};${sumVals[5]}`
          );
          [prevFve] = sdiToks;
          sumVals[0] = Number(sdiToks[1]);
          sumVals[1] = Number(sdiToks[2]);
          sumVals[2] = Number(sdiToks[3]);
          sumVals[3] = Number(sdiToks[4]);
          sumVals[4] = Number(sdiToks[5]);
          sumVals[5] = Number(sdiToks[6]);
        }
        if (i === sum.sub_data.length - 1) {
          rv.sub_data.push(
            `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]};${sumVals[4]};${sumVals[5]}`
          );
        }
      }
      return rv;
    } catch (err) {
      console.log(`MatsMiddleCommon.sumUpSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.sumUpSums ERROR: ${err.message}`);
    }
  };

  computeCtcForStations(
    fve,
    threshold,
    ctc,
    stationNames,
    obsSingleFve,
    modelSingleFve
  ) {
    try {
      const thisCtc = ctc;
      for (let i = 0; i < stationNames.length; i += 1) {
        const station = stationNames[i];
        const varValO = obsSingleFve.stations[station];
        const varValM = modelSingleFve.stations[station];

        if (varValO && varValM) {
          thisCtc.n0 += 1;
          let sub = `${fve};`;
          if (varValO < threshold && varValM < threshold) {
            thisCtc.hit += 1;
            sub += "1;";
          } else {
            sub += "0;";
          }

          if (varValO >= threshold && varValM < threshold) {
            thisCtc.fa += 1;
            sub += "1;";
          } else {
            sub += "0;";
          }

          if (varValO < threshold && varValM >= threshold) {
            thisCtc.miss += 1;
            sub += "1;";
          } else {
            sub += "0;";
          }

          if (varValO >= threshold && varValM >= threshold) {
            thisCtc.cn += 1;
            sub += "1";
          } else {
            sub += "0";
          }
          thisCtc.sub_data.push(sub);
        }
      }
      return thisCtc;
    } catch (err) {
      console.log(`MatsMiddleCommon.computeCtcForStations ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.computeCtcForStations ERROR: ${err.message}`);
    }
  }

  computeSumsForStations(fve, sums, stationNames, obsSingleFve, modelSingleFve) {
    try {
      const thisSums = sums;
      for (let i = 0; i < stationNames.length; i += 1) {
        const station = stationNames[i];
        const varValO = obsSingleFve.stations[station];
        const varValM = modelSingleFve.stations[station];

        if (varValO && varValM) {
          const squareDiffSum = (varValO - varValM) ** 2;
          const nSum = 1;
          const obsModelDiffSum = varValO - varValM;
          const modelSum = varValM;
          const obsSum = varValO;
          const absSum = Math.abs(varValO - varValM);

          thisSums.n0 += 1;
          thisSums.square_diff_sum += squareDiffSum;
          thisSums.N_sum += nSum;
          thisSums.obs_model_diff_sum += obsModelDiffSum;
          thisSums.model_sum += modelSum;
          thisSums.obs_sum += obsSum;
          thisSums.abs_sum += absSum;

          const sub = `${fve};${squareDiffSum};${nSum};${obsModelDiffSum};${modelSum};${obsSum};${absSum};`;
          thisSums.sub_data.push(sub);
        }
      }
      return thisSums;
    } catch (err) {
      console.log(`MatsMiddleCommon.computeSumsForStations ERROR: ${err.message}`);
      throw new Error(`MatsMiddleCommon.computeSumsForStations ERROR: ${err.message}`);
    }
  }
}

// eslint-disable-next-line no-undef
export default matsMiddleCommon = {
  MatsMiddleCommon,
};
