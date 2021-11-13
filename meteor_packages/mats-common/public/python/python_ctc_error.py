import getopt
import sys
import numpy as np
import random
import json


# class that
class CTCErrorUtil:
    error = ""          # one of the two fields to return at the end -- records any error message
    error_length = 0     # one of the two fields to return at the end -- the length of the error bars
    output_JSON = {}    # JSON structure to pass the two output fields back to the MATS JS

    # function for constructing and jsonifying a dictionary of the output variables
    def construct_output_json(self):
        self.output_JSON = {
            "error_length": self.error_length,
            "error": self.error
        }
        self.output_JSON = json.dumps(self.output_JSON)

    # function to check if a certain value is a float or int
    def is_number(self, s):
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

    # function for calculating true skill score
    def calculate_tss(self, hit, fa, miss, cn):
        try:
            tss = ((hit * cn - fa * miss) / ((hit + miss) * (fa + cn))) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            tss = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            tss = np.NaN
        return tss

    # function for calculating probability of positive detection
    def calculate_pody(self, hit, miss):
        try:
            pody = hit / (hit + miss) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            pody = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            pody = np.NaN
        return pody

    # function for calculating probability of negative detection
    def calculate_podn(self, fa, cn):
        try:
            podn = cn / (cn + fa) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            podn = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            podn = np.NaN
        return podn

    # function for calculating false alarm ratio
    def calculate_far(self, hit, fa):
        try:
            far = fa / (fa + hit) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            far = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            far = np.NaN
        return far

    # function for calculating multiplicative bias
    def calculate_bias(self, hit, fa, miss):
        try:
            bias = (hit + fa) / (hit + miss)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            bias = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            bias = np.NaN
        return bias

    # function for calculating critical skill index
    def calculate_csi(self, hit, fa, miss):
        try:
            csi = hit / (hit + miss + fa) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            csi = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            csi = np.NaN
        return csi

    # function for calculating Heidke skill score
    def calculate_hss(self, hit, fa, miss, cn):
        try:
            hss = 2 * (cn * hit - miss * fa) / ((cn + fa) * (fa + hit) + (cn + miss) * (miss + hit)) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            hss = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            hss = np.NaN
        return hss

    # function for calculating equitable threat score
    def calculate_ets(self, hit, fa, miss, cn):
        try:
            ets = (hit - ((hit + fa) * (hit + miss) / (hit + fa + miss + cn))) / ((hit + fa + miss) - ((hit + fa) * (hit + miss) / (hit + fa + miss + cn))) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ets = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ets = np.NaN
        return ets

    # function for calculating number below threshold
    def calculate_nlow(self, hit, miss):
        try:
            nlow = hit + miss
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            nlow = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            nlow = np.NaN
        return nlow

    # function for calculating number above threshold
    def calculate_nhigh(self, fa, cn):
        try:
            nhigh = cn + fa
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            nhigh = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            nhigh = np.NaN
        return nhigh

    # function for calculating total number
    def calculate_ntot(self, hit, fa, miss, cn):
        try:
            ntot = hit + fa + miss + cn
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ntot = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ntot = np.NaN
        return ntot

    # function for calculating ratio of nlow to ntot
    def calculate_ratlow(self, hit, fa, miss, cn):
        try:
            ratlow = self.calculate_nlow(hit, miss) / self.calculate_ntot(hit, fa, miss, cn)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ratlow = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ratlow = np.NaN
        return ratlow

    # function for calculating ratio of nhigh to ntot
    def calculate_rathigh(self, hit, fa, miss, cn):
        try:
            rathigh = self.calculate_nhigh(fa, cn) / self.calculate_ntot(hit, fa, miss, cn)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            rathigh = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            rathigh = np.NaN
        return rathigh

    # function for determining and calling the appropriate contigency table count statistical calculation function
    def calculate_ctc_stat(self, statistic, hit, fa, miss, cn):
        stat_switch = {  # dispatcher of statistical calculation functions
            'TSS (True Skill Score)': self.calculate_tss,
            'PODy (POD of value < threshold)': self.calculate_pody,
            'PODy (POD of value > threshold)': self.calculate_pody,
            'PODn (POD of value > threshold)': self.calculate_podn,
            'PODn (POD of value < threshold)': self.calculate_podn,
            'FAR (False Alarm Ratio)': self.calculate_far,
            'Bias (forecast/actual)': self.calculate_bias,
            'CSI (Critical Success Index)': self.calculate_csi,
            'HSS (Heidke Skill Score)': self.calculate_hss,
            'ETS (Equitable Threat Score)': self.calculate_ets,
            'Nlow (obs < threshold, avg per hr)': self.calculate_nlow,
            'Nlow (obs < threshold, avg per 15 min)': self.calculate_nlow,
            'Nlow (obs < threshold, avg per hr in predefined regions)': self.calculate_nlow,
            'Nlow (obs < threshold, avg per 15 min in predefined regions)': self.calculate_nlow,
            'Nhigh (obs > threshold, avg per hr)': self.calculate_nhigh,
            'Nhigh (obs > threshold, avg per 15 min)': self.calculate_nhigh,
            'Nhigh (obs > threshold, avg per hr in predefined regions)': self.calculate_nhigh,
            'Nhigh (obs > threshold, avg per 15 min in predefined regions)': self.calculate_nhigh,
            'Ntot (total obs, avg per hr)': self.calculate_ntot,
            'Ntot (total obs, avg per 15 min)': self.calculate_ntot,
            'Ntot (total obs, avg per hr in predefined regions)': self.calculate_ntot,
            'Ntot (total obs, avg per 15 min in predefined regions)': self.calculate_ntot,
            'Ratio (Nlow / Ntot)': self.calculate_ratlow,
            'Ratio (Nhigh / Ntot)': self.calculate_rathigh,
            'N per graph point': self.calculate_ntot,
            'All observed yes': self.calculate_nlow,
            'All observed no': self.calculate_nhigh
        }
        args_switch = {  # dispatcher of arguments for statistical calculation functions
            'TSS (True Skill Score)': (hit, fa, miss, cn),
            'PODy (POD of value < threshold)': (hit, miss),
            'PODy (POD of value > threshold)': (hit, miss),
            'PODn (POD of value > threshold)': (fa, cn),
            'PODn (POD of value < threshold)': (fa, cn),
            'FAR (False Alarm Ratio)': (hit, fa),
            'Bias (forecast/actual)': (hit, fa, miss),
            'CSI (Critical Success Index)': (hit, fa, miss),
            'HSS (Heidke Skill Score)': (hit, fa, miss, cn),
            'ETS (Equitable Threat Score)': (hit, fa, miss, cn),
            'Nlow (obs < threshold, avg per hr)': (hit, miss),
            'Nlow (obs < threshold, avg per 15 min)': (hit, miss),
            'Nlow (obs < threshold, avg per hr in predefined regions)': (hit, miss),
            'Nlow (obs < threshold, avg per 15 min in predefined regions)': (hit, miss),
            'Nhigh (obs > threshold, avg per hr)': (fa, cn),
            'Nhigh (obs > threshold, avg per 15 min)': (fa, cn),
            'Nhigh (obs > threshold, avg per hr in predefined regions)': (fa, cn),
            'Nhigh (obs > threshold, avg per 15 min in predefined regions)': (fa, cn),
            'Ntot (total obs, avg per hr)': (hit, fa, miss, cn),
            'Ntot (total obs, avg per 15 min)': (hit, fa, miss, cn),
            'Ntot (total obs, avg per hr in predefined regions)': (hit, fa, miss, cn),
            'Ntot (total obs, avg per 15 min in predefined regions)': (hit, fa, miss, cn),
            'Ratio (Nlow / Ntot)': (hit, fa, miss, cn),
            'Ratio (Nhigh / Ntot)': (hit, fa, miss, cn),
            'N per graph point': (hit, fa, miss, cn),
            'All observed yes': (hit, miss),
            'All observed no': (fa, cn)
        }
        try:
            stat_args = args_switch[statistic]  # get args
            stat = stat_switch[statistic](*stat_args)  # call stat function
        except KeyError as e:
            self.error = "Error choosing statistic: " + str(e)
            stat = 'null'
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            stat = 'null'
        return stat

    def test_null_hypothesis(self, statistic, minuend_data, subtrahend_data):
        max_tries = 1000
        max_length = len(minuend_data["hit"]) if len(minuend_data["hit"]) > len(subtrahend_data["hit"]) else len(subtrahend_data["hit"])
        all_data = [minuend_data, subtrahend_data]
        all_diffs = []

        for j in range(0, max_tries):
            perm_m_hit = []
            perm_m_fa = []
            perm_m_miss = []
            perm_m_cn = []
            perm_s_hit = []
            perm_s_fa = []
            perm_s_miss = []
            perm_s_cn = []
            for i in range(max_length):
                rand_idx = 0 if random.random() < 0.5 else 1
                other_idx = 0 if rand_idx == 1 else 1
                if len(all_data[rand_idx]["hit"]) > i and str(all_data[rand_idx]["hit"][i]) is not "null":
                    perm_m_hit.append(all_data[rand_idx]["hit"][i])
                    perm_m_fa.append(all_data[rand_idx]["fa"][i])
                    perm_m_miss.append(all_data[rand_idx]["miss"][i])
                    perm_m_cn.append(all_data[rand_idx]["cn"][i])
                else:
                    perm_m_hit.append(0)
                    perm_m_fa.append(0)
                    perm_m_miss.append(0)
                    perm_m_cn.append(0)
                if len(all_data[other_idx]["hit"]) > i and str(all_data[other_idx]["hit"][i]) is not "null":
                    perm_s_hit.append(all_data[other_idx]["hit"][i])
                    perm_s_fa.append(all_data[other_idx]["fa"][i])
                    perm_s_miss.append(all_data[other_idx]["miss"][i])
                    perm_s_cn.append(all_data[other_idx]["cn"][i])
                else:
                    perm_s_hit.append(0)
                    perm_s_fa.append(0)
                    perm_s_miss.append(0)
                    perm_s_cn.append(0)

            perm_m_stat = self.calculate_ctc_stat(statistic, sum(perm_m_hit), sum(perm_m_fa), sum(perm_m_miss), sum(perm_m_cn))
            perm_s_stat = self.calculate_ctc_stat(statistic, sum(perm_s_hit), sum(perm_s_fa), sum(perm_s_miss), sum(perm_s_cn))
            perm_diff = perm_m_stat - perm_s_stat
            all_diffs.append(perm_diff)

        all_diffs.sort()
        i_min = int(max_tries * 0.025)
        i_max = int(max_tries * 0.975)
        bot_95 = all_diffs[i_min]
        top_95 = all_diffs[i_max]
        return (top_95-bot_95)/(1.96*2)

    # makes sure all expected options were indeed passed in
    def validate_options(self, options):
        assert True, options.statistic is not None and options.minuend_data is not None and options.subtrahend_data is not None

    # process 'c' style options - using getopt - usage describes options
    def get_options(self, args):
        usage = ["(S)tatistic=", "(m)inuend_data", "(s)ubtrahend_data"]
        statistic = None
        minuend_data = None
        subtrahend_data = None

        try:
            opts, args = getopt.getopt(args[1:], "S:m:s:", usage)
        except getopt.GetoptError as err:
            # print help information and exit:
            print(str(err))  # will print something like "option -a not recognized"
            print(usage)  # print usage from last param to getopt
            sys.exit(2)
        for o, a in opts:
            if o == "-?":
                print(usage)
                sys.exit(2)
            if o == "-S":
                statistic = a
            elif o == "-m":
                minuend_data = json.loads(a)
            elif o == "-s":
                subtrahend_data = json.loads(a)
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, statistic is not None and minuend_data is not None and subtrahend_data is not None
        options = {
            "statistic": statistic,
            "minuend_data": minuend_data,
            "subtrahend_data": subtrahend_data
        }
        return options

    def calc_error_stats(self, options):
        self.validate_options(options)
        self.error_length = self.test_null_hypothesis(options["statistic"], options["minuend_data"], options["subtrahend_data"])


if __name__ == '__main__':
    ctc_util = CTCErrorUtil()
    options = ctc_util.get_options(sys.argv)
    ctc_util.calc_error_stats(options)
    ctc_util.construct_output_json()
    print(ctc_util.output_JSON)
