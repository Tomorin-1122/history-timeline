// 补录 A 组高频考点（考研 313 中国古代史）：42 条
// 输出: data/addon_a.json（由 insert 脚本按 dynasty 归入各章）
const ADDON = [
  // ═══════ 夏商 ═══════
  {
    title: '三星堆文化', year: -1500, yearMode: 'range', yearRange: [-1700, -1200], era: '', eraSub: '',
    dynasty: '商', period: '先秦', type: '文化', importance: 2,
    summary: '三星堆遗址位于四川广汉，是古蜀国文化遗存，年代约前1700年至前1200年（商代）。出土大量青铜面具、青铜神树、金杖、玉璋等，造型奇特，反映了长江上游独立发展的青铜文明，与中原商文化并存。',
    cause: '古蜀文明独立发展，成都平原富庶，形成独具特色的神权国家。',
    effect: '证明中华文明多元一体，长江流域也是文明起源中心之一。',
    examTip: '三星堆≠中原青铜器，代表古蜀文明；常考"中华文明多元一体"。',
    people: [], location: '三星堆（今四川广汉）', tags: ['考古', '古蜀', '青铜文明'],
    related: ['商代青铜文明（司母戊鼎）'], wikiSlug: '三星堆遗址'
  },
  // ═══════ 战国 ═══════
  {
    title: '荀子', year: null, yearMode: 'era', yearRange: null, era: '战国后期', eraSub: '',
    dynasty: '战国', period: '先秦', type: '文化', importance: 3,
    summary: '荀子（约前313-前238），战国末期儒家集大成者，赵国人。主张"性恶论"，强调后天教化；"隆礼重法"，礼法并用；提出"制天命而用之"的人定胜天思想。著《荀子》，弟子有韩非、李斯。',
    cause: '战国末期统一趋势加强，儒家思想需要回应现实政治。',
    effect: '荀子融合儒法，是先秦思想向汉代政治哲学过渡的关键人物。',
    examTip: '孟子性善论 vs 荀子性恶论；"隆礼重法"是荀子特色。',
    people: ['荀子'], location: '', tags: ['百家争鸣', '儒家'],
    related: ['孟子'], wikiSlug: '荀子'
  },
  {
    title: '墨家与墨子', year: null, yearMode: 'era', yearRange: null, era: '战国初期', eraSub: '',
    dynasty: '战国', period: '先秦', type: '文化', importance: 3,
    summary: '墨子（约前468-前376），墨家学派创始人。主张兼爱、非攻、尚贤、尚同、节用、节葬、非乐、天志、明鬼、非命。墨家组织严密，信徒多手工业者，战国时与儒家并称"显学"。',
    cause: '战国战乱频仍，小生产者阶层渴望和平与平等。',
    effect: '墨家是唯一代表平民利益的学派，秦汉后衰微但影响深远。',
    examTip: '墨家"兼爱非攻"核心；与儒家并称显学；常考"十论"。',
    people: ['墨子'], location: '', tags: ['百家争鸣', '墨家'],
    related: ['百家争鸣'], wikiSlug: '墨子'
  },
  // ═══════ 西汉 ═══════
  {
    title: '白登之围', year: -200, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '西汉', period: '秦汉', type: '军事', importance: 3,
    summary: '前200年，汉高祖刘邦亲率32万大军北击匈奴，被冒顿单于40万骑兵围困于平城白登山（今山西大同东北）七昼夜，后用陈平计贿赂阏氏方得脱围。',
    cause: '韩王信叛汉降匈奴，刘邦欲一举解决北方边患。',
    effect: '白登之围后汉朝无力对抗匈奴，被迫采取和亲政策，休养生息。',
    examTip: '白登之围=和亲政策的直接原因；刘邦vs冒顿。',
    people: ['刘邦', '冒顿单于'], location: '白登山（今山西大同东北）', tags: ['汉匈关系', '和亲背景'],
    related: ['汉高祖稳定社会秩序的措施'], wikiSlug: '白登之围'
  },
  // ═══════ 东汉 ═══════
  {
    title: '光武中兴', year: 25, yearMode: 'range', yearRange: [25, 57], era: '', eraSub: '',
    dynasty: '东汉', period: '秦汉', type: '政治', importance: 3,
    summary: '东汉光武帝刘秀在位期间（25-57年），释放奴婢、减轻赋税、整顿吏治、精简机构，加强中央集权，恢复社会经济，史称"光武中兴"。退功臣进文吏，尚书台掌实权。',
    cause: '新莽末年战乱后经济凋敝，需恢复生产、稳定统治。',
    effect: '东汉初期社会稳定，人口和垦田恢复，为东汉近两百年统治奠基。',
    examTip: '光武中兴=东汉初年治世；与文景之治/贞观之治并考。',
    people: ['刘秀'], location: '洛阳（今河南洛阳）', tags: ['治世', '东汉初'],
    related: ['东汉建立'], wikiSlug: '光武中兴'
  },
  {
    title: '《九章算术》', year: null, yearMode: 'era', yearRange: null, era: '东汉', eraSub: '',
    dynasty: '东汉', period: '秦汉', type: '文化', importance: 2,
    summary: '《九章算术》约成书于东汉，是中国古代最重要的数学著作，分方田、粟米、衰分、少广、商功、均输、盈不足、方程、勾股九章，涉及分数运算、开方、一元二次方程、线性方程组等，领先世界。',
    cause: '秦汉大一统后田亩计算、赋税、工程等实用算术需求积累。',
    effect: '确立中国古代数学的实用体系，后经刘徽作注，影响东亚千余年。',
    examTip: '九章算术=实用数学；"方程"章即线性方程组；东汉成书。',
    people: [], location: '', tags: ['科技', '数学'],
    related: ['蔡伦改进造纸术'], wikiSlug: '九章算术'
  },
  // ═══════ 三国两晋南北朝 ═══════
  {
    title: '门阀士族', year: null, yearMode: 'era', yearRange: null, era: '魏晋南北朝', eraSub: '',
    dynasty: '三国两晋南北朝', period: '魏晋南北朝', type: '政治', importance: 3,
    summary: '门阀士族是魏晋南北朝时期垄断政治经济特权的世家大族。凭借九品中正制"上品无寒门，下品无势族"，累世公卿，占有大量土地和部曲，与皇权共治，形成门阀政治。',
    cause: '东汉豪强地主发展+九品中正制选官垄断门第。',
    effect: '门阀政治延续数百年，至隋唐科举制兴起、唐末农民战争后才衰落。',
    examTip: '门阀政治=皇权与士族共治；九品中正制是其制度基础。',
    people: ['王导', '谢安'], location: '', tags: ['政治制度', '社会结构'],
    related: ['九品中正制确立'], wikiSlug: '门阀士族'
  },
  {
    title: '魏晋玄学', year: null, yearMode: 'era', yearRange: null, era: '魏晋', eraSub: '',
    dynasty: '三国两晋南北朝', period: '魏晋南北朝', type: '文化', importance: 3,
    summary: '玄学是魏晋时期以老庄思想为骨架的哲学思潮，探讨"有无""本末"等抽象问题。代表人物何晏、王弼（正始玄学）、嵇康、阮籍（竹林七贤）、郭象（《庄子注》）。以"贵无"或"独化"立论，清谈成风。',
    cause: '门阀士族在政治高压下避谈世事，转向玄远哲理清谈。',
    effect: '玄学冲击两汉经学，推动哲学思辨发展，影响文学艺术。',
    examTip: '玄学=老庄+清谈；竹林七贤属玄学人物；与经学对立。',
    people: ['何晏', '王弼', '嵇康', '阮籍'], location: '', tags: ['思想', '清谈'],
    related: ['九品中正制确立'], wikiSlug: '魏晋玄学'
  },
  {
    title: '祖冲之与圆周率', year: 462, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '南朝宋', period: '魏晋南北朝', type: '文化', importance: 3,
    summary: '南朝宋齐之际科学家祖冲之把圆周率精确到小数点后第七位（3.1415926-3.1415927之间），领先世界近千年；还编制《大明历》，创制水碓磨、指南车等。',
    cause: '南朝数学与历法研究的长期积累，实测需要更高精度。',
    effect: '祖率领先世界约800年，明代才被打破；《大明历》改进闰法。',
    examTip: '祖冲之=圆周率七位+《大明历》；南朝的科技高峰。',
    people: ['祖冲之'], location: '建康（今江苏南京）', tags: ['科技', '数学', '天文'],
    related: ['范缜著《神灭论》'], wikiSlug: '祖冲之'
  },
  {
    title: '王羲之与书法艺术', year: null, yearMode: 'era', yearRange: null, era: '东晋', eraSub: '',
    dynasty: '东晋', period: '魏晋南北朝', type: '文化', importance: 3,
    summary: '东晋书法家王羲之（约303-361），琅琊临沂人，官至右军将军，世称"王右军"。博采众长，备精诸体，行书《兰亭序》被誉为"天下第一行书"，后人尊为"书圣"。',
    cause: '魏晋书法由隶向行楷演变，士族文化推动艺术自觉。',
    effect: '确立行书典范，王羲之成为后世书法的最高标杆。',
    examTip: '王羲之=书圣、《兰亭序》=天下第一行书、行书。',
    people: ['王羲之'], location: '会稽（今浙江绍兴）', tags: ['书法', '艺术'],
    related: [], wikiSlug: '王羲之'
  },
  {
    title: '顾恺之与绘画', year: null, yearMode: 'era', yearRange: null, era: '东晋', eraSub: '',
    dynasty: '东晋', period: '魏晋南北朝', type: '文化', importance: 2,
    summary: '东晋画家顾恺之，无锡人，提出"以形写神""迁想妙得"的绘画理论，代表作《女史箴图》《洛神赋图》，是中国人物画的奠基者之一。',
    cause: '魏晋人物品评风气与士族审美促进绘画艺术成熟。',
    effect: '确立中国画"传神"传统，影响后世千年。',
    examTip: '顾恺之=以形写神、《女史箴图》《洛神赋图》。',
    people: ['顾恺之'], location: '', tags: ['绘画', '艺术'],
    related: ['王羲之与书法艺术'], wikiSlug: '顾恺之'
  },
  {
    title: '《齐民要术》', year: 540, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '北魏', period: '魏晋南北朝', type: '文化', importance: 3,
    summary: '北魏贾思勰著《齐民要术》，约成书于6世纪30年代，是中国现存最早最完整的综合性农书，系统总结黄河流域农业生产经验，涉及农、林、牧、副、渔各业。',
    cause: '北魏农业恢复发展的需要，作者长期实地考察总结。',
    effect: '奠定中国传统农学体系，后世农书多引其内容。',
    examTip: '《齐民要术》=现存最早完整农书、贾思勰、北魏。',
    people: ['贾思勰'], location: '', tags: ['科技', '农学'],
    related: ['北魏均田制颁行'], wikiSlug: '齐民要术'
  },
  {
    title: '郦道元《水经注》', year: 527, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '北魏', period: '魏晋南北朝', type: '文化', importance: 2,
    summary: '北魏郦道元著《水经注》，为《水经》作注，记载河流1252条，旁及地理、物产、古迹、风俗，是古代最系统的地理学著作。',
    cause: '郦道元历览山川，有感旧注简略而详加考订。',
    effect: '中国地理学的里程碑，兼具科学与文学价值。',
    examTip: '《水经注》=地理学著作、郦道元、北魏。',
    people: ['郦道元'], location: '', tags: ['科技', '地理'],
    related: [], wikiSlug: '水经注'
  },
  {
    title: '侨置郡县与土断', year: null, yearMode: 'era', yearRange: null, era: '东晋南朝', eraSub: '',
    dynasty: '东晋', period: '魏晋南北朝', type: '制度', importance: 3,
    summary: '东晋为安置南渡流民，在南方侨置原北方郡县（侨置郡县），流民编入侨籍不纳赋役。后因侨籍隐漏逃避赋役，东晋南朝多次"土断"，即把侨民编入当地户籍，统一纳税服役。',
    cause: '永嘉之乱后北方人口大规模南迁，需要安置流民、稳定户籍。',
    effect: '土断削弱侨姓士族荫庇，增加国家编户赋役，促进南方开发。',
    examTip: '侨置=安置流民虚设郡县；土断=核实户籍纳税；东晋南朝常考。',
    people: ['桓温'], location: '', tags: ['制度', '户籍', '南迁'],
    related: ['东晋建立'], wikiSlug: '侨置郡县与土断'
  },
  // ═══════ 唐 ═══════
  {
    title: '李白', year: null, yearMode: 'era', yearRange: null, era: '盛唐', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 3,
    summary: '李白（701-762），字太白，号青莲居士，盛唐浪漫主义诗人代表。诗风豪放飘逸、想象瑰丽，代表作《将进酒》《蜀道难》《望庐山瀑布》，人称"诗仙"。',
    cause: '盛唐开放气象与诗人个性交融，孕育浪漫诗风。',
    effect: '李白诗歌代表盛唐气象最高成就，影响深远。',
    examTip: '李白=诗仙、浪漫主义、盛唐；与杜甫并称"李杜"。',
    people: ['李白'], location: '长安（今陕西西安）', tags: ['唐诗', '文学'],
    related: ['开元之治'], wikiSlug: '李白'
  },
  {
    title: '杜甫', year: null, yearMode: 'era', yearRange: null, era: '盛唐至中唐', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 3,
    summary: '杜甫（712-770），字子美，世称"诗圣"。经历安史之乱，诗风沉郁顿挫，真实反映社会离乱，代表作"三吏""三别"《春望》，被誉为"诗史"。',
    cause: '安史之乱前后社会剧变，诗人身世飘零，发为沉痛之诗。',
    effect: '杜甫以诗记史，开创现实主义高峰，元白、宋诗皆承其绪。',
    examTip: '杜甫=诗圣、诗史、现实主义；"三吏三别"；与李白并称。',
    people: ['杜甫'], location: '长安（今陕西西安）', tags: ['唐诗', '文学'],
    related: ['安史之乱'], wikiSlug: '杜甫'
  },
  {
    title: '白居易与新乐府运动', year: null, yearMode: 'era', yearRange: null, era: '中唐', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 2,
    summary: '白居易（772-846），中唐诗人，倡导"文章合为时而著，歌诗合为事而作"，发起新乐府运动，诗风平易近人，代表作《长恨歌》《琵琶行》《卖炭翁》。',
    cause: '安史之乱后弊政丛生，士人借诗歌讽喻现实。',
    effect: '新乐府运动继承《诗经》讽喻传统，推动中唐写实诗风。',
    examTip: '白居易=新乐府、讽喻诗、《长恨歌》《琵琶行》；与元稹并称"元白"。',
    people: ['白居易', '元稹'], location: '长安（今陕西西安）', tags: ['唐诗', '新乐府'],
    related: ['两税法实施'], wikiSlug: '白居易'
  },
  {
    title: '古文运动', year: null, yearMode: 'era', yearRange: null, era: '中唐', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 3,
    summary: '唐代中期韩愈、柳宗元倡导古文运动，主张"文以载道"，反对六朝以来骈文浮华，提倡恢复先秦两汉散体古文。韩愈《师说》《原道》、柳宗元《永州八记》为典范。',
    cause: '中唐儒学复兴思潮，骈文空泛不切实用。',
    effect: '古文运动确立散文传统，为宋明古文开辟道路。',
    examTip: '古文运动=韩愈柳宗元、文以载道、反骈文；"唐宋八大家"之首。',
    people: ['韩愈', '柳宗元'], location: '长安（今陕西西安）', tags: ['文学', '散文'],
    related: [], wikiSlug: '古文运动'
  },
  {
    title: '敦煌莫高窟', year: null, yearMode: 'era', yearRange: null, era: '唐代', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 3,
    summary: '敦煌莫高窟始凿于前秦（366年），唐时鼎盛，现存洞窟735个，壁画4.5万平方米，彩塑2000余身。唐代洞窟规模宏大，飞天壁画著称，是中外艺术交流的结晶，1900年发现藏经洞。',
    cause: '敦煌为丝绸之路枢纽，佛教东传，供养人出资开窟造像。',
    effect: '莫高窟是佛教艺术宝库，见证丝路文明交流。',
    examTip: '莫高窟=石窟艺术、丝路文化、藏经洞；敦煌学。',
    people: [], location: '敦煌（今甘肃敦煌）', tags: ['艺术', '佛教', '丝路'],
    related: ['玄奘西行求法'], wikiSlug: '莫高窟'
  },
  {
    title: '孙思邈与《千金方》', year: 652, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '文化', importance: 2,
    summary: '唐代医学家孙思邈，京兆华原人，著《千金要方》《千金翼方》合称《千金方》，系统总结唐以前医学成就，主张医德为先，被后世尊为"药王"。',
    cause: '隋唐医学积累与孙思邈毕生行医经验总结。',
    effect: '《千金方》是唐代医学集大成之作，医德规范影响后世。',
    examTip: '孙思邈=药王、《千金方》；与《唐新本草》同属唐医学。',
    people: ['孙思邈'], location: '京兆（今陕西铜川）', tags: ['科技', '医学'],
    related: ['《唐新本草》编成'], wikiSlug: '孙思邈'
  },
  {
    title: '曲辕犁与筒车', year: null, yearMode: 'era', yearRange: null, era: '唐代', eraSub: '',
    dynasty: '唐', period: '隋唐', type: '经济', importance: 3,
    summary: '唐代改进农具：曲辕犁（江东犁）由直辕改为曲辕，轻便灵活，可调节深浅；筒车以水力提水灌溉，提高农业生产力，是唐代经济繁荣的技术基础。',
    cause: '南方水田农业发展的需要，农具不断改进。',
    effect: '曲辕犁推动精耕细作，筒车扩大灌溉面积，促进江南开发。',
    examTip: '曲辕犁=唐改进、江东犁；筒车=水力灌溉；体现唐代农业进步。',
    people: [], location: '', tags: ['经济', '农具', '科技'],
    related: ['均田制与租庸调制颁布'], wikiSlug: '曲辕犁'
  },
  // ═══════ 五代宋辽夏金 ═══════
  {
    title: '杯酒释兵权', year: 961, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '政治', importance: 3,
    summary: '961年（建隆二年），宋太祖赵匡胤设宴暗示石守信等禁军将领交出兵权，以田宅财帛换取富贵，解除宿将兵权，加强皇权对军队的控制。',
    cause: '赵匡胤陈桥兵变夺权，恐武将拥兵自重重演。',
    effect: '宋初收兵权，奠定"强干弱枝""重文轻武"国策基础。',
    examTip: '杯酒释兵权=宋太祖解宿将兵权；与陈桥兵变连考。',
    people: ['赵匡胤', '石守信'], location: '开封（今河南开封）', tags: ['北宋', '集权'],
    related: ['陈桥兵变'], wikiSlug: '杯酒释兵权'
  },
  {
    title: '重文轻武与宋初集权', year: null, yearMode: 'era', yearRange: null, era: '北宋初期', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '制度', importance: 3,
    summary: '北宋初年确立"重文轻武""强干弱枝"方针：收精兵（禁军归中央）、削实权（文臣知州、通判牵制）、制钱谷（转运使掌财赋），并扩大科举取士，形成文官政治。',
    cause: '唐末五代武人跋扈教训，宋太祖、太宗为防藩镇割据。',
    effect: '北宋中央集权空前加强，但导致冗官冗兵冗费、边防积弱。',
    examTip: '重文轻武=宋代国策；"收精兵削实权制钱谷"三招；与积贫积弱连考。',
    people: ['赵匡胤'], location: '开封（今河南开封）', tags: ['北宋', '中央集权'],
    related: ['杯酒释兵权'], wikiSlug: '重文轻武'
  },
  {
    title: '二府三司制', year: null, yearMode: 'era', yearRange: null, era: '北宋', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '制度', importance: 3,
    summary: '北宋中枢机构：中书门下（政事堂）掌行政，枢密院掌军政（合称"二府"），三司（盐铁、度支、户部）掌财政，三者互不统属，分割相权，皇帝总揽大权。',
    cause: '宋太祖为削弱相权，将宰相职权拆分为政、军、财三权。',
    effect: '相权大削而皇权独尊，但机构重叠导致冗官、效率低下。',
    examTip: '二府=中书门下+枢密院；三司=财政；与唐朝三省六部对比考。',
    people: [], location: '开封（今河南开封）', tags: ['北宋', '官制'],
    related: ['重文轻武与宋初集权'], wikiSlug: '二府三司制'
  },
  {
    title: '冗官冗兵冗费', year: null, yearMode: 'era', yearRange: null, era: '北宋中期', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '政治', importance: 3,
    summary: '北宋中期积贫积弱：科举与恩荫使冗官泛滥，养兵百万（冗兵），加上岁币、宗室开支，形成"冗官、冗兵、冗费"三冗，财政入不敷出，边防虚弱。',
    cause: '重文轻武、不抑兼并、养兵募兵政策累积的弊病。',
    effect: '三冗是庆历新政、王安石变法的直接背景。',
    examTip: '三冗=冗官冗兵冗费；积贫积弱的表现；与庆历新政/王安石变法连考。',
    people: ['赵祯'], location: '开封（今河南开封）', tags: ['北宋', '积贫积弱'],
    related: ['庆历新政', '王安石推行青苗法'], wikiSlug: '冗官冗兵冗费'
  },
  {
    title: '经济重心南移', year: null, yearMode: 'era', yearRange: null, era: '两宋时期', eraSub: '',
    dynasty: '南宋', period: '宋元', type: '经济', importance: 3,
    summary: '中国经济重心自东晋南朝以来持续南移，安史之乱后加速，至南宋时最终完成，"苏湖熟，天下足"，南方人口、赋税、文化全面超过北方。',
    cause: '北方战乱、南方相对安定+北人南迁带来劳动力与技术+南方自然条件优越。',
    effect: '南宋经济文化重心确立于江南，影响元明清格局。',
    examTip: '南移完成于南宋；"苏湖熟天下足"；与人口南迁、占城稻连考。',
    people: [], location: '', tags: ['经济', '区域发展'],
    related: ['交子发行', '广州设市舶司'], wikiSlug: '经济重心南移'
  },
  {
    title: '指南针的发明与应用', year: null, yearMode: 'era', yearRange: null, era: '北宋', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '文化', importance: 3,
    summary: '战国已有司南，北宋沈括《梦溪笔谈》记载以磁石磨针锋作指南针，并应用于航海，南宋时成为远洋航行必备，后经阿拉伯人传入欧洲。',
    cause: '宋代航海与商业发展对定向导航的需求。',
    effect: '指南针传入欧洲推动大航海时代，是四大发明之一。',
    examTip: '指南针=北宋用于航海；四大发明；与司南（战国）区分。',
    people: ['沈括'], location: '', tags: ['科技', '四大发明', '航海'],
    related: ['沈括完成《梦溪笔谈》'], wikiSlug: '指南针'
  },
  {
    title: '火药武器的发展', year: null, yearMode: 'era', yearRange: null, era: '北宋', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '文化', importance: 3,
    summary: '火药唐末已用于军事，北宋设火药作坊，生产火箭、火毬、突火枪等，宋金、宋元战争中广泛使用，后经蒙古西征传入阿拉伯和欧洲。',
    cause: '炼丹术发现火药配方，宋代战争频繁推动武器化。',
    effect: '火药武器改变战争形态，传入欧洲加速封建制度瓦解。',
    examTip: '火药=唐末军用、宋元发展；四大发明；与突火枪、火铳连考。',
    people: [], location: '', tags: ['科技', '四大发明', '军事'],
    related: ['毕昇发明活字印刷'], wikiSlug: '火药武器'
  },
  {
    title: '《资治通鉴》编纂', year: 1084, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '文化', importance: 3,
    summary: '北宋司马光主持编纂《资治通鉴》，1084年（元丰七年）成书，记载前403年至959年1362年史事，编年体通史，294卷，"鉴于往事，有资于治道"。',
    cause: '司马光欲以史为鉴，供统治者资治。',
    effect: '与《史记》并称史学双璧，编年体通史典范。',
    examTip: '《资治通鉴》=编年体通史、司马光、起战国讫五代；与《史记》（纪传体）对比。',
    people: ['司马光'], location: '', tags: ['史学', '编年体'],
    related: ['司马迁著《史记》'], wikiSlug: '资治通鉴'
  },
  {
    title: '宋词的繁荣', year: null, yearMode: 'era', yearRange: null, era: '两宋', eraSub: '',
    dynasty: '北宋', period: '宋元', type: '文化', importance: 3,
    summary: '词在两宋臻于极盛：北宋苏轼开豪放一派，柳永发展慢词，李清照为婉约之宗；南宋辛弃疾承豪放余绪，姜夔精工典雅。词成为宋代文学最高成就的标志。',
    cause: '城市经济繁荣、市民文化兴起，音乐与文学结合。',
    effect: '宋词与唐诗并称，是中国文学的双璧。',
    examTip: '苏轼/辛弃疾=豪放派，李清照=婉约派；词兴于唐盛于宋。',
    people: ['苏轼', '李清照', '辛弃疾', '柳永'], location: '', tags: ['文学', '宋词'],
    related: ['程朱理学确立正统地位'], wikiSlug: '宋词'
  },
  {
    title: '猛安谋克制', year: 1114, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '金', period: '宋元', type: '制度', importance: 3,
    summary: '女真族军事社会组织：猛安（千夫长）谋克（百夫长），以氏族部落为编制基础，兵民合一。阿骨打起兵后整编推行，后成为金朝地方行政与军事合一的基本组织。',
    cause: '女真部落联盟军事扩张需要有效的组织编制。',
    effect: '猛安谋克保证金朝战斗力，入主中原后逐渐腐化。',
    examTip: '猛安谋克=女真兵民合一制度；与八旗制度类比考。',
    people: ['完颜阿骨打'], location: '', tags: ['金', '军事制度'],
    related: ['金朝建立'], wikiSlug: '猛安谋克制'
  },
  {
    title: '郾城大捷', year: 1140, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '南宋', period: '宋元', type: '军事', importance: 3,
    summary: '1140年（绍兴十年），岳飞率岳家军在郾城大破金兀术主力，以步兵破金军"拐子马""铁浮图"，乘胜进抵朱仙镇，距开封四十五里。',
    cause: '绍兴十年金军南侵，岳飞率军北伐反攻。',
    effect: '郾城大捷是岳飞北伐巅峰，但宋高宗、秦桧力主议和，岳飞随即被召回。',
    examTip: '郾城大捷=岳飞北伐；"直捣黄龙"；与绍兴和议、岳飞被害连考。',
    people: ['岳飞', '金兀术'], location: '郾城（今河南漯河郾城区）', tags: ['南宋', '抗金'],
    related: ['绍兴和议', '岳飞被害'], wikiSlug: '郾城大捷'
  },
  // ═══════ 元 ═══════
  {
    title: '宣政院设立', year: 1264, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '元', period: '宋元', type: '制度', importance: 3,
    summary: '1264年元朝设宣政院，掌全国佛教事务并统辖吐蕃（西藏）地区军政，院使由帝师（八思巴）或蒙古大臣担任，是中央管理西藏的专门机构。',
    cause: '元朝崇信佛教，需设机构管理吐蕃与佛教事务。',
    effect: '西藏正式纳入中央政权管辖，宣政院是重要标志。',
    examTip: '宣政院=中央管西藏+佛教；与驻藏大臣、金瓶掣签（清）对比考。',
    people: ['八思巴'], location: '大都（今北京）', tags: ['元', '西藏', '中央机构'],
    related: ['凉州会谈'], wikiSlug: '宣政院'
  },
  // ═══════ 明 ═══════
  {
    title: '内阁制度形成', year: 1420, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '明', period: '明清', type: '制度', importance: 3,
    summary: '明成祖时设内阁，以翰林院官员入阁参与机务，掌"票拟"。内阁不是法定行政机构，实为皇帝秘书班子，后地位渐重，张居正时成为事实宰相。',
    cause: '废除丞相后皇帝政务繁重，需近臣辅佐。',
    effect: '内阁制下皇权独尊，相权以另一种形式存在。',
    examTip: '内阁=明代废丞相后的辅政机构、票拟；与清代军机处对比。',
    people: ['朱棣', '张居正'], location: '京师（今北京）', tags: ['明代', '官制'],
    related: ['废除丞相制度'], wikiSlug: '内阁制度形成'
  },
  {
    title: '锦衣卫设立', year: 1382, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '明', period: '明清', type: '制度', importance: 3,
    summary: '1382年（洪武十五年）明太祖设锦衣卫，兼掌侍卫与缉捕刑狱，直接对皇帝负责，可不经司法程序逮捕审讯，开明代厂卫特务政治之先。',
    cause: '朱元璋为强化皇权、监视臣民，清除功臣的需要。',
    effect: '锦衣卫与东厂西厂构成厂卫体系，明代特务政治特色。',
    examTip: '锦衣卫=明太祖设、厂卫之始；与东厂西厂（成祖后）连考。',
    people: ['朱元璋'], location: '京师（今江苏南京）', tags: ['明代', '特务机构'],
    related: ['胡惟庸案'], wikiSlug: '锦衣卫'
  },
  {
    title: '海禁政策', year: 1371, yearMode: 'range', yearRange: [1371, 1567], era: '', eraSub: '',
    dynasty: '明', period: '明清', type: '对外关系', importance: 3,
    summary: '明太祖洪武年间实行海禁，禁止民间私自出海贸易，只保留官方朝贡贸易。海禁抑制了民间海外贸易，导致走私与倭患，隆庆元年（1567年）开海禁（隆庆开关）。',
    cause: '明初防倭患、防沿海豪强与张士诚余部勾结，维持官方垄断。',
    effect: '海禁阻碍海外贸易发展，造成走私盛行、倭寇猖獗。',
    examTip: '海禁=明初禁民间出海；与朝贡贸易、隆庆开关、倭患连考。',
    people: ['朱元璋'], location: '', tags: ['明代', '对外政策'],
    related: ['郑和下西洋'], wikiSlug: '海禁政策'
  },
  {
    title: '朝贡贸易', year: null, yearMode: 'era', yearRange: null, era: '明代', eraSub: '',
    dynasty: '明', period: '明清', type: '对外关系', importance: 2,
    summary: '明代官方对外贸易以朝贡贸易为主：海外诸国遣使朝贡，明廷"厚往薄来"回赐，贡使可附带货物互市。郑和下西洋即朝贡体系的巅峰。',
    cause: '明朝以天朝上国自居，用经济让利换取政治藩属关系。',
    effect: '朝贡贸易耗费巨大，明中后期难以为继，民间走私贸易取而代之。',
    examTip: '朝贡贸易=官方垄断、厚往薄来；与海禁、郑和下西洋连考。',
    people: [], location: '', tags: ['明代', '对外贸易'],
    related: ['郑和下西洋'], wikiSlug: '朝贡贸易'
  },
  // ═══════ 清 ═══════
  {
    title: '康乾盛世', year: null, yearMode: 'era', yearRange: null, era: '康雍乾时期', eraSub: '',
    dynasty: '清', period: '明清', type: '政治', importance: 3,
    summary: '康熙、雍正、乾隆三朝（1661-1795）约130年间，国家统一、疆域奠定、人口增长、经济繁荣，传统社会达到鼎盛，史称"康乾盛世"。同时闭关锁国、文字狱、吏治腐败等危机也在积累。',
    cause: '明末清初长期战乱后恢复发展，康雍乾励精图治与边疆经营。',
    effect: '康乾盛世奠定现代中国疆域基础，但盛世之下已现衰象。',
    examTip: '康乾盛世=清朝鼎盛；注意"盛世危机"（闭关/文字狱/人口压力）常考论述。',
    people: ['康熙帝', '雍正帝', '乾隆帝'], location: '', tags: ['清代', '治世'],
    related: ['军机处设立', '平定三藩之乱'], wikiSlug: '康乾盛世'
  },
  {
    title: '闭关锁国政策', year: 1757, yearMode: 'range', yearRange: [1757, 1840], era: '', eraSub: '',
    dynasty: '清', period: '明清', type: '对外关系', importance: 3,
    summary: '乾隆二十二年（1757年）清廷限定广州一口通商，由公行垄断对外贸易，严格限制外国商民活动，禁止民间出海，形成闭关锁国政策，一直延续到鸦片战争。',
    cause: '自给自足自然经济+防范西方殖民势力+维持天朝体制。',
    effect: '闭关锁国使中国落后于世界潮流，是鸦片战争失败的重要原因。',
    examTip: '闭关锁国=广州一口通商、公行；与康乾盛世危机、鸦片战争连考。',
    people: ['乾隆帝'], location: '广州（今广东广州）', tags: ['清代', '对外政策'],
    related: ['广州一口通商'], wikiSlug: '闭关锁国'
  },
  {
    title: '设伊犁将军', year: 1762, yearMode: 'exact', yearRange: null, era: '', eraSub: '',
    dynasty: '清', period: '明清', type: '民族关系', importance: 3,
    summary: '乾隆二十七年（1762年）清廷在平定准噶尔、大小和卓之乱后，设伊犁将军驻惠远城，统辖天山南北军政，是清廷治理新疆的最高长官。',
    cause: '平定新疆叛乱后需设军政长官镇守边疆。',
    effect: '新疆正式纳入清朝直辖，巩固西北边疆。',
    examTip: '伊犁将军=清代治新疆；与平定准噶尔、大小和卓连考。',
    people: ['乾隆帝'], location: '伊犁（今新疆霍城）', tags: ['清代', '边疆', '新疆'],
    related: ['平定达瓦齐', '平定大小和卓之乱'], wikiSlug: '伊犁将军'
  },
  {
    title: '金瓶掣签制度', year: 1793, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '清', period: '明清', type: '制度', importance: 3,
    summary: '乾隆五十八年（1793年）《钦定藏内善后章程》规定，达赖、班禅等活佛转世须经金瓶掣签确定，由驻藏大臣主持，报清廷批准，以杜绝转世灵童舞弊。',
    cause: '乾隆朝廓尔喀侵藏后，为加强中央对西藏宗教事务的控制。',
    effect: '金瓶掣签确立中央对西藏活佛转世的最终决定权。',
    examTip: '金瓶掣签=清治西藏、驻藏大臣主持；与驻藏大臣、钦定西藏章程连考。',
    people: ['乾隆帝'], location: '拉萨（今西藏拉萨）', tags: ['清代', '西藏', '宗教'],
    related: ['驻藏大臣设置'], wikiSlug: '金瓶掣签'
  },
  {
    title: '京剧的形成', year: 1790, yearMode: 'approx', yearRange: null, era: '', eraSub: '',
    dynasty: '清', period: '明清', type: '文化', importance: 2,
    summary: '乾隆五十五年（1790年）徽班进京为乾隆祝寿，四大徽班融徽调、汉调、昆曲、秦腔，道光年间形成皮黄腔为主的京剧，成为影响最大的剧种。',
    cause: '徽班进京后吸收各地声腔，融合形成新剧种。',
    effect: '京剧集戏曲之大成，是国粹，近代成为中国第一大剧种。',
    examTip: '京剧=徽班进京（1790）起、皮黄；"徽汉合流"；常考时间点。',
    people: [], location: '北京（今北京）', tags: ['清代', '戏曲'],
    related: ['清代传奇《长生殿》《桃花扇》'], wikiSlug: '京剧'
  },
];
module.exports = ADDON;
