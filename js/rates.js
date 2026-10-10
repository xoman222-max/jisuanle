/* 台灣費率與常數 —— 每年更新請只改這個檔案
 * 資料更新日期 (as of): 2026-10-10
 */
(function (root) {
  var R = {
    updated: '2026-10-10',
    // 基本工資 115年(2026)：月 29,500、時 196
    // 來源: https://www.mol.gov.tw/ (115.1.1 生效)；https://www.jfcpa.com.tw/storage/app/public/filesdata/December2025/si3cK1jN0vhHNNHLBRly.pdf  as of 2026-10-10
    minWageMonthly: 29500,
    minWageHourly: 196,
    // 勞保：普通事故 11.5% + 就業保險 1% = 12.5%；勞工20% 雇主70% 政府10%
    // 來源: https://www.bli.gov.tw/0005475.htm (勞工保險投保薪資分級表 115.1.1 起適用) as of 2026-10-10
    laborRateOrdinary: 0.115,
    laborRateEmployment: 0.01,
    laborShare: { employee: 0.2, employer: 0.7, gov: 0.1 },
    laborGrades: [29500, 30300, 31800, 33300, 34800, 36300, 38200, 40100, 42000, 43900, 45800],
    // 職業災害保險：行業別費率不同，此處以平均 0.21% 估算（含通勤 0.07%？依勞保局公告），全數雇主負擔，投保上限 72,800
    // 來源: https://www.bli.gov.tw/ (職災保險) as of 2026-10-10 —— 平均費率為估算值
    occRate: 0.0021,
    occMaxWage: 72800,
    // 健保：費率 5.17%，本人30% 雇主60% 政府10%，平均眷口數 0.56，眷屬最多計 3 口
    // 來源: https://www.nhi.gov.tw/ch/cp-19418-9eefb-2576-1.html (115.1.1 生效) as of 2026-10-10
    healthRate: 0.0517,
    healthShare: { employee: 0.3, employer: 0.6, gov: 0.1 },
    healthAvgDependents: 0.56,
    healthMaxDependents: 3,
    healthGrades: [29500, 30300, 31800, 33300, 34800, 36300, 38200, 40100, 42000, 43900, 45800, 48200, 50600, 53000, 55400, 57800, 60800, 63800, 66800, 69800, 72800, 76500, 80200, 83900, 87600, 92100, 96600, 101100, 105600, 110100, 115500, 120900, 126300, 131700, 137100, 142500, 147900, 150000, 156400, 162800, 169200, 175600, 182000, 189500, 197000, 204500, 212000, 219500, 228200, 236900, 245600, 254300, 263000, 273000, 283000, 293000, 303000, 313000],
    // 勞退新制：雇主至少 6%，勞工自願提繳 0~6%，月提繳工資上限 150,000
    // 來源: https://www.bli.gov.tw/ (勞工退休金月提繳分級表) as of 2026-10-10
    pensionEmployerRate: 0.06,
    pensionMaxSelfRate: 0.06,
    pensionMaxWage: 150000,
    // 綜合所得稅（財政部公告）
    // 114年度(115年5月申報): https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg030223/ch04/type3/gov30/num16/Eg.htm
    // 115年度(116年5月申報): https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg031224/ch04/type3/gov30/num12/Eg.htm  as of 2026-10-10
    tax: {
      '115': { exemption: 101000, exemption70: 151500, standard: 136000, standardMarried: 272000, salaryDeduction: 227000,
        brackets: [[610000, 0.05, 0], [1380000, 0.12, 42700], [2770000, 0.20, 153100], [5190000, 0.30, 430100], [Infinity, 0.40, 949100]] },
      '114': { exemption: 97000, exemption70: 145500, standard: 131000, standardMarried: 262000, salaryDeduction: 218000,
        brackets: [[590000, 0.05, 0], [1330000, 0.12, 41300], [2660000, 0.20, 147700], [4980000, 0.30, 413700], [Infinity, 0.40, 911700]] }
    },
    // 加班費倍率（勞基法第24條、第39條）
    overtime: { first2: 4 / 3, next2: 5 / 3, rest9to12: 8 / 3 },
    // 資遣費新制（勞工退休金條例第12條）：每滿一年 0.5 個月，最高 6 個月
    severancePerYear: 0.5,
    severanceMaxMonths: 6
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.RATES = R;
})(this);
