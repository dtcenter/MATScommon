SELECT
    fcstValidEpoch fve,
    level avVal,
    {{vxAVERAGE}} avtime,
    {{stationNamesList}}
FROM
    {{vxDBTARGET}} AS obs
WHERE
    type = "DD"
    AND docType = "obs"
    AND version = "V01"
    AND level = {{vxLEVEL}}
    AND fcstValidEpoch IN {{fcstValidEpoch}}