import numpy as np
import metcalcpy.util.sl1l2_statistics as calc_sl1l2


def calculate_acc(fbar, obar, ffbar, oobar, fobar, total):
    """function for calculating anomaly correlation from MET partial sums"""
    error = ""
    try:
        denom = (np.power(total, 2) * ffbar - np.power(total, 2) * np.power(fbar, 2)) \
                * (np.power(total, 2) * oobar - np.power(total, 2) * np.power(obar, 2))
        acc = (np.power(total, 2) * fobar - np.power(total, 2) * fbar * obar) / np.sqrt(denom)
    except TypeError as e:
        error = "Error calculating ACC: " + str(e)
        acc = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating ACC: " + str(e)
        acc = np.empty(len(ffbar))
    return acc, error


def calculate_rmse(numpy_data, column_headers):
    """function for calculating RMSE from MET partial sums"""
    error = ""
    data_length = numpy_data.shape[0]
    rmse = np.empty([data_length])
    try:
        for idx in range(data_length):
            rmse[idx] = calc_sl1l2.calculate_rmse(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating RMSE: " + str(e)
    except ValueError as e:
        error = "Error calculating RMSE: " + str(e)
    return rmse, error


def calculate_bcrmse(fbar, obar, ffbar, oobar, fobar):
    """function for calculating bias-corrected RMSE from MET partial sums"""
    error = ""
    try:
        bcrmse = np.sqrt((ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2)
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        bcrmse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        bcrmse = np.empty(len(ffbar))
    return bcrmse, error


def calculate_mse(ffbar, oobar, fobar):
    """function for calculating MSE from MET partial sums"""
    error = ""
    try:
        mse = ffbar + oobar - 2 * fobar
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        mse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        mse = np.empty(len(ffbar))
    return mse, error


def calculate_bcmse(fbar, obar, ffbar, oobar, fobar):
    """function for calculating bias-corrected MSE from MET partial sums"""
    error = ""
    try:
        bcmse = (ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        bcmse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        bcmse = np.empty(len(ffbar))
    return bcmse, error


def calculate_me(fbar, obar):
    """function for calculating additive bias from MET partial sums"""
    error = ""
    try:
        me = fbar - obar
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        me = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        me = np.empty(len(fbar))
    return me, error


def calculate_fe(fbar, obar):
    """function for calculating fractional error from MET partial sums"""
    error = ""
    try:
        fe = (fbar - obar) / fbar
    except TypeError as e:
        error = "Error calculating fractional error: " + str(e)
        fe = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating fractional error: " + str(e)
        fe = np.empty(len(fbar))
    return fe, error


def calculate_mbias(fbar, obar):
    """function for calculating multiplicative bias from MET partial sums"""
    error = ""
    try:
        mbias = fbar / obar
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        mbias = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        mbias = np.empty(len(fbar))
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


def calculate_f_stdev(fbar, ffbar, total):
    """function for calculating forecast stdev from MET partial sums"""
    error = ""
    try:
        fstdev = np.sqrt(((ffbar * total) - (fbar * total) * (fbar * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        fstdev = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        fstdev = np.empty(len(fbar))
    return fstdev, error


def calculate_o_stdev(obar, oobar, total):
    """function for calculating observed stdev from MET partial sums"""
    error = ""
    try:
        ostdev = np.sqrt(((oobar * total) - (obar * total) * (obar * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        ostdev = np.empty(len(obar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        ostdev = np.empty(len(obar))
    return ostdev, error


def calculate_e_stdev(fbar, obar, ffbar, oobar, fobar, total):
    """function for calculating error stdev from MET partial sums"""
    error = ""
    try:
        estdev = np.sqrt((((ffbar + oobar - 2 * fobar) * total) - ((fbar - obar) * total) *
                          ((fbar - obar) * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        estdev = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        estdev = np.empty(len(fbar))
    return estdev, error


def calculate_pcc(fbar, obar, ffbar, oobar, fobar, total):
    """function for calculating pearson correlation from MET partial sums"""
    error = ""
    try:
        pcc = (total ** 2 * fobar - total ** 2 * fbar * obar) / np.sqrt(
            (total ** 2 * ffbar - total ** 2 * fbar ** 2) * (total ** 2 * oobar - total ** 2 * obar ** 2))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        pcc = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        pcc = np.empty(len(fbar))
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
        sub_stats, error = stat_switch[statistic](numpy_data, column_headers)  # call stat function
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
