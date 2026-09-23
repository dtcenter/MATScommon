SELECT
    fcstValidEpoch fve,
    fcstLen fcst_lead,
    {{vxAVERAGE}} avtime,
    {{stationNamesList}}
FROM
    {{vxDBTARGET}} AS models
WHERE
    type = "DD"
    AND docType = "model"
    AND model = {{vxMODEL}}
    AND fcstLen = {{vxFCST_LEN}}
    AND fcstLen IN {{vxFCST_LEN_ARRAY}}
    AND level = {{vxLEVEL}}
    AND version = "V01"
    AND fcstValidEpoch % (24 * 3600) / 3600 IN [{{vxVALID_TIMES}}]
    AND (fcstValidEpoch - fcstLen * 3600) % (24 * 3600) / 3600 IN [{{vxUTC_CYCLE_START}}]
    AND {{vxTIME_VAR}} IN {{fcstValidEpoch}}