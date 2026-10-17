/* Lập lá số — every placement follows grandma's "Phần I: Lập lá số tử vi" (TT. so bo + the start of Luận TV 11.2011).
   Where her method differs from the books most apps follow, `variant: 'books'` switches to the books' way:
   Hỏa/Linh, Tứ Hóa of Canh years, Thiên Phúc of Quý years. Things she did not write down (a birth in a leap month,
   a birth between 23:00 and 24:00, which lunar calendar a date was written in, clock or sun time) are settings,
   shown on the chart as not hers. */
import { BRANCHES, BRANCH_ELEMENT, PALACES, STEMS, STARS, STAR_BY_ID, brightOf, mod10, mod12, type Element, type Level, type Palace, type StarDef } from './names.js';
import { leapMonthOf, lunarToSolar, lunarZoneFor, solarToLunar, type LunarDate } from './lunar.js';
import { trueSolarTime } from './solar-time.js';

export type Gender = 'male' | 'female';

export interface BirthInput {
  name?: string;
  gender: Gender;
  calendar: 'solar' | 'lunar';
  year: number; month: number; day: number;
  /** lunar input only: the date is in the leap month */
  leap?: boolean;
  /** solar input: clock time (0–23, 0–59); lunar input: the giờ branch 0 Tý … 11 Hợi */
  hour: number; minute?: number;
  /** birthplace: latitude picks the lunar calendar of 1968–1975 (South below the 17th parallel); longitude gives sun time */
  latitude?: number | null; longitude?: number | null;
  /** the clock's UTC offset at birth, in minutes (Hà Nội 1990: 420) */
  utcOffsetMinutes?: number | null;
}

export interface ChartOptions {
  /** 'grandma' = grandma's placements (default); 'books' = the common books' placements for the few stars where they differ */
  variant: 'grandma' | 'books';
  /** born in a leap month: 'same' = count as that month; 'split15' = days 1–15 that month, 16–30 the next */
  leapMonth: 'same' | 'split15';
  /** solar input, 23:00–23:59: giờ Tý of the next day (true) or of the same day */
  tyNextDay: boolean;
  /** the year whose tiểu hạn to show (default: this year) */
  viewYear: number;
  /** which lunar calendar a date was written in: 'auto' by date and birthplace (see lunarZoneFor), or forced */
  lunarCalendar?: 'auto' | 'utc7' | 'utc8';
  /** the birth hour as the clock showed it (default), or turned into apparent solar time at the birthplace */
  hourBasis?: 'clock' | 'true_solar';
}

export const defaultOptions = (): ChartOptions => ({ variant: 'grandma', leapMonth: 'same', tyNextDay: true, viewYear: new Date().getFullYear(), lunarCalendar: 'auto', hourBasis: 'clock' });

const pad2 = (n: number) => String(n).padStart(2, '0');
const lunarText = (l: LunarDate) => `${l.day}/${l.month}${l.leap ? ' nhuận' : ''}/${l.year}`;
const sameLunar = (a: LunarDate, b: LunarDate) => a.day === b.day && a.month === b.month && a.year === b.year && a.leap === b.leap;

export interface PlacedStar { id: string; name: string; kind: StarDef['kind']; tone?: StarDef['tone']; ring?: StarDef['ring']; level?: Level; source?: 'supplement'; hoa?: string }

export interface PalaceCell {
  branch: number; stem: number; role: Palace; isThan: boolean;
  stars: PlacedStar[];
  daiHan: [number, number];
  /** tiểu hạn label: the year branch whose tiểu hạn falls here */
  tieuHanBranch: number;
}

