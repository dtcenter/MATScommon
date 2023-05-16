/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/*
generic Math Functions
 */
const isNum = function (args) {
  if (args === null || args === undefined) {
    return false;
  }
  args = args.toString();
  if (args.length === 0) return false;

  for (let i = 0; i < args.length; i++) {
    if (
      (args.substring(i, i + 1) < "0" || args.substring(i, i + 1) > "9") &&
      args.substring(i, i + 1) !== "." &&
      args.substring(i, i + 1) !== "-"
    ) {
      return false;
    }
  }

  return true;
};

const mean = function (arr) {
  let len = 0;
  let sum = 0;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === "") {
    } else if (!isNum(arr[i])) {
      // alert(arr[i] + " is not number!");
      console.log(
        `Error: value at position: ${i} is not number! Mean Calculation failed!`
      );
      return 0;
    } else {
      len += 1;
      sum += parseFloat(arr[i]);
    }
  }
  return sum / len;
};

const variance = function (arr) {
  let len = 0;
  let sum = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === "") {
    } else if (!isNum(arr[i])) {
      // alert(arr[i] + " is not number, Variance Calculation failed!");
      console.log(`value at position ${i} is not number, Variance Calculation failed!`);
      return 0;
    } else {
      len += 1;
      sum += parseFloat(arr[i]);
    }
  }

  let v = 0;
  if (len > 1) {
    const mean = sum / len;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === "") {
      } else {
        v += (arr[i] - mean) * (arr[i] - mean);
      }
    }

    return v / len;
  }
  return 0;
};

const median = function (arr) {
  arr.sort(function (a, b) {
    return a - b;
  });

  let median = 0;

  if (arr.length % 2 === 1) {
    median = arr[(arr.length + 1) / 2 - 1];
  } else {
    median = (1 * arr[arr.length / 2 - 1] + 1 * arr[arr.length / 2]) / 2;
  }

  return median;
};

export default matsMathUtils = {
  isNum,
  mean,
  variance,
  median,
};
