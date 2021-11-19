--using wolphin.fsl.noaa.gov:/precip_mesonets2_sums
select m0.valid_time as valid_time,
ceil(2592000*floor((m0.valid_time)/2592000)+2592000/2) as avtime,
m0.yy as hit0,
m0.yn as fa0,
m0.ny as miss0,
m0.nn as cn0,
m1.yy as hit1,
m1.yn as fa1,
m1.ny as miss1,
m1.nn as cn1
from HRRR_OPS_AQPI_LARGE as m0,
HRRR_GSD_AQPI_LARGE as m1
where
m0.valid_time = m1.valid_time
and m0.fcst_len = 2
and m1.fcst_len = 2
and m0.thresh = 1
and m1.thresh = 1
-- and m0.valid_time >= 1535302800 /*Sun 26 Aug 2018 17:00 GMT*/
-- and m0.valid_time < 1540573200 /*Fri 26 October 2018 17:00 GMT */
-- and m1.valid_time >= 1535302800
-- and m1.valid_time < 1540573200
and m0.valid_time >= 1382227200 /*Sun, Oct 20 2013 12:00 am GMT*/
and m0.valid_time < 1574208000 /*Wed, Nov 20 2019 12:00 am GMT*/
and m1.valid_time >= 1382227200
and m1.valid_time < 1574208000
order by m0.fcst_len,m0.valid_time;
