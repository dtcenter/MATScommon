import numpy as np

error = ""


# function for calculating anomaly correlation from MET partial sums
def calculate_acc(fbar, obar, ffbar, oobar, fobar, total):
    global error
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
    return acc


# function for calculating RMSE from MET partial sums
def calculate_rmse(ffbar, oobar, fobar):
    global error
    try:
        rmse = np.sqrt(ffbar + oobar - 2 * fobar)
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        rmse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        rmse = np.empty(len(ffbar))
    return rmse


# function for calculating bias-corrected RMSE from MET partial sums
def calculate_bcrmse(fbar, obar, ffbar, oobar, fobar):
    global error
    try:
        bcrmse = np.sqrt((ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2)
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        bcrmse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        bcrmse = np.empty(len(ffbar))
    return bcrmse


# function for calculating MSE from MET partial sums
def calculate_mse(ffbar, oobar, fobar):
    global error
    try:
        mse = ffbar + oobar - 2 * fobar
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        mse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        mse = np.empty(len(ffbar))
    return mse


# function for calculating bias-corrected MSE from MET partial sums
def calculate_bcmse(fbar, obar, ffbar, oobar, fobar):
    global error
    try:
        bcmse = (ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2
    except TypeError as e:
        error = "Error calculating RMS: " + str(e)
        bcmse = np.empty(len(ffbar))
    except ValueError as e:
        error = "Error calculating RMS: " + str(e)
        bcmse = np.empty(len(ffbar))
    return bcmse


# function for calculating additive bias from MET partial sums
def calculate_me(fbar, obar):
    global error
    try:
        me = fbar - obar
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        me = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        me = np.empty(len(fbar))
    return me


# function for calculating fractional error from MET partial sums
def calculate_fe(fbar, obar):
    global error
    try:
        fe = (fbar - obar) / fbar
    except TypeError as e:
        error = "Error calculating fractional error: " + str(e)
        fe = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating fractional error: " + str(e)
        fe = np.empty(len(fbar))
    return fe


# function for calculating multiplicative bias from MET partial sums
def calculate_mbias(fbar, obar):
    global error
    try:
        mbias = fbar / obar
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        mbias = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        mbias = np.empty(len(fbar))
    return mbias


# function for calculating N from MET partial sums
def calculate_n(total):
    return total


# function for calculating forecast mean from MET partial sums
def calculate_f_mean(fbar):
    return fbar


# function for calculating observed mean from MET partial sums
def calculate_o_mean(obar):
    return obar


# function for calculating forecast stdev from MET partial sums
def calculate_f_stdev(fbar, ffbar, total):
    global error
    try:
        fstdev = np.sqrt(((ffbar * total) - (fbar * total) * (fbar * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        fstdev = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        fstdev = np.empty(len(fbar))
    return fstdev


# function for calculating observed stdev from MET partial sums
def calculate_o_stdev(obar, oobar, total):
    global error
    try:
        ostdev = np.sqrt(((oobar * total) - (obar * total) * (obar * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        ostdev = np.empty(len(obar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        ostdev = np.empty(len(obar))
    return ostdev


# function for calculating error stdev from MET partial sums
def calculate_e_stdev(fbar, obar, ffbar, oobar, fobar, total):
    global error
    try:
        estdev = np.sqrt((((ffbar + oobar - 2 * fobar) * total) - ((fbar - obar) * total) *
                          ((fbar - obar) * total) / total) / (total - 1))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        estdev = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        estdev = np.empty(len(fbar))
    return estdev


# function for calculating pearson correlation from MET partial sums
def calculate_pcc(fbar, obar, ffbar, oobar, fobar, total):
    global error
    try:
        pcc = (total ** 2 * fobar - total ** 2 * fbar * obar) / np.sqrt(
            (total ** 2 * ffbar - total ** 2 * fbar ** 2) * (total ** 2 * oobar - total ** 2 * obar ** 2))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        pcc = np.empty(len(fbar))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        pcc = np.empty(len(fbar))
    return pcc


# function for determining and calling the appropriate scalar statistical calculation function
def calculate_scalar_stat(statistic, fbar, obar, ffbar, oobar, fobar, total):
    global error
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
    args_switch = {  # dispatcher of arguments for statistical calculation functions
        'ACC': (fbar, obar, ffbar, oobar, fobar, total),
        'RMSE': (ffbar, oobar, fobar),
        'Bias-corrected RMSE': (fbar, obar, ffbar, oobar, fobar),
        'MSE': (ffbar, oobar, fobar),
        'Bias-corrected MSE': (fbar, obar, ffbar, oobar, fobar),
        'ME (Additive bias)': (fbar, obar),
        'Fractional Error': (fbar, obar),
        'Multiplicative bias': (fbar, obar),
        'N': (total,),
        'Forecast mean': (fbar,),
        'Observed mean': (obar,),
        'Forecast stdev': (fbar, ffbar, total),
        'Observed stdev': (obar, oobar, total),
        'Error stdev': (fbar, obar, ffbar, oobar, fobar, total),
        'Pearson correlation': (fbar, obar, ffbar, oobar, fobar, total)
    }
    try:
        stat_args = args_switch[statistic]  # get args
        sub_stats = stat_switch[statistic](*stat_args)  # call stat function
        stat = np.nanmean(sub_stats)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.empty(len(fbar))
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.empty(len(fbar))
        stat = 'null'
    return sub_stats, stat, error
