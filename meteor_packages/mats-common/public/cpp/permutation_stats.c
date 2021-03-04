#include <ctype.h>
#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "permutations.h"

#define MAX_TRYS 1000
#define MAX_PAIRS 1000000
#define BAD_VAL 2e30
#define BAD_SHORT 32767.0

/* not used at the moment, because this didn't catch an appreciable number of
 * problem events */
int clean_data(char *stat_type, CTPair *ctp[], int n_ctp, int pairs,
               float sd_limit) {
  /* returns number of ctpairs for which the difference in the number of total
     events is within sd_limit*sd of the mean difference in number of total
     events */
  int i, i_max, j, j_limit, n_oor, good_ctp, n0, n1, n_diff;
  double sum, sum2, mean, sd;
  int compareValidTimes(const void *pp1, const void *pp2);
  void printCTP(CTPair * ctp);

  n_oor = 0; /* counts number of out of range ctpairs */
  good_ctp = n_ctp;

  if (n_ctp == 1 || pairs == 0) {
    return (good_ctp);
  }

  sum = 0;
  sum2 - 0;

  /* only get here if we have pairs */
  for (i = 0; i < n_ctp; i++) {
    n0 = ctp[i]->ct[0]->hits + ctp[i]->ct[0]->misss + ctp[i]->ct[0]->fas +
         ctp[i]->ct[0]->crs;
    n1 = ctp[i]->ct[1]->hits + ctp[i]->ct[1]->misss + ctp[i]->ct[1]->fas +
         ctp[i]->ct[1]->crs;
    n_diff = n0 - n1;
    sum += n_diff;
    sum2 += n_diff * n_diff;
  }

  mean = sum / n_ctp;
  sd = sqrt(sum2 / n_ctp - mean * mean);
  printf(";mean N diff of %d CTs: %.3f, sd %.3f\n", n_ctp, mean, sd);

  /* now eliminate all the CTPairs where N_diff exceeds the cutoff */
  for (i = 0; i < n_ctp; i++) {
    n0 = ctp[i]->ct[0]->hits + ctp[i]->ct[0]->misss + ctp[i]->ct[0]->fas +
         ctp[i]->ct[0]->crs;
    n1 = ctp[i]->ct[1]->hits + ctp[i]->ct[1]->misss + ctp[i]->ct[1]->fas +
         ctp[i]->ct[1]->crs;
    n_diff = n0 - n1;

    if (abs(n_diff - mean) > sd_limit * sd) {
      /* flag this CTPair for elimination */
      printf(";bad ctp: ");
      printCTP(ctp[i]);
      n_oor++;
      ctp[i]->valid_time = -1;
    }
  }
  printf(";%d of %d CT pairs out of num of events difference range\n", n_oor,
         n_ctp);

  if (n_oor > 0) {
    /* put all the negative valid times at the end */
    qsort(ctp, n_ctp, sizeof(CTPair *), compareValidTimes);
    good_ctp = n_ctp - n_oor;
  }

  return (good_ctp);
}

/* clean_data1 cleans hourly outliers for the desired stat (CSI, Bias, etc.).
   This may not be a very good test for stats that bounce around a lot on an
   hourly basis. If you want to use this in the future, rename this as
   'clean_data', and rename the other (newer) clean_data as something else. */
