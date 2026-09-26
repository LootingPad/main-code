"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type {
  LootingChartPoint,
  LootingTimePoint,
  LootingWalletPoint,
} from "@/lib/looting-token";

function formatAxisUsd(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function formatAxisCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function formatAxisPct(value: number) {
  return `${value.toFixed(0)}%`;
}

function createBaseChart(host: HTMLDivElement) {
  return createChart(host, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#8f8f8f",
      fontFamily: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: "rgba(255, 255, 255, 0.05)" },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(255, 255, 255, 0.16)",
        labelBackgroundColor: "#2a2a2a",
      },
      horzLine: {
        color: "rgba(255, 255, 255, 0.16)",
        labelBackgroundColor: "#2a2a2a",
      },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.14, bottom: 0.04 },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    handleScroll: { mouseWheel: false, pressedMouseMove: true },
    handleScale: { mouseWheel: false, pinch: true },
  });
}

function attachResize(host: HTMLDivElement, chart: IChartApi) {
  const observer = new ResizeObserver(() => {
    chart.timeScale().fitContent();
  });
  observer.observe(host);
  return () => observer.disconnect();
}

export function LootingCumulativeChart({ data }: { data: LootingChartPoint[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const burnRef = useRef<ISeriesApi<"Area"> | null>(null);
  const feeRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createBaseChart(host);
    burnRef.current = chart.addSeries(AreaSeries, {
      lineColor: "#ccff00",
      topColor: "rgba(204, 255, 0, 0.32)",
      bottomColor: "rgba(204, 255, 0, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisUsd, minMove: 1 },
    });
    feeRef.current = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.5)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisUsd, minMove: 1 },
    });
    chartRef.current = chart;
    const detach = attachResize(host, chart);
    return () => {
      detach();
      chart.remove();
      chartRef.current = null;
      burnRef.current = null;
      feeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!burnRef.current || !feeRef.current || !chartRef.current) return;
    burnRef.current.setData(data.map((point) => ({ time: point.time as Time, value: point.burnUsd })));
    feeRef.current.setData(data.map((point) => ({ time: point.time as Time, value: point.feeUsd })));
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return <div ref={hostRef} className="looting-lwc" role="img" aria-label="Cumulative burn and fee chart" />;
}

export function LootingDailyBurnChart({ data }: { data: LootingTimePoint[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createBaseChart(host);
    seriesRef.current = chart.addSeries(HistogramSeries, {
      color: "rgba(204, 255, 0, 0.82)",
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisUsd, minMove: 1 },
    });
    chartRef.current = chart;
    const detach = attachResize(host, chart);
    return () => {
      detach();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(
      data.map((point) => ({
        time: point.time as Time,
        value: point.value,
        color: "rgba(204, 255, 0, 0.78)",
      })),
    );
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return <div ref={hostRef} className="looting-lwc looting-lwc-sm" role="img" aria-label="Daily burn chart" />;
}

export function LootingRevenueAllocChart({
  data,
  targetPct,
}: {
  data: LootingTimePoint[];
  targetPct: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createBaseChart(host);
    const series = chart.addSeries(LineSeries, {
      color: "#ccff00",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisPct, minMove: 0.01 },
    });
    series.createPriceLine({
      price: targetPct,
      color: "rgba(255, 255, 255, 0.28)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `${targetPct}%`,
    });
    seriesRef.current = series;
    chartRef.current = chart;
    const detach = attachResize(host, chart);
    return () => {
      detach();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [targetPct]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(data.map((point) => ({ time: point.time as Time, value: point.value })));
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return (
    <div ref={hostRef} className="looting-lwc looting-lwc-sm" role="img" aria-label="Revenue allocated to burn chart" />
  );
}

export function LootingWalletsChart({ data }: { data: LootingWalletPoint[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chainRef = useRef<ISeriesApi<"Area"> | null>(null);
  const lootingRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createBaseChart(host);
    chainRef.current = chart.addSeries(AreaSeries, {
      lineColor: "#ccff00",
      topColor: "rgba(204, 255, 0, 0.28)",
      bottomColor: "rgba(204, 255, 0, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisCount, minMove: 1 },
    });
    lootingRef.current = chart.addSeries(AreaSeries, {
      lineColor: "rgba(255, 255, 255, 0.55)",
      topColor: "rgba(255, 255, 255, 0.12)",
      bottomColor: "rgba(255, 255, 255, 0.01)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: formatAxisCount, minMove: 1 },
    });
    chartRef.current = chart;
    const detach = attachResize(host, chart);
    return () => {
      detach();
      chart.remove();
      chartRef.current = null;
      chainRef.current = null;
      lootingRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chainRef.current || !lootingRef.current || !chartRef.current) return;
    chainRef.current.setData(data.map((point) => ({ time: point.time as Time, value: point.chain })));
    lootingRef.current.setData(data.map((point) => ({ time: point.time as Time, value: point.looting })));
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return <div ref={hostRef} className="looting-lwc looting-lwc-lg" role="img" aria-label="Active wallets chart" />;
}

export const LootingBurnChart = LootingCumulativeChart;
