import numpy as np
import metcalcpy.util.sl1l2_statistics as calc_sl1l2
import metcalcpy.util.sal1l2_statistics as calc_sal1l2
import metcalcpy.util.vl1l2_statistics as calc_vl1l2
import metcalcpy.util.val1l2_statistics as calc_val1l2
from ctc_stats import calculate_ctc_stat
from mode_stats import calculate_mode_stat


def calculate_scalar_stat(statistic, agg_method, numpy_data, column_headers):
    """function for determining and calling the appropriate scalar statistical calculation function"""
    stat_switch = {  # dispatcher of statistical calculation functions
        'ACC': calc_sal1l2.calculate_anom_corr,
        'RMSE': calc_sl1l2.calculate_rmse,
        'Bias-corrected RMSE': calc_sl1l2.calculate_bcrmse,
        'MSE': calc_sl1l2.calculate_mse,
        'Bias-corrected MSE': calc_sl1l2.calculate_bcmse,
        'ME (Additive bias)': calc_sl1l2.calculate_me,
        'Fractional Error': calc_sl1l2.calculate_fe,
        'Multiplicative bias': calc_sl1l2.calculate_mbias,
        'N': calc_sl1l2.calculate_sl1l2_total,
        'Forecast mean': calc_sl1l2.calculate_fbar,
        'Observed mean': calc_sl1l2.calculate_obar,
        'Forecast stdev': calc_sl1l2.calculate_fstdev,
        'Observed stdev': calc_sl1l2.calculate_ostdev,
        'Error stdev': calc_sl1l2.calculate_estdev,
        'Pearson correlation': calc_sl1l2.calculate_pr_corr
    }
    error = ""
    data_length = numpy_data.shape[0]
    sub_stats = np.empty([data_length])
    try:
        for idx in range(data_length):
            sub_stats[idx] = stat_switch[statistic](numpy_data[[idx], :], column_headers)
        if agg_method == "Mean statistic":
            stat = np.nanmean(sub_stats)  # calculate stat as mean of sub_values
        elif agg_method == "Median statistic":
            stat = np.nanmedian(sub_stats)  # calculate stat as mean of sub_values
        else:
            numpy_data[:, 5] = 1  # METcalcpy is weird about how it calculates totals. This gets what we want here.
            stat = stat_switch[statistic](numpy_data, column_headers, True)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    return sub_stats, stat, error


def calculate_vector_stat(statistic, agg_method, numpy_data, column_headers):
    """function for determining and calling the appropriate scalar statistical calculation function"""
    stat_switch = {  # dispatcher of statistical calculation functions
        'Vector ACC': calc_val1l2.calculate_val1l2_anom_corr,
        # 'Forecast length of mean wind vector': calculate_fbar_speed,
        # 'Observed length of mean wind vector': calculate_obar_speed,
        # 'Forecast length - observed length of mean wind vector': calculate_speed_err,
        # 'abs(Forecast length - observed length of mean wind vector)': calculate_speed_err_abs,
        # 'Length of forecast - observed mean wind vector': calculate_vdiff_speed,
        # 'abs(Length of forecast - observed mean wind vector)': calculate_vdiff_speed_abs,
        # 'Forecast direction of mean wind vector': calculate_fdir,
        # 'Observed direction of mean wind vector': calculate_odir,
        # 'Angle between mean forecast and mean observed wind vectors': calculate_dir_err,  # Fix this
        # 'abs(Angle between mean forecast and mean observed wind vectors)': calculate_dir_err_abs,  # Fix this
        # 'Direction of forecast - observed mean wind vector': calculate_vdiff_dir,  # Fix this
        # 'abs(Direction of forecast - observed mean wind vector)': calculate_vdiff_dir_abs,  # Fix this
        # 'RMSE of forecast wind vector length': calculate_fs_rms,
        # 'RMSE of observed wind vector length': calculate_os_rms,
        # 'Vector wind speed MSVE': calculate_msve,
        # 'Vector wind speed RMSVE': calculate_rmsve,
        # 'Forecast mean of wind vector length': calculate_fbar,
        # 'Observed mean of wind vector length': calculate_obar,
        # 'Forecast mean - observed mean of wind vector length': calculate_fbar_m_obar,
        # 'abs(Forecast mean - observed mean of wind vector length)': calculate_fbar_m_obar_abs,
        # 'Forecast stdev of wind vector length': calculate_fstdev,
        # 'Observed stdev of wind vector length': calculate_ostdev
    }
    error = ""
    data_length = numpy_data.shape[0]
    sub_stats = np.empty([data_length])
    try:
        for idx in range(data_length):
            sub_stats[idx] = stat_switch[statistic](numpy_data[[idx], :], column_headers)
        if agg_method == "Mean statistic":
            stat = np.nanmean(sub_stats)  # calculate stat as mean of sub_values
        elif agg_method == "Median statistic":
            stat = np.nanmedian(sub_stats)  # calculate stat as mean of sub_values
        else:
            numpy_data[:, 5] = 1  # METcalcpy is weird about how it calculates totals. This gets what we want here.
            stat = stat_switch[statistic](numpy_data, column_headers, True)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    return sub_stats, stat, error


