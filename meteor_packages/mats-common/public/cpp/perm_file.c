#include <ctype.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "permutations.h"

/* this needs environment variables: STAT_TYPE, STAT_FILE */

main(int argc, char *argv[]) {
  CTPair *ctp[MAX_PAIRS];
  char stat_type[20];
  char filename[200];
  char line[200];      /* temp storage for each input line */
  static FILE *stream; /* stream for rawTail list */
  int i;
  CT *ct0, *ct1;
  CTPair *ctpair;
  int input_count = 0;
  int pairs = 1;
  float sd_limit = 0;
  CT *newCT();
  CTPair *newCTPair();
  void get_stat1(char *stat_type, int vtime, CTPair *ctp[], int n_ctp,
                 int min_valid_time, int max_valid_time, int pairs,
                 float sd_limit);

  int max_ctp;

  int avtime = -1;
  int last_avtime = -1;
  int valid_time;
  int min_valid_time = INT_MAX;
  int max_valid_time = INT_MIN;
  int n_ctp = 0;   /* counts number of ctpairs for this avtime */
  int i_start = 0; /* starting index for this avtime */
  char *env_sd_limit;

  max_ctp = 0;

  snprintf(filename, 200, getenv("STAT_FILE"));
  stream = fopen(filename, "r");
  if (stream == NULL) {
    fprintf(stderr, "perm.c: Can't open file %s\n", filename);
    exit(1);
  }

  /* old way used environment variables
  stat_type = getenv("STAT_TYPE");
  if(stat_type == NULL) {
    printf("set env variable STAT_TYPE!\n");
    exit(1);
  }
  env_sd_limit = getenv("SD_LIMIT");
  if(env_sd_limit != NULL) {
    sscanf(env_sd_limit,"%f",&sd_limit);
    }*/

  if (fgets(line, 200, stream) == NULL) {
    printf("set env variable STAT_TYPE!\n");
    exit(1);
  } else {
    sscanf(line, "%s", stat_type);
    printf(";stat_type from input is %s\n", stat_type);
  }
  if (fgets(line, 200, stream) == NULL) {
    printf("set env variable SD_LIMIT!\n");
    exit(1);
  } else {
    sscanf(line, "%f", &sd_limit);
    printf(";sd limit from input is %f\n", sd_limit);
  }

  for (i = 0;;) {
    if (fgets(line, 200, stream) == NULL)
      break;                 /* EOF */
    else if (line[0] == ';') /* skip lines with semicolon in col 1 */
      ;
    else if (isspace(line[0])) /* skip lines with a space in col 1 */
      ;
    else {
      ct0 = newCT();
      ct1 = newCT();
      input_count =
          sscanf(line, "%d %d %d %d %d %d %d %d %d %d", &valid_time, &avtime,
                 &ct0->hits, &ct0->fas, &ct0->misss, &ct0->crs, &ct1->hits,
                 &ct1->fas, &ct1->misss, &ct1->crs);
      /* printf(";%d input count is %d %d %d
       * %d\n",i,input_count,valid_time,avtime,ct1->crs);*/
      /* make a place for these contingency tables record */
      if (input_count == 6) {
        /* we have only one time series of CTs, not two */
        pairs = 0;
        ct1->hits = 0;
        ct1->fas = 0;
        ct1->misss = 0;
        ct1->crs = 0;
      }
      ctpair = newCTPair();
      ctpair->ct[0] = ct0;
      ctpair->ct[1] = ct1;
      ctp[i++] = ctpair;
      n_ctp++;
      if (valid_time < min_valid_time) {
        min_valid_time = valid_time;
      }
      if (valid_time > max_valid_time) {
        max_valid_time = valid_time;
      }
      if (i > MAX_PAIRS) {
        printf("too many pairs of contingency tables. Max = %d\n", MAX_PAIRS);
        exit(1);
      }
    }
    if (avtime != last_avtime && last_avtime != -1) {
      n_ctp--; /* don't include the last CTPair, because it's for the next time
                */
      /* process this group of ctpairs */
      /* printf(";i_start is %d, n_ctp is %d\n",i_start,n_ctp);*/
      get_stat1(stat_type, last_avtime, &ctp[i_start], n_ctp, min_valid_time,
                max_valid_time, pairs, sd_limit);
      i_start = i - 1;
      n_ctp = 1;
    }
    last_avtime = avtime;
  }
  get_stat1(stat_type, last_avtime, &ctp[i_start], n_ctp, min_valid_time,
            max_valid_time, pairs, sd_limit);
  max_ctp = i;
}
