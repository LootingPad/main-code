"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatUsd } from "@/lib/format";
import type { TrenchCandle, TrenchTick } from "@/lib/trenches";

const UP = "#2ebd85";
const DOWN = "#f6465d";
const ZONE = new Date().getTimezoneOffset() * 60;

const FRAMES = [
  { id: "1s", ms: 1_000, bars: 90 },
  { id: "30s", ms: 30_000, bars: 80 },
  { id: "1m", ms: 60_000, bars: 80 },
  { id: "1H", ms: 3_600_000, bars: 72 },
  { id: "4H", ms: 14_400_000, bars: 60 },
  { id: "1D", ms: 86_400_000, bars: 48 },
] as const;

type FrameId = (typeof FRAMES)[number]["id"];
type Hover = { o: number; h: number; l: number; c: number; v: number };

function frameForHistory(ticks: TrenchTick[]): FrameId {
  if (ticks.length < 2) return "1s";
  const span = Math.max(...ticks.map((tick) => tick.t)) - Math.min(...ticks.map((tick) => tick.t));
  if (span <= 8 * 60_000) return "1s";
  if (span <= 30 * 60_000) return "30s";
  if (span <= 4 * 3_600_000) return "1m";
  if (span <= 36 * 3_600_000) return "1H";
  if (span <= 8 * 24 * 3_600_000) return "4H";
  return "1D";
}

function chartTime(ms: number): UTCTimestamp {
  return (Math.floor(ms / 1000) - ZONE) as UTCTimestamp;
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

function toSeries(bars: TrenchCandle[]) {
  const candles: CandlestickData[] = [];
  const volume: HistogramData[] = [];
  for (const bar of bars) {
    const time = chartTime(bar.t);
    const rising = bar.c >= bar.o;
    const last = candles[candles.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, bar.h);
      last.low = Math.min(last.low, bar.l);
      last.close = bar.c;
      const bin = volume[volume.length - 1];
      if (bin) bin.value += bar.v;
      continue;
    }
    candles.push({ time, open: bar.o, high: bar.h, low: bar.l, close: bar.c });
    volume.push({
      time,
      value: bar.v,
      color: rising ? "rgba(46, 189, 133, 0.45)" : "rgba(246, 70, 93, 0.45)",
    });
  }
  return { candles, volume };
}

function sameSeries(prev: CandlestickData[], next: CandlestickData[], prevVolume: HistogramData[], nextVolume: HistogramData[]) {
  if (prev.length !== next.length || prevVolume.length !== nextVolume.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const before = prev[i];
    const after = next[i];
    if (!before || !after || before.time !== after.time || before.open !== after.open || before.high !== after.high || before.low !== after.low || before.close !== after.close) {
      return false;
    }
  }
  const left = prevVolume[prevVolume.length - 1];
  const right = nextVolume[nextVolume.length - 1];
  return (left?.time ?? 0) === (right?.time ?? 0) && (left?.value ?? 0) === (right?.value ?? 0);
}

function canAppend(prev: CandlestickData[], next: CandlestickData[]) {
  if (prev.length === 0 || next.length === 0 || next.length < prev.length || next.length > prev.length + 1) return false;
  if (next[0]?.time !== prev[0]?.time) return false;
  for (let i = 0; i < prev.length - 1; i += 1) {
    if (next[i]?.time !== prev[i]?.time) return false;
  }
  return (next[next.length - 1]?.time ?? 0) >= (prev[prev.length - 1]?.time ?? 0);
}