def get_stat(idx, app_params, row, statistic, stat_line_type, object_row):
    """function for processing the sub-values from the query and calling a calculate_stat function"""

    has_levels = app_params["hasLevels"]
    agg_method = app_params["aggMethod"]

    # these are the sub-fields that are returned in the end
    sub_levs = []
    sub_secs = []
    sub_values = np.empty(0)
    sub_interests = np.empty(0)
    sub_pair_fids = np.empty(0)
    sub_pair_oids = np.empty(0)
    sub_mode_header_ids = np.empty(0)
    sub_cent_dists = np.empty(0)
    individual_obj_lookup = {}
    error = ""

    try:
        # get all of the sub-values for each time
        if stat_line_type == 'scalar':
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to scalar stats
            sub_fbar = []
            sub_obar = []
            sub_ffbar = []
            sub_oobar = []
            sub_fobar = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_fbar.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_obar.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                sub_ffbar.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                sub_oobar.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                sub_fobar.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                sub_total.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                sub_secs.append(float(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[7])

            # calculate the scalar statistic
            numpy_data = np.column_stack([sub_fbar, sub_obar, sub_ffbar, sub_oobar, sub_fobar, sub_total])
            if "ACC" not in statistic:
                column_headers = np.asarray(['fbar', 'obar', 'ffbar', 'oobar', 'fobar', 'total'])
            else:
                column_headers = np.asarray(['fabar', 'oabar', 'ffabar', 'ooabar', 'foabar', 'total'])
            sub_values, stat, stat_error = calculate_scalar_stat(statistic, agg_method, numpy_data, column_headers)
            if stat_error != '':
                error = stat_error

        elif stat_line_type == 'vector':
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to vector stats
            sub_ufbar = []
            sub_vfbar = []
            sub_uobar = []
            sub_vobar = []
            sub_uvfobar = []
            sub_uvffbar = []
            sub_uvoobar = []
            sub_f_speed_bar = []
            sub_o_speed_bar = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_ufbar.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_vfbar.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                sub_uobar.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                sub_vobar.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                sub_uvfobar.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                sub_uvffbar.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                sub_uvoobar.append(float(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                if "ACC" not in statistic:
                    sub_f_speed_bar.append(float(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                    sub_o_speed_bar.append(float(sub_datum[8]) if float(sub_datum[8]) != -9999 else np.nan)
                    sub_total.append(float(sub_datum[9]) if float(sub_datum[9]) != -9999 else np.nan)
                    sub_secs.append(float(sub_datum[10]) if float(sub_datum[10]) != -9999 else np.nan)
                    if has_levels:
                        sub_levs.append(sub_datum[11])
                else:
                    sub_total.append(float(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                    sub_secs.append(float(sub_datum[8]) if float(sub_datum[8]) != -9999 else np.nan)
                    if has_levels:
                        sub_levs.append(sub_datum[9])

            # calculate the vector statistic
            if "ACC" not in statistic:
                numpy_data = np.column_stack(
                    [sub_ufbar, sub_vfbar, sub_uobar, sub_vobar, sub_uvfobar, sub_uvffbar, sub_uvoobar,
                     sub_f_speed_bar, sub_o_speed_bar, sub_total])
                column_headers = np.asarray(
                    ['ufbar', 'vfbar', 'uobar', 'vobar', 'uvfobar', 'uvffbar', 'uvoobar',
                     'f_speed_bar', 'o_speed_bar', 'total'])
            else:
                numpy_data = np.column_stack(
                    [sub_ufbar, sub_vfbar, sub_uobar, sub_vobar, sub_uvfobar, sub_uvffbar, sub_uvoobar, sub_total])
                column_headers = np.asarray(
                    ['ufabar', 'vfabar', 'uoabar', 'voabar', 'uvfoabar', 'uvffabar', 'uvooabar', 'total'])
            sub_values, stat, stat_error = calculate_vector_stat(statistic, agg_method, numpy_data, column_headers)
            if stat_error != '':
                error = stat_error

        elif stat_line_type == 'ctc':
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to ctc stats
            sub_fy_oy = []
            sub_fy_on = []
            sub_fn_oy = []
            sub_fn_on = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_fy_oy.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_fy_on.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                sub_fn_oy.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                sub_fn_on.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                sub_total.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                sub_secs.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[6])
            sub_fy_oy = np.asarray(sub_fy_oy)
            sub_fy_on = np.asarray(sub_fy_on)
            sub_fn_oy = np.asarray(sub_fn_oy)
            sub_fn_on = np.asarray(sub_fn_on)
            sub_total = np.asarray(sub_total)
            sub_secs = np.asarray(sub_secs)
            if len(sub_levs) == 0:
                sub_levs = np.empty(len(sub_secs))
            else:
                sub_levs = np.asarray(sub_levs)
            # calculate the ctc statistic
            sub_values, stat, stat_error = calculate_ctc_stat(statistic, sub_fy_oy, sub_fy_on, sub_fn_oy, sub_fn_on,
                                                              sub_total)
            if stat_error != '':
                error = stat_error

        elif 'mode_pair' in stat_line_type:  # histograms will pass in 'mode_pair_histogram', but we still want to use this code here.
            if statistic == "OTS (Object Threat Score)" or statistic == "Model-obs centroid distance (unique pairs)":
                object_sub_data = str(object_row['sub_data2']).split(',')
                for sub_datum2 in object_sub_data:
                    sub_datum2 = sub_datum2.split(';')
                    obj_id = sub_datum2[0]
                    mode_header_id = sub_datum2[1]
                    area = sub_datum2[2]
                    intensity_nn = sub_datum2[3]
                    centroid_lat = sub_datum2[4]
                    centroid_lon = sub_datum2[5]
                    if mode_header_id not in individual_obj_lookup.keys():
                        individual_obj_lookup[mode_header_id] = {}
                    individual_obj_lookup[mode_header_id][obj_id] = {
                        "area": float(area),
                        "intensity_nn": float(intensity_nn),
                        "centroid_lat": float(centroid_lat),
                        "centroid_lon": float(centroid_lon)
                    }
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to mode stats
            sub_interests = []
            sub_pair_fids = []
            sub_pair_oids = []
            sub_mode_header_ids = []
            sub_cent_dists = []
            sub_secs = []
            sub_levs = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                obj_id = sub_datum[1]
                if obj_id.find("_") >= 0:
                    sub_interests.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                    sub_pair_fids.append(obj_id.split("_")[0])
                    sub_pair_oids.append(obj_id.split("_")[1])
                    sub_mode_header_ids.append(int(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                    sub_cent_dists.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                    sub_secs.append(int(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                    sub_levs.append(sub_datum[5])

            if 'histogram' in stat_line_type:
                # need to get an array of sub-values, one for each unique mode_header_id
                sub_interest_map = {}
                sub_pair_fid_map = {}
                sub_pair_oid_map = {}
                sub_mode_header_id_map = {}
                sub_cent_dist_map = {}
                sub_secs_map = {}
                sub_levs_map = {}
                for i in range(0, len(sub_mode_header_ids)):
                    this_mode_header_id = str(sub_mode_header_ids[i])
                    if this_mode_header_id not in sub_interest_map.keys():
                        sub_interest_map[this_mode_header_id] = []
                        sub_pair_fid_map[this_mode_header_id] = []
                        sub_pair_oid_map[this_mode_header_id] = []
                        sub_mode_header_id_map[this_mode_header_id] = []
                        sub_cent_dist_map[this_mode_header_id] = []
                        sub_secs_map[this_mode_header_id] = []
                        sub_levs_map[this_mode_header_id] = []
                    sub_interest_map[this_mode_header_id].append(sub_interests[i])
                    sub_pair_fid_map[this_mode_header_id].append(sub_pair_fids[i])
                    sub_pair_oid_map[this_mode_header_id].append(sub_pair_oids[i])
                    sub_mode_header_id_map[this_mode_header_id].append(sub_mode_header_ids[i])
                    sub_cent_dist_map[this_mode_header_id].append(sub_cent_dists[i])
                    sub_secs_map[this_mode_header_id].append(sub_secs[i])
                    sub_levs_map[this_mode_header_id].append(sub_levs[i])
                sub_values = []
                sub_secs = []
                sub_levs = []
                all_header_ids = sub_mode_header_id_map.keys()
                for header_id in all_header_ids:
                    stat, stat_error = calculate_mode_stat(statistic, np.asarray(sub_interest_map[header_id]),
                                                           np.asarray(sub_pair_fid_map[header_id]),
                                                           np.asarray(sub_pair_oid_map[header_id]),
                                                           np.asarray(sub_mode_header_id_map[header_id]),
                                                           np.asarray(sub_cent_dist_map[header_id]),
                                                           individual_obj_lookup)
                    if stat_error != '':
                        error = stat_error
                    if stat == 'null':
                        sub_values.append(np.nan)
                    else:
                        sub_values.append(stat)
                    # time and level are consistent for each header_id, so just take the first one
                    sub_secs.append(sub_secs_map[header_id][0])
                    sub_levs.append(sub_levs_map[header_id][0])
                sub_values = np.asarray(sub_values)
                sub_secs = np.asarray(sub_secs)
                sub_levs = np.asarray(sub_levs)
            else:
                sub_interests = np.asarray(sub_interests)
                sub_pair_fids = np.asarray(sub_pair_fids)
                sub_pair_oids = np.asarray(sub_pair_oids)
                sub_mode_header_ids = np.asarray(sub_mode_header_ids)
                sub_cent_dists = np.asarray(sub_cent_dists)
                sub_secs = np.asarray(sub_secs)
                if len(sub_levs) == 0:
                    sub_levs = np.empty(len(sub_secs))
                else:
                    sub_levs = np.asarray(sub_levs)

                # calculate the mode statistic
                stat, stat_error = calculate_mode_stat(statistic, sub_interests, sub_pair_fids, sub_pair_oids,
                                                       sub_mode_header_ids, sub_cent_dists, individual_obj_lookup)
                if stat_error != '':
                    error = stat_error

        elif stat_line_type == 'precalculated':
            stat = float(row['stat']) if float(row['stat']) != -9999 else 'null'
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to precalculated stats
            sub_values = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_values.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_secs.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[3])
            sub_values = np.asarray(sub_values)
            sub_secs = np.asarray(sub_secs)
            if len(sub_levs) == 0:
                sub_levs = np.empty(len(sub_secs))
            else:
                sub_levs = np.asarray(sub_levs)

        else:
            stat = 'null'
            sub_secs = np.empty(0)
            sub_levs = np.empty(0)

    except KeyError as e:
        error = "Error parsing query data. The expected fields don't seem to be present " \
                     "in the results cache: " + str(e)
        # if we don't have the data we expect just stop now and return empty data objects
        return np.nan, np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0)

    # if we do have the data we expect, return the requested statistic
    return stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids, \
           sub_cent_dists, individual_obj_lookup, error

