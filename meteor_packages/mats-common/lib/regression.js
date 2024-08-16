/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */
const gaussianElimination = function (a, o) {
  const thisA = a;
  let i = 0;
  let j = 0;
  let k = 0;
  let maxrow = 0;
  let tmp = 0;
  const n = thisA.length - 1;
  const x = new Array(o);
  for (i = 0; i < n; i += 1) {
    maxrow = i;
    for (j = i + 1; j < n; j += 1) {
      if (Math.abs(thisA[i][j]) > Math.abs(thisA[i][maxrow])) maxrow = j;
    }
    for (k = i; k < n + 1; k += 1) {
      tmp = thisA[k][i];
      thisA[k][i] = thisA[k][maxrow];
      thisA[k][maxrow] = tmp;
    }
    for (j = i + 1; j < n; j += 1) {
      for (k = n; k >= i; k -= 1) {
        thisA[k][j] -= (thisA[k][i] * thisA[i][j]) / thisA[i][i];
      }
    }
  }
  for (j = n - 1; j >= 0; j -= 1) {
    tmp = 0;
    for (k = j + 1; k < n; k += 1) tmp += thisA[k][j] * x[k];
    x[j] = (thisA[n][j] - tmp) / thisA[j][j];
  }
  return x;
};

const methods = {
  linear(data) {
    const sum = [0, 0, 0, 0, 0];
    let n = 0;
    const results = [];

    for (; n < data.length; n += 1) {
      if (data[n][1]) {
        sum[0] += data[n][0];
        sum[1] += data[n][1];
        sum[2] += data[n][0] * data[n][0];
        sum[3] += data[n][0] * data[n][1];
        sum[4] += data[n][1] * data[n][1];
      }
    }

    const gradient = (n * sum[3] - sum[0] * sum[1]) / (n * sum[2] - sum[0] * sum[0]);
    const intercept = sum[1] / n - (gradient * sum[0]) / n;
    //  var correlation = (n * sum[3] - sum[0] * sum[1]) / Math.sqrt((n * sum[2] - sum[0] * sum[0]) * (n * sum[4] - sum[1] * sum[1]));

    for (let i = 0, len = data.length; i < len; i += 1) {
      const coordinate = [data[i][0], data[i][0] * gradient + intercept];
      results.push(coordinate);
    }

    const string = `y = ${Math.round(gradient * 100) / 100}x + ${
      Math.round(intercept * 100) / 100
    }`;

    return { equation: [gradient, intercept], points: results, string };
  },

  linearThroughOrigin(data) {
    const sum = [0, 0];
    let n = 0;
    const results = [];

    for (; n < data.length; n += 1) {
      if (data[n][1]) {
        sum[0] += data[n][0] * data[n][0]; // sumSqX
        sum[1] += data[n][0] * data[n][1]; // sumXY
      }
    }

    const gradient = sum[1] / sum[0];

    for (let i = 0, len = data.length; i < len; i += 1) {
      const coordinate = [data[i][0], data[i][0] * gradient];
      results.push(coordinate);
    }

    const string = `y = ${Math.round(gradient * 100) / 100}x`;

    return { equation: [gradient], points: results, string };
  },

  exponential(data) {
    const sum = [0, 0, 0, 0, 0, 0];
    let n = 0;
    const results = [];

    for (let len = data.length; n < len; n += 1) {
      if (data[n][1]) {
        sum[0] += data[n][0];
        sum[1] += data[n][1];
        sum[2] += data[n][0] * data[n][0] * data[n][1];
        sum[3] += data[n][1] * Math.log(data[n][1]);
        sum[4] += data[n][0] * data[n][1] * Math.log(data[n][1]);
        sum[5] += data[n][0] * data[n][1];
      }
    }

    const denominator = sum[1] * sum[2] - sum[5] * sum[5];
    const A = Math.E ** ((sum[2] * sum[3] - sum[5] * sum[4]) / denominator);
    const B = (sum[1] * sum[4] - sum[5] * sum[3]) / denominator;

    for (let i = 0, len = data.length; i < len; i += 1) {
      const coordinate = [data[i][0], A * Math.E ** (B * data[i][0])];
      results.push(coordinate);
    }

    const string = `y = ${Math.round(A * 100) / 100}e^(${Math.round(B * 100) / 100}x)`;

    return { equation: [A, B], points: results, string };
  },

  logarithmic(data) {
    const sum = [0, 0, 0, 0];
    let n = 0;
    const results = [];

    for (let len = data.length; n < len; n += 1) {
      if (data[n][1]) {
        sum[0] += Math.log(data[n][0]);
        sum[1] += data[n][1] * Math.log(data[n][0]);
        sum[2] += data[n][1];
        sum[3] += Math.log(data[n][0]) ** 2;
      }
    }

    const B = (n * sum[1] - sum[2] * sum[0]) / (n * sum[3] - sum[0] * sum[0]);
    const A = (sum[2] - B * sum[0]) / n;

    for (let i = 0, len = data.length; i < len; i += 1) {
      const coordinate = [data[i][0], A + B * Math.log(data[i][0])];
      results.push(coordinate);
    }

    const string = `y = ${Math.round(A * 100) / 100} + ${
      Math.round(B * 100) / 100
    } ln(x)`;

    return { equation: [A, B], points: results, string };
  },

  power(data) {
    const sum = [0, 0, 0, 0];
    let n = 0;
    const results = [];

    for (let len = data.length; n < len; n += 1) {
      if (data[n][1]) {
        sum[0] += Math.log(data[n][0]);
        sum[1] += Math.log(data[n][1]) * Math.log(data[n][0]);
        sum[2] += Math.log(data[n][1]);
        sum[3] += Math.log(data[n][0]) ** 2;
      }
    }

    const B = (n * sum[1] - sum[2] * sum[0]) / (n * sum[3] - sum[0] * sum[0]);
    const A = Math.E ** ((sum[2] - B * sum[0]) / n);

    for (let i = 0, len = data.length; i < len; i += 1) {
      const coordinate = [data[i][0], A * data[i][0] ** B];
      results.push(coordinate);
    }

    const string = `y = ${Math.round(A * 100) / 100}x^${Math.round(B * 100) / 100}`;

    return { equation: [A, B], points: results, string };
  },

  polynomial(data, order) {
    let thisOrder = order;
    if (typeof thisOrder === "undefined") {
      thisOrder = 2;
    }
    const lhs = [];
    const rhs = [];
    const results = [];
    let a = 0;
    let b = 0;
    const k = thisOrder + 1;

    for (let i = 0; i < k; i += 1) {
      for (let l = 0, len = data.length; l < len; l += 1) {
        if (data[l][1]) {
          a += data[l][0] ** i * data[l][1];
        }
      }
      lhs.push(a);
      a = 0;
      const c = [];
      for (let j = 0; j < k; j += 1) {
        for (let l = 0, len = data.length; l < len; l += 1) {
          if (data[l][1]) {
            b += data[l][0] ** (i + j);
          }
        }
        c.push(b);
        b = 0;
      }
      rhs.push(c);
    }
    rhs.push(lhs);

    const equation = gaussianElimination(rhs, k);

    for (let i = 0, len = data.length; i < len; i += 1) {
      let answer = 0;
      for (let w = 0; w < equation.length; w += 1) {
        answer += equation[w] * data[i][0] ** w;
      }
      results.push([data[i][0], answer]);
    }

    let string = "y = ";

    for (let i = equation.length - 1; i >= 0; i -= 1) {
      if (i > 1) string += `${Math.round(equation[i] * 10 ** i) / 10 ** i}x^${i} + `;
      else if (i === 1) string += `${Math.round(equation[i] * 100) / 100}x + `;
      else string += Math.round(equation[i] * 100) / 100;
    }

    return { equation, points: results, string };
  },

  lastvalue(data) {
    const results = [];
    let lastvalue = null;
    for (let i = 0; i < data.length; i += 1) {
      if (data[i][1]) {
        [, lastvalue] = data[i];
        results.push([data[i][0], data[i][1]]);
      } else {
        results.push([data[i][0], lastvalue]);
      }
    }

    return { equation: [lastvalue], points: results, string: `${lastvalue}` };
  },
};

// eslint-disable-next-line no-undef
export default regression = function (method, data, order) {
  if (typeof method === "string") {
    return methods[method](data, order);
  }
  return null;
};
