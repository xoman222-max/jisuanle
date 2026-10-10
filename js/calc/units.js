(function (root) {
  // 以基本單位表示的換算係數
  var UNITS = {
    area: { base: '平方公尺', u: { '平方公尺': 1, '坪': 400 / 121, '公頃': 10000, '甲': 9699.17, '分(地)': 969.917, '平方英尺': 0.09290304, '畝(市畝)': 2000 / 3, '平方公里': 1e6 } },
    weight: { base: '公斤', u: { '公斤': 1, '公克': 0.001, '台斤': 0.6, '台兩': 0.0375, '市斤': 0.5, '市兩': 0.05, '磅': 0.45359237, '盎司': 0.028349523125 } },
    length: { base: '公尺', u: { '公尺': 1, '公分': 0.01, '公里': 1000, '台尺': 10 / 33, '台寸': 1 / 33, '市尺': 1 / 3, '英尺': 0.3048, '英寸': 0.0254, '英里': 1609.344 } },
    volume: { base: '公升', u: { '公升': 1, '毫升': 0.001, '立方公尺': 1000, '美制加侖': 3.785411784, '杯(240ml)': 0.24 } },
    temperature: { base: '°C', u: { '°C': 1, '°F': 1, 'K': 1 } }
  };
  function convert(cat, value, from, to) {
    var c = UNITS[cat]; if (!c || !isFinite(value) || !(from in c.u) || !(to in c.u)) return null;
    if (cat === 'temperature') {
      var C = from === '°C' ? value : from === '°F' ? (value - 32) * 5 / 9 : value - 273.15;
      return to === '°C' ? C : to === '°F' ? C * 9 / 5 + 32 : C + 273.15;
    }
    return value * c.u[from] / c.u[to];
  }
  var api = { UNITS: UNITS, convert: convert };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