export const NAP_AM: { name: string; element: Element }[] = [
  ['Hải Trung Kim', 'Kim'], ['Lô Trung Hỏa', 'Hỏa'], ['Đại Lâm Mộc', 'Mộc'], ['Lộ Bàng Thổ', 'Thổ'], ['Kiếm Phong Kim', 'Kim'],
  ['Sơn Đầu Hỏa', 'Hỏa'], ['Giản Hạ Thủy', 'Thủy'], ['Thành Đầu Thổ', 'Thổ'], ['Bạch Lạp Kim', 'Kim'], ['Dương Liễu Mộc', 'Mộc'],
  ['Tuyền Trung Thủy', 'Thủy'], ['Ốc Thượng Thổ', 'Thổ'], ['Tích Lịch Hỏa', 'Hỏa'], ['Tùng Bách Mộc', 'Mộc'], ['Trường Lưu Thủy', 'Thủy'],
  ['Sa Trung Kim', 'Kim'], ['Sơn Hạ Hỏa', 'Hỏa'], ['Bình Địa Mộc', 'Mộc'], ['Bích Thượng Thổ', 'Thổ'], ['Kim Bạch Kim', 'Kim'],
  ['Phú Đăng Hỏa', 'Hỏa'], ['Thiên Hà Thủy', 'Thủy'], ['Đại Trạch Thổ', 'Thổ'], ['Thoa Xuyến Kim', 'Kim'], ['Tang Đố Mộc', 'Mộc'],
  ['Đại Khê Thủy', 'Thủy'], ['Sa Trung Thổ', 'Thổ'], ['Thiên Thượng Hỏa', 'Hỏa'], ['Thạch Lựu Mộc', 'Mộc'], ['Đại Hải Thủy', 'Thủy'],
].map(([name, element]) => ({ name, element: element as Element }));

/** position in the sixty-year cycle of a stem + branch pair (Giáp Tý = 0) */
export const sexagenary = (stem: number, branch: number) => (((6 * stem - 5 * branch) % 60) + 60) % 60;
export const napAmOf = (stem: number, branch: number) => NAP_AM[Math.floor(sexagenary(stem, branch) / 2)];

export const CUC: Record<Element, { n: number; name: string }> = {
  'Thủy': { n: 2, name: 'Thủy Nhị Cục' }, 'Mộc': { n: 3, name: 'Mộc Tam Cục' }, 'Kim': { n: 4, name: 'Kim Tứ Cục' },
  'Thổ': { n: 5, name: 'Thổ Ngũ Cục' }, 'Hỏa': { n: 6, name: 'Hỏa Lục Cục' },
};

/** Tử Vi's palace for a day and a cục — the five tables in TT. so bo follow exactly this rule */
export function tuViPosition(cuc: number, day: number): number {
  let k = 0;
  while ((day + k) % cuc) k++;
  const q = (day + k) / cuc, p = mod12(2 + q - 1);
  return k % 2 ? mod12(p - k) : mod12(p + k);
}

/** Tứ Hóa by year stem: Lộc, Quyền, Khoa, Kỵ */
const TU_HOA_GRANDMA: string[][] = [
  ['Liêm Trinh', 'Phá Quân', 'Vũ Khúc', 'Thái Dương'], ['Thiên Cơ', 'Thiên Lương', 'Tử Vi', 'Thái Âm'], ['Thiên Đồng', 'Thiên Cơ', 'Văn Xương', 'Liêm Trinh'],
  ['Thái Âm', 'Thiên Đồng', 'Thiên Cơ', 'Cự Môn'], ['Tham Lang', 'Thái Âm', 'Hữu Bật', 'Thiên Cơ'], ['Vũ Khúc', 'Tham Lang', 'Thiên Lương', 'Văn Khúc'],
  ['Thái Dương', 'Vũ Khúc', 'Thiên Đồng', 'Thái Âm'], ['Cự Môn', 'Thái Dương', 'Văn Khúc', 'Văn Xương'], ['Thiên Lương', 'Tử Vi', 'Thiên Phủ', 'Vũ Khúc'],
  ['Phá Quân', 'Cự Môn', 'Thái Âm', 'Tham Lang'],
];
const TU_HOA_BOOKS_CANH = ['Thái Dương', 'Vũ Khúc', 'Thái Âm', 'Thiên Đồng'];
const HOA_IDS = ['hoa_loc', 'hoa_quyen', 'hoa_khoa', 'hoa_ky'];

