"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatUsd } from "@/lib/format";
import type { TrenchCandle, TrenchTick } from "@/lib/trenches";

const UP = "#ccff00";
const DOWN = "#ff4d4d";
const ZONE = new Date().getTimezoneOffset() * 60;
/** Bucket size for full-history line — keeps ~120 points max. */
const BUCKET_TARGET = 120;

function chartTime(ms: number): UTCTimestamp {
  return (Math.floor(ms / 1000) - ZONE) as UTCTimestamp;
}

function bucketMs(ticks: TrenchTick[]): number {
  if (ticks.length < 2) return 1_000;
  const times = ticks.map((tick) => tick.t);
  const span = Math.max(...times) - Math.min(...times);
  if (span <= 0) return 1_000;
  return Math.max(1_000, Math.ceil(span / BUCKET_TARGET));
}

function aggregate(ticks: TrenchTick[], frameMs: number): TrenchCandle[] {
  const bars = new Map<number, TrenchCandle>();
  let prev = 0;
  for (const tick of [...ticks].sort((a, b) => a.t - b.t)) {
    if (!(tick.p > 0)) continue;
    const t = Math.floor(tick.t / frameMs) * frameMs;
    const bar = bars.get(t);
    if (!bar) {
      const open = prev > 0 ? prev : tick.p;
      bars.set(t, { t, o: open, h: Math.max(open, tick.p), l: Math.min(open, tick.p), c: tick.p, v: tick.v });
    } else {
      bar.h = Math.max(bar.h, tick.p);
      bar.l = Math.min(bar.l, tick.p);
      bar.c = tick.p;
      bar.v += tick.v;
    }
    prev = tick.p;
  }
  return [...bars.values()].sort((a, b) => a.t - b.t);
}

function toLine(bars: TrenchCandle[]): LineData[] {
  const line: LineData[] = [];
  for (const bar of bars) {
    const time = chartTime(bar.t);
    const last = line[line.length - 1];
    if (last && last.time === time) {
      last.value = bar.c;
      continue;
    }
    line.push({ time, value: bar.c });
  }
  return line;
}

function sameLine(prev: LineData[], next: LineData[]) {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const before = prev[i];
    const after = next[i];
    if (!before || !after || before.time !== after.time || before.value !== after.value) return false;
  }
  return true;
}

function canAppend(prev: LineData[], next: LineData[]) {
  if (prev.length === 0 || next.length === 0 || next.length < prev.length || next.length > prev.length + 1) {
    return false;
  }
  if (next[0]?.time !== prev[0]?.time) return false;
  for (let i = 0; i < prev.length - 1; i += 1) {
    if (next[i]?.time !== prev[i]?.time) return false;
  }
  return (next[next.length - 1]?.time ?? 0) >= (prev[prev.length - 1]?.time ?? 0);
}

function fitFull(chart: IChartApi) {
  chart.timeScale().fitContent();
}

