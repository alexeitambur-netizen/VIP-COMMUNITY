/* Next-minute direction from the latest Fibonacci impulse, candle points, and ticks.
   A single print against the impulse must not flip the call. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VipMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.236, 1.272, 1.382, 1.5, 1.618, 1.786, 2.618];

  function pointSize(price) {
    var abs = Math.abs(price || 0);
    if (abs >= 100) return 0.01;
    if (abs >= 10) return 0.001;
    return 0.00001;
  }

  function formatPoints(delta, price) {
    var pts = Math.round((Number(delta) || 0) / pointSize(price));
    if (!isFinite(pts)) pts = 0;
    return (pts > 0 ? '+' : '') + pts + ' пт';
  }

  function fmt(price) {
    var abs = Math.abs(price || 0);
    var digits = abs >= 100 ? 2 : (abs >= 10 ? 3 : 5);
    return Number(price || 0).toFixed(digits);
  }

  function levelLabel(level) {
    if (level === 0) return '0';
    if (level === 1) return '100';
    return String(Math.round(level * 1000) / 10);
  }

  function tickPrices(ticks) {
    var out = [];
    (ticks || []).forEach(function (tk) {
      var time = 0;
      var price = NaN;
      if (Array.isArray(tk)) {
        time = Number(tk[0]);
        price = Number(tk[1]);
        if (!(price > 0) && tk.length > 2) {
          time = Number(tk[1]);
          price = Number(tk[2]);
        }
      } else if (tk && typeof tk === 'object') {
        time = Number(tk.t || tk.time || 0);
        price = Number(tk.price != null ? tk.price : tk.close);
      } else {
        price = Number(tk);
      }
      if (price > 0 && isFinite(price)) out.push({ t: time || out.length, price: price });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out.map(function (row) { return row.price; });
  }

  function tapeFromPrices(prices) {
    var up = 0;
    var down = 0;
    for (var i = 1; i < prices.length; i++) {
      var step = prices[i] - prices[i - 1];
      if (step > 0) up += 1;
      else if (step < 0) down += 1;
    }
    var mid = Math.max(1, Math.floor(prices.length / 2));
    var recent = prices[prices.length - 1] - prices[mid];
    var net = prices[prices.length - 1] - prices[0];
    var bias = 0;
    if (up >= down + 2 && net > 0) bias += 1;
    if (down >= up + 2 && net < 0) bias -= 1;
    if (recent > 0 && up >= down) bias += 1;
    if (recent < 0 && down >= up) bias -= 1;
    return { up: up, down: down, net: net, recent: recent, bias: bias, samples: prices.length };
  }

  function closesOf(rows, count) {
    var prices = [];
    (rows || []).slice(-count).forEach(function (row) {
      if (row && row.close > 0) prices.push(row.close);
    });
    return prices;
  }

  function readTape(ticks, rows) {
    var live = tickPrices(ticks).slice(-40);
    var minute = closesOf(rows, 8);
    var nowPrices = live.length >= 6 ? live.slice(-24) : closesOf(rows, 3);
    var shown = live.length >= 6 ? live : minute;
    var now = nowPrices.length >= 2 ? tapeFromPrices(nowPrices) : { up: 0, down: 0, net: 0, recent: 0, bias: 0, samples: 0 };
    var context = shown.length >= 2 ? tapeFromPrices(shown) : now;
    var price = shown.length ? shown[shown.length - 1] : (minute.length ? minute[minute.length - 1] : 0);
    context.pointsText = formatPoints(context.net, price);
    context.live = live.length >= 6;
    now.pointsText = formatPoints(now.net, price || (nowPrices[nowPrices.length - 1] || 0));
    return { context: context, now: now };
  }

  function structurePoints(rows) {
    var slice = (rows || []).slice(-6);
    var higher = 0;
    var lower = 0;
    for (var i = 1; i < slice.length; i++) {
      if (slice[i].high >= slice[i - 1].high && slice[i].low >= slice[i - 1].low) higher += 1;
      else if (slice[i].high <= slice[i - 1].high && slice[i].low <= slice[i - 1].low) lower += 1;
    }
    return { higher: higher, lower: lower };
  }

  function fibRetracement(rows) {
    if (!rows || rows.length < 12) return null;
    var n = rows.length;
    var from = Math.max(0, n - 40);
    var hi = from;
    var lo = from;
    for (var i = from + 1; i < n; i++) {
      if (rows[i].high >= rows[hi].high) hi = i;
      if (rows[i].low <= rows[lo].low) lo = i;
    }
    if (hi === lo) return null;
    var spanPrice = Math.abs(rows[hi].high - rows[lo].low);
    var microFrom = Math.max(from, n - 8);
    var mhi = microFrom;
    var mlo = microFrom;
    for (var j = microFrom + 1; j < n; j++) {
      if (rows[j].high >= rows[mhi].high) mhi = j;
      if (rows[j].low <= rows[mlo].low) mlo = j;
    }
    var microSpan = Math.abs(rows[mhi].high - rows[mlo].low);
    var useMicro = mhi !== mlo && microSpan >= spanPrice * 0.382;
    var up;
    var start;
    var end;
    if (useMicro) {
      up = mhi > mlo;
      if (up) {
        start = { index: mlo, price: rows[mlo].low };
        end = { index: mhi, price: rows[mhi].high };
      } else {
        start = { index: mhi, price: rows[mhi].high };
        end = { index: mlo, price: rows[mlo].low };
      }
    } else if (lo < hi) {
      up = true;
      start = { index: lo, price: rows[lo].low };
      end = { index: hi, price: rows[hi].high };
    } else {
      up = false;
      start = { index: hi, price: rows[hi].high };
      end = { index: lo, price: rows[lo].low };
    }
    var span = start.price - end.price;
    if (!isFinite(span) || Math.abs(span) < Math.abs(end.price) * 0.00005) return null;
    var last = rows[n - 1].close;
    var ratio = (last - end.price) / span;
    var nearest = 0;
    var best = Infinity;
    FIB_LEVELS.forEach(function (level) {
      var dist = Math.abs(ratio - level);
      if (dist < best) {
        best = dist;
        nearest = level;
      }
    });
    return {
      up: up,
      start: start,
      end: end,
      span: span,
      ratio: ratio,
      nearest: nearest,
      atLevel: best <= 0.08 || ratio < 0.05,
      levels: FIB_LEVELS.map(function (level) {
        return { level: level, price: end.price + span * level };
      })
    };
  }

  function levelPrice(fib, level) {
    return fib.end.price + fib.span * level;
  }

  function closedMove(rows) {
    var slice = (rows || []).slice(-4);
    var up = 0;
    var down = 0;
    for (var i = 1; i < slice.length; i++) {
      if (slice[i].close > slice[i - 1].close) up += 1;
      else if (slice[i].close < slice[i - 1].close) down += 1;
    }
    var net = slice.length >= 2 ? slice[slice.length - 1].close - slice[0].close : 0;
    return {
      up: up,
      down: down,
      net: net,
      rising: up >= 2 && up > down && net > 0,
      falling: down >= 2 && down > up && net < 0
    };
  }

  function sideUp(fib, move) {
    if (!fib) return move.rising || (!move.falling && move.net >= 0);
    var ratio = fib.ratio;
    if (fib.up) {
      if (ratio > 0.786 && move.falling) return false;
      if (ratio > 0.5 && move.falling) return false;
      return true;
    }
    if (ratio > 0.786 && move.rising) return true;
    if (ratio > 0.5 && move.rising) return true;
    return false;
  }

  function minuteCall(fib, rows, ticks) {
    var pack = readTape(ticks, rows);
    var now = pack.now;
    var tape = pack.context;
    var move = closedMove(rows);
    var structure = structurePoints(rows);
    var when = ' Вход на открытии следующей минуты, экспирация на её закрытии. До этого открытия сторона не меняется.';
    var price = rows && rows.length ? rows[rows.length - 1].close : 0;
    var tapeNote = ' Закрытые минуты: ' + tape.pointsText + ' (' + move.up + ' вверх / ' + move.down + ' вниз).';
    var structNote = ' Свечи: выше предыдущей ' + structure.higher + ', ниже предыдущей ' + structure.lower + '.';
    var isUp = sideUp(fib, move);
    var reason;

    if (!fib) {
      reason = (isUp ? 'Закрытые минуты вверх.' : 'Закрытые минуты вниз.') + tapeNote + structNote;
      return finish(isUp, 56, reason + when, fib, tape, now, 0);
    }

    var place = levelLabel(fib.nearest);
    var at = levelPrice(fib, fib.nearest);
    var fromLevel = formatPoints(price - at, price);
    var side = fib.up ? 'импульса вверх' : 'импульса вниз';
    var leg = 'Импульс ' + (fib.up ? 'вверх ' : 'вниз ') + fmt(fib.start.price) + ' → ' + fmt(fib.end.price) + '. ';
    var where = 'Фибо ' + place + '% ' + side + ' (' + fmt(at) + ', ' + fromLevel + ' от уровня).';
    if (fib.up && isUp) reason = leg + where + ' Уровень по закрытым минутам держится.';
    else if (fib.up) reason = leg + where + ' Закрытые минуты пробили уровень вниз.';
    else if (isUp) reason = leg + where + ' Закрытые минуты вышли из падения.';
    else reason = leg + where + ' Уровень по закрытым минутам держит вниз.';
    reason += tapeNote + structNote;
    var agrees = (fib.up && isUp) || (!fib.up && !isUp);
    var accuracy = agrees ? (fib.atLevel ? 66 : 61) : 57;
    return finish(isUp, accuracy, reason + when, fib, tape, now, fib.nearest);
  }

  function finish(isUp, accuracy, reason, fib, tape, now, level) {
    var text = reason;
    if (text.indexOf('CALL') < 0 && text.indexOf('PUT') < 0) {
      var word = isUp ? ' CALL.' : ' PUT.';
      if (text.indexOf(' Вход на открытии') >= 0) text = text.replace(' Вход на открытии', word + ' Вход на открытии');
      else text += word;
    }
    return {
      wait: false,
      isUp: isUp,
      accuracy: accuracy,
      reason: text,
      level: level,
      tape: tape,
      now: now,
      fib: fib || null
    };
  }

  return {
    FIB_LEVELS: FIB_LEVELS,
    fibRetracement: fibRetracement,
    minuteCall: minuteCall,
    readTape: readTape,
    formatPoints: formatPoints,
    closedMove: closedMove,
    sideUp: sideUp
  };
});
