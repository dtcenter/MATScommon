import numpy as np
import sys
import math
import re
from calc_stats import get_stat, calculate_stat
from calc_ens_stats import get_ens_stat


def _null_point(data, di, plot_type, stat_var_name, has_levels):
    """utility to make null a point on a graph"""
    di = int(di)
    data[stat_var_name][di] = 'null'
    if plot_type == "PerformanceDiagram" or plot_type == "ROC":
        data["oy_all"][di] = 'NaN'
        data["on_all"][di] = 'NaN'
    if len(data['error_' + stat_var_name]) > 0:
        data['error_' + stat_var_name][di] = 'null'
    if plot_type == "SimpleScatter":
        data["y"][di] = 'null'
        data["subDataX"][di] = 'NaN'
        data["subDataY"][di] = 'NaN'
        data["subHeadersX"][di] = 'NaN'
        data["subHeadersY"][di] = 'NaN'
        data["subValsX"][di] = 'NaN'
        data["subValsY"][di] = 'NaN'
        data["subSecsX"][di] = 'NaN'
        data["subSecsY"][di] = 'NaN'
        if has_levels:
            data["subLevsX"][di] = 'NaN'
            data["subLevsY"][di] = 'NaN'
    else:
        data["subData"][di] = 'NaN'
        data["subHeaders"][di] = 'NaN'
        data["subVals"][di] = 'NaN'
        data["subSecs"][di] = 'NaN'
        if has_levels:
            data["subLevs"][di] = 'NaN'


def _add_null_point(data, di, plot_type, ind_var_name, new_ind_var, stat_var_name, has_levels):
    """function to add an additional null point on a graph"""
    di = int(di)
    data[ind_var_name].insert(di, new_ind_var)
    data[stat_var_name].insert(di, 'null')
    if plot_type == "PerformanceDiagram" or plot_type == "ROC":
        data["oy_all"].insert(di, [])
        data["on_all"].insert(di, [])
    if len(data['error_' + stat_var_name]) > 0:
        data['error_' + stat_var_name].insert(di, 'null')
    if plot_type == "SimpleScatter":
        data["y"][di].insert(di, 'null')
        data["subDataX"][di].insert(di, [])
        data["subDataY"][di].insert(di, [])
        data["subHeadersX"][di].insert(di, [])
        data["subHeadersY"][di].insert(di, [])
        data["subValsX"][di].insert(di, [])
        data["subValsY"][di].insert(di, [])
        data["subSecsX"][di].insert(di, [])
        data["subSecsY"][di].insert(di, [])
        if has_levels:
            data["subLevsX"][di].insert(di, [])
            data["subLevsY"][di].insert(di, [])
    else:
        data['subData'].insert(di, [])
        data['subHeaders'].insert(di, [])
        data['subVals'].insert(di, [])
        data['subSecs'].insert(di, [])
        if has_levels:
            data['subLevs'].insert(di, [])


def _remove_point(data, di, plot_type, stat_var_name, has_levels):
    """utility to remove a point on a graph"""
    di = int(di)
    del (data["x"][di])
    del (data["y"][di])
    if plot_type == "PerformanceDiagram" or plot_type == "ROC":
        del (data["oy_all"][di])
        del (data["on_all"][di])
    if len(data['error_' + stat_var_name]) > 0:
        del (data['error_' + stat_var_name][di])
    if plot_type == "SimpleScatter":
        del (data["binVals"][di])
        del (data["subDataX"][di])
        del (data["subDataY"][di])
        del (data["subHeadersX"][di])
        del (data["subHeadersY"][di])
        del (data["subValsX"][di])
        del (data["subValsY"][di])
        del (data["subSecsX"][di])
        del (data["subSecsY"][di])
        if has_levels:
            del (data["subLevsX"][di])
            del (data["subLevsY"][di])
    else:
        del (data["subData"][di])
        del (data["subHeaders"][di])
        del (data["subVals"][di])
        del (data["subSecs"][di])
        if has_levels:
            del (data["subLevs"][di])


def _is_number(s):
    """function to check if a certain value is a float or int"""
    try:
        if np.isnan(s) or np.isinf(s):
            return False
    except TypeError:
        return False
    try:
        float(s)
        return True
    except ValueError:
        return False


