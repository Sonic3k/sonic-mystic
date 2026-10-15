/* Tử vi on the server: a chart from a birth, and grandma's sentences (with the added layer kept apart) for every
   palace, Thân and the hạn of a year — in one answer, so a page can switch views without asking again. */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ENGINE_VERSION } from '@mystic/engine';
import {
  VIEWS, buildChart, defaultOptions, principlesFor, readHan, readView,
  type BirthInput, type Chart, type ChartOptions, type Group, type View,
} from '@mystic/engine/tuvi';
import type { GroupDto, RuleDto, TuViReadingDto, TuViSettings } from '@mystic/engine/api';
import { KnowledgeService, type Knowledge } from '../kb/knowledge.service.js';

export const GENERAL_PRINCIPLES = ['menh_chu', 'than_chu', 'tam_phuong', 'mieu_ham', 'dai_han', 'tieu_han'];
const thisYear = () => new Date().getFullYear();

export function optionsOf(settings: Partial<TuViSettings> | undefined, viewYear?: number): ChartOptions {
  const d = defaultOptions();
  return {
    variant: settings?.variant === 'sach' ? 'sach' : 'ba',
    leapMonth: settings?.leapMonth === 'split15' ? 'split15' : 'same',
    tyNextDay: settings?.tyNextDay !== false,
    lunarCalendar: settings?.lunarCalendar === 'utc7' || settings?.lunarCalendar === 'utc8' ? settings.lunarCalendar : 'auto',
    hourBasis: settings?.hourBasis === 'true_solar' ? 'true_solar' : 'clock',
    viewYear: viewYear && Number.isInteger(viewYear) ? viewYear : d.viewYear,
  };
}

/** a chart, or a 400 that says what is wrong with the birth */
export function chartOf(birth: BirthInput, options: ChartOptions): Chart {
  if (!birth || (birth.calendar !== 'solar' && birth.calendar !== 'lunar')) throw new BadRequestException('Thiếu ngày sinh');
  if (birth.gender !== 'nam' && birth.gender !== 'nu') throw new BadRequestException('Chưa chọn giới tính');
  const { year, month, day, hour } = birth;
  if (![year, month, day, hour].every(Number.isInteger)) throw new BadRequestException('Ngày giờ sinh không hợp lệ');
  if (year < 1800 || year > 2200) throw new BadRequestException('Năm sinh phải từ 1800 đến 2200');
  if (month < 1 || month > 12) throw new BadRequestException('Tháng sinh phải từ 1 đến 12');
  if (birth.calendar === 'solar') {
    const real = new Date(Date.UTC(year, month - 1, day));
    if (day < 1 || real.getUTCMonth() !== month - 1) throw new BadRequestException(`Không có ngày ${day}/${month}/${year} dương lịch`);
    if (hour < 0 || hour > 23) throw new BadRequestException('Giờ sinh phải từ 0 đến 23');
  } else {
    if (day < 1 || day > 30) throw new BadRequestException('Ngày âm lịch phải từ 1 đến 30');
    if (hour < 0 || hour > 11) throw new BadRequestException('Giờ âm lịch phải từ 0 (Tý) đến 11 (Hợi)');
  }
  try {
    return buildChart(birth, options);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}

@Injectable()
export class TuViService {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  chart(birth: BirthInput, settings?: Partial<TuViSettings>, viewYear?: number): Chart {
    return chartOf(birth, optionsOf(settings, viewYear));
  }

  async reading(birth: BirthInput, settings?: Partial<TuViSettings>, viewYear = thisYear()): Promise<TuViReadingDto> {
    const k = await this.knowledge.get();
    const chart = chartOf(birth, optionsOf(settings, viewYear));
    return this.readingOf(chart, k, viewYear);
  }

  readingOf(chart: Chart, k: Knowledge, viewYear: number): TuViReadingDto {
    const used = new Set<string>();
    const groups = (gs: Group[]): GroupDto[] => gs.map(g => ({
      key: g.key, star: g.star ?? null, name: g.name, entryRef: g.entry ?? null, inPalace: g.inPalace,
      matches: g.matches.map(m => { used.add(m.rule.id); return { rule: m.rule.id, why: m.why }; }),
    }));
    const views = Object.fromEntries(VIEWS.map(v => {
      const r = readView(chart, k.kb, v, viewYear);
      return [v, { view: r.view, branch: r.branch, about: r.about ?? null, counts: r.counts, ba: groups(r.ba), boSung: groups(r.boSung) }];
    })) as TuViReadingDto['views'];
    const h = readHan(chart, k.kb, viewYear);
    const han: TuViReadingDto['han'] = {
      year: h.year, age: h.age, canChi: h.canChi, months: h.months,
      dai: h.dai ? { branch: h.dai.branch, from: h.dai.from, to: h.dai.to, ba: groups(h.dai.ba), boSung: groups(h.dai.boSung) } : null,
      tieu: { branch: h.tieu.branch, dong: h.tieu.dong, ba: groups(h.tieu.ba), boSung: groups(h.tieu.boSung) },
    };
    const rules: Record<string, RuleDto> = {};
    for (const code of used) { const r = k.rules.get(code); if (r) rules[code] = r; }
    const general = Object.fromEntries(GENERAL_PRINCIPLES.map(id => [id, k.kb.principles[id]]).filter(([, p]) => p));
    return {
      engineVersion: ENGINE_VERSION, knowledgeVersion: k.version, viewYear, chart, views, han,
      principles: principlesFor(chart, k.kb), general, rules, sources: k.sources,
    };
  }
}

export type { View };