const B = (n: string) => BRANCHES.indexOf(n as (typeof BRANCHES)[number]);
const list = (names: string[]) => names.map(B);
const LOC_TON = list(['Dần', 'Mão', 'Tỵ', 'Ngọ', 'Tỵ', 'Ngọ', 'Thân', 'Dậu', 'Hợi', 'Tý']);
const LUU_NIEN_VAN_TINH = list(['Tỵ', 'Ngọ', 'Thân', 'Dậu', 'Thân', 'Dậu', 'Hợi', 'Tý', 'Dần', 'Mão']);
const KHOI = list(['Sửu', 'Tý', 'Hợi', 'Hợi', 'Sửu', 'Tý', 'Ngọ', 'Ngọ', 'Mão', 'Mão']);
const VIET = list(['Mùi', 'Thân', 'Dậu', 'Dậu', 'Mùi', 'Thân', 'Dần', 'Dần', 'Tỵ', 'Tỵ']);
const THIEN_TRU = list(['Tỵ', 'Ngọ', 'Tý', 'Tỵ', 'Ngọ', 'Thân', 'Dần', 'Ngọ', 'Dậu', 'Tuất']);
const THIEN_QUAN = list(['Mùi', 'Thìn', 'Tỵ', 'Dần', 'Mão', 'Dậu', 'Hợi', 'Dậu', 'Tuất', 'Ngọ']);
const THIEN_PHUC_GRANDMA = list(['Dậu', 'Thân', 'Tý', 'Hợi', 'Mão', 'Dần', 'Ngọ', 'Tỵ', 'Ngọ', 'Tý']);
const THIEN_PHUC_BOOKS = list(['Dậu', 'Thân', 'Tý', 'Hợi', 'Mão', 'Dần', 'Ngọ', 'Tỵ', 'Ngọ', 'Tỵ']);
const LUU_HA = list(['Dậu', 'Tuất', 'Mùi', 'Thân', 'Tỵ', 'Ngọ', 'Thìn', 'Mão', 'Hợi', 'Dần']);
/** year-branch trines: 0 Thân Tý Thìn · 1 Dần Ngọ Tuất · 2 Tỵ Dậu Sửu · 3 Hợi Mão Mùi */
const trine = (b: number) => [0, 2, 1, 3][b % 4];
const DAO_HOA = list(['Dậu', 'Mão', 'Ngọ', 'Tý']), THIEN_MA = list(['Dần', 'Thân', 'Hợi', 'Tỵ']);
const HOA_CAI = list(['Thìn', 'Tuất', 'Sửu', 'Mùi']), KIEP_SAT = list(['Tỵ', 'Hợi', 'Dần', 'Thân']);
const HOA_START = list(['Dần', 'Sửu', 'Mão', 'Dậu']), LINH_START = list(['Tuất', 'Mão', 'Tuất', 'Tuất']);
const TIEU_HAN_START = list(['Tuất', 'Thìn', 'Mùi', 'Sửu']);
/** Tràng Sinh starts by cục: Kim Tỵ · Hỏa Dần · Thủy Thân · Thổ Thân · Mộc Hợi */
const TRANG_SINH: Record<Element, number> = { 'Kim': 5, 'Hỏa': 2, 'Thủy': 8, 'Thổ': 8, 'Mộc': 11 };
const MENH_CHU = ['Tham Lang', 'Cự Môn', 'Lộc Tồn', 'Văn Khúc', 'Liêm Trinh', 'Vũ Khúc', 'Phá Quân', 'Vũ Khúc', 'Liêm Trinh', 'Văn Khúc', 'Lộc Tồn', 'Cự Môn'];
const THAN_CHU = ['Linh Tinh', 'Thiên Tướng', 'Thiên Lương', 'Thiên Đồng', 'Văn Xương', 'Thiên Cơ', 'Hỏa Tinh', 'Thiên Tướng', 'Thiên Lương', 'Thiên Đồng', 'Văn Xương', 'Thiên Cơ'];
/** the order of each ring */
const LOC_RING = ['bac_si', 'luc_si', 'thanh_long', 'tieu_hao', 'tuong_quan', 'tau_thu', 'phi_liem', 'hy_than', 'benh_phu', 'dai_hao', 'phuc_binh', 'quan_phu_loc'];
const TUE_RING = ['thai_tue', 'thieu_duong', 'tang_mon', 'thieu_am', 'quan_phu_tue', 'tu_phu', 'tue_pha', 'long_duc', 'bach_ho', 'phuc_duc', 'dieu_khach', 'truc_phu'];
const SINH_RING = ['trang_sinh', 'moc_duc', 'quan_doi', 'lam_quan', 'de_vuong', 'suy', 'benh', 'tu', 'mo', 'tuyet', 'thai', 'duong'];
/** Đồng hạn (ages 1–12): "Mệnh Tài ách phu phúc Quan Di Nô Tử Điền Huynh Phụ" */
export const DONG_HAN: Palace[] = ['Mệnh', 'Tài Bạch', 'Tật Ách', 'Phu Thê', 'Phúc Đức', 'Quan Lộc', 'Thiên Di', 'Nô Bộc', 'Tử Tức', 'Điền Trạch', 'Huynh Đệ', 'Phụ Mẫu'];