/** Fixed full-history area chart — no timeframe tabs, no pan/zoom. */
export function CandleChart({
  symbol,
  ticks,
}: {
  symbol: string;
  ticks: TrenchTick[];
  spot?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Area"> | null>(null);
  const placeTipRef = useRef<(() => void) | null>(null);
  const anchorRef = useRef(true);
  const prevRef = useRef<LineData[]>([]);
  const seriesRef = useRef<LineData[]>([]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const frameMs = useMemo(() => bucketMs(ticks), [ticks]);
  const bars = useMemo(() => aggregate(ticks, frameMs), [ticks, frameMs]);
  const last = bars[bars.length - 1];
  const first = bars[0];
  const open = first?.o ?? 0;
  const price = hoverPrice ?? last?.c ?? 0;
  const delta = price - open;
  const pct = open > 0 ? (delta / open) * 100 : 0;
  const volume = bars.reduce((sum, bar) => sum + bar.v, 0);
  const up = delta >= 0;

  useEffect(() => {
    anchorRef.current = true;
    prevRef.current = [];
    setHoverPrice(null);
  }, [symbol]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9b9b9b",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "rgba(255,255,255,0.22)", labelBackgroundColor: "#222222" },
        horzLine: { color: "rgba(255,255,255,0.22)", labelBackgroundColor: "#222222" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: false,
      handleScale: false,
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: UP,
      topColor: "rgba(204, 255, 0, 0.22)",
      bottomColor: "rgba(204, 255, 0, 0)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: { type: "custom", formatter: formatUsd, minMove: 0.01 },
    });
    area.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.06 } });
    chart.subscribeCrosshairMove((param) => {
      const row = param.seriesData.get(area);
      if (!param.point || !row || !("value" in row)) {
        setHoverPrice(null);
        return;
      }
      setHoverPrice(row.value);
    });
    chartRef.current = chart;
    lineRef.current = area;
    const seeded = seriesRef.current;
    if (seeded.length > 0) {
      area.setData(seeded);
      fitFull(chart);
      anchorRef.current = false;
      prevRef.current = seeded;
    }
    const placeTip = () => {
      const tip = tipRef.current;
      const lastPoint = seriesRef.current[seriesRef.current.length - 1];
      if (!tip || !lastPoint) {
        if (tip) tip.style.opacity = "0";
        return;
      }
      const x = chart.timeScale().timeToCoordinate(lastPoint.time);
      const y = area.priceToCoordinate(lastPoint.value);
      if (x == null || y == null) {
        tip.style.opacity = "0";
        return;
      }
      tip.dataset.down = lastPoint.value < (seriesRef.current[0]?.value ?? lastPoint.value) ? "1" : "0";
      tip.style.opacity = "1";
      tip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };
    placeTipRef.current = placeTip;
    chart.timeScale().subscribeVisibleLogicalRangeChange(placeTip);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(placeTip) : null;
    ro?.observe(host);
    requestAnimationFrame(placeTip);
    return () => {
      ro?.disconnect();
      placeTipRef.current = null;
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const next = toLine(bars);
    seriesRef.current = next;
    const chart = chartRef.current;
    const area = lineRef.current;
    if (!chart || !area) return;
    if (sameLine(prevRef.current, next)) {
      placeTipRef.current?.();
      return;
    }
    chart.applyOptions({ timeScale: { secondsVisible: frameMs < 60_000 } });
    const tip = next[next.length - 1];
    const openValue = next[0]?.value ?? 0;
    const rising = tip ? tip.value >= openValue : true;
    area.applyOptions({
      lineColor: rising ? UP : DOWN,
      topColor: rising ? "rgba(204, 255, 0, 0.22)" : "rgba(255, 77, 77, 0.22)",
      bottomColor: rising ? "rgba(204, 255, 0, 0)" : "rgba(255, 77, 77, 0)",
    });
    if (next.length === 0) {
      area.setData([]);
      prevRef.current = [];
      placeTipRef.current?.();
      return;
    }
    if (!anchorRef.current && canAppend(prevRef.current, next)) {
      const lastPoint = next[next.length - 1];
      if (lastPoint) area.update(lastPoint);
    } else {
      area.setData(next);
      anchorRef.current = false;
    }
    fitFull(chart);
    prevRef.current = next;
    requestAnimationFrame(() => placeTipRef.current?.());
  }, [bars, frameMs]);

  const empty = !last;

  return (
    <div className={`trade-chart${empty ? " is-empty" : ""}`}>
      {!empty ? (
        <>
          <div className="chart-ohlc">
            <b>{symbol}</b>
            <span>{formatUsd(price)}</span>
            <span className={up ? "is-up" : "is-down"}>
              {delta >= 0 ? "+" : ""}
              {formatUsd(delta)} ({delta >= 0 ? "+" : ""}
              {pct.toFixed(2)}%)
            </span>
          </div>
          <div className="chart-volume-label">Volume {formatUsd(volume)}</div>
        </>
      ) : null}
      <div className="chart-host-wrap">
        <div ref={hostRef} className="chart-host" hidden={empty} />
        <span className="chart-watermark" aria-hidden>
          Lootingpad.com
        </span>
        <i ref={tipRef} className="chart-tip" aria-hidden />
      </div>
    </div>
  );
}
