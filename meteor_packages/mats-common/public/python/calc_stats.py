import numpy as np
import metcalcpy.util.sl1l2_statistics as calc_sl1l2
import metcalcpy.util.sal1l2_statistics as calc_sal1l2
import metcalcpy.util.vcnt_statistics as calc_vcnt
import metcalcpy.util.val1l2_statistics as calc_val1l2
import metcalcpy.util.ctc_statistics as calc_ctc
import metcalcpy.util.ecnt_statistics as calc_ecnt
import metcalcpy.util.nbrcnt_statistics as calc_nbrcnt
import metcalcpy.util.mode_2d_ratio_statistics as calc_2d_ratio
import metcalcpy.util.mode_2d_arearat_statistics as calc_2d_arearat
from mode_stats import calculate_ots, calculate_mmi, calculate_ofb, calculate_mcd, \
    calculate_mode_csi, calculate_mode_far, calculate_mode_pody


def _scalar_stat_switch():
    """function for defining the appropriate scalar statistical calculation functions"""
    return {
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


def _vector_stat_switch():
    """function for defining the appropriate vector statistical calculation functions"""
    return {
        'Vector ACC': calc_val1l2.calculate_val1l2_anom_corr,
        'Forecast length of mean wind vector': calc_vcnt.calculate_vcnt_fbar_speed,
        'Observed length of mean wind vector': calc_vcnt.calculate_vcnt_obar_speed,
        'Forecast length - observed length of mean wind vector': calc_vcnt.calculate_vcnt_speed_err,
        'abs(Forecast length - observed length of mean wind vector)': calc_vcnt.calculate_vcnt_speed_abserr,
        'Length of forecast - observed mean wind vector': calc_vcnt.calculate_vcnt_vdiff_speed,
        'Direction of forecast - observed mean wind vector': calc_vcnt.calculate_vcnt_vdiff_dir,
        'Forecast direction of mean wind vector': calc_vcnt.calculate_vcnt_fdir,
        'Observed direction of mean wind vector': calc_vcnt.calculate_vcnt_odir,
        'Angle between mean forecast and mean observed wind vectors': calc_vcnt.calculate_vcnt_vdiff_dir,
        'RMSE of forecast wind vector length': calc_vcnt.calculate_vcnt_fs_rms,
        'RMSE of observed wind vector length': calc_vcnt.calculate_vcnt_os_rms,
        'Vector wind speed MSVE': calc_vcnt.calculate_vcnt_msve,
        'Vector wind speed RMSVE': calc_vcnt.calculate_vcnt_rmsve,
        'Forecast mean of wind vector length': calc_vcnt.calculate_vcnt_fbar,
        'Observed mean of wind vector length': calc_vcnt.calculate_vcnt_obar,
        'Forecast stdev of wind vector length': calc_vcnt.calculate_vcnt_fstdev,
        'Observed stdev of wind vector length': calc_vcnt.calculate_vcnt_fstdev
    }


def _ctc_stat_switch():
    """function for defining the appropriate ctc statistical calculation functions"""
    return {
        'CSI (Critical Success Index)': calc_ctc.calculate_csi,
        'FAR (False Alarm Ratio)': calc_ctc.calculate_far,
        'FBIAS (Frequency Bias)': calc_ctc.calculate_fbias,
        'GSS (Gilbert Skill Score)': calc_ctc.calculate_gss,
        'HSS (Heidke Skill Score)': calc_ctc.calculate_hss,
        'PODy (Probability of positive detection)': calc_ctc.calculate_pody,
        'PODn (Probability of negative detection)': calc_ctc.calculate_podn,
        'POFD (Probability of false detection)': calc_ctc.calculate_pofd
    }


def _nbrcnt_stat_switch():
    """function for defining the appropriate nbrcnt statistical calculation functions"""
    return {
        'FSS': calc_nbrcnt.calculate_nbr_fss
    }


def _ecnt_stat_switch():
    """function for defining the appropriate ecnt statistical calculation functions"""
    return {
        'RMSE': [calc_ecnt.calculate_ecnt_rmse, np.square, 'mse'],
        'RMSE with obs error': [calc_ecnt.calculate_ecnt_rmse_oerr, np.square, 'mse_oerr'],
        'Spread': [calc_ecnt.calculate_ecnt_spread, np.square, 'variance'],
        'Spread with obs error': [calc_ecnt.calculate_ecnt_spread_oerr, np.square, 'variance_oerr'],
        'ME (Additive bias)': [calc_ecnt.calculate_ecnt_me, '', 'me'],
        'ME with obs error': [calc_ecnt.calculate_ecnt_me_oerr, '', 'me_oerr'],
        'CRPS': [calc_ecnt.calculate_ecnt_crps, '', 'crps'],
        'CRPSS': [calc_ecnt.calculate_ecnt_crpss, '', 'crpss'],
        'MAE': [calc_ecnt.calculate_ecnt_mae, '', 'mae'],
    }


def _mode_single_stat_switch():
    """function for defining the appropriate mode_single statistical calculation functions"""
    return {
        'Ratio of simple objects that are forecast objects': calc_2d_ratio.calculate_2d_ratio_fsa_asa,
        'Ratio of simple objects that are observation objects': calc_2d_ratio.calculate_2d_ratio_osa_asa,
        'Ratio of simple objects that are matched': calc_2d_ratio.calculate_2d_ratio_asm_asa,
        'Ratio of simple objects that are unmatched': calc_2d_ratio.calculate_2d_ratio_asu_asa,
        'Ratio of simple forecast objects that are matched': calc_2d_ratio.calculate_2d_ratio_fsm_fsa,
        'Ratio of simple forecast objects that are unmatched': calc_2d_ratio.calculate_2d_ratio_fsu_fsa,
        'Ratio of simple observed objects that are matched': calc_2d_ratio.calculate_2d_ratio_osm_osa,
        'Ratio of simple observed objects that are unmatched': calc_2d_ratio.calculate_2d_ratio_osu_osa,
        'Ratio of simple matched objects that are forecast objects': calc_2d_ratio.calculate_2d_ratio_fsm_asm,
        'Ratio of simple matched objects that are observed objects': calc_2d_ratio.calculate_2d_ratio_osm_asm,
        'Ratio of simple unmatched objects that are forecast objects': calc_2d_ratio.calculate_2d_ratio_fsu_asu,
        'Ratio of simple unmatched objects that are observed objects': calc_2d_ratio.calculate_2d_ratio_osu_asu,
        'Ratio of forecast objects that are simple': calc_2d_ratio.calculate_2d_ratio_fsa_faa,
        'Ratio of forecast objects that are cluster': calc_2d_ratio.calculate_2d_ratio_fca_faa,
        'Ratio of observed objects that are simple': calc_2d_ratio.calculate_2d_ratio_osa_oaa,
        'Ratio of observed objects that are cluster': calc_2d_ratio.calculate_2d_ratio_oca_oaa,
        'Ratio of cluster objects that are forecast objects': calc_2d_ratio.calculate_2d_ratio_fca_aca,
        'Ratio of cluster objects that are observation objects': calc_2d_ratio.calculate_2d_ratio_oca_aca,
        'Ratio of simple forecasts to simple observations (frequency bias)': calc_2d_ratio.calculate_2d_ratio_fsa_osa,
        'Ratio of simple observations to simple forecasts (1 / frequency bias)': calc_2d_ratio.calculate_2d_ratio_osa_fsa,
        'Ratio of cluster objects to simple objects': calc_2d_ratio.calculate_2d_ratio_aca_asa,
        'Ratio of simple objects to cluster objects': calc_2d_ratio.calculate_2d_ratio_asa_aca,
        'Ratio of forecast cluster objects to forecast simple objects': calc_2d_ratio.calculate_2d_ratio_fca_fsa,
        'Ratio of forecast simple objects to forecast cluster objects': calc_2d_ratio.calculate_2d_ratio_fsa_fca,
        'Ratio of observed cluster objects to observed simple objects': calc_2d_ratio.calculate_2d_ratio_oca_osa,
        'Ratio of observed simple objects to observed cluster objects': calc_2d_ratio.calculate_2d_ratio_osa_oca,
        'Area-weighted ratio of simple objects that are forecast objects': calc_2d_arearat.calculate_2d_arearat_fsa_asa,
        'Area-weighted ratio of simple objects that are observation objects': calc_2d_arearat.calculate_2d_arearat_osa_asa,
        'Area-weighted ratio of simple objects that are matched': calc_2d_arearat.calculate_2d_arearat_asm_asa,
        'Area-weighted ratio of simple objects that are unmatched': calc_2d_arearat.calculate_2d_arearat_asu_asa,
        'Area-weighted ratio of simple forecast objects that are matched': calc_2d_arearat.calculate_2d_arearat_fsm_fsa,
        'Area-weighted ratio of simple forecast objects that are unmatched': calc_2d_arearat.calculate_2d_arearat_fsu_fsa,
        'Area-weighted ratio of simple observed objects that are matched': calc_2d_arearat.calculate_2d_arearat_osm_osa,
        'Area-weighted ratio of simple observed objects that are unmatched': calc_2d_arearat.calculate_2d_arearat_osu_osa,
        'Area-weighted ratio of simple matched objects that are forecast objects': calc_2d_arearat.calculate_2d_arearat_fsm_asm,
        'Area-weighted ratio of simple matched objects that are observed objects': calc_2d_arearat.calculate_2d_arearat_osm_asm,
        'Area-weighted ratio of simple unmatched objects that are observed objects': calc_2d_arearat.calculate_2d_arearat_osu_asu,
        'Area-weighted ratio of forecast objects that are simple': calc_2d_arearat.calculate_2d_arearat_fsa_faa,
        'Area-weighted ratio of forecast objects that are cluster': calc_2d_arearat.calculate_2d_arearat_fca_faa,
        'Area-weighted ratio of observed objects that are simple': calc_2d_arearat.calculate_2d_arearat_osa_oaa,
        'Area-weighted ratio of observed objects that are cluster': calc_2d_arearat.calculate_2d_arearat_oca_oaa,
        'Area-weighted ratio of cluster objects that are forecast objects': calc_2d_arearat.calculate_2d_arearat_fca_aca,
        'Area-weighted ratio of cluster objects that are observation objects': calc_2d_arearat.calculate_2d_arearat_oca_aca,
        'Area-weighted ratio of simple forecasts to simple observations (frequency bias)': calc_2d_arearat.calculate_2d_arearat_fsa_osa,
        'Area-weighted ratio of simple observations to simple forecasts (1 / frequency bias)': calc_2d_arearat.calculate_2d_arearat_osa_fsa,
        'Area-weighted ratio of cluster objects to simple objects': calc_2d_arearat.calculate_2d_arearat_aca_asa,
        'Area-weighted ratio of simple objects to cluster objects': calc_2d_arearat.calculate_2d_arearat_asa_aca,
        'Area-weighted ratio of forecast cluster objects to forecast simple objects': calc_2d_arearat.calculate_2d_arearat_fca_fsa,
        'Area-weighted ratio of forecast simple objects to forecast cluster objects': calc_2d_arearat.calculate_2d_arearat_fsa_fca,
        'Area-weighted ratio of observed cluster objects to observed simple objects': calc_2d_arearat.calculate_2d_arearat_oca_osa,
        'Area-weighted ratio of observed simple objects to observed cluster objects': calc_2d_arearat.calculate_2d_arearat_osa_oca,
    }


def _mode_pair_stat_switch():
    """function for defining the appropriate mode_pair statistical calculation functions"""
    return {
        'OTS (Object Threat Score)': calculate_ots,
        'MMI (Median of Maximum Interest)': calculate_mmi,
        'CSI (Critical Success Index)': calculate_mode_csi,
        'FAR (False Alarm Ratio)': calculate_mode_far,
        'PODy (Probability of positive detection)': calculate_mode_pody,
        'Object frequency bias': calculate_ofb,
        'Model-obs centroid distance (unique pairs)': calculate_mcd,
    }


def calculate_stat(statistic, stat_line_type, agg_method, outlier_qc_param, numpy_data, column_headers, sub_secs, sub_levs):
    """function for determining and calling the appropriate statistical calculation function"""
    if stat_line_type == 'scalar':
        stat_switch = _scalar_stat_switch()
    elif stat_line_type == 'vector':
        stat_switch = _vector_stat_switch()
    elif stat_line_type == 'ctc':
        stat_switch = _ctc_stat_switch()
    elif stat_line_type == 'nbrcnt':
        stat_switch = _nbrcnt_stat_switch()
    elif stat_line_type == 'ecnt':
        stat_switch = _ecnt_stat_switch()
    elif stat_line_type == 'mode_single':
        stat_switch = _mode_single_stat_switch()
    elif stat_line_type == 'mode_pair':
        stat_switch = _mode_pair_stat_switch()
    else:
        stat_switch = {}

    error = ""
    data_length = numpy_data.shape[0]
    total_index = np.where(column_headers == 'total')[0]
    sub_stats = np.empty([data_length])
    if stat_line_type == "ecnt":
        column_headers[0] = stat_switch[statistic][2]
    try:
        for idx in range(data_length):
            if stat_line_type == "precalculated":
                sub_stats[idx] = numpy_data[idx, 0]
            elif stat_line_type == "ecnt":
                if stat_switch[statistic][1] != '':
                    numpy_data[[idx], :] = stat_switch[statistic][1](numpy_data[[idx], :])
                sub_stats[idx] = stat_switch[statistic][0](numpy_data[[idx], :], column_headers)
            elif stat_line_type == 'mode_pair':
                # dummy because these need to be overall stats only
                sub_stats[idx] = 1
            else:
                sub_stats[idx] = stat_switch[statistic](numpy_data[[idx], :], column_headers)

        # now that we have all the sub-stats, we can get the standard deviation 
        # and remove the rows that exceed it. This should only ever trigger for 
        # scalar stats, everything else will have outlier_qc_param = 100
        if outlier_qc_param != "all":
            sub_stdev = np.nanstd(sub_stats)
            sub_mean = np.nanmean(sub_stats)
            sd_limit = outlier_qc_param * sub_stdev
            for idx in reversed(range(data_length)):
                if abs(sub_stats[idx] - sub_mean) > sd_limit:
                    sub_stats = np.delete(sub_stats, idx, 0)
                    sub_secs = np.delete(sub_secs, idx, 0)
                    sub_levs = np.delete(sub_levs, idx, 0) if len(sub_levs) > 0 else sub_levs
                    numpy_data = np.delete(numpy_data, idx, 0)

        # calculate the overall statistic
        if agg_method == "Mean statistic":
            stat = np.nanmean(sub_stats)  # calculate stat as mean of sub_values
        elif agg_method == "Median statistic":
            stat = np.nanmedian(sub_stats)  # calculate stat as median of sub_values
        elif agg_method == "Mean statistic weighted by N":
            total = np.nansum(numpy_data[:, total_index])
            stat = np.nansum(sub_stats * (numpy_data[:, total_index] / total)[:, 0])  # calculate stat as weighted average of sub_values
        elif statistic in ['rhist', 'phist', 'relp']:
            stat = np.nansum(sub_stats)  # calculate stat as sum of sub_values
        else:
            numpy_data[:, total_index] = 1  # METcalcpy is weird about how it calculates totals. This gets what we want here.
            if stat_line_type == 'ctc' or 'mode' in stat_line_type:
                stat = stat_switch[statistic](numpy_data, column_headers)  # calculate overall stat
            else:
                stat = stat_switch[statistic](numpy_data, column_headers, True)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    return sub_stats, sub_secs, sub_levs, numpy_data, stat, error


def get_stat(row, statistic, stat_line_type, app_params):
    """function for processing the sub-values from the query and calling a calculate_stat function"""

    has_levels = app_params["hasLevels"]
    agg_method = app_params["aggMethod"]
    outlier_qc_param = "all" if app_params["outliers"] == "all" else int(app_params["outliers"])

    # these are the sub-fields that are returned in the end
    stat = "null"
    sub_levs = []
    sub_secs = []
    sub_values = np.empty(0)
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
                sub_fbar.append(float(sub_datum[0]) if abs(float(sub_datum[0])) != 9999. else np.nan)
                sub_obar.append(float(sub_datum[1]) if abs(float(sub_datum[1])) != 9999. else np.nan)
                sub_ffbar.append(float(sub_datum[2]) if abs(float(sub_datum[2])) != 9999. else np.nan)
                sub_oobar.append(float(sub_datum[3]) if abs(float(sub_datum[3])) != 9999. else np.nan)
                sub_fobar.append(float(sub_datum[4]) if abs(float(sub_datum[4])) != 9999. else np.nan)
                sub_total.append(int(sub_datum[5]) if abs(int(sub_datum[5])) != 9999 else np.nan)
                sub_secs.append(int(sub_datum[6]) if abs(int(sub_datum[6])) != 9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[7])

            # calculate the scalar statistic
            numpy_data = np.column_stack([sub_fbar, sub_obar, sub_ffbar, sub_oobar, sub_fobar, sub_total])
            if "ACC" not in statistic:
                column_headers = np.asarray(['fbar', 'obar', 'ffbar', 'oobar', 'fobar', 'total'])
            else:
                column_headers = np.asarray(['fabar', 'oabar', 'ffabar', 'ooabar', 'foabar', 'total'])

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
                sub_ufbar.append(float(sub_datum[0]) if abs(float(sub_datum[0])) != 9999. else np.nan)
                sub_vfbar.append(float(sub_datum[1]) if abs(float(sub_datum[1])) != 9999. else np.nan)
                sub_uobar.append(float(sub_datum[2]) if abs(float(sub_datum[2])) != 9999. else np.nan)
                sub_vobar.append(float(sub_datum[3]) if abs(float(sub_datum[3])) != 9999. else np.nan)
                sub_uvfobar.append(float(sub_datum[4]) if abs(float(sub_datum[4])) != 9999. else np.nan)
                sub_uvffbar.append(float(sub_datum[5]) if abs(float(sub_datum[5])) != 9999. else np.nan)
                sub_uvoobar.append(float(sub_datum[6]) if abs(float(sub_datum[6])) != 9999. else np.nan)
                if "ACC" not in statistic:
                    sub_f_speed_bar.append(float(sub_datum[7]) if abs(float(sub_datum[7])) != 9999. else np.nan)
                    sub_o_speed_bar.append(float(sub_datum[8]) if abs(float(sub_datum[8])) != 9999. else np.nan)
                    sub_total.append(int(sub_datum[9]) if abs(int(sub_datum[9])) != 9999 else np.nan)
                    sub_secs.append(int(sub_datum[10]) if abs(int(sub_datum[10])) != 9999 else np.nan)
                    if has_levels:
                        sub_levs.append(sub_datum[11])
                else:
                    sub_total.append(int(sub_datum[7]) if abs(int(sub_datum[7])) != 9999 else np.nan)
                    sub_secs.append(int(sub_datum[8]) if abs(int(sub_datum[8])) != 9999 else np.nan)
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
                sub_fy_oy.append(int(sub_datum[0]) if abs(int(sub_datum[0])) != 9999 else np.nan)
                sub_fy_on.append(int(sub_datum[1]) if abs(int(sub_datum[1])) != 9999 else np.nan)
                sub_fn_oy.append(int(sub_datum[2]) if abs(int(sub_datum[2])) != 9999 else np.nan)
                sub_fn_on.append(int(sub_datum[3]) if abs(int(sub_datum[3])) != 9999 else np.nan)
                sub_total.append(int(sub_datum[4]) if abs(int(sub_datum[4])) != 9999 else np.nan)
                sub_secs.append(int(sub_datum[5]) if abs(int(sub_datum[5])) != 9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[6])

            # calculate the ctc statistic
            numpy_data = np.column_stack([sub_fy_oy, sub_fy_on, sub_fn_oy, sub_fn_on, sub_total])
            column_headers = np.asarray(['fy_oy', 'fy_on', 'fn_oy', 'fn_on', 'total'])

        elif stat_line_type == 'nbrcnt':
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to nbrcnt stats
            sub_fss = []
            sub_fbs = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_fss.append(float(sub_datum[0]) if abs(float(sub_datum[0])) != 9999. else np.nan)
                sub_fbs.append(float(sub_datum[1]) if abs(float(sub_datum[1])) != 9999. else np.nan)
                sub_total.append(int(sub_datum[2]) if abs(int(sub_datum[2])) != 9999 else np.nan)
                sub_secs.append(int(sub_datum[3]) if abs(int(sub_datum[3])) != 9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[4])

            # calculate the nbrcnt statistic
            numpy_data = np.column_stack([sub_fss, sub_fbs, sub_total])
            column_headers = np.asarray(['fss', 'fbs', 'total'])

        elif stat_line_type == 'mode_single':
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to single-object mode stats
            sub_obj_id = []
            sub_obj_cat = []
            sub_obj_type = []
            sub_area = []
            sub_total = []
            sub_fcst_flag = []
            sub_simple_flag = []
            sub_matched_flag = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_obj_id.append(sub_datum[0])
                sub_obj_cat.append(sub_datum[1])
                sub_obj_type.append('2d')
                sub_area.append(float(sub_datum[2]) if abs(float(sub_datum[2])) != 9999. else np.nan)
                sub_total.append(int(sub_datum[3]) if abs(int(sub_datum[3])) != 9999 else np.nan)
                sub_fcst_flag.append(int(sub_datum[4]) if abs(int(sub_datum[4])) != 9999 else np.nan)
                sub_simple_flag.append(int(sub_datum[5]) if abs(int(sub_datum[5])) != 9999 else np.nan)
                sub_matched_flag.append(int(sub_datum[6]) if abs(int(sub_datum[6])) != 9999 else np.nan)
                sub_secs.append(int(sub_datum[7]) if abs(int(sub_datum[7])) != 9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[8])

            # calculate the single-object mode statistic
            numpy_data = np.column_stack([sub_obj_id, sub_obj_cat, sub_obj_type, sub_area, sub_total,
                                          sub_fcst_flag, sub_simple_flag, sub_matched_flag])
            column_headers = np.asarray(['object_id', 'object_cat', 'object_type', 'area', 'total',
                                         'fcst_flag', 'simple_flag', 'matched_flag'])

        elif 'mode_pair' in stat_line_type:
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to paired-object mode stats
            sub_mode_header_id = []
            sub_obj_pair_id = []
            sub_obj_f_id = []
            sub_obj_o_id = []
            sub_obj_f_cat = []
            sub_obj_o_cat = []
            sub_obj_type = []
            sub_interest = []
            sub_centroid_dist = []
            sub_f_area = []
            sub_o_area = []
            sub_f_intensity_nn = []
            sub_o_intensity_nn = []
            sub_f_centroid_lat = []
            sub_o_centroid_lat = []
            sub_f_centroid_lon = []
            sub_o_centroid_lon = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                mode_header_id = sub_datum[0]
                obj_pair_id = sub_datum[1]
                obj_f_id = sub_datum[1].split('_')[0]
                obj_o_id = sub_datum[1].split('_')[1]
                if sub_datum[2] == obj_f_id:
                    # make sure the f object IDs match--the mysql join sometimes matches complex and simple objects
                    # when it isn't supposed to, because of the format of the names
                    sub_mode_header_id.append(sub_datum[0])
                    sub_obj_pair_id.append(sub_datum[1])
                    sub_obj_type.append('2d')
                    sub_interest.append(float(sub_datum[4]) if abs(float(sub_datum[4])) != 9999. else np.nan)
                    sub_centroid_dist.append(float(sub_datum[5]) if abs(float(sub_datum[5])) != 9999. else np.nan)
                    sub_total.append(int(sub_datum[10]) if abs(int(sub_datum[10])) != 9999 else np.nan)
                    sub_secs.append(int(sub_datum[10]) if abs(int(sub_datum[10])) != 9999 else np.nan)
                    if has_levels:
                        sub_levs.append(sub_datum[11])
                    sub_obj_f_id.append(sub_datum[2])
                    sub_obj_f_cat.append(sub_datum[3])
                    sub_f_area.append(float(sub_datum[6]) if abs(float(sub_datum[6])) != 9999. else np.nan)
                    sub_f_intensity_nn.append(float(sub_datum[7]) if abs(float(sub_datum[7])) != 9999. else np.nan)
                    sub_f_centroid_lat.append(float(sub_datum[8]) if abs(float(sub_datum[8])) != 9999. else np.nan)
                    sub_f_centroid_lon.append(float(sub_datum[9]) if abs(float(sub_datum[9])) != 9999. else np.nan)
                elif sub_datum[2] == obj_o_id:
                    # make sure the o object IDs match--the mysql join sometimes matches complex and simple objects
                    # when it isn't supposed to, because of the format of the names
                    sub_obj_o_id.append(sub_datum[2])
                    sub_obj_o_cat.append(sub_datum[3])
                    sub_o_area.append(float(sub_datum[6]) if abs(float(sub_datum[6])) != 9999. else np.nan)
                    sub_o_intensity_nn.append(float(sub_datum[7]) if abs(float(sub_datum[7])) != 9999. else np.nan)
                    sub_o_centroid_lat.append(float(sub_datum[8]) if abs(float(sub_datum[8])) != 9999. else np.nan)
                    sub_o_centroid_lon.append(float(sub_datum[9]) if abs(float(sub_datum[9])) != 9999. else np.nan)

            # calculate the single-object mode statistic
            numpy_data = np.column_stack([sub_mode_header_id, sub_obj_pair_id, sub_obj_f_id, sub_obj_o_id,
                                          sub_obj_f_cat, sub_obj_o_cat, sub_obj_type, sub_interest, sub_centroid_dist,
                                          sub_f_area, sub_o_area, sub_f_intensity_nn, sub_o_intensity_nn,
                                          sub_f_centroid_lat, sub_o_centroid_lat, sub_f_centroid_lon,
                                          sub_o_centroid_lon, sub_total])
            column_headers = np.asarray(['mode_header_id', 'object_id', 'object_f_id', 'object_o_id', 'object_f_cat',
                                         'object_o_cat', 'object_type', 'interest', 'centroid_dist', 'f_area', 'o_area',
                                         'f_intensity_nn', 'o_intensity_nn', 'f_centroid_lat', 'o_centroid_lat',
                                         'f_centroid_lon', 'o_centroid_lon', 'total'])

        else:
            sub_data = str(row['sub_data']).split(',')
            # these are the sub-fields specific to precalculated stats
            sub_values = []
            sub_total = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_values.append(float(sub_datum[0]) if abs(float(sub_datum[0])) != 9999. else np.nan)
                sub_total.append(int(sub_datum[1]) if abs(int(sub_datum[1])) != 9999 else np.nan)
                sub_secs.append(int(sub_datum[2]) if abs(int(sub_datum[2])) != 9999 else np.nan)
                if has_levels:
                    sub_levs.append(sub_datum[3])
            numpy_data = np.column_stack([sub_values, sub_total])
            column_headers = np.asarray(['precalc', 'total'])

        sub_values, sub_secs, sub_levs, numpy_data, stat, stat_error = calculate_stat(statistic, stat_line_type, 
                agg_method, outlier_qc_param, numpy_data, column_headers, sub_secs, sub_levs)
        if stat_error != '':
            error = stat_error

    except KeyError as e:
        error = "Error parsing query data. The expected fields don't seem to be present " \
                "in the results cache: " + str(e)
        # if we don't have the data we expect just stop now and return empty data objects
        return np.nan, np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0), error

    # if we do have the data we expect, return the requested statistic
    return stat, sub_levs, sub_secs, sub_values, numpy_data, column_headers, error
