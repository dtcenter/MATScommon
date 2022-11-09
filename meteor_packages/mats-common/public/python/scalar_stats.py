import numpy as np
import metcalcpy.util.sl1l2_statistics as calc_sl1l2
import metcalcpy.util.sal1l2_statistics as calc_sal1l2


def calculate_acc(numpy_data, column_headers, data_length):
    """function for calculating anomaly correlation from MET partial sums"""
    error = ""
    acc = np.empty([data_length])
    try:
        for idx in range(data_length):
            acc[idx] = calc_sal1l2.calculate_anom_corr(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating ACC: " + str(e)
    except ValueError as e:
        error = "Error calculating ACC: " + str(e)
    return acc, error


def calculate_rmse(numpy_data, column_headers, data_length):
    """function for calculating RMSE from MET partial sums"""
    error = ""
    rmse = np.empty([data_length])
    try:
        for idx in range(data_length):
            rmse[idx] = calc_sl1l2.calculate_rmse(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating RMSE: " + str(e)
    except ValueError as e:
        error = "Error calculating RMSE: " + str(e)
    return rmse, error


def calculate_bcrmse(numpy_data, column_headers, data_length):
    """function for calculating bias-corrected RMSE from MET partial sums"""
    error = ""
    bcrmse = np.empty([data_length])
    try:
        for idx in range(data_length):
            bcrmse[idx] = calc_sl1l2.calculate_bcrmse(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating bias-corrected RMSE: " + str(e)
    except ValueError as e:
        error = "Error calculating bias-corrected RMSE: " + str(e)
    return bcrmse, error


def calculate_mse(numpy_data, column_headers, data_length):
    """function for calculating MSE from MET partial sums"""
    error = ""
    mse = np.empty([data_length])
    try:
        for idx in range(data_length):
            mse[idx] = calc_sl1l2.calculate_mse(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating MSE: " + str(e)
    except ValueError as e:
        error = "Error calculating MSE: " + str(e)
    return mse, error


def calculate_bcmse(numpy_data, column_headers, data_length):
    """function for calculating bias-corrected MSE from MET partial sums"""
    error = ""
    bcmse = np.empty([data_length])
    try:
        for idx in range(data_length):
            bcmse[idx] = calc_sl1l2.calculate_bcmse(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating bias-corrected MSE: " + str(e)
    except ValueError as e:
        error = "Error calculating bias-corrected MSE: " + str(e)
    return bcmse, error


def calculate_me(numpy_data, column_headers, data_length):
    """function for calculating additive bias from MET partial sums"""
    error = ""
    me = np.empty([data_length])
    try:
        for idx in range(data_length):
            me[idx] = calc_sl1l2.calculate_me(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
    return me, error


def calculate_fe(numpy_data, column_headers, data_length):
    """function for calculating fractional error from MET partial sums"""
    error = ""
    fe = np.empty([data_length])
    try:
        for idx in range(data_length):
            fe[idx] = calc_sl1l2.calculate_fe(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating fractional error: " + str(e)
    except ValueError as e:
        error = "Error calculating fractional error: " + str(e)
    return fe, error


def calculate_mbias(numpy_data, column_headers, data_length):
    """function for calculating multiplicative bias from MET partial sums"""
    error = ""
    mbias = np.empty([data_length])
    try:
        for idx in range(data_length):
            mbias[idx] = calc_sl1l2.calculate_mbias(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating multiplicative bias: " + str(e)
    except ValueError as e:
        error = "Error calculating multiplicative bias: " + str(e)
    return mbias, error


def calculate_n(total):
    """function for calculating N from MET partial sums"""
    return total, ""


def calculate_f_mean(fbar):
    """function for calculating forecast mean from MET partial sums"""
    return fbar, ""


def calculate_o_mean(obar):
    """function for calculating observed mean from MET partial sums"""
    return obar, ""


def calculate_f_stdev(numpy_data, column_headers, data_length):
    """function for calculating forecast stdev from MET partial sums"""
    error = ""
    fstdev = np.empty([data_length])
    try:
        for idx in range(data_length):
            fstdev[idx] = calc_sl1l2.calculate_fstdev(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating forecast stdev: " + str(e)
    except ValueError as e:
        error = "Error calculating forecast stdev: " + str(e)
    return fstdev, error


def calculate_o_stdev(numpy_data, column_headers, data_length):
    """function for calculating observed stdev from MET partial sums"""
    error = ""
    ostdev = np.empty([data_length])
    try:
        for idx in range(data_length):
            ostdev[idx] = calc_sl1l2.calculate_ostdev(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating observed stdev: " + str(e)
    except ValueError as e:
        error = "Error calculating observed stdev: " + str(e)
    return ostdev, error


def calculate_e_stdev(numpy_data, column_headers, data_length):
    """function for calculating error stdev from MET partial sums"""
    error = ""
    estdev = np.empty([data_length])
    try:
        for idx in range(data_length):
            estdev[idx] = calc_sl1l2.calculate_estdev(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating error stdev: " + str(e)
    except ValueError as e:
        error = "Error calculating error stdev: " + str(e)
    return estdev, error


def calculate_pcc(numpy_data, column_headers, data_length):
    """function for calculating pearson correlation from MET partial sums"""
    error = ""
    pcc = np.empty([data_length])
    try:
        for idx in range(data_length):
            pcc[idx] = calc_sl1l2.calculate_pr_corr(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating pcc: " + str(e)
    except ValueError as e:
        error = "Error calculating pcc: " + str(e)
    return pcc, error


def calculate_scalar_stat(statistic, numpy_data, column_headers):
    """function for determining and calling the appropriate scalar statistical calculation function"""
    stat_switch = {  # dispatcher of statistical calculation functions
        'ACC': calculate_acc,
        'RMSE': calculate_rmse,
        'Bias-corrected RMSE': calculate_bcrmse,
        'MSE': calculate_mse,
        'Bias-corrected MSE': calculate_bcmse,
        'ME (Additive bias)': calculate_me,
        'Fractional Error': calculate_fe,
        'Multiplicative bias': calculate_mbias,
        'N': calculate_n,
        'Forecast mean': calculate_f_mean,
        'Observed mean': calculate_o_mean,
        'Forecast stdev': calculate_f_stdev,
        'Observed stdev': calculate_o_stdev,
        'Error stdev': calculate_e_stdev,
        'Pearson correlation': calculate_pcc
    }
    try:
        data_length = numpy_data.shape[0]
        sub_stats, error = stat_switch[statistic](numpy_data, column_headers, data_length)  # call stat function
        stat = np.nanmean(sub_stats)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    return sub_stats, stat, error
