import numpy as np
import metcalcpy.util.sl1l2_statistics as calc_sl1l2
import metcalcpy.util.sal1l2_statistics as calc_sal1l2


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
