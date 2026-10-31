/* 护照用中翻英（中国大陆规则）：姓名依 GB/T 28039-2011 5.1.6/6.2 与国家移民管理局 Ü 打印规则；地址按大陆常用英文地址格式（拼音规则）。需先载入 passport-dict.js、passport.js。jisuanle.com */
(function(G){
'use strict';
var P=G.PP;
// 姓氏读音（多音字姓）
var SUR={'曾':'zeng','單':'shan','仇':'qiu','區':'ou','解':'xie','樂':'yue','查':'zha','尉':'wei','繆':'miao','任':'ren','沈':'shen','盛':'sheng','重':'chong','華':'hua','葛':'ge','蓋':'ge','員':'yun','秘':'bi','覃':'qin','召':'shao','隗':'wei','燕':'yan','宿':'su','種':'chong','祭':'zhai','費':'fei','那':'na','冼':'xian','闞':'kan','句':'gou','卜':'bu','薄':'bo','翟':'zhai','臧':'zang','莘':'shen','柏':'bai','朝':'chao','曲':'qu','都':'du','番':'pan','長':'chang','行':'xing','參':'can','乜':'nie','朴':'piao','黑':'hei','車':'che','褚':'chu','石':'shi','令':'ling','折':'she','角':'jue','佘':'she','吳':'wu','呂':'lv','余':'yu','涂':'tu','紀':'ji','賈':'jia','繁':'po','藺':'lin','廖':'liao','游':'you','鍾':'zhong','鐘':'zhong','柯':'ke','易':'yi','邵':'shao','溫':'wen','和':'he','謝':'xie','薛':'xue','許':'xu','葉':'ye','叶':'ye','万俟':'mo-qi','尉遲':'yu-chi','長孫':'zhang-sun','澹臺':'tan-tai','澹台':'tan-tai','令狐':'ling-hu','單于':'chan-yu','區':'ou','杜':'du','能':'nai'};
var COMP='歐陽 司馬 諸葛 上官 東方 皇甫 公孫 令狐 夏侯 慕容 司徒 長孫 尉遲 宇文 端木 西門 鍾離 申屠 獨孤 南宮 聞人 万俟 軒轅 澹臺 澹台 公羊 太史 呼延 赫連 司空 第五 百里 左丘 東郭 濮陽 宗政 拓跋 鮮于 閭丘 公冶 單于'.split(' ');
// 护照拼写：无声调、无隔音符号；lü/nü → LYU/NYU，lüe/nüe → LUE/NUE（国家移民管理局公告）；ju/qu/xu/yu 本来就写 u
function pp(py){ return py.replace(/^([ln])ve$/,'$1ue').replace(/^([ln])v/,'$1yu').replace(/v/g,'u').toUpperCase(); }
function name(full,o){ o=o||{}; full=P.s2t(String(full).replace(/[\s,，、．.·]/g,'')); var n=o.mode==='2'?2:o.mode==='1'?1:(full.length>=3&&COMP.indexOf(full.slice(0,2))>=0?2:1);
  var s=full.slice(0,n), g=full.slice(n), sp=SUR[s]?SUR[s].split('-'):s.split('').map(function(c){return SUR[c]||(P.readings(c)[0]||'?');});
  var picks=o.picks||{}, poly=[], gs=[];
  for(var i=0;i<g.length;i++){ var rs=P.readings(g.charAt(i)), k=picks[i]!=null&&rs[picks[i]]?picks[i]:0; if(rs.length>1) poly.push({i:i,ch:g.charAt(i),opts:rs.map(pp),py:rs,sel:k}); gs.push(rs.length?pp(rs[k]):'?'); }
  var S=sp.map(function(p){return p==='?'?'?':pp(p);}).join(''), N=gs.join('');
  var cap=function(x){return x.charAt(0)+x.slice(1).toLowerCase();};
  return {sur:s,given:g,S:S,G:N,text:S+(N?' '+N:''),comma:S+(N?', '+N:''),western:(N?cap(N)+' ':'')+cap(S),poly:poly}; }

// ---------- 地址 ----------
var PROV={'北京':'Beijing','天津':'Tianjin','上海':'Shanghai','重慶':'Chongqing','河北':'Hebei','山西':'Shanxi','遼寧':'Liaoning','吉林':'Jilin','黑龍江':'Heilongjiang','江蘇':'Jiangsu','浙江':'Zhejiang','安徽':'Anhui','福建':'Fujian','江西':'Jiangxi','山東':'Shandong','河南':'Henan','湖北':'Hubei','湖南':'Hunan','廣東':'Guangdong','海南':'Hainan','四川':'Sichuan','貴州':'Guizhou','雲南':'Yunnan','陝西':'Shaanxi','甘肅':'Gansu','青海':'Qinghai','內蒙古':'Inner Mongolia','廣西':'Guangxi','西藏':'Xizang (Tibet)','寧夏':'Ningxia','新疆':'Xinjiang','香港':'Hong Kong','澳門':'Macao'};
// 常见多音地名
var PLACE={'重慶':'Chongqing','廈門':'Xiamen','長沙':'Changsha','長春':'Changchun','長寧':'Changning','長安':"Chang'an",'蚌埠':'Bengbu','六安':"Lu'an",'東莞':'Dongguan','番禺':'Panyu','朝陽':'Chaoyang','西安':"Xi'an",'樂山':'Leshan','曲阜':'Qufu','大廈':'Dasha','解放':'Jiefang','長江':'Changjiang','長樂':'Changle','行政':'Xingzheng','和平':'Heping','單縣':'Shan County','莘縣':'Shen County','都江堰':'Dujiangyan','麗水':'Lishui','丹東':'Dandong','臺州':'Taizhou','台州':'Taizhou','銀行':'Yinhang','中關村':'Zhongguancun','浦東':'Pudong','世紀':'Shiji','南山':'Nanshan','科技園':'Kejiyuan'};
var CN={'零':0,'〇':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function cnum(s){ if(/^\d+$/.test(s)) return +s; var t=0,c=0; for(var i=0;i<s.length;i++){ var x=s.charAt(i); if(x in CN) c=CN[x]; else if(x==='十'){t+=(c||1)*10;c=0;} else if(x==='百'){t+=(c||1)*100;c=0;} else if(x==='千'){t+=(c||1)*1000;c=0;} } return t+c; }
var NUM='[0-9一二三四五六七八九十百千零〇兩]+';
function ord(n){ var s=['th','st','nd','rd'],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
// 地名拼音：连写，开头大写，有歧义的音节界限加隔音符号（GB/T 16159：Xi'an）
function py(w){ if(PLACE[w]) return PLACE[w]; var o=''; for(var i=0;i<w.length;i++){ var c=w.charAt(i), r=PLACE[c]||P.readings(c)[0]; if(!r){ o+=c; continue; } r=r.replace(/^([ln])v/,'$1ü').replace(/v/g,'u'); o+=(o&&/^[aoe]/.test(r)?"'":'')+r; } return o.charAt(0).toUpperCase()+o.slice(1); }
function pyLong(w){ // 先找最长的已知多音地名
  for(var k in PLACE){ var i=w.indexOf(k); if(i>=0) return (i?pyJoin(py(w.slice(0,i)),PLACE[k]):PLACE[k]).replace(/^(.)/,function(c){return c.toUpperCase();})+(w.slice(i+k.length)?pyLong(w.slice(i+k.length)).toLowerCase().replace(/^([aoe])/,"'$1"):''); }
  return py(w); }
function pyJoin(a,b){ return a+(/^[aoe]/i.test(b)?"'":'')+b.toLowerCase(); }
var DIR={'東':'East','西':'West','南':'South','北':'North','中':'Middle'};
function road(r){ var m=r.match(/^(.*?)(東|西|南|北|中)?(路|街|大道|大街|道|巷|弄|胡同)$/); if(!m||!m[1]) return pyLong(r);
  var b=m[1],o='',mm=b.match(new RegExp('^(.+?)('+NUM+')$')); if(mm){ b=mm[1]; o=' '+ord(cnum(mm[2])); }
  return pyLong(b)+o+(m[2]?' '+DIR[m[2]]:'')+' '+{'路':'Road','街':'Street','大道':'Avenue','大街':'Street','道':'Road','巷':'Lane','弄':'Lane','胡同':'Hutong'}[m[3]]; }
function addr(src){ var s=P.s2t(String(src)).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248);}).replace(/[\s,，]/g,'').replace(/^中國/,''), W=[], out=[], zip='', m;
  m=s.match(/(\d{6})$/)||s.match(/^(\d{6})/); if(m){ zip=m[1]; s=s.replace(zip,''); }
  var prov='',city='',dist='',town='';
  for(var k in PROV){ var re=new RegExp('^'+k+'(省|市|壯族自治區|回族自治區|維吾爾自治區|自治區|特別行政區)?'); m=s.match(re); if(m){ prov=PROV[k]; s=s.slice(m[0].length); break; } }
  m=s.match(/^(.{2,8}?)(自治州|地區|盟|市)/); if(m&&!/[路街號]/.test(m[1])){ city=pyLong(m[1])+(m[2]==='自治州'?' Autonomous Prefecture':m[2]==='地區'?' Prefecture':m[2]==='盟'?' League':''); s=s.slice(m[0].length); }
  m=s.match(/^(.{1,6}?)(新區|自治縣|區|縣|旗)/); if(m&&!/[路街號]/.test(m[1])){ dist=pyLong(m[1])+{'新區':' New Area','自治縣':' Autonomous County','區':' District','縣':' County','旗':' Banner'}[m[2]]; s=s.slice(m[0].length); }
  m=s.match(/^(.{1,6}?)(街道|鎮|鄉)/); if(m&&!/[路街號]/.test(m[1])){ town=pyLong(m[1])+{'街道':' Subdistrict','鎮':' Town','鄉':' Township'}[m[2]]; s=s.slice(m[0].length); }
  var rd='',no='',yard='',bld='',unit='',fl='',rm='';
  m=s.match(new RegExp('^(.+?(?:路|大街|街|大道|道|巷|弄|胡同))(?='+NUM+'|$)')); if(m){ rd=road(m[1]); s=s.slice(m[1].length); }
  m=s.match(new RegExp('^('+NUM+')(?:之('+NUM+'))?號(院)?')); if(m){ no=cnum(m[1])+(m[2]?'-'+cnum(m[2]):''); s=s.slice(m[0].length); }
  m=s.match(new RegExp('^('+NUM+')(?:號樓|棟|幢|座)')); if(m){ bld=cnum(m[1]); s=s.slice(m[0].length); }
  m=s.match(new RegExp('^('+NUM+')單元')); if(m){ unit=cnum(m[1]); s=s.slice(m[0].length); }
  m=s.match(new RegExp('^('+NUM+')(?:層|樓)')); if(m){ fl=cnum(m[1]); s=s.slice(m[0].length); }
  m=s.match(new RegExp('^('+NUM+')(?:室|房|號房)?$')); if(m&&s){ rm=cnum(m[1]); s=''; }
  var rest=s; if(rest&&!rd&&!no){ /* 例如 科技园、某小区 */ }
  function add(en,what){ if(en) out.push({en:en,what:what}); }
  add(rm&&'Room '+rm,'室 Room'); add(fl&&(ord(fl)+' Floor'),'层 Floor'); add(unit&&'Unit '+unit,'单元 Unit'); add(bld&&'Building '+bld,'栋／号楼 Building');
  add(rest&&pyLong(rest.replace(/(小區|大廈|花園|園區)$/,'')) + ({'小區':' Residential Community','大廈':' Building','花園':' Garden','園區':' Park'}[(rest.match(/(小區|大廈|花園|園區)$/)||[])[1]]||''),'小区／大厦等名称（拼音）');
  add(no&&rd?'No. '+no+' '+rd:(rd||(no&&'No. '+no)),'门牌号＋道路');
  add(town,'街道／镇／乡'); add(dist,'区／县'); add(city,'市'); add(prov,'省／直辖市／自治区');
  if(!prov&&!city) W.push('没有识别到省或市，请以省／直辖市开头');
  if(rest) W.push('“'+rest+'”按拼音直译，请自行核对');
  var text=out.map(function(p){return p.en;}).join(', ')+(zip?' '+zip:'')+', China';
  return {text:text,parts:out.concat([{en:(zip?zip+' ':'')+'China',what:'邮编＋国家'}]),warn:W}; }

var API={name:name,addr:addr}; G.PPCN=API; if(typeof module!=='undefined') module.exports=API;
if(typeof document==='undefined') return;
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function cp(t){ return '<button type="button" class="secondary pp-copy" data-copy="'+esc(t)+'">📋 复制</button>'; }
document.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('.pp-copy'); if(!b||!$('cnname')) return; var t=b.getAttribute('data-copy'), done=function(){ var o=b.textContent; b.textContent='✅ 已复制'; setTimeout(function(){b.textContent=o;},1500); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,fb); else fb();
  function fb(){ var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');done();}catch(_){} ta.remove(); } });
var picks={};
function runName(){ var v=$('cnname').value.trim(), out=$('cnnameout'); if(!v){ out.innerHTML='<p class="note">请输入中文姓名，例如：陈大文</p>'; return; }
  var r=name(v,{mode:$('cnmode').value,picks:picks});
  var h='<p class="big" style="font-size:1.5rem"><b>'+esc(r.text)+'</b> '+cp(r.text)+'</p><div class="overflow-auto"><table><tr><th>用途</th><th>写法</th><th></th></tr><tr><td>护照「姓 Surname」栏</td><td><b>'+esc(r.S)+'</b></td><td>'+cp(r.S)+'</td></tr><tr><td>护照「名 Given names」栏</td><td><b>'+esc(r.G)+'</b></td><td>'+cp(r.G)+'</td></tr><tr><td>表格「姓, 名」</td><td><b>'+esc(r.comma)+'</b></td><td>'+cp(r.comma)+'</td></tr><tr><td>西方习惯（名在前）</td><td><b>'+esc(r.western)+'</b></td><td>'+cp(r.western)+'</td></tr></table></div>';
  if(r.poly.length){ h+='<p class="note">以下是<b>多音字</b>，请选择你名字的实际读音：</p>'; r.poly.forEach(function(p){ h+='<div class="f"><label>“'+esc(p.ch)+'”的读音</label><select data-i="'+p.i+'" class="cnpick">'+p.opts.map(function(o,j){return '<option value="'+j+'"'+(j===p.sel?' selected':'')+'>'+esc(o)+'（'+esc(p.py[j].replace('v','ü'))+'）</option>';}).join('')+'</select></div>'; }); }
  out.innerHTML=h; }
function runAddr(){ var v=$('cnaddr').value.trim(), out=$('cnaddrout'); if(!v){ out.innerHTML='<p class="note">请输入中文地址，例如：北京市朝阳区建国路88号院3号楼2单元1501室</p>'; return; }
  var r=addr(v), h='<p class="big" style="font-size:1.25rem"><b>'+esc(r.text)+'</b> '+cp(r.text)+'</p>';
  if(r.warn.length) h+='<ul class="note">'+r.warn.map(function(w){return '<li>⚠️ '+esc(w)+'</li>';}).join('')+'</ul>';
  h+='<div class="overflow-auto"><table><tr><th>英文</th><th>说明</th></tr>'+r.parts.map(function(p){return '<tr><td><b>'+esc(p.en)+'</b></td><td><small>'+esc(p.what)+'</small></td></tr>';}).join('')+'</table></div>'; out.innerHTML=h; }
function init(){ if(!$('cnname')) return; $('cnname').addEventListener('input',function(){picks={};runName();}); $('cnmode').addEventListener('change',runName);
  $('cnnameout').addEventListener('change',function(e){ if(e.target.classList.contains('cnpick')){ picks[e.target.getAttribute('data-i')]=+e.target.value; runName(); } });
  $('cnaddr').addEventListener('input',runAddr); document.querySelectorAll('[data-cnex]').forEach(function(b){ b.addEventListener('click',function(){ var k=b.getAttribute('data-cnk'); $(k).value=b.getAttribute('data-cnex'); picks={}; k==='cnname'?runName():runAddr(); }); });
  runName(); runAddr(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})(typeof globalThis!=='undefined'?globalThis:window);
