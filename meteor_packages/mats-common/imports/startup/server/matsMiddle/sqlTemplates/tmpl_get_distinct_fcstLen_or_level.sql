SELECT DISTINCT {{vxFIELD}}
FROM {{vxDBTARGET}} m0
WHERE m0.type='DD'
    AND m0.docType in ['CTC', 'SUMS']
    AND m0.subset='{{vxCOLLECTION}}'
    AND m0.version='V01'
    AND m0.model={{vxMODEL}}
    AND m0.fcstValidEpoch >= {{vxFROM_SECS}}
    AND m0.fcstValidEpoch <= {{vxTO_SECS}}
ORDER BY {{vxFIELD}};