export function CandleChart({
  symbol,
  ticks,
}: {
  symbol: string;
  ticks: TrenchTick[];
  spot?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const countRef = useRef(0);
  const followRef = useRef(true);
  const anchorRef = useRef(true);
  const prevRef = useRef<CandlestickData[]>([]);
  const prevVolumeRef = useRef<HistogramData[]>([]);
  const seriesRef = useRef(toSeries([]));
  const frameBarsRef = useRef(90);
  const picked = useRef(false);
  const [frameId, setFrameId] = useState<FrameId>("1m");
  const [hover, setHover] = useState<Hover | null>(null);
  const [following, setFollowing] = useState(true);
  const frame = FRAMES.find((item) => item.id === frameId) ?? FRAMES[1];
  frameBarsRef.current = frame.bars;

  const bars = useMemo(() => aggregate(ticks, frame.ms), [ticks, frame.ms]);
  const last = bars[bars.length - 1];
  const first = bars[0];
  const session = first && last
    ? {
        o: first.o,
        h: Math.max(...bars.map((bar) => bar.h)),
        l: Math.min(...bars.map((bar) => bar.l)),
        c: last.c,
        v: 0,
      }
    : null;
  const active = hover ?? session;
  const base = hover ? hover.o : (session?.o ?? 0);
  const delta = active ? active.c - base : 0;
  const pct = base > 0 ? (delta / base) * 100 : 0;
  const volume = hover ? hover.v : bars.reduce((sum, bar) => sum + bar.v, 0);

  useEffect(() => {
    if (picked.current || ticks.length === 0) return;
    setFrameId(frameForHistory(ticks));
  }, [ticks]);

  useEffect(() => {
    anchorRef.current = true;
    prevRef.current = [];
    prevVolumeRef.current = [];
    setHover(null);
  }, [frameId, symbol]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8d8d8d",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.28)", labelBackgroundColor: "#2a2e34" },
        horzLine: { color: "rgba(255,255,255,0.28)", labelBackgroundColor: "#2a2e34" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 3,
        shiftVisibleRangeOnNewBar: true,
      },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineColor: UP,
      priceFormat: { type: "custom", formatter: formatUsd, minMove: 0.01 },
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "volume" },
    });
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    chart.subscribeCrosshairMove((param) => {
      const row = param.seriesData.get(candle);
      const bin = param.seriesData.get(volumeSeries);
      if (!param.point || !row || !("open" in row)) {
        setHover(null);
        return;
      }
      const vol = bin && "value" in bin ? bin.value : 0;
      setHover({ o: row.open, h: row.high, l: row.low, c: row.close, v: vol });
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      const atEnd = range.to >= countRef.current - 1;
      if (atEnd === followRef.current) return;
      followRef.current = atEnd;
      chart.timeScale().applyOptions({ shiftVisibleRangeOnNewBar: atEnd });
      setFollowing(atEnd);
    });
    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volumeSeries;
    const seeded = seriesRef.current;
    if (seeded.candles.length > 0) {
      candle.setData(seeded.candles);
      volumeSeries.setData(seeded.volume);
      countRef.current = seeded.candles.length;
      const from = Math.max(0, seeded.candles.length - frameBarsRef.current);
      chart.timeScale().setVisibleLogicalRange({ from, to: seeded.candles.length + 2 });
      anchorRef.current = false;
      prevRef.current = seeded.candles;
      prevVolumeRef.current = seeded.volume;
    }
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const next = toSeries(bars);
    seriesRef.current = next;
    const chart = chartRef.current;
    const candle = candleRef.current;
    const volumeSeries = volumeRef.current;
    if (!chart || !candle || !volumeSeries) return;
    if (sameSeries(prevRef.current, next.candles, prevVolumeRef.current, next.volume)) return;
    chart.applyOptions({ timeScale: { secondsVisible: frame.ms < 60_000 } });
    const lastCandle = next.candles[next.candles.length - 1];
    if (lastCandle) candle.applyOptions({ priceLineColor: lastCandle.close >= lastCandle.open ? UP : DOWN });
    countRef.current = next.candles.length;
    if (next.candles.length === 0) {
      candle.setData([]);
      volumeSeries.setData([]);
      prevRef.current = [];
      prevVolumeRef.current = [];
      return;
    }
    if (!anchorRef.current && canAppend(prevRef.current, next.candles)) {
      const lastCandle = next.candles[next.candles.length - 1];
      const lastVolume = next.volume[next.volume.length - 1];
      if (lastCandle) candle.update(lastCandle);
      if (lastVolume) volumeSeries.update(lastVolume);
    } else {
      const range = chart.timeScale().getVisibleRange();
      candle.setData(next.candles);
      volumeSeries.setData(next.volume);
      if (anchorRef.current || !range) {
        const from = Math.max(0, next.candles.length - frame.bars);
        chart.timeScale().setVisibleLogicalRange({ from, to: next.candles.length + 2 });
        anchorRef.current = false;
        followRef.current = true;
        chart.timeScale().applyOptions({ shiftVisibleRangeOnNewBar: true });
        setFollowing(true);
      } else if (followRef.current) {
        chart.timeScale().scrollToRealTime();
      } else {
        chart.timeScale().setVisibleRange(range);
      }
    }
    prevRef.current = next.candles;
    prevVolumeRef.current = next.volume;
  }, [bars, frame.bars, frame.ms]);

  return (
    <div className="trade-chart">
      <div className="chart-frames">
        <div role="tablist" aria-label="Chart interval">
          {FRAMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === frameId}
              className={item.id === frameId ? "is-on" : ""}
              onClick={() => {
                picked.current = true;
                setFrameId(item.id);
              }}
            >
              {item.id}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={following ? "chart-live" : "chart-live is-back"}
          onClick={() => {
            followRef.current = true;
            setFollowing(true);
            chartRef.current?.timeScale().applyOptions({ shiftVisibleRangeOnNewBar: true });
            chartRef.current?.timeScale().scrollToRealTime();
          }}
        >
          <i />
          {following ? "Live" : "Latest"}
        </button>
      </div>
      {active ? (
        <>
          <div className="chart-ohlc">
            <b>
              {symbol} · {frame.id}
            </b>
            <span>O {formatUsd(active.o)}</span>
            <span className="is-up">H {formatUsd(active.h)}</span>
            <span className="is-down">L {formatUsd(active.l)}</span>
            <span>C {formatUsd(active.c)}</span>
            <span className={delta >= 0 ? "is-up" : "is-down"}>
              {delta >= 0 ? "+" : ""}
              {formatUsd(delta)} ({delta >= 0 ? "+" : ""}
              {pct.toFixed(2)}%)
            </span>
          </div>
          <div className="chart-volume-label">Volume {formatUsd(volume)}</div>
        </>
      ) : (
        <p className="ohlc-empty">Waiting for trades</p>
      )}
      <div ref={hostRef} className="chart-host" />
    </div>
  );
}
