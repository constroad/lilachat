import { useState } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from 'lucide-react';
import { dayTemperature, hourLabel, pointLabel, weatherCurve, weatherFacts, type WeatherBlock, type WeatherIcon, type WeatherSeries } from '@lilachat/shared';
import { TONE } from './tones';

const ICONS: Record<WeatherIcon, LucideIcon> = { sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, storm: CloudLightning, fog: CloudFog };
const TABS: { key: WeatherSeries; label: string }[] = [{ key: 'temp', label: 'Temperatura' }, { key: 'rain', label: 'Precipitaciones' }, { key: 'wind', label: 'Viento' }];
const CURVE = { width: 320, height: 96, pad: 22 };

/**
 * /clima like Google's (pending 96, design e-33): the chosen day's now, its
 * curve by hours with three tabs, and the strip of days; a day's dot is its
 * risk to pave. The APK's `BlockWeather` is its twin.
 */
export function BlockWeather({ block }: { block: WeatherBlock }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [series, setSeries] = useState<WeatherSeries>('temp');
  const day = block.days[Math.min(dayIndex, block.days.length - 1)]!;
  const Icon = ICONS[day.icon];
  const temperature = dayTemperature(day);
  const curve = weatherCurve(day.hours, series, CURVE.width, CURVE.height, CURVE.pad);
  return (
    <div data-testid="bloque-clima" aria-label={block.place ? `Clima en ${block.place}` : undefined} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={40} strokeWidth={1.5} className="shrink-0 text-on-surface-variant" />
          {temperature !== undefined ? <span data-testid="clima-temperatura" className="text-4xl font-bold tabular-nums tracking-tight">{Math.round(temperature)} °C</span> : null}
        </div>
        <div className="min-w-0 text-right">
          {day.summary ? <p className="text-[14px] font-semibold">{day.summary}</p> : null}
          {weatherFacts(day).map((fact) => <p key={fact.label} className="text-[12px] text-on-surface-variant">{fact.label} <span className="font-semibold tabular-nums text-on-surface">{fact.value}</span></p>)}
        </div>
      </div>
      {day.risk ? <p data-testid="clima-riesgo" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${TONE[day.risk.tone].soft} ${TONE[day.risk.tone].text}`}><span className={`h-1.5 w-1.5 rounded-full ${TONE[day.risk.tone].bar}`} />{day.risk.label}</p> : null}
      {day.note ? <p className="text-[11px] text-on-surface-variant">{day.note}</p> : null}
      {day.hours.length ? (
        <div>
          <div role="tablist" className="flex gap-4 border-b border-outline/15">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={series === tab.key} data-testid={`clima-pestana-${tab.key}`} onClick={() => setSeries(tab.key)} className={`-mb-px border-b-2 pb-1.5 text-[13px] font-semibold ${series === tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>{tab.label}</button>
            ))}
          </div>
          {curve.points.length ? (
            <svg data-testid="clima-curva" viewBox={`-14 0 ${CURVE.width + 28} ${CURVE.height + 4}`} className="mt-2 h-28 w-full" role="img" aria-label={`${TABS.find((tab) => tab.key === series)!.label} por hora`}>
              <path d={curve.area} className="fill-primary/15" />
              <path d={curve.line} className="stroke-primary" strokeWidth={2} fill="none" />
              {curve.points.map((point) => (
                <g key={point.index}>
                  <circle cx={point.x} cy={point.y} r={3.5} className="fill-surface stroke-primary" strokeWidth={2} />
                  <text x={point.x} y={point.y - 8} textAnchor="middle" className="fill-on-surface text-[11px] font-semibold">{pointLabel(day.hours[point.index]!, series)}</text>
                </g>
              ))}
            </svg>
          ) : <p className="py-6 text-center text-[12px] text-on-surface-variant">Sin datos por hora</p>}
          <div className="flex justify-between">
            {day.hours.map((hour) => <span key={hour.at} className="text-[10px] text-on-surface-variant">{hourLabel(hour.at)}</span>)}
          </div>
        </div>
      ) : null}
      {block.days.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {block.days.map((one, index) => {
            const DayIcon = ICONS[one.icon];
            return (
              <button key={`${one.label}-${index}`} type="button" data-testid={`clima-dia-${index}`} aria-pressed={index === dayIndex} onClick={() => setDayIndex(index)} className={`relative flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 ${index === dayIndex ? 'border-2 border-primary' : 'border-outline/20'}`}>
                {one.risk ? <span aria-label={one.risk.label} className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${TONE[one.risk.tone].bar}`} /> : null}
                <span className={`text-[12px] ${index === dayIndex ? 'font-bold text-primary' : ''}`}>{one.label}</span>
                <DayIcon size={16} className="text-on-surface-variant" />
                {one.max !== undefined ? <span className="text-[12px] font-bold tabular-nums">{Math.round(one.max)}°</span> : null}
                {one.min !== undefined ? <span className="text-[11px] tabular-nums text-on-surface-variant">{Math.round(one.min)}°</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
