/* parallel.js — 中外文明平行对照（v3 横向）· 惰性初始化：切到「对照」视图才构建 chart */
(function(){
'use strict';
'use strict';
/* ============ 数据：18 个地域区域，每区域独立一行 ============
   t=名称, s=开始年(负=公元前), e=结束年, note=悬停知识点；region 由所属区域决定 */
const REGIONS = [
  { r:'中国', color:'#a86b5c', items:[
    {t:'仰韶文化', s:-5000, e:-3000, note:'黄河中游，半坡遗址，彩陶文化（距今约7000-5000年）'},
    {t:'河姆渡文化', s:-5000, e:-3300, note:'长江下游，稻作农业，干栏式建筑（距今约7000-5300年）'},
    {t:'大汶口文化', s:-4300, e:-2500, note:'黄河下游山东，龙山文化的前身（距今约6300-4500年）'},
    {t:'良渚文化', s:-3300, e:-2300, note:'长江下游，玉器/古城/水利系统（距今约5300-4300年）'},
    {t:'龙山文化', s:-2500, e:-2000, note:'山东龙山文化是大汶口文化的延续，据碳14法测定其年代距今约4500—4000年'},
    {t:'夏', s:-2070, e:-1600},
    {t:'商', s:-1600, e:-1046},
    {t:'西周', s:-1046, e:-771},
    {t:'春秋', s:-770, e:-476},
    {t:'战国', s:-475, e:-221},
    {t:'秦', s:-221, e:-207},
    {t:'西汉', s:-202, e:8},
    {t:'东汉', s:25, e:220},
    {t:'三国', s:220, e:280},
    {t:'西晋', s:265, e:316},
    {t:'东晋十六国', s:317, e:420},
    {t:'北魏', s:386, e:534, note:'386拓跋珪建北魏，439统一北方，494迁都洛阳、孝文帝汉化改革，534分裂为东魏西魏（教材）'},
    {t:'刘宋', s:420, e:479, note:'420刘裕建宋，南朝之始（教材）'},
    {t:'萧齐', s:479, e:502, note:'479萧道成建齐（教材）'},
    {t:'萧梁', s:502, e:557, note:'502萧衍建梁，侯景之乱（教材）'},
    {t:'东魏·西魏', s:534, e:556, note:'534高欢立东魏、535宇文泰立西魏（教材）'},
    {t:'北齐', s:550, e:577, note:'550高洋建北齐，577为北周所灭（教材）'},
    {t:'北周', s:557, e:581, note:'557宇文觉建北周，577灭北齐统一北方，581为隋代（教材）'},
    {t:'陈', s:557, e:589, note:'557陈霸先建陈，南朝最后王朝，589为隋灭（教材）'},
    {t:'隋', s:581, e:618},
    {t:'唐', s:618, e:907},
    {t:'五代十国', s:907, e:960},
    {t:'辽', s:916, e:1125, note:'916耶律阿保机称帝建契丹国，947改国号辽（教材"契丹建国916"），1125为金所灭'},
    {t:'北宋', s:960, e:1127},
    {t:'西夏', s:1038, e:1227, note:'1038元昊称帝建夏（通行史实），与宋辽金并立，1227为蒙古所灭'},
    {t:'金', s:1115, e:1234, note:'1115完颜阿骨打建金，1125灭辽、1127灭北宋，1234宋蒙联合灭金（教材）'},
    {t:'南宋', s:1127, e:1279},
    {t:'元', s:1271, e:1368},
    {t:'明', s:1368, e:1644},
    {t:'清', s:1644, e:1912, note:'清军入关定都北京（1644）至辛亥革命（1912）；含鸦片战争后晚清（1840-1912）'},
    {t:'中华民国', s:1912, e:1949, note:'1912中华民国成立（北洋政府时期）→1927南京国民政府→1949败退台湾'},
    {t:'中华人民共和国', s:1949, e:2000, note:'1949年10月1日开国，页面范围截止2000'},
  ]},
  { r:'埃及', color:'#b3925f', items:[
    {t:'前王朝时期', s:-4000, e:-3100, note:'涅伽达文化Ⅰ（约前4000-前3500）、Ⅱ（约前3500-前3100），国家产生（教材第02章第一节）'},
    {t:'早王朝', s:-3100, e:-2686, note:'第1-2王朝，美尼斯统一（前3100），建都孟斐斯'},
    {t:'古王国时期', s:-2686, e:-2181, note:'第3-6王朝，金字塔时期，胡夫金字塔最大'},
    {t:'第一中间期', s:-2181, e:-2040, note:'第7-10王朝，分裂混乱，第一次贫民奴隶起义'},
    {t:'中王国时期', s:-2040, e:-1786, note:'第11-12王朝，底比斯重新统一'},
    {t:'第二中间期', s:-1786, e:-1570, note:'第13-17王朝，喜克索斯人统治（约前1720起）'},
    {t:'新王国时期', s:-1570, e:-1085, note:'第18-20王朝，埃赫那吞改革、拉美西斯二世'},
    {t:'后期埃及', s:-1085, e:-525, note:'第21-26王朝（利比亚·舍易斯时期），前525为波斯征服'},
    {t:'波斯统治埃及', s:-525, e:-332, note:'阿契美尼德王朝统治（第27-31王朝），冈比西前525征服埃及（教材第06章）'},
    {t:'托勒密王朝', s:-305, e:-30, note:'托勒密一世前305称王，克娄巴特拉七世，前30为罗马所灭（教材第09章）'},
    {t:'罗马统治埃及', s:-30, e:395, note:'前30屋大维并埃及为罗马行省，395帝国分裂归东罗马（教材第12-14章）'},
    {t:'拜占庭统治', s:395, e:641, note:'东罗马（拜占廷）统治埃及，641为阿拉伯人征服（古代史编·下第05章）'},
    {t:'阿拉伯行省', s:641, e:868, note:'倭马亚/阿拔斯帝国行省，641阿慕尔征服埃及（古代史编·下第04章）'},
    {t:'图伦·伊赫什德', s:868, e:969, note:'9世纪中叶埃及渐摆脱阿拔斯（图伦王朝868-905、伊赫什德935-969）（古代史编·下第08章）'},
    {t:'法蒂玛王朝', s:969, e:1171, note:'埃及作为完全独立的国家始于此（古代史编·下第08章）'},
    {t:'阿尤布王朝', s:1171, e:1250, note:'萨拉丁灭法蒂玛，1187收复耶路撒冷（古代史编·下第08章）'},
    {t:'马穆鲁克王朝', s:1250, e:1517, note:'奴隶骑兵（马穆鲁克）夺权，1260败蒙古于艾因贾鲁（古代史编·下第08章）'},
    {t:'奥斯曼统治', s:1517, e:1914, note:'塞利姆一世1517灭马穆鲁克，1914埃及成英国保护国（古代史编·下第08章）'},
    {t:'埃及王国', s:1922, e:1953, note:'1922埃及名义独立建国（法鲁克王朝），1953推翻王室（近代史编·下）'},
    {t:'埃及共和国', s:1953, e:2000, note:'纳赛尔1952革命后1953建共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'两河', color:'#6e9485', items:[
    {t:'苏美尔文明的发生', s:-4300, e:-2800, note:'欧贝德/乌鲁克/捷姆迭特·那色文化期，约前4300年进入铜石并用时代（教材第02章第一节）'},
    {t:'苏美尔城邦', s:-2800, e:-2371},
    {t:'阿卡德王国', s:-2371, e:-2191, note:'萨尔贡建立，约前2191为库提人所灭'},
    {t:'乌尔第三王朝', s:-2113, e:-2006, note:'教材第02章第四节；乌尔纳木颁行《乌尔纳木法典》'},
    {t:'伊辛-拉尔萨时期', s:-2006, e:-1763, note:'乌尔第三王朝灭亡后诸邦分立（伊新/拉尔萨/马里/埃什嫩那），至汉谟拉比统一'},
    {t:'古巴比伦王国', s:-1894, e:-1595, note:'巴比伦第一王朝，汉谟拉比法典，前1595为赫梯所灭'},
    {t:'海国王朝', s:-1595, e:-1460, note:'巴比伦第二王朝，古巴比伦灭亡后兴起于沿海，为加喜特人所灭'},
    {t:'中巴比伦', s:-1460, e:-1155, note:'加喜特人统治的巴比伦尼亚（巴比伦第三王朝），约前1460灭海国统一，前1155为埃兰所灭'},
    {t:'早期亚述', s:-2000, e:-1365, note:'古亚述时期（约数），含沙马什阿达德一世（前1813-前1781）；与巴比伦尼亚并行'},
    {t:'中期亚述', s:-1365, e:-1000, note:'前15世纪末叶强盛（亚舒尔乌巴里特一世），前11世纪受阿拉美亚人打击削弱'},
    {t:'亚述帝国', s:-1000, e:-612, note:'新亚述，前10世纪末叶起扩张，前612尼尼微陷落'},
    {t:'新巴比伦王国', s:-626, e:-539, note:'迦勒底人建国（前626），尼布甲尼撒二世、巴比伦之囚，前539为居鲁士征服'},
    {t:'波斯统治两河', s:-539, e:-332, note:'阿契美尼德行省（巴比伦尼亚），前539居鲁士占巴比伦'},
    {t:'塞琉古王国', s:-305, e:-64, note:'塞琉古一世前305称王，前64亡于罗马庞培（教材第09章）'},
    {t:'安息统治两河', s:-141, e:224, note:'帕提亚（安息）密特里达特一世约前141占巴比伦尼亚，224为萨珊所灭'},
    {t:'萨珊统治两河', s:224, e:651, note:'萨珊波斯核心区含两河，651为阿拉伯人所灭'},
    {t:'阿拉伯帝国统治', s:651, e:1258, note:'卡迪西亚之役（637）后两河入阿拉伯，阿拔斯定都巴格达（762），1258蒙古灭'},
    {t:'伊尔汗国', s:1258, e:1335, note:'旭烈兀灭阿拔斯后蒙古统治两河（教材古代史编·下第07章）'},
    {t:'奥斯曼统治', s:1534, e:1917, note:'苏莱曼一世1534占巴格达，两河（伊拉克）归奥斯曼至一战后'},
    {t:'伊拉克王国', s:1921, e:1958, note:'一战后英国委任统治下1921建国（费萨尔王朝），1958革命废除（近代史编·下）'},
    {t:'伊拉克共和国', s:1958, e:2000, note:'1958七月革命后建共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'希腊', color:'#877ca3', items:[
    {t:'克里特文明', s:-2000, e:-1450, note:'米诺斯文明（爱琴文明）'},
    {t:'迈锡尼文明', s:-1450, e:-1100, note:'爱琴文明'},
    {t:'荷马时代', s:-1100, e:-800},
    {t:'古风时代', s:-800, e:-500, note:'城邦形成与海外殖民、斯巴达/雅典形成、梭伦改革（前594）（教材第08章第一节）'},
    {t:'古典时代', s:-500, e:-338, note:'希波战争、伯罗奔尼撒战争（前431-前404）、雅典民主全盛；前338喀罗尼亚战役后城邦失去独立（教材第08章二、三节）'},
    {t:'马其顿时期', s:-359, e:-323, note:'腓力二世改革（前359-前336）、亚历山大东征（前334-前323）（教材第09章）'},
    {t:'希腊化时代', s:-323, e:-30, note:'亚历山大死后继业者王国（托勒密/塞琉古/安提柯），前30最后希腊化王国亡于罗马'},
    {t:'罗马统治希腊', s:-146, e:395, note:'前146希腊全境落入罗马统治（科林斯被毁），设亚该亚行省；395帝国分裂归东罗马（教材第09/12章）'},
    {t:'拜占庭统治', s:395, e:1453, note:'东罗马（拜占廷）统治希腊，1453君士坦丁堡陷落（古代史编·下第05章）'},
    {t:'奥斯曼统治', s:1453, e:1830, note:'奥斯曼征服拜占廷后统治希腊，1821起义、1830独立（近代史编·上）'},
    {t:'希腊王国', s:1832, e:1974, note:'1832伦敦会议定希腊王国，1974共和制确立（近代史编·上）'},
    {t:'希腊共和国', s:1974, e:2000, note:'1974废除君主制，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'罗马', color:'#9d7a6b', items:[
    {t:'王政时代', s:-753, e:-510},
    {t:'罗马共和国', s:-509, e:-27},
    {t:'罗马帝国', s:-27, e:476, note:'前27屋大维建元首制（罗马帝国始），西罗马476灭亡'},
    {t:'东哥特王国', s:493, e:553, note:'狄奥多里克建东哥特王国（493），553为查士丁尼所灭（古代史编·下第01/05章）'},
    {t:'拜占庭统治', s:553, e:751, note:'查士丁尼收复意大利，伦巴第入侵后仅存拉文纳总督区至751（古代史编·下第05章）'},
    {t:'伦巴第王国', s:568, e:774, note:'伦巴第人568入侵意大利，774为查理曼所灭（古代史编·下第05/06章）'},
    {t:'法兰克·加洛林统治', s:774, e:887, note:'查理曼灭伦巴第（774），800加冕称帝；887加洛林帝国分裂（古代史编·下第06章）'},
    {t:'教皇国', s:756, e:1870, note:'矮子丕平献土（756）奠定教皇国基础，1870意大利统一罗马（古代史编·下第06章）'},
    {t:'神圣罗马帝国', s:962, e:1806, note:'奥托一世962加冕为帝，意大利北部属神罗；1806拿破仑解散（古代史编·下第10章）'},
    {t:'意大利王国', s:1861, e:1946, note:'撒丁王国统一意大利（1861），1922墨索里尼上台，1946废除君主制（近代史编·下）'},
    {t:'意大利共和国', s:1946, e:2000, note:'1946年6月全民公决建共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'英国', color:'#6f88ab', items:[
    {t:'诺曼王朝', s:1066, e:1154, note:'诺曼底公爵威廉1066征服英国（教材：诺曼王朝1066-1154，古代史编·下第06/10章）'},
    {t:'金雀花王朝', s:1154, e:1399, note:'1154亨利二世即位（教材：金雀花/安如王朝1154-1399，《大宪章》1215，古代史编·下第06章）'},
    {t:'玫瑰战争', s:1455, e:1485, note:'兰开斯特与约克两派内战（教材：玫瑰战争1455-1485，古代史编·下第10章）'},
    {t:'都铎王朝', s:1485, e:1603, note:'1485都铎开国，亨利八世宗教改革、伊丽莎白一世（教材：都铎王朝1485-1603，近代史编·上第01章）'},
    {t:'斯图亚特王朝', s:1603, e:1649, note:'1603詹姆斯一世即位，1649查理一世被送上断头台（教材：近代史编·上第02章）'},
    {t:'英吉利共和国', s:1649, e:1660, note:'1649英吉利共和国建立，克伦威尔护国公，1660复辟（教材：近代史编·上第02章）'},
    {t:'斯图亚特复辟', s:1660, e:1714, note:'1660查理二世复辟，1688光荣革命确立君主立宪（教材：近代史编·上第02章）'},
    {t:'汉诺威王朝', s:1714, e:1901, note:'1714乔治一世入主（源自德意志汉诺威选侯），维多利亚时代1837-1901（教材：近代史编·上第02章；止年通行史实）'},
    {t:'温莎王朝', s:1910, e:2000, note:'1910乔治五世改称温莎王朝，页面范围截止2000（通行史实）'},
  ]},
  { r:'法国', color:'#50698f', items:[
    {t:'墨洛温王朝', s:481, e:751, note:'克洛维481建法兰克王国（教材：墨洛温王朝481-751，古代史编·下第06章）'},
    {t:'加洛林王朝', s:751, e:987, note:'丕平751即位，查理曼帝国（768-814），843凡尔登三分（教材：加洛林王朝751-987，古代史编·下第06章）'},
    {t:'卡佩王朝', s:987, e:1328, note:'987休·加佩即位（教材作"加佩王朝987-1328"，1302三级会议，古代史编·下第06/10章）'},
    {t:'瓦卢瓦王朝', s:1328, e:1589, note:'1328腓力六世即位（教材作"瓦罗亚1328-1589"），百年战争1337-1453（古代史编·下第10章）'},
    {t:'波旁王朝', s:1589, e:1792, note:'1589亨利四世即位，路易十四专制顶峰，1789大革命爆发（教材：近代史编·上第01/02/03章）'},
    {t:'法兰西第一共和国', s:1792, e:1804, note:'1792国民公会建共和，雅各宾专政、热月督政府（教材：近代史编·上第03章）'},
    {t:'拿破仑第一帝国', s:1804, e:1814, note:'1804拿破仑称帝，1814退位、1815百日王朝（教材：近代史编·上第03章）'},
    {t:'波旁复辟', s:1815, e:1830, note:'1815路易十八复位，1830七月革命推翻（教材：近代史编·上第03章）'},
    {t:'七月王朝', s:1830, e:1848, note:'1830路易·菲利普建金融王朝，1848二月革命推翻（教材：近代史编·上第03章）'},
    {t:'法兰西第二共和国', s:1848, e:1852, note:'1848二月革命建共和，1852路易·波拿巴称帝（教材：近代史编·上第03章）'},
    {t:'第二帝国', s:1852, e:1870, note:'拿破仑三世1852称帝，1870色当战败（教材：近代史编·上第03章、下第04章）'},
    {t:'法兰西第三共和国', s:1870, e:1940, note:'1870巴黎革命建共和，1940战败投降（教材：近代史编·下第04章、现代史编·上第10章）'},
    {t:'维希法国', s:1940, e:1944, note:'贝当傀儡政府，都维希，1944解放（教材：现代史编·上第10章）'},
    {t:'法兰西第四共和国', s:1946, e:1958, note:'1946宪法生效，1958戴高乐建第五共和国（教材：现代史编·下第04章）'},
    {t:'法兰西第五共和国', s:1958, e:2000, note:'1958戴高乐总统制，页面范围截止2000（教材：现代史编·下第04章）'},
  ]},
  { r:'德国', color:'#5c636e', items:[
    {t:'东法兰克/德意志', s:843, e:962, note:'843凡尔登三分，东部发展成日耳曼王国（德国），919萨克森王朝（教材：古代史编·下第06章）'},
    {t:'神圣罗马帝国', s:962, e:1806, note:'962奥托一世加冕，1356黄金诏书定七大选侯，1806拿破仑瓦解（教材：古代史编·下第06/10章、近代史编·上第03章）'},
    {t:'普鲁士王国', s:1701, e:1871, note:'1701腓特烈一世得国王称号，开明专制，1871并入德意志帝国（教材：近代史编·上第02章、下第05章）'},
    {t:'德意志帝国', s:1871, e:1918, note:'俾斯麦铁血政策统一，1871威廉一世称帝，1918十一月革命终结（教材：近代史编·下第05/06章、现代史编·上第02章）'},
    {t:'魏玛共和国', s:1919, e:1933, note:'1919国民会议建共和，恶性通胀、1924-29经济复兴，1933希特勒任总理告终（教材：现代史编·上第05/08章）'},
    {t:'纳粹德国', s:1933, e:1945, note:'1933《授权法》、1934希特勒元首，法西斯专政，1945投降（教材：现代史编·上第08/10章）'},
    {t:'盟军占领', s:1945, e:1949, note:'苏美英法分区占领，柏林危机致分裂（教材：现代史编·下第01/02章）'},
    {t:'两德分裂', s:1949, e:1990, note:'1949联邦德国与民主德国相继成立，1961柏林墙（教材：现代史编·下第02/04章）'},
    {t:'两德统一', s:1990, e:2000, note:'1990.10.3东德并入西德定都柏林，页面范围截止2000（教材：现代史编·下第09章）'},
  ]},
  { r:'俄国', color:'#5d7355', items:[
    {t:'基辅罗斯', s:862, e:1240, note:'862留里克王朝，882定都基辅，1240蒙古攻陷基辅（教材：古代史编·下第05/07章）'},
    {t:'金帐汗国统治', s:1240, e:1480, note:'蒙古钦察汗国（金帐汗国）统治罗斯，1480乌格拉河对峙摆脱（教材：古代史编·下第07/09章）'},
    {t:'莫斯科公国', s:1480, e:1613, note:'伊凡三世统一莫斯科中央集权国家，至罗曼诺夫王朝（教材：古代史编·下第09章）'},
    {t:'俄罗斯帝国', s:1613, e:1917, note:'1613罗曼诺夫王朝，1721彼得一世改国号俄罗斯帝国，1917二月革命推翻（教材：近代史编·上第02章、现代史编·上第02/03章）'},
    {t:'苏俄', s:1917, e:1922, note:'1917.11.7十月革命建苏维埃政权，1918-1920国内战争（教材：现代史编·上第03章）'},
    {t:'苏联', s:1922, e:1991, note:'1922.12.30苏维埃联盟成立，1936斯大林宪法，1991.12解体（教材：现代史编·上第06章、下第09/11章）'},
    {t:'俄罗斯联邦', s:1991, e:2000, note:'1991叶利钦当选总统、苏联解体后独立，页面范围截止2000（教材：现代史编·下第09/11章）'},
  ]},
  { r:'小亚细亚', color:'#9a6a50', items:[
    {t:'赫梯', s:-1650, e:-1180, note:'古王国（穆尔西里一世前1595灭古巴比伦）→新王国帝国时期（与埃及争霸，前1283卡迭石和约）；约前1180亡于海上民族（教材第04章；教材口径另作约前1900-前800）'},
    {t:'弗里吉亚王国', s:-800, e:-676, note:'弥达斯王，被辛梅里安人摧毁，后归属吕底亚（教材第06章）'},
    {t:'吕底亚王国', s:-680, e:-547, note:'克洛伊索斯，前547萨狄斯为居鲁士攻破（教材第06章第二节）'},
    {t:'波斯统治小亚', s:-547, e:-334, note:'阿契美尼德行省，前334亚历山大入侵小亚'},
    {t:'帕加马王国', s:-283, e:-133, note:'阿塔洛斯王朝，前133遗赠罗马（教材第09/12章）'},
    {t:'本都王国', s:-120, e:-63, note:'密特里达提六世与罗马的战争（米特拉达梯战争），前63为庞培所平（教材第12章）'},
    {t:'罗马统治小亚', s:-133, e:395, note:'亚细亚行省（前133起），395帝国分裂归东罗马'},
    {t:'拜占庭统治', s:395, e:1071, note:'东罗马（拜占廷）统治小亚，1071曼齐刻尔特之战败于塞尔柱（古代史编·下第05/08章）'},
    {t:'罗姆苏丹国', s:1077, e:1307, note:'塞尔柱在小亚的苏丹国（首都科尼亚），1307解体'},
    {t:'奥斯曼帝国', s:1299, e:1922, note:'横跨欧亚非，1453灭拜占廷，1922苏丹制废除'},
    {t:'土耳其共和国', s:1923, e:2000, note:'凯末尔1923建土耳其共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'阿拉伯', color:'#4e8d62', items:[
    {t:'阿拉伯帝国', s:632, e:1258, note:'横跨亚非欧，阿拔斯王朝定都巴格达（762），1258蒙古灭'},
    {t:'伊尔汗国', s:1258, e:1335, note:'旭烈兀灭阿拔斯后统治两河（巴格达），1335解体（教材古代史编·下第07章）'},
    {t:'马穆鲁克王朝', s:1260, e:1517, note:'1260艾因贾鲁败蒙古，统治埃及/叙利亚/汉志（麦加麦地那），1260-1517开罗（教材古代史编·下第08章）'},
    {t:'黑羊·白羊王朝', s:1335, e:1508, note:'蒙古解体后两河诸王朝（贾拉伊尔1335-1410、黑羊1410-1468、白羊1468-1508）（通识）'},
    {t:'萨法维统治', s:1508, e:1534, note:'伊斯玛仪一世1508占巴格达，两河归萨法维，1534为奥斯曼所夺（通识）'},
    {t:'奥斯曼统治', s:1517, e:1917, note:'1517塞利姆一世灭马穆鲁克（叙利亚/汉志/埃及），1534占巴格达统一阿拉伯地区，一战后解体（教材古代史编·下第08章）'},
    {t:'现代阿拉伯诸国', s:1917, e:2000, note:'奥斯曼解体后阿拉伯地区分裂为现代诸国（沙特1932/伊拉克1921/叙利亚1946等），页面范围截止2000（近代史编·下）'},
  ]},
  { r:'波斯', color:'#5e8d99', items:[
    {t:'埃兰', s:-2700, e:-549, note:'伊朗高原西南古国（苏撒），前549为居鲁士征服（教材第06章）'},
    {t:'米底王国', s:-650, e:-550, note:'前612与迦勒底结盟灭亚述，前550为居鲁士所灭（教材第06章第二节）'},
    {t:'波斯帝国', s:-550, e:-330, note:'阿契美尼德王朝，居鲁士建国、大流士改革，前330为亚历山大所灭'},
    {t:'塞琉古统治伊朗', s:-312, e:-247, note:'亚历山大死后伊朗属塞琉古王国（教材第09/13章）'},
    {t:'安息帝国', s:-247, e:226, note:'帕提亚（阿尔萨息王朝前247-公元226），密特里达特一世建帝国（教材第13章）'},
    {t:'萨珊波斯', s:224, e:651, note:'阿尔达希尔灭安息建萨珊，651为阿拉伯人所灭'},
    {t:'阿拉伯帝国统治', s:651, e:867, note:'倭马亚/阿拔斯行省，波斯人地位上升；867萨法尔王朝起复兴（教材古代史编·下第04章）'},
    {t:'萨法尔·萨曼王朝', s:867, e:999, note:'波斯人地方王朝（萨法尔867-903、萨曼875-999），波斯文化复兴（教材古代史编·下第04章）'},
    {t:'塞尔柱帝国', s:1037, e:1194, note:'塞尔柱突厥，1055占巴格达（教材古代史编·下第08章）'},
    {t:'花剌子模', s:1194, e:1256, note:'灭塞尔柱，1256为旭烈兀所灭（教材古代史编·下第07章）'},
    {t:'伊尔汗国', s:1256, e:1335, note:'蒙古旭烈兀汗国，1258灭阿拔斯（教材古代史编·下第07章）'},
    {t:'帖木儿帝国', s:1370, e:1507, note:'帖木儿（1370-1405），1402安卡拉之战败奥斯曼，1507为萨法维所灭（教材古代史编·下第07章）'},
    {t:'萨法维王朝', s:1501, e:1736, note:'什叶派波斯，伊斯玛仪一世、阿巴斯大帝（1588-1629）（通识）'},
    {t:'卡扎尔王朝', s:1794, e:1925, note:'恺加王朝（1794-1925），1925礼萨汗夺权（通识）'},
    {t:'巴列维王朝', s:1925, e:1979, note:'礼萨汗1925建巴列维王朝，1979伊斯兰革命推翻（近代史编·下）'},
    {t:'伊朗伊斯兰共和国', s:1979, e:2000, note:'霍梅尼1979建伊斯兰共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'非洲', color:'#9a7040', items:[
    {t:'库施王国', s:-1100, e:400, note:'前12世纪末独立建国（纳巴塔→麦罗埃），4世纪被阿克苏姆征服（教材：古代史编·下第11章）'},
    {t:'阿克苏姆王国', s:50, e:1137, note:'公元前后形成，4世纪极盛，7世纪后衰落，约1137为札格维王朝取代（教材：古代史编·下第11章）'},
    {t:'加纳帝国', s:700, e:1240, note:'8世纪已有史料记载的西非黄金国，1240被马里征服（教材：古代史编·下第11章）'},
    {t:'桑海帝国', s:850, e:1680, note:'9世纪占加奥建国，1462-1492索尼·阿里强盛，1590摩洛哥入侵，1680亡（教材：古代史编·下第11章）'},
    {t:'马里帝国', s:1235, e:1650, note:'1235松迪亚塔建马里，曼萨·穆萨（1307-1332）极盛，17世纪中叶被班巴拉征服（教材：古代史编·下第11章）'},
    {t:'埃塞俄比亚', s:1137, e:1974, note:'1137札格维、1270所罗门王朝，19世纪末抗意、1941光复，1974帝国终结（教材：古代史编·下第11章、现代史编·下第10章）'},
    {t:'欧洲殖民非洲', s:1870, e:1960, note:'19世纪70年代列强加速瓜分，1884-85柏林会议，1900已占90.4%，1960"非洲年"独立浪潮（教材：近代史编·下第06章、现代史编·下第05章）'},
    {t:'非洲民族独立', s:1957, e:1990, note:'1957加纳首个独立、1960年17国独立，1990纳米比亚独立完成非殖民化（教材：现代史编·下第05章）'},
  ]},
  { r:'印度', color:'#a8915e', items:[
    {t:'印度河流域文明', s:-2500, e:-1750, note:'哈拉巴文化（摩亨佐·达罗），约前2500-前1750（教材第03章）'},
    {t:'吠陀时代', s:-1500, e:-600, note:'雅利安人进入印度，早期/后期吠陀（教材第07章）'},
    {t:'列国时代', s:-600, e:-400, note:'十六国并立，佛教创立（前6世纪）、耆那教（教材第07章）'},
    {t:'孔雀帝国', s:-324, e:-187, note:'旃陀罗笈多、阿育王（前268-前232），佛教鼎盛（教材第07章）'},
    {t:'巽伽王朝', s:-187, e:-75, note:'孔雀帝国灭亡后北印度王朝（约前187-前75）（教材第13章）'},
    {t:'贵霜帝国', s:15, e:375, note:'大月氏贵霜翕侯，丘就却约公元16年建贵霜，迦腻色迦鼎盛，3世纪中衰、375灭亡（教材第13章）'},
    {t:'笈多王朝', s:320, e:540, note:'旃陀罗笈多一世建（320-540年），印度教复兴、笈多文化黄金时代（教材古代史编·下第03章）'},
    {t:'戒日王朝', s:606, e:647, note:'戒日王（606-647年在位），玄奘访印（教材古代史编·下第03章）'},
    {t:'拉其普特诸国', s:647, e:1206, note:'戒日王死后北印度分裂，拉其普特诸王朝并立（教材古代史编·下第03章）'},
    {t:'德里苏丹国', s:1206, e:1526, note:'古尔王朝灭后建（1206），突厥-阿富汗诸王朝，1526帕尼帕特战役亡于巴布尔（教材古代史编·下第08章）'},
    {t:'莫卧儿帝国', s:1526, e:1857, note:'巴布尔建（1526），阿克巴大帝，1857印度民族大起义后英国直接统治（教材近代史编·上）'},
    {t:'英属印度', s:1858, e:1947, note:'1858英国东印度公司转归英王直辖，1947印巴分治独立（近代史编·下）'},
    {t:'印度共和国', s:1947, e:2000, note:'1947年8月15日印度独立，1950年共和国，页面范围截止2000（近代史编·下）'},
  ]},
  { r:'日本', color:'#a4717a', items:[
    {t:'弥生时代', s:-300, e:300, note:'水稻与青铜传入'},
    {t:'古坟时代', s:250, e:538},
    {t:'飞鸟时代', s:538, e:710, note:'大化改新（645）'},
    {t:'奈良时代', s:710, e:794},
    {t:'平安时代', s:794, e:1185},
    {t:'镰仓幕府', s:1185, e:1333},
    {t:'室町时代', s:1333, e:1573},
    {t:'江户时代', s:1603, e:1868},
    {t:'明治时代', s:1868, e:1912, note:'明治维新（1868）'},
    {t:'大正时代', s:1912, e:1926, note:'大正民主、一战景气'},
    {t:'昭和时代', s:1926, e:1989, note:'军国主义、二战、战后经济高速增长'},
    {t:'平成时代', s:1989, e:2000, note:'泡沫崩溃后长期停滞，页面范围截止2000'},
  ]},
  { r:'朝鲜', color:'#b36a76', items:[
    {t:'朝鲜三国', s:-100, e:668, note:'高句丽/百济/新罗三足鼎立（通行：高句丽前37、百济前18、新罗前57；668新罗统一，教材古代史编·下第02章）'},
    {t:'统一新罗', s:668, e:935, note:'668统一半岛（通行），935新罗向高丽投降（教材）'},
    {t:'高丽王朝', s:918, e:1392, note:'918王建建高丽，1392李成桂废恭让王（教材）'},
    {t:'李氏朝鲜', s:1392, e:1897, note:'1392李成桂自立、1396定国号朝鲜，1636为清属国（教材）；1897高宗称帝建大韩帝国（通行）'},
    {t:'大韩帝国', s:1897, e:1910, note:'1897高宗称帝（通行），1910《日韩合并条约》被日本吞并（教材）'},
    {t:'日本殖民统治', s:1910, e:1945, note:'1910朝鲜总督府殖民统治，1945三八线解放（教材：现代史编·上第01/10章）'},
    {t:'朝鲜半岛分裂', s:1945, e:2000, note:'1948南北分建政权（大韩民国/朝鲜民主主义人民共和国），1950-53朝鲜战争，页面范围截止2000（教材：现代史编·下第03章）'},
  ]},
  { r:'东南亚', color:'#6f9452', items:[
    {t:'扶南', s:100, e:627, note:'东南亚最早印度化国家，627为真腊所灭（教材：古代史编·下第03章）'},
    {t:'占婆', s:192, e:1700, note:'192年建占婆国，17世纪为越南完全合并（教材：古代史编·下第03/02章）'},
    {t:'室利佛逝', s:700, e:1300, note:'7世纪末苏门答腊巨港海上佛教王国（教材：古代史编·下第03章）；约13世纪衰落（通行）'},
    {t:'吴哥王朝', s:800, e:1431, note:'9世纪初真腊建吴哥王朝，13世纪后衰落，1369/1389暹罗攻陷（教材）；1431陷落（通行）'},
    {t:'吴朝', s:939, e:968, note:'939吴权败南汉独立（教材）；968亡（通行）'},
    {t:'前黎朝', s:980, e:1009, note:'982侵占婆（教材）；980-1009（通行史实）'},
    {t:'李朝', s:1009, e:1225, note:'1009李公蕴建李朝大越国，定都升龙（教材）'},
    {t:'陈朝', s:1225, e:1400, note:'1225陈日煚继位，陈朝1225-1400（教材）'},
    {t:'胡朝', s:1400, e:1407, note:'1400废陈氏自立国号大虞，1407为明所灭（教材作"胡氏政权"）'},
    {t:'明属时期', s:1407, e:1427, note:'明朝置交趾布政司，1418黎利起义，1427议和撤司（教材）'},
    {t:'后黎朝', s:1428, e:1789, note:'1428黎利建大越国，后黎朝1428-1789（教材）'},
    {t:'阮朝', s:1802, e:1945, note:'1802阮福映建阮朝，1808称帝（教材）；1945保大退位'},
    {t:'法属殖民', s:1885, e:1945, note:'1885中法条约承认法殖民统治，1887建印度支那联邦（教材）；1945八月革命终结'},
    {t:'越南民主共和国', s:1945, e:2000, note:'1945胡志明建越南民主共和国，1955南北分裂、1976统一（教材），页面范围截止2000'},
    {t:'蒲甘王朝', s:1044, e:1287, note:'阿奴律陀建蒲甘王朝1044-1287，统一上下缅甸（教材：古代史编·下第03章）'},
    {t:'暹罗速古台王朝', s:1238, e:1351, note:'1238泰族建速古台王朝（教材）；约1351为阿瑜陀耶取代（通行）'},
    {t:'西方殖民东南亚', s:1511, e:1945, note:'1511葡占马六甲，西/荷/英/法/美先后殖民，1945日本占领终结欧洲统治（教材：古代史编·下第12章、现代史编·下第01章）'},
    {t:'东南亚独立诸国', s:1945, e:2000, note:'1945越南/印尼、1946菲律宾、1948缅甸、1957马来亚、1965新加坡（教材：现代史编·下第05章）；页面范围截止2000'},
  ]},
  { r:'美洲', color:'#6f5b8f', items:[
    {t:'玛雅', s:-1100, e:1441, note:'玛雅文明（教材口径约前11世纪初定居农业文明，公元初城邦兴起，9世纪末南部衰落，奇钦·伊查等城邦，12世纪末玛雅潘称霸、1441倾覆后分裂混战；古代史编·下第11章）'},
    {t:'阿兹特克', s:1325, e:1521, note:'1325建特诺奇蒂特兰，15世纪结盟扩张成帝国，孟泰祖马二世1502-1520，1521科尔蒂斯征服（通行史实；教材：古代史编·下第11章）'},
    {t:'印加', s:1200, e:1533, note:'12世纪以库斯科建印加国家，15世纪扩张为大帝国，1532西班牙入侵、1533亡（教材：古代史编·下第11章）'},
    {t:'美国', s:1776, e:2000, note:'1776独立战争，1787联邦宪法，1861-65南北战争，二战后超级大国、1991后唯一超级大国，页面范围截止2000（教材：近代史编·上第03章等）'},
  ]},
];

/* ============ 数据预处理：列内轨道分配（同地域文明基本时间继承，极少重叠） ============ */function assignTracks(items){
  const N = items.length;
  const adj = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++){
    if (items[i].s < items[j].e && items[j].s < items[i].e){ adj[i].push(j); adj[j].push(i); }
  }
  const comp = new Array(N).fill(-1);
  let ci = 0;
  for (let i = 0; i < N; i++){
    if (comp[i] !== -1) continue;
    const q = [i]; comp[i] = ci;
    while (q.length){ const u = q.pop(); for (const v of adj[u]) if (comp[v] === -1){ comp[v] = ci; q.push(v); } }
    ci++;
  }
  const trackOf = new Array(N).fill(0), kOf = new Array(N).fill(1);
  for (let c = 0; c < ci; c++){
    const idxs = [];
    for (let i = 0; i < N; i++) if (comp[i] === c) idxs.push(i);
    if (idxs.length < 2) continue;
    idxs.sort((a, b) => items[a].s - items[b].s);
    const tracks = [];
    for (const i of idxs){
      let ti = tracks.findIndex(t => t.bottom <= items[i].s);
      if (ti === -1){ ti = tracks.length; tracks.push({ bottom: items[i].e }); }
      else tracks[ti].bottom = Math.max(tracks[ti].bottom, items[i].e);
      trackOf[i] = ti;
    }
    idxs.forEach(i => kOf[i] = tracks.length);
  }
  return items.map((d, i) => ({ ...d, track: trackOf[i], k: kOf[i] }));
}
const REGIONS_DONE = REGIONS.map(reg => ({ ...reg, items: assignTracks(reg.items) }));

/* ============ 同文明明度渐变：区域内按时间排序，明度线性微渐变（早期深 → 晚期浅），体现继承感 ============ */
function hexToHsl(hex){
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (max + min < 510 ? max + min : 510 - max - min);
  let h;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = h * 60; if (h < 0) h += 360;
  return { h, s, l };
}
function hslToHex(h, s, l){
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r, g, b;
  if (h < 60){ r = c; g = x; b = 0; } else if (h < 120){ r = x; g = c; b = 0; }
  else if (h < 180){ r = 0; g = c; b = x; } else if (h < 240){ r = 0; g = x; b = c; }
  else if (h < 300){ r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
const L_MIN = 0.43, L_MAX = 0.57, L_SPAN = 0.12;   /* 明度区间：轻微渐变，保白字可读 */
REGIONS_DONE.forEach(reg => {
  const n = reg.items.length;
  if (n < 2){ reg.items[0].color = reg.color; reg.items[0].L = Math.min(L_MAX, Math.max(L_MIN, hexToHsl(reg.color).l)); return; }   /* 单条目：基础主题色（此前漏赋 color 导致白色块） */
  reg.items.sort((a, b) => a.s - b.s);              /* 按时间排序，早期深晚期浅 */
  const { h, s, l: l0 } = hexToHsl(reg.color);
  const step = L_SPAN / (n - 1);
  reg.items.forEach((it, i) => {
    const l = Math.min(L_MAX, Math.max(L_MIN, l0 + (i - (n - 1) / 2) * step));
    it.color = hslToHex(h, s, l);
    it.L = l;                                       /* 字色判断用 */
  });
});

/* ============ ECharts：横向布局 —— 区域=行、时间=横轴（进度条横移），上下双年份刻度带 ============ */
const MIN = -5000, MAX = 2000, SPAN = MAX - MIN;   /* 7000 年（仰韶文化 -5000 起，上限 2000） */
const fmtY = v => v < 0 ? ('前' + (-v) + '年') : (v === 0 ? '公元元年' : v + '年');

const AXIS_W = 72, TRACK_H = 20, ROW_PAD = 10, GAP = 8, TICK_H = 52, TOP_TICK_H = 40, TOP_TOP = 4, RIGHT = 10;  /* 区域名列宽/轨高/行内边距/行距/底刻度带高/顶刻度带高/顶距/右留白 */
const chartW = AXIS_W + SPAN + RIGHT;              /* 1px/年 → 横向内容宽 7082px（页面横向滚动） */
function yearLabelCfg(pos){
  return {
    color: '#5c554a', fontFamily: 'serif', fontSize: 12.5, fontWeight: 'bold', margin: 8, position: pos,
    formatter: v => { const s = fmtY(v); return v % 500 === 0 ? '{b|' + s + '}' : '{a|' + s + '}'; },
    rich: {
      a: { color: '#5c554a', fontSize: 12.5, fontWeight: 'bold', fontFamily: 'serif' },
      b: { color: '#2e2a23', fontSize: 14, fontWeight: '900', fontFamily: 'serif' },
    },
  };
}
function renderBar(params, api){
  const s = api.value(0), e = api.value(1), track = api.value(2), k = api.value(3);
  const name = api.value(4), color = api.value(5);
  const px = api.size([1, 0])[0];                    /* 1 年像素宽 */
  const w = Math.max((e - s) * px, 2);
  const cy = api.coord([0, 0])[1];                   /* 行中心 y */
  const rowH = api.size([0, 1])[1];                  /* 行高 */
  const laneH = rowH / k;                            /* 每轨高 */
  const y = cy - rowH / 2 + track * laneH;
  const h = laneH - 2;
  const x = api.coord([s, 0])[0];
  const thin = w < 42;                               /* 窄块：文字放块上方标签（tooltip 兜底全名） */
  const textW = thin ? Math.min(120, Math.max(40, w * 1.6)) : (w - 6);
  return {
    type: 'group',
    children: [
      { type: 'rect', shape: { x, y, width: w, height: h }, style: { fill: color, stroke: 'rgba(0,0,0,.10)', lineWidth: 1, borderRadius: 3 } },
      { type: 'text', style: {
          text: name, x: thin ? x : x + w / 2, y: thin ? (y - 8) : (y + h / 2),
          fill: thin ? '#2e2a23' : '#faf7ee', font: '700 12px serif',
          align: thin ? 'left' : 'center', verticalAlign: thin ? 'bottom' : 'middle',
          textShadow: thin ? undefined : '0 1px 2px rgba(46,42,35,.5)',
          width: textW, overflow: 'truncate', ellipsis: '…',
          backgroundColor: thin ? '#faf7ee' : undefined, padding: thin ? [1, 4] : undefined,
          borderColor: thin ? '#ddd3bf' : undefined, borderWidth: thin ? 1 : 0,
        } },
    ],
  };
}

let inited = false;
function init(){
  if(inited) return; inited = true;
  /* ---- 初始化：注入尺寸 / 构建 rows / 创建 chart ---- */
document.getElementById('chart').style.width = chartW + 'px';
const TOP_TICK_TOP = TOP_TOP;                       /* 顶部刻度带 grid 位置 */
let topY = TOP_TOP + TOP_TICK_H + 8;                /* 注：不可命名 top，会与 window.top 冲突 */
const rows = REGIONS_DONE.map(r => {
  const maxK = Math.max(...r.items.map(i => i.k));
  const height = maxK * TRACK_H + ROW_PAD;         /* 行高自适应多轨（行内纵向展开，不再挤宽） */
  const g = { top: topY, height };
  topY += height + GAP;
  return { ...r, maxK, grid: g };
});
const TICK_TOP = topY;
document.getElementById('chart').style.height = (TICK_TOP + TICK_H + 6) + 'px';

const chart = echarts.init(document.getElementById('chart'));
/* x 轴：时间（左古右今）。grid0=顶部刻度带、1..N=区域行（只留网格线）、末=底部刻度带 */
const xAxes = [
  { gridIndex: 0, type: 'value', min: MIN, max: MAX, interval: 100, position: 'top',
    axisLine: { lineStyle: { color: '#5c554a', width: 2 } },
    axisTick: { show: true, length: 6, lineStyle: { color: '#5c554a', width: 1.5 } },
    axisLabel: yearLabelCfg('top'),
    splitLine: { show: false },
    minorTick: { show: true, splitNumber: 4, length: 3, lineStyle: { color: '#8a8072', opacity: .5 } },
    minorSplitLine: { show: true, lineStyle: { color: '#ddd3bf', opacity: .25 } },
  },
  ...rows.map((r, i) => ({
    gridIndex: i + 1, type: 'value', min: MIN, max: MAX, interval: 100, inverse: false,
    axisLine: { lineStyle: { color: '#c9bda2', width: 1 } },
    axisTick: { show: false },
    axisLabel: { show: false },                     /* 区域行：不重复标年 */
    splitLine: { lineStyle: { color: '#b8ac8e', opacity: .55, width: 1 } },  /* 100 年网格线，跨行对齐增强同年代对比 */
    minorTick: { show: false },
    minorSplitLine: { show: false },                /* 20 年细线只留给刻度带，避免 13 行过密 */
  })),
  { gridIndex: rows.length + 1, type: 'value', min: MIN, max: MAX, interval: 100, inverse: false,
    axisLine: { lineStyle: { color: '#5c554a', width: 2 } },
    axisTick: { show: true, length: 7, lineStyle: { color: '#5c554a', width: 1.5 } },
    axisLabel: yearLabelCfg('bottom'),
    splitLine: { show: false },
    minorTick: { show: true, splitNumber: 4, length: 4, lineStyle: { color: '#8a8072', opacity: .5 } },  /* 20 年细刻度 */
    minorSplitLine: { show: true, lineStyle: { color: '#ddd3bf', opacity: .28 } },
  },
];

/* y 轴：每行 category（区域名放最左），刻度带行无 y */
const yAxes = [
  { gridIndex: 0, type: 'category', data: [''], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
  ...rows.map((r, i) => ({
    gridIndex: i + 1, type: 'category', data: [r.r],
    position: 'left', boundaryGap: [0.18, 0.18],
    axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
    axisLabel: { color: r.color, fontFamily: 'serif', fontSize: 13, fontWeight: 'bold', margin: 8 },
  })),
  { gridIndex: rows.length + 1, type: 'category', data: [''], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
];

const grids = [
  { left: AXIS_W, right: RIGHT, top: TOP_TICK_TOP, height: TOP_TICK_H, containLabel: true },            /* 顶部刻度带 */
  ...rows.map(r => ({ left: AXIS_W, right: RIGHT, top: r.grid.top, height: r.grid.height, containLabel: false })),
  { left: AXIS_W, right: RIGHT, top: TICK_TOP, height: TICK_H, containLabel: true },                     /* 底部刻度带 */
];

const series = [];
rows.forEach((r, i) => {
  series.push({
    type: 'custom', xAxisIndex: i + 1, yAxisIndex: i + 1,
    data: r.items.map(b => [b.s, b.e, b.track, b.k, b.t, b.color, b.note || '', b.L || 0.5]),
    renderItem: renderBar,
  });
});

const option = {
  animation: false,
  grid: grids,
  xAxis: xAxes,
  yAxis: yAxes,
  tooltip: {
    trigger: 'item', backgroundColor: '#faf7ee', borderColor: '#c9bda2',
    textStyle: { color: '#2e2a23', fontFamily: 'serif', fontSize: 12.5 },
    formatter: p => {
      const d = p.data;
      return '<b>' + d[4] + '</b><br/>' + fmtY(d[0]) + ' ~ ' + fmtY(d[1]) + '，共 ' + (d[1] - d[0]) + ' 年'
        + (d[6] ? '<br/><span style="color:#5c554a">' + d[6] + '</span>' : '');
    }
  },
  dataZoom: [{ type: 'inside', xAxisIndex: xAxes.map((_, i) => i), start: 0, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false }],  /* 滚轮=缩放时间，按住拖拽=横向平移；右下按钮亦可 */
  graphic: [
    { type: 'rect', left: AXIS_W, right: RIGHT, top: TOP_TICK_TOP, height: TOP_TICK_H, style: { fill: 'rgba(46,42,35,.07)' }, silent: true, z: 0 },  /* 顶部刻度带衬底 */
    { type: 'rect', left: AXIS_W, right: RIGHT, top: TICK_TOP, height: TICK_H, style: { fill: 'rgba(46,42,35,.09)' }, silent: true, z: 0 },   /* 底部刻度带衬底 */
    { type: 'line', id: 'ptCursor', invisible: true, silent: true, z: 5, style: { stroke: '#9e3d26', lineWidth: 1.5, lineDash: [4, 3] } },      /* 年份游标线（ptGo 设置） */
  ],
  series,
};

/* 直观缩放/平移按钮（固定右下角 #zoomUI） */
function getDZ(){ return chart.getOption().dataZoom[0]; }
window.ptZoom = function(f){
  const dz = getDZ();
  const mid = (dz.start + dz.end) / 2;
  let nr = Math.min(100, Math.max(5, (dz.end - dz.start) * f));
  let ns = mid - nr / 2, ne = mid + nr / 2;
  if (ns < 0){ ne -= ns; ns = 0; }
  if (ne > 100){ ns -= (ne - 100); ne = 100; }
  chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: ns, end: ne });
};
window.ptPan = function(p){
  const dz = getDZ();
  const r = dz.end - dz.start;
  let ns = dz.start + r * p, ne = dz.end + r * p;
  if (ns < 0){ ns = 0; ne = r; }
  if (ne > 100){ ne = 100; ns = 100 - r; }
  chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: ns, end: ne });
};
window.ptReset = function(){ chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 }); };

/* 年份跳转 + 游标线：输入如 前221 / 1912 / -221，回车或点「定位」；留空清除 */
let markYear = null;
function parseYear(t){
  if (t == null) return null;
  const s = String(t).trim();
  if (!s) return null;
  let m = s.match(/^前\s*(\d+)$/);  if (m) return -Math.min(+m[1], 5000);
  m = s.match(/^(-?\d+)$/);         if (m) return Math.max(Math.min(+m[1], 2000), -5000);
  return null;
}
function updateCursor(){
  const x = chart.convertToPixel({ gridIndex: 0 }, [markYear, 0])[0];
  chart.setOption({ graphic: [{ id: 'ptCursor', invisible: false, shape: { x1: x, y1: TOP_TOP - 2, x2: x, y2: TICK_TOP + TICK_H + 2 } }] });
}
window.ptGo = function(){
  const inp = document.getElementById('ptYearInput');
  const year = parseYear(inp ? inp.value : '');
  if (year === null){ markYear = null; chart.setOption({ graphic: [{ id: 'ptCursor', invisible: true }] }); return; }
  markYear = year;
  const dz = chart.getOption().dataZoom[0];
  let w = dz.end - dz.start;
  if (w > 20) w = 20;                                    /* 定位窗口：最多 20%（1400 年），年份居中 */
  const pos = (year - MIN) / SPAN * 100;
  let ns = pos - w / 2, ne = pos + w / 2;
  if (ns < 0){ ne -= ns; ns = 0; }
  if (ne > 100){ ns -= (ne - 100); ne = 100; }
  chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: ns, end: ne });
  updateCursor();
};
window.ptCursorClear = function(){ markYear = null; chart.setOption({ graphic: [{ id: 'ptCursor', invisible: true }] }); };
chart.on('dataZoom', function(){ if (markYear !== null) updateCursor(); });   /* 缩放/平移后游标线跟随年份像素位置 */

/* 按钮绑定：addEventListener（不用内联 onclick——线上 CSP script-src 禁 unsafe-inline 会拦截） */
function bindBtn(id, fn){ const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
bindBtn('ptResetBtn', function(){ window.ptReset(); });
bindBtn('ptPanL', function(){ window.ptPan(-0.18); });
bindBtn('ptPanR', function(){ window.ptPan(0.18); });
bindBtn('ptZoomOut', function(){ window.ptZoom(1.6); });
bindBtn('ptZoomIn', function(){ window.ptZoom(0.6); });
bindBtn('ptGoBtn', function(){ window.ptGo(); });
const yearInp = document.getElementById('ptYearInput');
if (yearInp) yearInp.addEventListener('keydown', function(e){ if (e.key === 'Enter') window.ptGo(); });
chart.setOption(option);
/* 测试钩子 */
window.__pt = {
  chart, MIN, MAX, SPAN, REGIONS: REGIONS_DONE, rows, grids,
  convertXAt: (g, year) => chart.convertToPixel({ gridIndex: g }, [year, 0])[0],
  dataCount: () => chart.getOption().series.reduce((a, s) => a + s.data.length, 0),
};
}

window.initParallel = init;
})();