export interface Chart {
  input: BirthInput; options: ChartOptions;
  solar: [number, number, number];
  lunar: LunarDate;
  /** the lunar month used to place stars (differs from lunar.month only for a leap month split at day 15) */
  month: number;
  /** the lunar day placed (the day after, for 23:00–24:00 with tyNextDay) */
  day: number;
  hour: number;
  stem: number; branch: number;
  yang: boolean; forward: boolean;
  amDuong: string;
  menh: number; than: number;
  napAm: { name: string; element: Element };
  cuc: { element: Element; n: number; name: string };
  menhChu: string; thanChu: string;
  palaces: PalaceCell[];
  /** star id → branch (Tuần/Triệt: the first of their two palaces) */
  pos: Record<string, number>;
  tuan: [number, number]; triet: [number, number];
  /** stars whose place follows grandma's method where the books differ */
  variantStars: string[];
  /** settings she did not write down that changed this chart */
  notes: string[];
  /** the meridian of the lunar calendar used for this date (7 or 8) */
  lunarZone: 7 | 8;
  /** set when the UTC+7 and UTC+8 calendars give this solar date different lunar dates — worth checking with family papers */
  calendarWarning?: string;
  /** the hour and minute the giờ was read from, when sun time replaced the clock */
  solarClock?: { hour: number; minute: number };
}

export function canChiYear(year: number) { return { stem: mod10(year - 4), branch: mod12(year - 4) }; }
export const canChiName = (stem: number, branch: number) => `${STEMS[stem]} ${BRANCHES[branch]}`;
export const hourBranchOf = (hour: number) => Math.floor((hour + 1) / 2) % 12;

