import numpy as np


def get_ens_bin_stat(oy_all, on_all, total_times, total_values, observed_total, forecast_total, sub_oy, sub_on, sub_total, sub_secs):
    """function for processing the sub-values from the query and getting the per bin ensemble statistics"""
    oy = np.nansum(np.array(sub_oy))
    on = np.nansum(np.array(sub_on))
    numpy_secs = np.array(sub_secs)
    number_times = len(np.unique(numpy_secs[~np.isnan(numpy_secs)]))
    number_values = np.nansum(np.array(sub_total))

    # we must add up all of the observed and not-observed values for each probability bin
    observed_total = observed_total + oy
    forecast_total = forecast_total + oy + on

    oy_all.append(oy)
    on_all.append(on)
    total_times.append(number_times)
    total_values.append(number_values)

    return observed_total,forecast_total


def get_ens_stat(plot_type, forecast_total, observed_total, on_all, oy_all, threshold_all, total_times,
                 total_values):
    """function for processing the sub-values from the query and getting the overall ensemble statistics"""
    # initialize return variables
    hit_rate = []
    pody = []
    far = []
    sample_climo = 0
    auc = 0
    x_var = 'threshold_all'  # variable that appears pn a plot's x-axis -- change with plot type
    y_var = 'hit_rate'  # variable that appears pn a plot's y-axis -- change with plot type

    if plot_type == 'Reliability':
        # determine the hit rate for each probability bin
        for i in range(0, len(threshold_all)):
            try:
                hr = float(oy_all[i]) / (float(oy_all[i]) + float(on_all[i]))
            except ZeroDivisionError:
                hr = None
            hit_rate.append(hr)
        # calculate the sample climatology
        sample_climo = float(observed_total) / float(forecast_total)
        x_var = 'threshold_all'
        y_var = 'hit_rate'

    elif plot_type == 'ROC' or plot_type == "PerformanceDiagram":
        # determine the probability of detection (hit rate) and probability of false detection (false alarm ratio) for each probability bin
        for i in range(len(threshold_all)):
            hit = 0
            miss = 0
            fa = 0
            cn = 0
            for index, value in enumerate(oy_all):
                if index > i:
                    hit += value
                if index <= i:
                    miss += value
            for index, value in enumerate(on_all):
                if index > i:
                    fa += value
                if index <= i:
                    cn += value

            # POD
            try:
                hr = hit / (hit + miss)
            except ZeroDivisionError:
                hr = None
            pody.append(hr)

            if plot_type == 'ROC':
                # POFD
                try:
                    pofd = fa / (fa + cn)
                except ZeroDivisionError:
                    pofd = None
                far.append(pofd)
            else:
                # 1- FAR for success ratio
                try:
                    far1 = 1 - (fa / (fa + hit))
                except ZeroDivisionError:
                    far1 = None
                far.append(far1)

        # Reverse all of the lists (easier to graph)
        pody = pody[::-1]
        far = far[::-1]
        threshold_all = threshold_all[::-1]
        oy_all = oy_all[::-1]
        on_all = on_all[::-1]
        total_values = total_values[::-1]
        total_times = total_times[::-1]

        if plot_type == 'ROC':
            # Add one final point to allow for the AUC score to be calculated
            pody.append(1)
            far.append(1)
            threshold_all.append(-999)
            oy_all.append(-999)
            on_all.append(-999)
            total_values.append(-999)
            total_times.append(-999)

            # Calculate AUC
            auc_sum = 0
            for i in range(1, len(threshold_all)):
                auc_sum = ((pody[i] + pody[i - 1]) * (far[i] - far[i - 1])) + auc_sum
            auc = auc_sum / 2
        x_var = 'far'
        y_var = 'pody'

    return {
        "hit_rate": hit_rate,
        "sample_climo": sample_climo,
        "auc": auc,
        "far": far,
        "pody": pody,
        "on_all": on_all,
        "oy_all": oy_all,
        "threshold_all": threshold_all,
        "total_times": total_times,
        "total_values": total_values,
        "x_var": x_var,
        "y_var": y_var
    }

