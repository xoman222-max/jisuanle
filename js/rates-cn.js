/* 中国大陆费率与常量 —— 每年更新只改此文件
 * 数据更新日期 (as of): 2026-10-10
 */
(function (root) {
  var R = {
    updated: '2026-10-10',
    // 个人所得税：综合所得年度税率表（个人所得税法），基本减除费用 5000元/月
    // 来源: http://www.chinatax.gov.cn/ (个人所得税法、累计预扣法) as of 2026-10-10
    threshold: 5000,
    annualBrackets: [[36000, 0.03, 0], [144000, 0.10, 2520], [300000, 0.20, 16920], [420000, 0.25, 31920], [660000, 0.30, 52920], [960000, 0.35, 85920], [Infinity, 0.45, 181920]],
    // 年终奖单独计税：按月度换算税率表；政策延续至 2027-12-31（财政部 税务总局公告2023年第30号）
    // 来源: https://www.chinatax.gov.cn/chinatax/n810341/n810825/c101434/c5211218/content.html  as of 2026-10-10
    bonusSeparateUntil: '2027-12-31',
    monthlyBrackets: [[3000, 0.03, 0], [12000, 0.10, 210], [25000, 0.20, 1410], [35000, 0.25, 2660], [55000, 0.30, 4410], [80000, 0.35, 7160], [Infinity, 0.45, 15160]],
    // 专项附加扣除（每月，国发〔2023〕13号）
    // 来源: https://www.gov.cn/zhengce/content/202308/content_6900595.htm  as of 2026-10-10
    special: { child: 2000, infant: 2000, elderly: 3000, mortgage: 1000, rentT1: 1500, rentT2: 1100, rentT3: 800, education: 400 },
    // 贷款利率：LPR（2026-09-20 公布）1年期 3.0%，5年期以上 3.5%
    // 来源: https://www.zzz.gov.cn/html/xwzx/dtyw/19360.html  as of 2026-10-10
    lpr1y: 3.0, lpr5y: 3.5,
    // 公积金贷款利率（2025-05-08 起）首套：5年以下 2.1%，5年以上 2.6%；二套 2.525% / 3.075%
    // 来源: http://www.pbc.gov.cn/ (2025年5月 下调公积金贷款利率) as of 2026-10-10
    hfFirstShort: 2.1, hfFirstLong: 2.6, hfSecondShort: 2.525, hfSecondLong: 3.075,
    // 加班费倍率（劳动法第44条）；月计薪天数 21.75（劳社部发〔2008〕3号）
    overtime: { weekday: 1.5, restday: 2, holiday: 3 }, payDaysPerMonth: 21.75,
    // 年休假（职工带薪年休假条例第3条）
    annualLeave: [[1, 0], [10, 5], [20, 10], [Infinity, 15]],
    // 五险一金城市参数 —— 注意：以下缴费基数上下限为 2025 年度公布值或近似值，每年 7 月前后调整，
    // 且部分城市各险种基数不同，此处简化为同一基数，请以当地社保局/公积金中心公布为准。（未能逐一核实）
    cities: {
      beijing:  { name: '北京', min: 7162, max: 35811, pension: 0.08, medical: 0.02, medicalFixed: 3, unemployment: 0.005, hfDefault: 0.12,
                  er: { pension: 0.16, medical: 0.098, unemployment: 0.005, injury: 0.002 } },
      shanghai: { name: '上海', min: 7460, max: 37302, pension: 0.08, medical: 0.02, medicalFixed: 0, unemployment: 0.005, hfDefault: 0.07,
                  er: { pension: 0.16, medical: 0.10, unemployment: 0.005, injury: 0.0026 } },
      guangzhou:{ name: '广州', min: 5284, max: 27501, pension: 0.08, medical: 0.02, medicalFixed: 0, unemployment: 0.002, hfDefault: 0.05,
                  er: { pension: 0.15, medical: 0.0655, unemployment: 0.008, injury: 0.002 } },
      shenzhen: { name: '深圳', min: 2520, max: 27501, pension: 0.08, medical: 0.02, medicalFixed: 0, unemployment: 0.003, hfDefault: 0.05,
                  er: { pension: 0.16, medical: 0.06, unemployment: 0.007, injury: 0.002 } },
      hangzhou: { name: '杭州', min: 4812, max: 24930, pension: 0.08, medical: 0.02, medicalFixed: 0, unemployment: 0.005, hfDefault: 0.12,
                  er: { pension: 0.16, medical: 0.095, unemployment: 0.005, injury: 0.002 } },
      chengdu:  { name: '成都', min: 4246, max: 21228, pension: 0.08, medical: 0.02, medicalFixed: 0, unemployment: 0.004, hfDefault: 0.12,
                  er: { pension: 0.16, medical: 0.075, unemployment: 0.006, injury: 0.002 } }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.RATES_CN = R;
})(this);