/** `fast` skips converting a lunar input back to its solar date (bulk checks over many charts). */
export function buildChart(input: BirthInput, opts: ChartOptions = defaultOptions(), fast = false): Chart {
  const notes: string[] = [];
  const forced = opts.lunarCalendar === 'utc7' ? 7 : opts.lunarCalendar === 'utc8' ? 8 : null;
  let lunar: LunarDate, solar: [number, number, number], hour: number, zone: 7 | 8 = 7;
  let calendarWarning: string | undefined, solarClock: { hour: number; minute: number } | undefined;
  if (input.calendar === 'solar') {
    let [d, m, y] = [input.day, input.month, input.year];
    let h = input.hour, mi = input.minute ?? 0;
    solar = [d, m, y];
    if (opts.hourBasis === 'true_solar') {
      if (input.longitude == null || input.utcOffsetMinutes == null) notes.push('Chưa có kinh độ nơi sinh hoặc múi giờ, nên giờ vẫn tính theo đồng hồ.');
      else {
        const t = trueSolarTime(d, m, y, h, mi, input.longitude, input.utcOffsetMinutes);
        [d, m, y, h, mi] = [t.day, t.month, t.year, t.hour, t.minute];
        solarClock = { hour: h, minute: mi };
        notes.push(`Giờ tính theo mặt trời tại nơi sinh: ${pad2(h)}:${pad2(mi)} (${t.shiftMinutes >= 0 ? 'sớm' : 'muộn'} hơn đồng hồ ${Math.abs(t.shiftMinutes)} phút).`);
      }
    }
    hour = hourBranchOf(h);
    if (h >= 23 && opts.tyNextDay) {
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      [d, m, y] = [next.getUTCDate(), next.getUTCMonth() + 1, next.getUTCFullYear()];
      notes.push('Sinh sau 23 giờ: tính giờ Tý của ngày hôm sau.');
    }
    zone = forced ?? lunarZoneFor(d, m, y, input.latitude);
    lunar = solarToLunar(d, m, y, zone);
    const other = solarToLunar(d, m, y, zone === 7 ? 8 : 7);
    if (!sameLunar(lunar, other)) {
      calendarWarning = `Ngày này lịch UTC+7 và lịch UTC+8 lệch nhau: lá số dùng ${lunarText(lunar)} (UTC+${zone}), lịch kia là ${lunarText(other)}. Nếu giấy tờ gia đình ghi ngày âm khác, đổi lịch trong tuỳ chọn.`;
    }
  } else {
    lunar = { day: input.day, month: input.month, year: input.year, leap: !!input.leap };
    hour = mod12(input.hour);
    if (fast) solar = [0, 0, 0];
    else {
      const at = (tz: 7 | 8) => lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.leap, tz);
      let s = at(forced ?? 7);
      if (forced) zone = forced;
      else {
        /* the date was written in the calendar of its time: when that is UTC+8, convert with it (a leap month may
           exist in only one of the two calendars) */
        const s8 = at(8);
        if (s8 && lunarZoneFor(s8[0], s8[1], s8[2], input.latitude) === 8) { s = s8; zone = 8; }
      }
      if (!s) throw new Error(`Năm âm lịch ${input.year} không có tháng ${input.month} nhuận.`);
      solar = s;
    }
  }
  if (zone === 8) notes.push(input.calendar === 'solar'
    ? 'Đổi ra âm lịch theo lịch tính cho UTC+8 — lịch dùng trước năm 1968 (ở miền Nam đến 1975).'
    : 'Đổi ngày âm ra dương lịch theo lịch tính cho UTC+8 — lịch dùng trước năm 1968 (ở miền Nam đến 1975).');
  let month = lunar.month;
  if (lunar.leap) {
    if (opts.leapMonth === 'split15' && lunar.day > 15) { month = month % 12 + 1; notes.push(`Sinh tháng ${lunar.month} nhuận, sau ngày 15: an sao theo tháng ${month}.`); }
    else notes.push(`Sinh tháng ${lunar.month} nhuận: an sao như tháng ${lunar.month}.`);
  }
  const day = lunar.day;
  const { stem, branch } = canChiYear(lunar.year);
  const yang = stem % 2 === 0, male = input.gender === 'male';
  const forward = yang === male;
  const amDuong = `${yang ? 'Dương' : 'Âm'} ${male ? 'Nam' : 'Nữ'}`;

  // 5/ An Mệnh, 6/ An Thân
  const menh = mod12(2 + (month - 1) - hour), than = mod12(2 + (month - 1) + hour);
  // palace stems from Dần (Ngũ hổ độn)
  const stemDan = mod10((stem % 5) * 2 + 2);
  const stemOf = (b: number) => mod10(stemDan + mod12(b - 2));
  // 2/ Tìm Cục — the nạp âm of the Mệnh palace
  const cucEl = napAmOf(stemOf(menh), menh).element, cuc = { element: cucEl, ...CUC[cucEl] };

  const pos: Record<string, number> = {};
  const put = (id: string, b: number) => { pos[id] = mod12(b); };
  // 7/ Tử Vi and the main stars
  const tv = tuViPosition(cuc.n, day);
  put('tu_vi', tv); put('thien_co', tv - 1); put('thai_duong', tv - 3); put('vu_khuc', tv - 4); put('thien_dong', tv - 5); put('liem_trinh', tv - 8);
  const tp = mod12(4 - tv);
  put('thien_phu', tp); put('thai_am', tp + 1); put('tham_lang', tp + 2); put('cu_mon', tp + 3); put('thien_tuong', tp + 4); put('thien_luong', tp + 5); put('that_sat', tp + 6); put('pha_quan', tp + 10);
  // Tuần, Triệt
  const giap = mod12(branch - stem), tuan: [number, number] = [mod12(giap - 2), mod12(giap - 1)];
  const t0 = [8, 6, 4, 2, 0][stem % 5], triet: [number, number] = [t0, t0 + 1];
  // by month
  put('ta_phu', 4 + month - 1); put('huu_bat', 10 - (month - 1));
  put('tam_thai', pos.ta_phu + day - 1); put('bat_toa', pos.huu_bat - (day - 1));
  put('thien_giai', 8 + month - 1); put('dia_giai', 7 + month - 1); put('thien_hinh', 9 + month - 1);
  put('thien_dieu', 1 + month - 1); put('thien_y', 1 + month - 1);
  // by hour
  put('van_xuong', 10 - hour); put('van_khuc', 4 + hour);
  put('an_quang', pos.van_xuong + day - 2); put('thien_quy', pos.van_khuc - day + 2);
  put('thai_phu', pos.van_khuc + 2); put('phong_cao', pos.van_khuc - 2);
  put('dia_kiep', 11 + hour); put('dia_khong', 11 - hour);
  // by year branch
  put('long_tri', 4 + branch); put('phuong_cac', 10 - branch); put('giai_than', pos.phuong_cac);
  put('nguyet_duc', 5 + branch); put('thien_duc', 9 + branch);
  put('thien_tai', menh + branch); put('thien_tho', than + branch);
  put('thien_khoc', 6 - branch); put('thien_hu', 6 + branch);
  put('hong_loan', 3 - branch); put('thien_hy', pos.hong_loan + 6);
  const g = trine(branch);
  put('dao_hoa', DAO_HOA[g]); put('thien_ma', THIEN_MA[g]); put('hoa_cai', HOA_CAI[g]); put('kiep_sat', KIEP_SAT[g]);
  put('pha_toai', [5, 9, 1][[0, 2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1][branch]]);
  const season = Math.floor(mod12(branch - 2) / 3); // 0 Dần Mão Thìn · 1 Tỵ Ngọ Mùi · 2 Thân Dậu Tuất · 3 Hợi Tý Sửu
  put('co_than', [5, 8, 11, 2][season]); put('qua_tu', [1, 4, 7, 10][season]);
  // fixed
  put('thien_la', 4); put('dia_vong', 10);
  put('thien_thuong', menh + 5); put('thien_su', menh + 7);
  // by year stem
  put('thien_khoi', KHOI[stem]); put('thien_viet', VIET[stem]); put('thien_tru', THIEN_TRU[stem]);
  put('luu_nien_van_tinh', LUU_NIEN_VAN_TINH[stem]);
  put('thien_quan', THIEN_QUAN[stem]);
  put('thien_phuc', (opts.variant === 'books' ? THIEN_PHUC_BOOKS : THIEN_PHUC_GRANDMA)[stem]);
  put('luu_ha', LUU_HA[stem]);
  const loc = LOC_TON[stem];
  put('loc_ton', loc); put('kinh_duong', loc + 1); put('da_la', loc - 1);
  put('quoc_an', loc + 8); put('duong_phu', loc - 7);
  LOC_RING.forEach((id, i) => put(id, loc + (forward ? i : -i)));
  // Thái Tuế ring: thuận from the year branch
  TUE_RING.forEach((id, i) => put(id, branch + i));
  put('thien_khong', branch + 1); put('quan_sach', branch - 1);
  put('dau_quan', branch - (month - 1) + hour);
  // Hỏa, Linh
  const variantStars: string[] = [];
  if (opts.variant === 'books') {
    put('hoa_tinh', HOA_START[g] + (forward ? hour : -hour)); put('linh_tinh', LINH_START[g] + (forward ? -hour : hour));
  } else {
    // "Từ cung khởi theo tuổi, tính thuận đến giờ sinh … Nam khởi Hỏa trước; Nữ khởi Linh trước"
    const [first, second] = [HOA_START[g], LINH_START[g]];
    put(male ? 'hoa_tinh' : 'linh_tinh', first + hour); put(male ? 'linh_tinh' : 'hoa_tinh', second + hour);
  }
  // Tràng Sinh ring
  const ts = TRANG_SINH[cuc.element];
  SINH_RING.forEach((id, i) => put(id, ts + (forward ? i : -i)));
  // Tứ Hóa
  const hoa = opts.variant === 'books' && stem === 6 ? TU_HOA_BOOKS_CANH : TU_HOA_GRANDMA[stem];
  const hoaOf: Record<string, string> = {};
  hoa.forEach((name, i) => { const s = STARS.find(x => x.name === name)!; put(HOA_IDS[i], pos[s.id]); hoaOf[s.id] = STAR_BY_ID[HOA_IDS[i]].name; });
  if (opts.variant === 'grandma') {
    const booksHoa = HOA_START[g] + (forward ? hour : -hour), booksLinh = LINH_START[g] + (forward ? -hour : hour);
    if (mod12(booksHoa) !== pos.hoa_tinh || mod12(booksLinh) !== pos.linh_tinh) variantStars.push('hoa_tinh', 'linh_tinh');
    if (stem === 6) variantStars.push('hoa_khoa', 'hoa_ky');
    if (stem === 9) variantStars.push('thien_phuc');
  }

  // palaces, đại hạn, tiểu hạn labels
  const thStart = TIEU_HAN_START[g];
  const palaces: PalaceCell[] = BRANCHES.map((_, b) => {
    const k = mod12(b - menh);
    const steps = forward ? mod12(b - menh) : mod12(menh - b);
    const from = cuc.n + steps * 10;
    const tieu = male ? mod12(branch + mod12(b - thStart)) : mod12(branch + mod12(thStart - b));
    return { branch: b, stem: stemOf(b), role: PALACES[k], isThan: b === than, stars: [], daiHan: [from, from + 9], tieuHanBranch: tieu };
  });
  if (!fast) for (const s of STARS) {
    if (s.kind === 'khong') continue;
    const b = pos[s.id];
    if (b === undefined) continue;
    palaces[b].stars.push({ id: s.id, name: s.name, kind: s.kind, tone: s.tone, ring: s.ring, level: brightOf(s, b), source: s.source, hoa: hoaOf[s.id] });
  }
  pos.tuan = tuan[0]; pos.triet = triet[0];

  return {
    input, options: opts, solar, lunar, month, day, hour, stem, branch, yang, forward, amDuong, menh, than,
    napAm: napAmOf(stem, branch), cuc, menhChu: MENH_CHU[branch], thanChu: THAN_CHU[branch],
    palaces, pos, tuan, triet, variantStars, notes, lunarZone: zone, calendarWarning, solarClock,
  };
}

