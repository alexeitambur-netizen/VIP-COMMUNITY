'use strict';

const assert = require('assert');
const market = require('./market-signal');

function bars(closes) {
  return closes.map(function (close, index) {
    var prev = index ? closes[index - 1] : close;
    return {
      t: index * 60000,
      open: prev,
      high: Math.max(prev, close) + 0.00002,
      low: Math.min(prev, close) - 0.00002,
      close: close
    };
  });
}

function walk(start, steps) {
  var price = start;
  var closes = [price];
  steps.forEach(function (step) {
    var count = Math.abs(step.count);
    var dir = step.count < 0 ? -1 : 1;
    for (var i = 0; i < count; i++) {
      price += dir * step.size;
      closes.push(Number(price.toFixed(5)));
    }
  });
  return closes;
}

function callOf(closes, ticks) {
  var rows = bars(closes);
  return market.minuteCall(market.fibRetracement(rows), rows, ticks || null);
}

var rally = walk(1.1, [
  { count: -20, size: 0.0003 },
  { count: 20, size: 0.00025 }
]);
var rallyCall = callOf(rally);
assert.strictEqual(rallyCall.isUp, true, 'rally after a drop must be CALL, got ' + rallyCall.reason);

var upThenOneRed = walk(1.08, [{ count: 36, size: 0.00008 }]);
upThenOneRed[upThenOneRed.length - 1] = upThenOneRed[upThenOneRed.length - 2] - 0.00003;
var holdCall = callOf(upThenOneRed);
assert.strictEqual(holdCall.isUp, true, 'one red minute at the high must stay CALL, got ' + holdCall.reason);

var downThenOneGreen = walk(1.09, [{ count: -36, size: 0.00008 }]);
downThenOneGreen[downThenOneGreen.length - 1] = downThenOneGreen[downThenOneGreen.length - 2] + 0.00003;
var holdPut = callOf(downThenOneGreen);
assert.strictEqual(holdPut.isUp, false, 'one green minute at the low must stay PUT, got ' + holdPut.reason);

var breakHigh = walk(1.05, [{ count: 30, size: 0.0001 }]);
var breakRows = bars(breakHigh);
var breakTicks = [];
for (var i = 0; i < 12; i++) breakTicks.push([i, breakRows[breakRows.length - 1].close + i * 0.00004]);
var breakCall = market.minuteCall(market.fibRetracement(breakRows), breakRows, breakTicks);
assert.strictEqual(breakCall.isUp, true, 'tick breakout above the high must be CALL, got ' + breakCall.reason);

var failedBounce = walk(1.2, [
  { count: 24, size: 0.0001 },
  { count: -12, size: 0.00018 }
]);
var failed = callOf(failedBounce);
assert.strictEqual(failed.isUp, false, 'break through 78.6 of an up impulse must be PUT, got ' + failed.reason);

var bounce = walk(1.07, [
  { count: 22, size: 0.00012 },
  { count: -6, size: 0.0001 },
  { count: 3, size: 0.00009 }
]);
var bounceCall = callOf(bounce);
assert.strictEqual(bounceCall.isUp, true, 'turn up from a fib pullback must be CALL, got ' + bounceCall.reason);

assert.ok(/Фибо|Импульс|Пробой|Откат/.test(rallyCall.reason), rallyCall.reason);
assert.ok(/пт/.test(rallyCall.reason), rallyCall.reason);
assert.ok(rallyCall.reason.indexOf('CALL') >= 0, rallyCall.reason);
assert.ok(holdPut.reason.indexOf('PUT') >= 0, holdPut.reason);

var upCount = 0;
var downCount = 0;
[rallyCall, holdCall, holdPut, breakCall, failed, bounceCall].forEach(function (row) {
  if (row.isUp) upCount += 1;
  else downCount += 1;
});
assert.ok(upCount >= 3 && downCount >= 2, 'signals collapsed to one side: ' + upCount + ' CALL / ' + downCount + ' PUT');

console.log('market-signal tests passed');
console.log('rally', rallyCall.isUp, rallyCall.reason);
console.log('one red at high', holdCall.isUp, holdCall.reason);
console.log('one green at low', holdPut.isUp, holdPut.reason);
console.log('breakout', breakCall.isUp, breakCall.reason);
console.log('failed impulse', failed.isUp, failed.reason);
console.log('bounce', bounceCall.isUp, bounceCall.reason);