int clean_data1(char *stat_type, CTPair *ctp[], int n_ctp, int pairs,
                float sd_limit) {
  /* returns number of ctpairs with that are "clean" (in terms of being within
   * sd_limit*std from the mean) */
  Stat *this_s;
  int i, i_max, j, j_limit, n_oor, good_ctp;
  int n_non_bad[2]; /* counts number of non BAD (i.e., non-nans) ctpairs */
  Stat *newStat();
  double val;
  double sum[2], sum2[2], mean[2], sd[2];
  Stat *s[n_ctp];
  Stat *gen_stat(CTPair * ctp, char *stat_type, int pairs);
  int compareValidTimes(const void *pp1, const void *pp2);

  n_oor = 0; /* counts number of out of range ctpairs */
  good_ctp = n_ctp;

  if (n_ctp == 1) {
    return (good_ctp);
  }

  j_limit = 2;
  if (pairs == 0) {
    j_limit = 1;
  }
  for (j = 0; j < j_limit; j++) {
    sum[j] = 0;
    sum2[j] = 0;
    n_non_bad[j] = 0;
  }

  for (i = 0; i < n_ctp; i++) {
    this_s = gen_stat(ctp[i], stat_type, pairs);
    s[i] = this_s;
    for (j = 0; j < j_limit; j++) {
      if (this_s->val[j] < BAD_VAL / 2.0) {
        sum[j] += this_s->val[j];
        sum2[j] += this_s->val[j] * this_s->val[j];
        n_non_bad[j]++;
      }
    }
  }
  /* first time through to get mean and sd for each stat */
  for (j = 0; j < j_limit; j++) {
    mean[j] = sum[j] / n_non_bad[j];
    sd[j] = sqrt(sum2[j] / n_non_bad[j] - mean[j] * mean[j]);
    printf(";%d mean of %d non-NAN stats: %.3f, sd %.3f\n", j, n_non_bad[j],
           mean[j], sd[j]);
  }
  /* then find times that exceed the sd cutoff */
  for (i = 0; i < n_ctp; i++) {
    for (j = 0; j < j_limit; j++) {
      if (s[i]->val[j] < BAD_VAL / 2.0) {
        if (fabs(s[i]->val[j] - mean[j]) > sd_limit * sd[j]) {
          /*printf("found bad stat at i=%d, %.3f, %d %d %d %d\n",
            i,s[i]->val[j],ctp[i]->ct[0]->hits,
            ctp[i]->ct[0]->misss,ctp[i]->ct[0]->fas,ctp[i]->ct[0]->crs);*/
          n_oor++;
          /* eliminate this CTPair */
          ctp[i]->valid_time = -1;
        }
      }
    }
  }
  printf(";n_pairs: %d, n out of range: %d (non-NAN stats: %d, %d)\n", n_ctp,
         n_oor, n_non_bad[0], n_non_bad[1]);
  if (n_oor > 0) {
    /* put all the negative valid times at the end */
    qsort(ctp, n_ctp, sizeof(CTPair *), compareValidTimes);
    good_ctp = n_ctp - n_oor;
    /*for(i=0;i<n_ctp;i++) {
      printf("%d: %d %d %d %d %d\n",i,
             ctp[i]->valid_time,ctp[i]->ct[0]->hits,
             ctp[i]->ct[0]->misss,ctp[i]->ct[0]->fas,ctp[i]->ct[0]->crs);
             }*/
  }
  return (good_ctp);
}

void get_stat1(char *stat_type, int avtime, CTPair *ctp[], int n_ctp,
               int min_valid_time, int max_valid_time, int pairs,
               float sd_limit) {
  static Stat *stat[MAX_TRYS];
  Stat *true_stat;
  CTPair *octp;
  CTPair *gen_overall_ctp(CTPair * *ctp, int n_ctp, int rand, int pairs);
  Stat *gen_stat(CTPair * ctp, char *stat_type, int pairs);
  int compareDiffs(const void *, const void *);
  int clean_data(char *stat_type, CTPair **ctp, int n_ctp, int pairs,
                 float sd_limit);
  int i;
  int i_min, i_max;
  double bot_95, top_95;
  int good_ctp = n_ctp;

  /* turn this off for now. I haven't found a good way to ensure clean data.
     More tries to come. */
  if (0 && sd_limit > 0.01) { /* the '0' turns this off */
    /* a standard deviation limit was input (via env variable SD_LIMIT) */
    good_ctp = clean_data(stat_type, ctp, n_ctp, pairs, sd_limit);
  }

  /* get actuall overall stat's (no permutation) */
  octp = gen_overall_ctp(ctp, good_ctp, 0, pairs);
  /*printf("overall ctp 0,1: %d %d %d %d / %d %d %d %d\n",
         octp->ct[0]->hits,octp->ct[0]->misss,octp->ct[0]->fas,octp->ct[0]->crs,
         octp->ct[1]->hits,octp->ct[1]->misss,octp->ct[1]->fas,octp->ct[1]->crs);*/
  true_stat = gen_stat(octp, stat_type, pairs);
  /*printf("%s for %d forecasts valid at %d: %f, %f %f   \n",
    stat_type,good_ctp,avtime,true_stat->val[0],true_stat->val[1],true_stat->val_diff);*/

  if (good_ctp < 10) {
    if (true_stat->val[0] > BAD_VAL / 2.0 ||
        true_stat->val[1] > BAD_VAL / 2.0) {
      printf(";BAD at valid_time %d\n", avtime);
    } else {
      printf("%s %d %d %f %f %f %f %d %d\n", stat_type, good_ctp, avtime,
             true_stat->val[0], true_stat->val[1], true_stat->val_diff,
             BAD_SHORT, min_valid_time, max_valid_time);
    }
    return;
  }

  if (pairs != 0) {
    srand(time(NULL)); /* seed the random number generator */
    for (i = 0; i < MAX_TRYS; i++) {
      stat[i] =
          gen_stat(gen_overall_ctp(ctp, good_ctp, 1, pairs), stat_type, pairs);
    }

    /* sort the stat array */
    qsort(stat, MAX_TRYS, sizeof(Stat *), compareDiffs);

    for (i = 0; i < 0; i++) {
      printf(";%d %s: %f %f %f\n", i, stat_type, stat[i]->val[0],
             stat[i]->val[1], stat[i]->val_diff);
    }
    i_min = (int)(MAX_TRYS * 0.025);
    i_max = (int)(MAX_TRYS * 0.975);
    /*printf("i_min, max: %d %d\n",i_min,i_max);*/
    bot_95 = stat[i_min]->val_diff;
    top_95 = stat[i_max]->val_diff;
    /* printf("95%: +/-  %.3f\n",(top_95-bot_95)/2);*/
  }

  if (true_stat->val[0] > BAD_VAL / 2.0 || true_stat->val[1] > BAD_VAL / 2.0) {
    printf(";BAD at valid_time %d\n", avtime);
  } else {
    printf("%s %d %d %f %f %f %f %d %d\n", stat_type, good_ctp, avtime,
           true_stat->val[0], true_stat->val[1], true_stat->val_diff,
           (top_95 - bot_95) / (1.96 * 2), min_valid_time, max_valid_time);
  }
}