def parse_query_data_xy_curve(idx, query_data, stat_line_type, statistic, app_params, fcst_offset, vts, return_obj):
    """function for parsing the data returned by an x-y curve query"""
    # initialize local variables
    plot_type = app_params["plotType"]
    hide_gaps = app_params["hideGaps"]
    has_levels = app_params["hasLevels"]
    completeness_qc_param = float(app_params["completeness"]) / 100
    ind_var_min = sys.float_info.max
    ind_var_max = -1 * sys.float_info.max
    curve_ind_vars = []
    curve_stats = []
    sub_vals_all = []
    sub_secs_all = []
    sub_levs_all = []
    sub_data_all = []
    sub_headers_all = []

    # if this is a timeseries, calculate starting time interval of the returned data
    if plot_type == 'TimeSeries':
        time_interval = int(query_data[1]['avtime']) - int(query_data[0]['avtime']) if len(query_data) > 1 else 3600
        if len(vts) > 0:
            # selecting valid_times makes the cadence irregular
            vts = vts.replace("'", "")
            vts = vts.split(',')
            vts = [(int(vt)) * 3600 * 1000 for vt in vts]
            # make sure no vts are negative
            vts = list(map((lambda vt: vt if vt >= 0 else vt + 24 * 3600 * 1000), vts))
            # sort 'em
            vts = sorted(vts)
            regular = False
        else:
            vts = []
            regular = True
    else:
        time_interval = 3600
        vts = []
        regular = True

    # loop through the query results and store the returned values
    row_idx = 0
    for row in query_data:
        if plot_type == 'ValidTime':
            ind_var = float(row['hr_of_day'])
        elif plot_type == 'GridScale':
            ind_var = float(row['gridscale'])
        elif plot_type == 'Profile':
            ind_var = float(str(row['avVal']).replace('P', ''))
        elif plot_type == 'DailyModelCycle' or plot_type == 'TimeSeries':
            ind_var = int(row['avtime']) * 1000
        elif plot_type == 'Dieoff':
            ind_var = int(row['fcst_lead'])
            ind_var = ind_var if ind_var % 10000 != 0 else ind_var / 10000
        elif plot_type == 'Threshold':
            ind_var = float(row['thresh'].replace('=', '').replace('<', '').replace('>', ''))
        elif plot_type == 'YearToYear':
            ind_var = float(row['year'])
        else:
            ind_var = int(row['avtime'])

        if stat_line_type == 'scalar':
            data_exists = row['fbar'] != "null" and row['fbar'] != "NULL"
        elif stat_line_type == 'vector':
            data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL"
        elif stat_line_type == 'ctc':
            data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL"
        elif stat_line_type == 'nbrcnt':
            data_exists = row['fss'] != "null" and row['fss'] != "NULL"
        elif stat_line_type == 'mode_pair':
            data_exists = row['interest'] != "null" and row['interest'] != "NULL"
        elif stat_line_type == 'mode_single':
            data_exists = row['area'] != "null" and row['area'] != "NULL"
        else:
            data_exists = row['stat'] != "null" and row['stat'] != "NULL"
        if hasattr(row, 'n0'):
            return_obj['n0'][idx].append(int(row['n0']))
        else:
            return_obj['n0'][idx].append(int(row['nTimes']))
        return_obj['nTimes'][idx].append(int(row['nTimes']))

        if plot_type == 'TimeSeries' and row_idx < len(query_data) - 1:  # make sure we have the smallest time interval for the while loop later
            time_diff = int(query_data[row_idx + 1]['avtime']) - int(row['avtime'])
            time_interval = time_diff if time_diff < time_interval else time_interval

        if data_exists:
            ind_var_min = ind_var if ind_var < ind_var_min else ind_var_min
            ind_var_max = ind_var if ind_var > ind_var_max else ind_var_max
            stat, sub_levs, sub_secs, sub_values, sub_data, sub_headers, return_obj['error'][idx] \
                = get_stat(row, statistic, stat_line_type, app_params)
            if stat == 'null' or not _is_number(stat):
                # there's bad data at this point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_secs = 'NaN'
                sub_levs = 'NaN'
                sub_data = 'NaN'
                sub_headers = 'NaN'
        else:
            # there's no data at this point
            stat = 'null'
            sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
            sub_secs = 'NaN'
            sub_levs = 'NaN'
            sub_data = 'NaN'
            sub_headers = 'NaN'

        # deal with missing forecast cycles for dailyModelCycle plot type
        if plot_type == 'DailyModelCycle' and row_idx > 0 and (
                int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000)) > 3600 * 24 * 1000:
            cycles_missing = math.ceil(
                int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000) / (3600 * 24 * 1000)) - 1
            for missing_cycle in reversed(range(1, cycles_missing + 1)):
                curve_ind_vars.append(ind_var - 3600 * 24 * 1000 * missing_cycle)
                curve_stats.append('null')
                sub_data_all.append('NaN')
                sub_headers_all.append('NaN')
                sub_vals_all.append('NaN')
                sub_secs_all.append('NaN')
                if has_levels:
                    sub_levs_all.append('NaN')

        # store parsed data for later
        curve_ind_vars.append(ind_var)
        curve_stats.append(stat)
        sub_data_all.append(sub_data)
        sub_headers_all.append(sub_headers)
        sub_vals_all.append(sub_values)
        sub_secs_all.append(sub_secs)
        if has_levels:
            sub_levs_all.append(sub_levs)

        # we successfully processed a cycle, so increment both indices
        row_idx = row_idx + 1

    # make sure lists are definitely sorted by the float ind_var values, instead of their former strings
    if has_levels:
        curve_ind_vars, curve_stats, sub_data_all, sub_headers_all, sub_vals_all, sub_secs_all, sub_levs_all = zip(
            *sorted(zip(curve_ind_vars, curve_stats, sub_data_all, sub_headers_all, sub_vals_all, sub_secs_all,
            sub_levs_all)))
    else:
        curve_ind_vars, curve_stats, sub_data_all, sub_headers_all, sub_vals_all, sub_secs_all = zip(
            *sorted(zip(curve_ind_vars, curve_stats, sub_data_all, sub_headers_all, sub_vals_all, sub_secs_all)))

    n0_max = max(return_obj['n0'][idx])
    n_times_max = max(return_obj['nTimes'][idx])
    time_interval = time_interval * 1000
    loop_sum = 0
    dep_var_min = sys.float_info.max
    dep_var_max = -1 * sys.float_info.max

    # profiles have the levels sorted as strings, not numbers. Need to fix that
    if plot_type == 'Profile':
        curve_stats = [x for _, x in sorted(zip(curve_ind_vars, curve_stats))]
        sub_data_all = [x for _, x in sorted(zip(curve_ind_vars, sub_data_all))]
        sub_headers_all = [x for _, x in sorted(zip(curve_ind_vars, sub_headers_all))]
        sub_vals_all = [x for _, x in sorted(zip(curve_ind_vars, sub_vals_all))]
        sub_secs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_secs_all))]
        sub_levs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_levs_all))]
        curve_ind_vars = sorted(curve_ind_vars)

    for ind_var in curve_ind_vars:
        # the reason we need to loop through everything again is to add in nulls
        # for any bad data points along the curve.
        d_idx = curve_ind_vars.index(ind_var)
        this_n0 = return_obj['n0'][idx][d_idx]
        this_n_times = return_obj['nTimes'][idx][d_idx]
        # add a null if there were too many missing sub-values
        if curve_stats[d_idx] == 'null' or this_n_times < completeness_qc_param * n_times_max:
            if not hide_gaps:
                if plot_type == 'Profile':
                    # profile has the stat first, and then the ind_var. The others have ind_var and then stat.
                    # this is in the pattern of x-plotted-variable, y-plotted-variable.
                    return_obj['data'][idx]['x'].append('null')
                    return_obj['data'][idx]['y'].append(ind_var)
                    return_obj['data'][idx]['error_x'].append('null')
                else:
                    return_obj['data'][idx]['x'].append(ind_var)
                    return_obj['data'][idx]['y'].append('null')
                    return_obj['data'][idx]['error_y'].append('null')
                return_obj['data'][idx]['subData'].append('NaN')
                return_obj['data'][idx]['subHeaders'].append('NaN')
                return_obj['data'][idx]['subVals'].append('NaN')
                return_obj['data'][idx]['subSecs'].append('NaN')
                if has_levels:
                    return_obj['data'][idx]['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder
                # can't figure out what to do with np.nan or float('nan')
        else:
            # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
            loop_sum += curve_stats[d_idx]
            list_data = sub_data_all[d_idx].tolist() \
                if not isinstance(sub_data_all[d_idx], list) \
                else sub_data_all[d_idx]
            list_headers = sub_headers_all[d_idx].tolist() \
                if not isinstance(sub_headers_all[d_idx], list) \
                else sub_headers_all[d_idx]
            list_vals = sub_vals_all[d_idx].tolist() \
                if not isinstance(sub_vals_all[d_idx], list) \
                else sub_vals_all[d_idx]
            list_secs = sub_secs_all[d_idx].tolist() \
                if not isinstance(sub_secs_all[d_idx], list) \
                else sub_secs_all[d_idx]
            if has_levels:
                list_levs = sub_levs_all[d_idx].tolist() \
                    if not isinstance(sub_levs_all[d_idx], list) \
                    else sub_levs_all[d_idx]
            else:
                list_levs = []

            # JSON can't deal with numpy nans in subarrays for some reason, so we make them string NaNs
            bad_value_indices = [index for index, value in enumerate(list_vals) if not _is_number(value)]
            for bad_value_index in sorted(bad_value_indices, reverse=True):
                list_vals[bad_value_index] = 'NaN'

            # store data
            if plot_type == 'Profile':
                # profile has the stat first, and then the ind_var. The others have ind_var and then stat.
                # this is in the pattern of x-plotted-variable, y-plotted-variable.
                return_obj['data'][idx]['x'].append(curve_stats[d_idx])
                return_obj['data'][idx]['y'].append(ind_var)
                return_obj['data'][idx]['error_x'].append('null')
            else:
                return_obj['data'][idx]['x'].append(ind_var)
                return_obj['data'][idx]['y'].append(curve_stats[d_idx])
                return_obj['data'][idx]['error_y'].append('null')
            return_obj['data'][idx]['subData'].append(list_data)
            return_obj['data'][idx]['subHeaders'].append(list_headers)
            return_obj['data'][idx]['subVals'].append(list_vals)
            return_obj['data'][idx]['subSecs'].append(list_secs)
            if has_levels:
                return_obj['data'][idx]['subLevs'].append(list_levs)
            dep_var_min = curve_stats[d_idx] if curve_stats[d_idx] < dep_var_min else dep_var_min
            dep_var_max = curve_stats[d_idx] if curve_stats[d_idx] > dep_var_max else dep_var_max

    # add in any missing times in the time series
    if plot_type == 'TimeSeries' and not hide_gaps:
        day_in_milli_seconds = 24 * 3600 * 1000
        for d_idx in range(len(curve_ind_vars)-2, -1, -1):
            lower_ind_var = curve_ind_vars[d_idx]
            upper_ind_var = curve_ind_vars[d_idx + 1]
            cycles_missing = math.ceil((float(upper_ind_var) - float(lower_ind_var)) / time_interval) - 1
            for missing_idx in range(cycles_missing, 0, -1):
                new_time = lower_ind_var + (missing_idx * time_interval)
                if not regular:
                    # if it's not a regular model, we only want to add a null point if
                    # this is an init time that should have had a forecast.
                    this_cadence = (new_time % day_in_milli_seconds)
                    # check to see if cycle time was on a previous day -- if so, need to
                    # wrap around 00Z to get current hour of day (cycle time)
                    if float(this_cadence) - (float(fcst_offset) * 3600 * 1000) < 0:
                        number_of_days_back = math.ceil(-1 * (float(this_cadence)
                                        - (float(fcst_offset) * 3600 * 1000)) / day_in_milli_seconds)
                        this_cadence = (float(this_cadence) - (float(fcst_offset) * 3600 * 1000)
                                        + number_of_days_back * day_in_milli_seconds)
                    else:
                        this_cadence = (float(this_cadence) - (float(fcst_offset) * 3600 * 1000))
                    if this_cadence in vts:
                        _add_null_point(return_obj['data'][idx], d_idx + 1, plot_type, 'x', new_time, 'y', has_levels)
                else:
                    _add_null_point(return_obj['data'][idx], d_idx + 1, plot_type, 'x', new_time, 'y', has_levels)

    if plot_type == 'Profile':
        return_obj['data'][idx]['xmin'] = dep_var_min
        return_obj['data'][idx]['xmax'] = dep_var_max
        return_obj['data'][idx]['ymin'] = ind_var_min
        return_obj['data'][idx]['ymax'] = ind_var_max
    else:
        return_obj['data'][idx]['xmin'] = ind_var_min
        return_obj['data'][idx]['xmax'] = ind_var_max
        return_obj['data'][idx]['ymin'] = dep_var_min
        return_obj['data'][idx]['ymax'] = dep_var_max
    return_obj['data'][idx]['sum'] = loop_sum

    return return_obj

def parse_query_data_histogram(idx, query_data, stat_line_type, statistic, app_params, return_obj):
    """function for parsing the data returned by a histogram query"""
    # initialize local variables
    has_levels = app_params["hasLevels"]
    sub_data_all = []
    sub_headers_all = []
    sub_vals_all = []
    sub_secs_all = []
    sub_levs_all = []

    # loop through the query results and store the returned values
    row_idx = 0
    for row in query_data:
        av_seconds = int(row['avtime'])
        data_exists = False
        if stat_line_type == 'scalar':
            data_exists = row['fbar'] != "null" and row['fbar'] != "NULL"
        elif stat_line_type == 'vector':
            data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL"
        elif stat_line_type == 'ctc':
            data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL"
        elif stat_line_type == 'nbrcnt':
            data_exists = row['fss'] != "null" and row['fss'] != "NULL"
        else:
            data_exists = row['stat'] != "null" and row['stat'] != "NULL"
        if hasattr(row, 'n0'):
            return_obj['n0'][idx].append(int(row['n0']))
        else:
            return_obj['n0'][idx].append(int(row['nTimes']))
        return_obj['nTimes'][idx].append(int(row['nTimes']))

        if data_exists:
            stat, sub_levs, sub_secs, sub_values, sub_data, sub_headers, return_obj['error'][idx] \
                = get_stat(row, statistic, stat_line_type, app_params)
            if stat == 'null' or not _is_number(stat):
                # there's bad data at this point
                continue

            # We don't need to keep bad data for histograms
            if np.isnan(sub_values).any() or np.isinf(sub_values).any():
                nan_value_indices = np.argwhere(np.isnan(sub_values))
                inf_value_indices = np.argwhere(np.isinf(sub_values))
                bad_value_indices = np.union1d(nan_value_indices, inf_value_indices)
                sub_data = np.delete(sub_data, bad_value_indices, axis=0)
                sub_values = np.delete(sub_values, bad_value_indices)
                sub_secs = np.delete(sub_secs, bad_value_indices)
                if has_levels:
                    sub_levs = np.delete(sub_levs, bad_value_indices)

            # store parsed data for later
            list_data = sub_data.tolist() if not isinstance(sub_data, list) else sub_data
            sub_data_all.append(list_data)
            list_headers = sub_headers.tolist() if not isinstance(sub_headers, list) else sub_headers
            sub_headers_all.append(list_headers)
            list_vals = sub_values.tolist() if not isinstance(sub_values, list) else sub_values
            sub_vals_all.append(list_vals)
            list_secs = sub_secs.tolist() if not isinstance(sub_secs, list) else sub_secs
            sub_secs_all.append(list_secs)
            if has_levels:
                list_levs = sub_levs.tolist() if not isinstance(sub_levs, list) else sub_levs
                sub_levs_all.append(list_levs)

        # we successfully processed a cycle, so increment both indices
        row_idx = row_idx + 1

    # we don't have bins yet, so we want all of the data in one array
    return_obj['data'][idx]['subData'] = [item for sublist in sub_data_all for item in sublist]
    return_obj['data'][idx]['subHeaders'] = [item for sublist in sub_headers_all for item in sublist]
    return_obj['data'][idx]['subVals'] = [item for sublist in sub_vals_all for item in sublist]
    return_obj['data'][idx]['subSecs'] = [item for sublist in sub_secs_all for item in sublist]
    if has_levels:
        return_obj['data'][idx]['subLevs'] = [item for sublist in sub_levs_all for item in sublist]
    
    return return_obj

def parse_query_data_ensemble_histogram(idx, query_data, stat_line_type, statistic, app_params, return_obj):
    """function for parsing the data returned by an ensemble histogram query"""
    # initialize local variables
    has_levels = app_params["hasLevels"]
    bins = []
    bin_counts = []
    sub_data_all = []
    sub_headers_all = []
    sub_vals_all = []
    sub_secs_all = []
    sub_levs_all = []

    # loop through the query results and store the returned values
    for row in query_data:
        data_exists = row['bin_count'] != "null" and row['bin_count'] != "NULL"

        if data_exists:
            bin_number = int(row['bin'])
            bin_count = int(row['bin_count'])
            if hasattr(row, 'n0'):
                return_obj['n0'][idx].append(int(row['n0']))
            else:
                return_obj['n0'][idx].append(int(row['nTimes']))
            return_obj['nTimes'][idx].append(int(row['nTimes']))

            # this function deals with rhist/phist/relp and rhist_rank/phist_bin/relp_ens tables
            stat, sub_levs, sub_secs, sub_values, sub_data, sub_headers, return_obj['error'][idx] \
                = get_stat(row, statistic, stat_line_type, app_params)
            if stat == 'null' or not _is_number(stat):
                # there's bad data at this point
                bins.append(bin_number)
                bin_counts.append(0)
                sub_data_all.append([])
                sub_headers_all.append([])
                sub_vals_all.append([])
                sub_secs_all.append([])
                if has_levels:
                    sub_levs_all.append([])

            else:
                list_data = sub_data.tolist() if not isinstance(sub_data, list) else sub_data
                list_headers = sub_headers.tolist() if not isinstance(sub_headers, list) else sub_headers
                list_vals = sub_values.tolist() if not isinstance(sub_values, list) else sub_values
                list_secs = sub_secs.tolist() if not isinstance(sub_secs, list) else sub_secs
                if has_levels:
                    list_levs = sub_levs.tolist() if not isinstance(sub_levs, list) else sub_levs

                # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                # Don 't need them for matching because histograms don't do Overall Statistic
                bad_value_indices = [index for index, value in enumerate(list_vals) if not _is_number(value)]
                for bad_value_index in sorted(bad_value_indices, reverse=True):
                    del list_data[bad_value_index]
                    del list_vals[bad_value_index]
                    del list_secs[bad_value_index]
                    if has_levels:
                        del list_levs[bad_value_index]

                # store parsed data
                bins.append(bin_number)
                bin_counts.append(bin_count)
                sub_data_all.append(list_data)
                sub_headers_all.append(list_headers)
                sub_vals_all.append(list_vals)
                sub_secs_all.append(list_secs)
                if has_levels:
                    sub_levs_all.append(list_levs)

    if statistic == "Probability Integral Transform Histogram":
        bin_num = len(bins)
        bins[:] = [x / bin_num for x in bins]

    # Finalize data structure
    if len(bins) > 0:
        return_obj['data'][idx]['x'] = bins
        return_obj['data'][idx]['y'] = bin_counts
        return_obj['data'][idx]['subData'] = sub_data_all
        return_obj['data'][idx]['subHeaders'] = sub_headers_all
        return_obj['data'][idx]['subVals'] = sub_vals_all
        return_obj['data'][idx]['subSecs'] = sub_secs_all
        return_obj['data'][idx]['subLevs'] = sub_levs_all
        return_obj['data'][idx]['xmax'] = max(bins)
        return_obj['data'][idx]['xmin'] = min(bins)
        return_obj['data'][idx]['ymax'] = max(bin_counts)
        return_obj['data'][idx]['ymin'] = 0

    return return_obj

def parse_query_data_ensemble(idx, query_data, app_params, return_obj):
    """function for parsing the data returned by an ensemble query"""
    # initialize local variables
    plot_type = app_params["plotType"]
    threshold_all = []
    oy_all = []
    on_all = []
    total_times = []
    total_values = []
    observed_total = 0
    forecast_total = 0

    # loop through the query results and store the returned values
    for row in query_data:
        data_exists = row['bin_number'] != "null" and row['bin_number'] != "NULL" and row['oy_i'] != "null" and row[
            'oy_i'] != "NULL"

        if data_exists:
            bin_number = int(row['bin_number'])
            threshold = row['threshold']
            oy = int(row['oy_i'])
            on = int(row['on_i'])
            number_times = int(row['nTimes'])
            if hasattr(row, 'n0'):
                number_values = int(row['n0'])
            else:
                number_values = int(row['nTimes'])

            # we must add up all of the observed and not-observed values for each probability bin
            observed_total = observed_total + oy
            forecast_total = forecast_total + oy + on

            if len(oy_all) < bin_number:
                oy_all.append(oy)
            else:
                oy_all[bin_number - 1] = oy_all[bin_number - 1] + oy
            if len(on_all) < bin_number:
                on_all.append(on)
            else:
                on_all[bin_number - 1] = on_all[bin_number - 1] + on
            if len(total_times) < bin_number:
                total_times.append(on)
            else:
                total_times[bin_number - 1] = total_times[bin_number - 1] + number_times
            if len(total_values) < bin_number:
                total_values.append(on)
            else:
                total_values[bin_number - 1] = total_values[bin_number - 1] + number_values
            if len(threshold_all) < bin_number:
                threshold_all.append(threshold)
            else:
                continue

    # this function deals with pct and pct_thresh tables
    ens_stats = get_ens_stat(plot_type, forecast_total, observed_total, on_all, oy_all, threshold_all,
                                    total_times, total_values)

    # Since everything is combined already, put it into the data structure
    return_obj['n0'][idx] = total_values
    return_obj['nTimes'][idx] = total_times
    return_obj['data'][idx]['x'] = ens_stats[ens_stats["x_var"]]
    return_obj['data'][idx]['y'] = ens_stats[ens_stats["y_var"]]
    return_obj['data'][idx]['sample_climo'] = ens_stats["sample_climo"]
    return_obj['data'][idx]['threshold_all'] = ens_stats["threshold_all"]
    return_obj['data'][idx]['oy_all'] = ens_stats["oy_all"]
    return_obj['data'][idx]['on_all'] = ens_stats["on_all"]
    return_obj['data'][idx]['n'] = total_values
    return_obj['data'][idx]['auc'] = ens_stats["auc"]
    return_obj['data'][idx]['xmax'] = 1.0
    return_obj['data'][idx]['xmin'] = 0.0
    return_obj['data'][idx]['ymax'] = 1.0
    return_obj['data'][idx]['ymin'] = 0.0

    return return_obj

def parse_query_data_contour(idx, query_data, stat_line_type, statistic, app_params, return_obj):
    """function for parsing the data returned by a contour query"""
    # initialize local variables
    has_levels = app_params["hasLevels"]
    agg_method = app_params["aggMethod"]
    curve_stat_lookup = {}
    curve_n_lookup = {}

    # loop through the query results and store the returned values
    for row in query_data:
        # get rid of any non-numeric characters
        non_float = re.compile(r'[^\d.]+')
        row_x_val = float(non_float.sub('', str(row['xVal']))) if str(row['xVal']) != 'NA' else 0.
        row_y_val = float(non_float.sub('', str(row['yVal']))) if str(row['yVal']) != 'NA' else 0.
        stat_key = str(row_x_val) + '_' + str(row_y_val)
        data_exists = False
        if stat_line_type == 'scalar':
            data_exists = row['fbar'] != "null" and row['fbar'] != "NULL"
        elif stat_line_type == 'vector':
            data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL"
        elif stat_line_type == 'ctc':
            data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL"
        elif stat_line_type == 'nbrcnt':
            data_exists = row['fss'] != "null" and row['fss'] != "NULL"
        else:
            data_exists = row['stat'] != "null" and row['stat'] != "NULL"

        if data_exists:
            stat, sub_levs, sub_secs, sub_values, sub_data, sub_headers, return_obj['error'][idx] \
                = get_stat(row, statistic, stat_line_type, app_params)
            if stat == 'null' or not _is_number(stat):
                # there's bad data at this point
                continue
            n = row['n']
            min_date = row['min_secs']
            max_date = row['max_secs']
        else:
            # there's no data at this point
            stat = 'null'
            n = 0
            sub_headers = 'NaN'
            sub_data = 'NaN'
            min_date = 'null'
            max_date = 'null'
        # store flat arrays of all the parsed data, used by the text output and for some calculations later
        return_obj['data'][idx]['xTextOutput'].append(row_x_val)
        return_obj['data'][idx]['yTextOutput'].append(row_y_val)
        return_obj['data'][idx]['zTextOutput'].append(stat)
        return_obj['data'][idx]['nTextOutput'].append(n)
        if stat_line_type == 'ctc' and agg_method == 'Overall statistic':
            if isinstance(sub_headers, np.ndarray) and len(sub_headers) > 0:
                flat_data = np.sum(sub_data, axis=0)
                hit_idx = np.where(sub_headers == 'fy_oy')[0][0]
                fa_idx = np.where(sub_headers == 'fy_on')[0][0]
                miss_idx = np.where(sub_headers == 'fn_oy')[0][0]
                cn_idx = np.where(sub_headers == 'fn_on')[0][0]
                return_obj['data'][idx]["hitTextOutput"].append(flat_data[hit_idx])
                return_obj['data'][idx]["faTextOutput"].append(flat_data[fa_idx])
                return_obj['data'][idx]["missTextOutput"].append(flat_data[miss_idx])
                return_obj['data'][idx]["cnTextOutput"].append(flat_data[cn_idx])
            else:
                return_obj['data'][idx]["hitTextOutput"].append('null')
                return_obj['data'][idx]["faTextOutput"].append('null')
                return_obj['data'][idx]["missTextOutput"].append('null')
                return_obj['data'][idx]["cnTextOutput"].append('null')

        return_obj['data'][idx]['minDateTextOutput'].append(min_date)
        return_obj['data'][idx]['maxDateTextOutput'].append(max_date)
        curve_stat_lookup[stat_key] = stat
        curve_n_lookup[stat_key] = n

    # get the unique x and y values and sort the stats into the 2D z array accordingly
    return_obj['data'][idx]['x'] = sorted(list(set(return_obj['data'][idx]['xTextOutput'])))
    return_obj['data'][idx]['y'] = sorted(list(set(return_obj['data'][idx]['yTextOutput'])))

    loop_sum = 0
    n_points = 0
    zmin = sys.float_info.max
    zmax = -1 * sys.float_info.max
    for curr_y in return_obj['data'][idx]['y']:
        curr_y_stat_array = []
        curr_y_n_array = []
        for curr_x in return_obj['data'][idx]['x']:
            curr_stat_key = str(curr_x) + '_' + str(curr_y)
            if curr_stat_key in curve_stat_lookup:
                curr_stat = curve_stat_lookup[curr_stat_key]
                curr_n = curve_n_lookup[curr_stat_key]
                loop_sum = loop_sum + curr_stat
                n_points = n_points + 1
                curr_y_stat_array.append(curr_stat)
                curr_y_n_array.append(curr_n)
                zmin = curr_stat if curr_stat < zmin else zmin
                zmax = curr_stat if curr_stat > zmax else zmax
            else:
                curr_y_stat_array.append('null')
                curr_y_n_array.append(0)
        return_obj['data'][idx]['z'].append(curr_y_stat_array)
        return_obj['data'][idx]['n'].append(curr_y_n_array)

    # calculate statistics
    return_obj['data'][idx]['xmin'] = return_obj['data'][idx]['x'][0]
    return_obj['data'][idx]['xmax'] = return_obj['data'][idx]['x'][len(return_obj['data'][idx]['x']) - 1]
    return_obj['data'][idx]['ymin'] = return_obj['data'][idx]['y'][0]
    return_obj['data'][idx]['ymax'] = return_obj['data'][idx]['y'][len(return_obj['data'][idx]['y']) - 1]
    return_obj['data'][idx]['zmin'] = zmin
    return_obj['data'][idx]['zmax'] = zmax
    return_obj['data'][idx]['sum'] = loop_sum
    return_obj['data'][idx]['glob_stats']['mean'] = loop_sum / n_points
    return_obj['data'][idx]['glob_stats']['minDate'] = min(m for m in return_obj['data'][idx]['minDateTextOutput'] if m != 'null')
    return_obj['data'][idx]['glob_stats']['maxDate'] = max(m for m in return_obj['data'][idx]['maxDateTextOutput'] if m != 'null')
    return_obj['data'][idx]['glob_stats']['n'] = n_points

    return return_obj

def parse_query_data_simple_scatter(idx, results, stat_line_type, statistic, app_params, return_obj):
    """function for parsing the data returned by a contour query"""
    # initialize local variables
    statistic = statistic.split('__vs__')
    statistic_x = statistic[0]
    statistic_y = statistic[1]
    has_levels = app_params["hasLevels"]
    agg_method = app_params["aggMethod"]
    outlier_qc_param = "all" if app_params["outliers"] == "all" else int(app_params["outliers"])

    # loop through the query results and store the returned values
    for row in results:
        # get rid of any non-numeric characters
        non_float = re.compile(r'[^\d.]+')
        bin_val = float(non_float.sub('', str(row['binVal']))) if str(row['binVal']) != 'NA' else 0.
        if stat_line_type == 'scalar':
            data_exists = row['fbarX'] != "null" and row['fbarX'] != "NULL"
        else:
            data_exists = row['stat'] != "null" and row['stat'] != "NULL"

        if data_exists:
            # get the x-stat first
            row_data = {"sub_data": row["sub_dataX"]}
            stat_x, sub_levs_x, sub_secs_x, sub_values_x, sub_data_x, sub_headers_x, return_obj['error'][idx] \
                = get_stat(row_data, statistic_x, stat_line_type, app_params)
            # then get the y-stat
            row_data = {"sub_data": row["sub_dataY"]}
            stat_y, sub_levs_y, sub_secs_y, sub_values_y, sub_data_y, sub_headers_y, return_obj['error'][idx] \
                = get_stat(row_data, statistic_y, stat_line_type, app_params)
            if stat_x == 'null' or not _is_number(stat_x) or stat_y == 'null' or not _is_number(stat_y):
                # there's bad data at this point
                continue
            else:
                # make sure all the sub-values match and then re-calculate the stat if necessary
                if has_levels:
                    sub_sec_lev_x = list(zip(sub_secs_x, sub_levs_x))
                    sub_sec_lev_y = list(zip(sub_secs_y, sub_levs_y))
                else:
                    sub_sec_lev_x = list(sub_secs_x)
                    sub_sec_lev_y = list(sub_secs_y)
                matched_sec_levs = set(sub_sec_lev_x) & set(sub_sec_lev_y)
                unmatched_sec_levs_x = list(set(sub_sec_lev_x) - matched_sec_levs)
                unmatched_sec_levs_y = list(set(sub_sec_lev_y) - matched_sec_levs)
                if len(unmatched_sec_levs_x) > 0 or len(unmatched_sec_levs_y) > 0:
                    unmatched_x_indices = [i for i, e in enumerate(sub_sec_lev_x) if e in unmatched_sec_levs_x]
                    unmatched_y_indices = [i for i, e in enumerate(sub_sec_lev_y) if e in unmatched_sec_levs_y]
                    sub_data_x = np.delete(sub_data_x, unmatched_x_indices, axis=0)
                    sub_data_y = np.delete(sub_data_y, unmatched_y_indices, axis=0)
                    sub_secs_x = np.delete(sub_secs_x, unmatched_x_indices)
                    sub_secs_y = np.delete(sub_secs_y, unmatched_y_indices)
                    if has_levels:
                        sub_levs_x = np.delete(sub_levs_x, unmatched_y_indices)
                        sub_levs_y = np.delete(sub_levs_y, unmatched_x_indices)

                    sub_values_x, sub_secs_x, sub_levs_x, sub_data_x, stat_x, error = calculate_stat(statistic_x,
                            stat_line_type, agg_method, outlier_qc_param, sub_data_x, sub_headers_x, sub_secs_x, sub_levs_x)

                    sub_values_y, sub_secs_y, sub_levs_y, sub_data_y, stat_y, error = calculate_stat(statistic_y,
                            stat_line_type, agg_method, outlier_qc_param, sub_data_y, sub_headers_y, sub_secs_y, sub_levs_y)

                    if stat_x == 'null' or not _is_number(stat_x) or stat_y == 'null' or not _is_number(stat_y):
                        # there's bad data at this point
                        continue
            n = len(sub_values_x)
        else:
            # there's no data at this point
            stat_x = 'null'
            stat_y = 'null'
            n = 0
            sub_headers_x = []
            sub_data_x = []
            sub_values_x = []
            sub_secs_x = []
            sub_levs_x = []
            sub_headers_y = []
            sub_data_y = []
            sub_values_y = []
            sub_secs_y = []
            sub_levs_y = []

        return_obj['data'][idx]['x'].append(stat_x)
        return_obj['data'][idx]['y'].append(stat_y)
        return_obj['data'][idx]['n'].append(n)
        return_obj['data'][idx]['binVals'].append(float(bin_val))
        return_obj['data'][idx]['subDataX'].append(sub_data_x.tolist() if not isinstance(sub_data_x, list) else sub_data_x)
        return_obj['data'][idx]['subHeadersX'].append(sub_headers_x.tolist() if not isinstance(sub_headers_x, list) else sub_headers_x)
        return_obj['data'][idx]['subValsX'].append(sub_values_x.tolist() if not isinstance(sub_values_x, list) else sub_values_x)
        return_obj['data'][idx]['subSecsX'].append(sub_secs_x.tolist() if not isinstance(sub_secs_x, list) else sub_secs_x)
        return_obj['data'][idx]['subLevsX'].append(sub_levs_x.tolist() if not isinstance(sub_levs_x, list) else sub_levs_x)
        return_obj['data'][idx]['subDataY'].append(sub_data_y.tolist() if not isinstance(sub_data_y, list) else sub_data_y)
        return_obj['data'][idx]['subHeadersY'].append(sub_headers_y.tolist() if not isinstance(sub_headers_y, list) else sub_headers_y)
        return_obj['data'][idx]['subValsY'].append(sub_values_y.tolist() if not isinstance(sub_values_y, list) else sub_values_y)
        return_obj['data'][idx]['subSecsY'].append(sub_secs_y.tolist() if not isinstance(sub_secs_y, list) else sub_secs_y)
        return_obj['data'][idx]['subLevsY'].append(sub_levs_y.tolist() if not isinstance(sub_levs_y, list) else sub_levs_y)

    # calculate statistics
    return_obj['data'][idx]['xmin'] = min(return_obj['data'][idx]['x'])
    return_obj['data'][idx]['xmax'] = max(return_obj['data'][idx]['x'])
    return_obj['data'][idx]['ymin'] = min(return_obj['data'][idx]['y'])
    return_obj['data'][idx]['ymax'] = max(return_obj['data'][idx]['y'])
    return_obj['data'][idx]['sum'] = sum(return_obj['data'][idx]['n'])

    return return_obj

def do_matching(options, return_obj):
    """function for matching data in the output object"""
    sub_secs_raw = {}
    sub_levs_raw = {}
    sub_secs = []
    sub_levs = []
    independent_var_groups = []
    independent_var_has_point = []
    sub_intersections_object = {}
    sub_intersections_array = []
    sub_sec_intersection_object = {}
    sub_sec_intersection_array = []

    plot_type = options["query_array"][0]["appParams"]["plotType"]
    has_levels = options["query_array"][0]["appParams"]["hasLevels"]
    curves_length = len(return_obj['data'])

    if plot_type in ["EnsembleHistogram"]:
        remove_non_matching_ind_vars = False
    elif plot_type in ["TimeSeries", "Profile", "Dieoff", "Threshold", "ValidTime", "GridScale", "DailyModelCycle",
                        "YearToYear", "SimpleScatter", "Scatter2d", "Contour", "ContourDiff"]:
        remove_non_matching_ind_vars = True
    else:
        # Either matching is not supported for this pot type, or it's a histogram and we do the matching later
        # ["Reliability", "ROC", "PerformanceDiagram", "Histogram", "Map"]
        return return_obj

    # matching in this function is based on a curve's independent variable. For a timeseries, the independentVar
    # is epoch, for a profile, it's level, for a dieoff, it's forecast hour, for a threshold plot, it's threshold,
    # and for a valid time plot, it's hour of day. This function identifies the the independentVar values common
    # across all of the curves, and then the common sub times / levels / values for those independentVar values.

    # determine whether data.x or data.y is the independent variable, and which is the stat value
    if plot_type == "SimpleScatter":
        independent_var_name = 'binVals'
        stat_var_name = 'x'
        sub_secs_name = "subSecsX"
        sub_levs_name = "subLevsX"
    elif plot_type != "Profile":
        independent_var_name = 'x'
        stat_var_name = 'y'
        sub_secs_name = "subSecs"
        sub_levs_name = "subLevs"
    else:
        independent_var_name = 'y'
        stat_var_name = 'x'
        sub_secs_name = "subSecs"
        sub_levs_name = "subLevs"

    # find the matching independentVars shared across all curves
    for curve_index in range(curves_length):
        independent_var_groups.append([])  # array for the independentVars for each curve that are not null
        independent_var_has_point.append([])  # array for the * all * of the independentVars for each curve
        sub_secs.append(
            {})  # map of the individual record times (subSecs) going into each independentVar for each curve
        if has_levels:
            sub_levs.append(
                {})  # map of the individual record levels (subLevs) going into each independentVar for each curve
        data = return_obj['data'][curve_index]

        # loop over every independentVar value in this curve
        for di in range(len(data[independent_var_name])):
            curr_independent_var = data[independent_var_name][di]
            if data[stat_var_name][di] != 'null':
                # store raw secs for this independentVar value, since it's not a null point
                sub_secs[curve_index][curr_independent_var] = data[sub_secs_name][di]
                if has_levels:
                    # store raw levs for this independentVar value, since it's not a null point
                    sub_levs[curve_index][curr_independent_var] = data[sub_levs_name][di]
                # store this independentVar value, since it's not a null point
                independent_var_groups[curve_index].append(curr_independent_var)
            # store all the independentVar values, regardless of whether they're null
            independent_var_has_point[curve_index].append(curr_independent_var)

    matching_independent_vars = set(independent_var_groups[0])
    matching_independent_has_point = set(independent_var_has_point[0])
    for curve_index in range(1, curves_length):
        matching_independent_vars = matching_independent_vars & set(independent_var_groups[curve_index])
        matching_independent_has_point = matching_independent_has_point & set(independent_var_has_point[curve_index])
    matching_independent_vars = list(matching_independent_vars)
    matching_independent_has_point = list(matching_independent_has_point)

    if remove_non_matching_ind_vars:
        if has_levels:
            # loop over each common non-null independentVar value
            for fi in range(0, len(matching_independent_vars)):
                curr_independent_var = matching_independent_vars[fi]
                sub_intersections_object[curr_independent_var] = []
                curr_sub_intersections = []
                for si in range(0, len(sub_secs[0][curr_independent_var])):
                    # fill current intersection array with sec-lev pairs from the first curve
                    curr_sub_intersections.append(
                        [sub_secs[0][curr_independent_var][si], sub_levs[0][curr_independent_var][si]])
                # loop over every curve after the first
                for curve_index in range(1, curves_length):
                    temp_sub_intersections = []
                    for si in range(0, len(sub_secs[curve_index][curr_independent_var])):
                        # create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                        temp_pair = [sub_secs[curve_index][curr_independent_var][si],
                                        sub_levs[curve_index][curr_independent_var][si]]
                        # see if the individual sec-lev pair matches a pair from the current intersection array
                        if temp_pair in curr_sub_intersections:
                            # store matching pairs
                            temp_sub_intersections.append(temp_pair)
                    # replace current intersection array with array of only pairs that matched from this loop through.
                    curr_sub_intersections = temp_sub_intersections
                # store the final intersecting subSecs array for this common non-null independentVar value
                sub_intersections_object[curr_independent_var] = curr_sub_intersections
        else:
            # loop over each common non - null independentVar value
            for fi in range(0, len(matching_independent_vars)):
                curr_independent_var = matching_independent_vars[fi]
                # fill current subSecs intersection array with subSecs from the first curve
                curr_sub_sec_intersection = sub_secs[0][curr_independent_var]
                # loop over every curve after the first
                for curve_index in range(1, curves_length):
                    # keep taking the intersection of the current subSecs intersection array with each curve's subSecs array for this independentVar value
                    curr_sub_sec_intersection = list(
                        set.intersection(set(curr_sub_sec_intersection),
                                            set(sub_secs[curve_index][curr_independent_var])))
                # store the final intersecting subSecs array for this common non-null independentVar value
                sub_sec_intersection_object[curr_independent_var] = curr_sub_sec_intersection
    else:
        # pull all subSecs and subLevs out of their bins, and back into one main array
        for curve_index in range(0, curves_length):
            data = return_obj['data'][curve_index]
            sub_secs_raw[curve_index] = []
            sub_secs[curve_index] = []
            if has_levels:
                sub_levs_raw[curve_index] = []
                sub_levs[curve_index] = []
            for di in range(0, len(data[independent_var_name])):
                sub_secs_raw[curve_index].append(data[sub_secs_name][di])
                if has_levels:
                    sub_levs_raw[curve_index].append(data[sub_levs_name][di])
            sub_secs[curve_index] = [item for sublist in sub_secs_raw[curve_index] for item in sublist]
            if has_levels:
                sub_levs[curve_index] = [item for sublist in sub_levs_raw[curve_index] for item in sublist]

        if has_levels:
            # determine which seconds and levels are present in all curves
            for si in range(0, len(sub_secs[0])):
                # fill current intersection array with sec-lev pairs from the first curve
                sub_intersections_array.append([sub_secs[0][si], sub_levs[0][si]])
            # loop over every curve after the first
            for curve_index in range(1, curves_length):
                temp_sub_intersections = []
                for si in range(0, len(sub_secs[curve_index])):
                    # create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                    temp_pair = [sub_secs[curve_index][si], sub_levs[curve_index][si]]
                    # see if the individual sec-lev pair matches a pair from the current intersection array
                    if temp_pair in sub_intersections_array:
                        # store matching pairs
                        temp_sub_intersections.append(temp_pair)
                # replace current intersection array with array of only pairs that matched from this loop through
                sub_intersections_array = temp_sub_intersections
        else:
            # determine which seconds are present in all curves
            # fill current subSecs intersection array with subSecs from the first curve
            sub_sec_intersection_array = sub_secs[0]
            # loop over every curve after the first
            for curve_index in range(1, curves_length):
                # keep taking the intersection of the current subSecs intersection array with each curve's subSecs array
                sub_sec_intersection_array = list(
                    set.intersection(set(sub_sec_intersection_array), set(sub_secs[curve_index])))

    # remove non-matching independentVars and subSecs
    for curve_index in range(0, curves_length):
        data = return_obj['data'][curve_index]
        # need to loop backwards through the data array so that we can splice non-matching indices
        # while still having the remaining indices in the correct order
        data_length = len(data[independent_var_name])
        for di in range(data_length - 1, -1, -1):
            if remove_non_matching_ind_vars:
                if data[independent_var_name][di] not in matching_independent_vars:
                    # if this is not a common non-null independentVar value, we'll have to remove some data
                    if data[independent_var_name][di] not in matching_independent_has_point:
                        # if at least one curve doesn't even have a null here, much less a matching value (because of the cadence), just drop this independentVar
                        _remove_point(data, di, plot_type, stat_var_name, has_levels)
                    else:
                        # if all of the curves have either data or nulls at this independentVar, and there is at least one null, ensure all of the curves are null
                        _null_point(data, di, plot_type, stat_var_name, has_levels)
                    # then move on to the next independentVar. There's no need to mess with the subSecs or subLevs
                    continue
            if plot_type != "SimpleScatter":
                sub_data = data["subData"][di]
                sub_data_x = []
                sub_data_y = []
                sub_headers = data["subHeaders"][di]
                sub_headers_x = []
                sub_headers_y = []
                sub_values = data["subVals"][di]
                sub_values_x = []
                sub_values_y = []
                sub_secs = data["subSecs"][di]
                sub_secs_x = []
                sub_secs_y = []
                if has_levels:
                    sub_levs = data["subLevs"][di]
                    sub_levs_x = []
                    sub_levs_y = []
            else:
                sub_data = []
                sub_data_x = data["subDataX"][di]
                sub_data_y = data["subDataY"][di]
                sub_headers = []
                sub_headers_x = data["subHeadersX"][di]
                sub_headers_y = data["subHeadersY"][di]
                sub_values = []
                sub_values_x = data["subValsX"][di]
                sub_values_y = data["subValsY"][di]
                sub_secs = []
                sub_secs_x = data["subSecsX"][di]
                sub_secs_y = data["subSecsY"][di]
                if has_levels:
                    sub_levs = []
                    sub_levs_x = data["subLevsX"][di]
                    sub_levs_y = data["subLevsY"][di]

            if (not has_levels and (len(sub_secs) > 0 or len(sub_secs_x) > 0 or len(sub_secs_y) > 0)) \
                    or (has_levels and ((len(sub_secs) > 0 and len(sub_levs) > 0) or (len(sub_secs_x) > 0
                    and len(sub_levs_x) > 0) or (len(sub_secs_y) > 0 and len(sub_levs_y) > 0))):

                curr_independent_var = data[independent_var_name][di]
                new_sub_data = []
                new_sub_data_x = []
                new_sub_data_y = []
                new_sub_values = []
                new_sub_values_x = []
                new_sub_values_y = []
                new_sub_secs = []
                new_sub_secs_x = []
                new_sub_secs_y = []
                new_sub_levs = []
                new_sub_levs_x = []
                new_sub_levs_y = []

                # loop over all subSecs for this independentVar
                for si in range(0, len(sub_secs)):
                    if has_levels:
                        # create sec-lev pair for each sub value
                        temp_pair = [sub_secs[si], sub_levs[si]]
                    # keep the subValue only if its associated subSec / subLev is common to all curves for this independentVar
                    if (not remove_non_matching_ind_vars and
                        ((not has_levels and sub_secs[si] in sub_sec_intersection_array)
                            or (has_levels and temp_pair in sub_intersections_array))) or \
                            (remove_non_matching_ind_vars and
                                ((not has_levels and sub_secs[si] in sub_sec_intersection_object[curr_independent_var])
                                or (has_levels and temp_pair in sub_intersections_object[curr_independent_var]))):
                        new_sub_data.append(sub_data[si])
                        new_sub_values.append(sub_values[si])
                        new_sub_secs.append(sub_secs[si])
                        if has_levels:
                            new_sub_levs.append(sub_levs[si])

                # if we have x-related sub_secs, loop over those
                for si in range(0, len(sub_secs_x)):
                    if has_levels:
                        # create sec-lev pair for each x-sub value
                        temp_pair_x = [sub_secs_x[si], sub_levs_x[si]]
                    if (not has_levels and sub_secs_x[si] in sub_sec_intersection_object[curr_independent_var]) \
                            or (has_levels and temp_pair_x in sub_intersections_object[curr_independent_var]):
                        new_sub_data_x.append(sub_data_x[si])
                        new_sub_values_x.append(sub_values_x[si])
                        new_sub_secs_x.append(sub_secs_x[si])
                        if has_levels:
                            new_sub_levs_x.append(sub_levs_x[si])

                # if we have y-related sub_secs, loop over those
                for si in range(0, len(sub_secs_y)):
                    if has_levels:
                        # create sec-lev pair for each y-sub value
                        temp_pair_y = [sub_secs_y[si], sub_levs_y[si]]
                    if (not has_levels and sub_secs_y[si] in sub_sec_intersection_object[curr_independent_var]) \
                            or (has_levels and temp_pair_y in sub_intersections_object[curr_independent_var]):
                        new_sub_data_y.append(sub_data_y[si])
                        new_sub_values_y.append(sub_values_y[si])
                        new_sub_secs_y.append(sub_secs_y[si])
                        if has_levels:
                            new_sub_levs_y.append(sub_levs_y[si])

                if len(new_sub_secs) == 0 and len(new_sub_secs_x) == 0 and len(new_sub_secs_y) == 0:
                    # no matching sub-values, so null the point
                    _null_point(data, di, plot_type, stat_var_name, has_levels)
                else:
                    # store the filtered data
                    if plot_type != "SimpleScatter":
                        data["subData"][di] = new_sub_data
                        data["subHeaders"][di] = sub_headers
                        data["subVals"][di] = new_sub_values
                        data["subSecs"][di] = new_sub_secs
                        if has_levels:
                            data["subLevs"][di] = new_sub_levs
                    else:
                        data["subDataX"][di] = new_sub_data_x
                        data["subDataY"][di] = new_sub_data_y
                        data["subHeadersX"][di] = sub_headers_x
                        data["subHeadersY"][di] = sub_headers_y
                        data["subValsX"][di] = new_sub_values_x
                        data["subValsY"][di] = new_sub_values_y
                        data["subSecsX"][di] = new_sub_secs_x
                        data["subSecsY"][di] = new_sub_secs_y
                        if has_levels:
                            data["subLevsX"][di] = new_sub_levs_x
                            data["subLevsY"][di] = new_sub_levs_y
            else:
                # no sub-values to begin with, so null the point
                _null_point(data, di, plot_type, stat_var_name, has_levels)

        data_length = len(data[independent_var_name])
        for di in range(0, data_length):
            if data[stat_var_name][di] != 'null':
                statistic = options["query_array"][curve_index]["statistic"]
                stat_line_type = options["query_array"][curve_index]["statLineType"]
                agg_method = options["query_array"][curve_index]["appParams"]["aggMethod"]

                if plot_type == "SimpleScatter":
                    statistic = statistic.split('__vs__')
                    statistic_x = statistic[0]
                    statistic_y = statistic[1]
                    if has_levels:
                        sub_lev_arg_x = np.asarray(data["subLevsX"][di])
                        sub_lev_arg_y = np.asarray(data["subLevsY"][di])
                    else:
                        sub_lev_arg_x = np.asarray([])
                        sub_lev_arg_y = np.asarray([])

                    sub_stats_x, sub_secs_x, sub_levs_x, numpy_data_x, stat_x, stat_error = calculate_stat(
                        statistic_x, stat_line_type, agg_method, "all",
                        np.asarray(data["subDataX"][di]), np.asarray(data["subHeadersX"][di]),
                        np.asarray(data["subSecsX"][di]), sub_lev_arg_x)
                    data["x"][di] = stat_x
                    sub_stats_y, sub_secs_y, sub_levs_y, numpy_data_y, stat_y, stat_error = calculate_stat(
                        statistic_y, stat_line_type, agg_method, "all",
                        np.asarray(data["subDataY"][di]), np.asarray(data["subHeadersY"][di]),
                        np.asarray(data["subSecsY"][di]), sub_lev_arg_y)
                    data["y"][di] = stat_y
                    if stat_error != '':
                        return_obj['error'][curve_index] = stat_error
                else:
                    if has_levels:
                        sub_lev_arg = np.asarray(data["subLevs"][di])
                    else:
                        sub_lev_arg = np.asarray([])

                    sub_stats, sub_secs, sub_levs, numpy_data, stat, stat_error = calculate_stat(
                        statistic, stat_line_type, agg_method, "all",
                        np.asarray(data["subData"][di]), np.asarray(data["subHeaders"][di]),
                        np.asarray(data["subSecs"][di]), sub_lev_arg)
                    data[stat_var_name][di] = stat
                    if stat_error != '':
                        return_obj['error'][curve_index] = stat_error

                if _is_number(data["x"][di]) and data["x"][di] < data["xmin"]:
                    data["xmin"] = data["x"][di]
                if _is_number(data["x"][di]) and data["x"][di] > data["xmax"]:
                    data["xmax"] = data["x"][di]
                if _is_number(data["y"][di]) and data["y"][di] < data["ymin"]:
                    data["ymin"] = data["y"][di]
                if _is_number(data["y"][di]) and data["y"][di] > data["ymax"]:
                    data["ymax"] = data["y"][di]

        return_obj['data'][curve_index] = data
    
    return return_obj