/** palaces a star occupies — two for Tuần and Triệt */
export function placesOf(chart: Chart, id: string): number[] {
  if (id === 'tuan') return chart.tuan;
  if (id === 'triet') return chart.triet;
  const b = chart.pos[id];
  return b === undefined ? [] : [b];
}

/** tuổi mụ in a given year */
export const ageIn = (chart: Chart, year: number) => year - chart.lunar.year + 1;

/** the palace of đại hạn at a tuổi mụ (null before the first đại hạn starts) */
export function daiHanAt(chart: Chart, age: number): number | null {
  const c = chart.palaces.find(p => age >= p.daiHan[0] && age <= p.daiHan[1]);
  return c ? c.branch : null;
}

/** tiểu hạn of a solar year (its lunar year), or the đồng hạn palace for ages 1–12 */
export function tieuHanAt(chart: Chart, year: number): { branch: number; dong: boolean } {
  const age = ageIn(chart, year);
  if (age >= 1 && age <= 12) {
    const role = DONG_HAN[age - 1];
    return { branch: chart.palaces.find(p => p.role === role)!.branch, dong: true };
  }
  const yb = mod12(year - 4);
  return { branch: chart.palaces.find(p => p.tieuHanBranch === yb)!.branch, dong: false };
}

/** Nguyệt hạn: "Tính Nguyệt nghịch, thời thuận ở cung năm tiểu hạn" → the palace of each lunar month of that year */
export function nguyetHan(chart: Chart, year: number): number[] {
  const t = tieuHanAt(chart, year).branch;
  const gieng = mod12(t - (chart.month - 1) + chart.hour);
  return Array.from({ length: 12 }, (_, i) => mod12(gieng + i));
}

/** the leap month of a lunar year in the calendar of that time (UTC+8 before 1968) */
export const leapOfYear = (year: number, zone: 7 | 8 = year < 1968 ? 8 : 7) => leapMonthOf(year, zone);
export const elementOfBranch = (b: number) => BRANCH_ELEMENT[b];
