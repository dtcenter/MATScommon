SELECT RAW s.name
FROM {{vxDBTARGET}} s
    JOIN {{vxDBTARGET}} bb ON 
    (s.geo[0].lat BETWEEN bb.geo.bottom_right.lat AND bb.geo.top_left.lat) AND 
    (CASE WHEN bb.geo.top_left.lon < bb.geo.bottom_right.lon THEN 
    s.geo[0].lon BETWEEN bb.geo.top_left.lon AND bb.geo.bottom_right.lon ELSE 
    s.geo[0].lon > bb.geo.top_left.lon OR s.geo[0].lon < bb.geo.bottom_right.lon END)
WHERE bb.type="MD"
    AND bb.docType="region"
    AND bb.subset='COMMON'
    AND bb.version='V01'
    AND bb.name="{{vxREGION}}"
    AND s.type="MD"
    AND s.docType="station"
    AND s.subset='METAR'
    AND s.version='V01'
ORDER BY s.name