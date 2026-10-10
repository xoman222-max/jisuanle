(function (root) {
  // region 'tw'：<18.5 過輕, <24 正常, <27 過重, <30 輕度肥胖, <35 中度, ≥35 重度（國健署）
  // region 'cn'：<18.5 偏瘦, <24 正常, <28 超重, ≥28 肥胖（WS/T 428-2013）
  function bmi(heightCm, weightKg, region) {
    if (!(heightCm >= 50 && heightCm <= 250) || !(weightKg >= 10 && weightKg <= 400)) return null;
    var h = heightCm / 100, b = weightKg / (h * h), cat;
    if (region === 'cn') cat = b < 18.5 ? '偏瘦' : b < 24 ? '正常' : b < 28 ? '超重' : '肥胖';
    else cat = b < 18.5 ? '體重過輕' : b < 24 ? '健康體位' : b < 27 ? '過重' : b < 30 ? '輕度肥胖' : b < 35 ? '中度肥胖' : '重度肥胖';
    return { bmi: b, category: cat, ideal: 22 * h * h, normalMin: 18.5 * h * h, normalMax: 24 * h * h };
  }
  // Mifflin-St Jeor
  function tdee(o) {
    if (!(o.age >= 10 && o.age <= 120) || !(o.height > 50) || !(o.weight > 10) || !(o.activity >= 1.1)) return null;
    var bmr = 10 * o.weight + 6.25 * o.height - 5 * o.age + (o.sex === 'female' ? -161 : 5);
    var t = bmr * o.activity;
    return { bmr: bmr, tdee: t, lose: t - 500, gain: t + 300 };
  }
  var api = { bmi: bmi, tdee: tdee };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