Stat *gen_stat(CTPair *ctp, char *stat_type, int pairs) {
  Stat *s;
  int i, i_max;
  Stat *newStat();
  double val, val_temp;

  if (pairs == 0) {
    i_max = 1;
  } else {
    i_max = 2;
  }

  s = newStat();
  if (strncmp(stat_type, "CSI", 3) == 0) {
    for (i = 0; i < i_max; i++) {
      val_temp =
          (double)(ctp->ct[i]->hits + ctp->ct[i]->misss + ctp->ct[i]->fas);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = ctp->ct[i]->hits / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "Bias", 4) == 0) {
    for (i = 0; i < i_max; i++) {
      val_temp = (double)(ctp->ct[i]->hits + ctp->ct[i]->misss);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = (ctp->ct[i]->hits + ctp->ct[i]->fas) / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "Ratio", 4) == 0) {
    for (i = 0; i < i_max; i++) {
      val_temp = (double)(ctp->ct[i]->hits + ctp->ct[i]->misss +
                          ctp->ct[i]->fas + ctp->ct[i]->crs);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = (ctp->ct[i]->hits + ctp->ct[i]->misss) / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "PODy", 4) == 0) {
    for (i = 0; i < i_max; i++) {
      val_temp = (double)(ctp->ct[i]->hits + ctp->ct[i]->misss);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = (ctp->ct[i]->hits) / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "PODn", 4) == 0) {
    for (i = 0; i < i_max; i++) {
      val_temp = (double)(ctp->ct[i]->fas + ctp->ct[i]->crs);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = (ctp->ct[i]->crs) / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "FAR", 3) == 0) {
    /* false alarm R ATIO */
    for (i = 0; i < i_max; i++) {
      val_temp = (double)(ctp->ct[i]->hits + ctp->ct[i]->fas);
      if (val_temp == 0) {
        val = BAD_VAL;
      } else {
        val = (ctp->ct[i]->fas) / val_temp;
      }
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "NPT", 3) == 0) {
    for (i = 0; i < i_max; i++) {
      val = ctp->ct[i]->hits + ctp->ct[i]->misss;
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else if (strncmp(stat_type, "Ntot", 3) == 0) {
    for (i = 0; i < i_max; i++) {
      val = ctp->ct[i]->hits + ctp->ct[i]->misss + ctp->ct[i]->fas +
            ctp->ct[i]->crs;
      /*printf("%d val is %f\n",i,val);*/
      s->val[i] = val;
    }
  } else {
    printf("Stat = %s not supported.\n",
           stat_type);
    exit(1);
  }
  if (s->val[0] > BAD_VAL / 2.0 || s->val[1] > BAD_VAL / 2.0) {
    s->val_diff = BAD_VAL;
  } else {
    s->val_diff = s->val[1] - s->val[0];
  }
  return (s);
}

CTPair *gen_overall_ctp(CTPair **ctp, int n_ctp, int perm, int pairs) {
  int i, i_max, j, j_rand, rand_tot, j_rand1;
  int j_max = 2;
  double x, y;
  float z;
  CT *overall_ct0, *overall_ct1;
  CTPair *overall_ctp;
  CTPair *newCTPair();
  CT *newCT();
  void printCTP(CTPair * ctp);

  if (pairs == 0) {
    /* only a single set of CTs */
    j_max = 1;
  } else {
    j_max = 2;
  }

  overall_ct0 = newCT();
  overall_ct1 = newCT();
  overall_ctp = newCTPair();
  overall_ctp->ct[0] = overall_ct0;
  overall_ctp->ct[1] = overall_ct1;
  rand_tot = 0;

  for (i = 0; i < n_ctp; i++) {
    x = (double)RAND_MAX;
    y = (double)rand() / x;
    j_rand = y < 0.5 ? 0 : 1;
    rand_tot += j_rand;
    /*printf("y: %f, j_rand is %d\n",y,j_rand);*/
    for (j = 0; j < j_max; j++) {
      if (perm == 0) {
        j_rand1 = j; /* no perumtation */
      } else {
        if (j == 0) {
          j_rand1 = j_rand;
        } else {
          j_rand1 = 1 - j_rand;
        }
      }
      overall_ctp->ct[j]->hits += ctp[i]->ct[j_rand1]->hits;
      overall_ctp->ct[j]->misss += ctp[i]->ct[j_rand1]->misss;
      overall_ctp->ct[j]->fas += ctp[i]->ct[j_rand1]->fas;
      overall_ctp->ct[j]->crs += ctp[i]->ct[j_rand1]->crs;
    }
    /*printCTP(overall_ctp);*/
  }
  /*printf("rand_tot is %d, n_ctp is %d\n",rand_tot,n_ctp);*/
  return (overall_ctp);
}

void printCTP(CTPair *ctp) {
  printf("%d %d %d %d %d %d %d %d\n", ctp->ct[0]->hits, ctp->ct[0]->misss,
         ctp->ct[0]->fas, ctp->ct[0]->crs, ctp->ct[1]->hits, ctp->ct[1]->misss,
         ctp->ct[1]->fas, ctp->ct[1]->crs);
}

/**********************************************************************/
/*  function compareValidTimes  */
/**********************************************************************/
/* used in qsort to compare two stat differences. */
int compareValidTimes(const void *pp1, const void *pp2) {
  CTPair *ctp1, *ctp2;
  int vt1, vt2, return_val;

  ctp1 = *((CTPair **)pp1);
  ctp2 = *((CTPair **)pp2);

  vt1 = ctp1->valid_time;
  vt2 = ctp2->valid_time;

  if (vt1 < 0) {
    return_val = 1;
  } else if (vt2 < 0) {
    return_val = -1;
  } else {
    return_val = vt1 - vt2;
  }
  return (return_val);
}

/**********************************************************************/
/*  function compareDiffs  */
/**********************************************************************/
/* used in qsort to compare two stat differences. */
int compareDiffs(const void *pp1, const void *pp2) {
  Stat *p1, *p2;
  double diff1, diff2, diffdiff;
  int return_val;
  p1 = *((Stat **)pp1);
  p2 = *((Stat **)pp2);

  diff1 = p1->val_diff;
  diff2 = p2->val_diff;
  diffdiff = diff1 - diff2;

  if (diffdiff < 0) {
    return_val = -1;
  } else if (diffdiff > 0) {
    return_val = 1;
  } else {
    return_val = 0;
  }

  return (return_val);
}

/**********************************************************************/
/* f u n c t i o n  n e w S t a t  */
/**********************************************************************/
/* creates space for a new Stat entry */
Stat *newStat() {
  FILE *fp;
  Stat *p;
  fp = fopen("errors.txt", "a");
  p = (Stat *)malloc(sizeof(Stat));
  if (p == NULL) {
    fprintf(fp, "perm.c: Ran out of memory space for a new Stat entry!!");
    fclose(fp);
    exit(1);
  }
  p->val[0] = 0;
  p->val[1] = 0;
  p->val_diff = 0;
  return (p);
}

/**********************************************************************/
/* f u n c t i o n  n e w C T  */
/**********************************************************************/
/* creates space for a new CT entry */
CT *newCT() {
  FILE *fp;
  CT *p;

  fp = fopen("errors.txt", "a");
  p = (CT *)malloc(sizeof(CT));
  if (p == NULL) {
    fprintf(fp, "perm.c: Ran out of memory space for a new CT entry!!");
    fclose(fp);
    exit(1);
  }
  p->hits = 0;
  p->misss = 0;
  p->fas = 0;
  p->crs = 0;
  return (p);
}

/**********************************************************************/
/* f u n c t i o n  n e w C T S */
/**********************************************************************/
/* creates space for a new CT entry */
CTPair *newCTPair() {
  FILE *fp;
  CTPair *p;

  fp = fopen("errors.txt", "a");
  p = (CTPair *)malloc(sizeof(CTPair));
  if (p == NULL) {
    fprintf(fp, "perm.c: Ran out of memory space for a new CTPair entry!!");
    fclose(fp);
    exit(1);
  }
  return (p);
}
