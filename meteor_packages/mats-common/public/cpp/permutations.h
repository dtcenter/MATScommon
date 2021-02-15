#define MAX_TRYS 1000
#define MAX_PAIRS 1000000


typedef struct CT {
  int hits;
  int misss;			/* misses */
  int fas;			/* false alarms */
  int crs;			/* correct rejections (or correct nulls) */
} CT;
 
typedef struct CTPair {
  int valid_time;
  CT *ct[2];
} CTPair;

typedef struct Stat {
  double val[2];
  double val_diff;
} Stat;
