SELECT DISTINCT fcstValidEpoch
FROM
    {{vxDBTARGET}}
WHERE
    type = "DD"
    AND docType = "obs"
    AND version = "V01"
    AND fcstValidEpoch BETWEEN {{vxFROM_SECS}}
    AND {{vxTO_SECS}}
    ORDER BY fcstValidEpoch