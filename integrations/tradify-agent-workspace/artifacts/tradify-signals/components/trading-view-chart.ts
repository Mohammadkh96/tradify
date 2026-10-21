import { lightweightChartsRuntime } from "./lightweight-charts-runtime";
import { brandPalette, chartContextPalette } from "@/constants/colors";

const chartPalette = {
  background: brandPalette.background,
  raised: brandPalette.raised,
  border: brandPalette.border,
  text: brandPalette.text,
  muted: brandPalette.muted,
  primary: brandPalette.gold,
  positive: brandPalette.teal,
  negative: brandPalette.error,
  warning: brandPalette.gold,
  context: chartContextPalette,
};

const chartPage = `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; background: ${chartPalette.background}; }
    body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; touch-action: none; overscroll-behavior: none; }
    #app { position: relative; }
    #chart { position: absolute; inset: 0; touch-action: none; }
     #hud { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
      #state { position: absolute; left: 10px; top: 9px; padding: 5px 7px; border: 1px solid ${chartPalette.positive}59; border-radius: 6px; background: ${chartPalette.background}D9; font: 800 9px -apple-system, sans-serif; letter-spacing: .8px; color: ${chartPalette.positive}; }
      #legend { position: absolute; left: 10px; top: 34px; max-width: calc(100% - 115px); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; color: ${chartPalette.muted}; }
      #countdown { position: absolute; right: 10px; top: 9px; padding: 5px 7px; border: 1px solid ${chartPalette.muted}3D; border-radius: 6px; background: ${chartPalette.background}D9; font: 800 9px ui-monospace, SFMono-Regular, Menlo, monospace; color: ${chartPalette.text}; }
      #crosshair { position: absolute; left: 10px; top: 58px; display: none; max-width: calc(100% - 20px); padding: 5px 7px; border: 1px solid ${chartPalette.primary}55; border-radius: 6px; background: ${chartPalette.background}E0; color: ${chartPalette.text}; font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #gesture-hint { position: absolute; right: 10px; bottom: 84px; padding: 6px 8px; border: 1px solid ${chartPalette.muted}3D; border-radius: 7px; background: ${chartPalette.background}D1; color: ${chartPalette.muted}; font: 800 8px -apple-system, sans-serif; letter-spacing: .55px; opacity: 1; transition: opacity .25s ease; }
     #gesture-hint.hidden { opacity: 0; }
     #empty { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; color: ${chartPalette.muted}; font: 12px -apple-system, sans-serif; }
    #empty.visible { display: flex; }
  </style>
</head>
<body>
  <div id="app">
    <div id="chart"></div>
     <div id="hud"><div id="state"></div><div id="legend"></div><div id="countdown"></div><div id="crosshair"></div><div id="gesture-hint">DRAG TO PAN · PINCH TO ZOOM</div><div id="empty"></div></div>
  </div>
  <script>${lightweightChartsRuntime}</script>
  <script>
    (function () {
      "use strict";
      var LC = window.LightweightCharts;
      var theme = ${JSON.stringify(chartPalette)};
      var root = document.getElementById("chart");
      var empty = document.getElementById("empty");
      var stateNode = document.getElementById("state");
      var legendNode = document.getElementById("legend");
      var countdownNode = document.getElementById("countdown");
       var crosshairNode = document.getElementById("crosshair");
       var gestureHintNode = document.getElementById("gesture-hint");
      var chart;
      var mainSeries;
      var volumeSeries;
      var candlesByTime = new Map();
      var latestData;
      var lastTime = 0;
      var activeSeriesType = "";
      var priceLines = [];
      var didFit = false;
      var lastClickAt = 0;
      var historyRequestPending = false;
      var frame;
       var priceAxisTouch = null;
       var priceAxisPadding = 0.08;
       var touchActive = false;
       var hintTimer;
       var lastLevelSignature = "";
       var lastSeriesKey = "";

       function clamp(value, minimum, maximum) {
         return Math.max(minimum, Math.min(maximum, value));
       }

       function isPriceAxisTouch(touch) {
         if (!touch) return false;
         var axisStart = Math.max(root.clientWidth - 88, root.clientWidth * 0.78);
         return touch.clientX >= axisStart;
       }

       function applyPriceAxisPadding(padding) {
         priceAxisPadding = clamp(padding, 0.015, 0.3);
         if (chart) {
           chart.priceScale("right").applyOptions({
             autoScale: true,
             scaleMargins: { top: priceAxisPadding, bottom: priceAxisPadding }
           });
         }
       }

       function onTouchStart(event) {
          if (!touchActive) post("INTERACTION", { active: true });
          touchActive = true;
          gestureHintNode.className = "hidden";
          if (hintTimer) clearTimeout(hintTimer);
         if (!event.touches || event.touches.length !== 1 || !isPriceAxisTouch(event.touches[0])) return;
         priceAxisTouch = { startY: event.touches[0].clientY, startPadding: priceAxisPadding };
         event.preventDefault();
         event.stopPropagation();
       }

       function onTouchMove(event) {
         if (!priceAxisTouch || !event.touches || event.touches.length !== 1) return;
         var distance = event.touches[0].clientY - priceAxisTouch.startY;
         applyPriceAxisPadding(priceAxisTouch.startPadding + distance / 900);
         event.preventDefault();
         event.stopPropagation();
       }

       function onTouchEnd(event) {
          if (priceAxisTouch) {
            priceAxisTouch = null;
            event.preventDefault();
            event.stopPropagation();
          }
          if (!event.touches || event.touches.length === 0) {
            touchActive = false;
            post("INTERACTION", { active: false });
          }
       }

      function post(type, payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(JSON.stringify({ type: type, payload: payload || {} }), "*");
        }
      }

      function safeNumber(value) {
        return typeof value === "number" && isFinite(value);
      }

      function sendState() {
        if (!chart || !latestData) return;
        var range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return;
        var info = latestData.candles.length ? latestData.candles[latestData.candles.length - 1] : null;
        var lastLogical = latestData.candles.length - 1;
        var away = range.to < lastLogical - 1.5;
        post("VIEWPORT", { from: range.from, to: range.to, awayFromRealtime: away });
        if (away) historyRequestPending = false;
        if (range.from <= 2 && latestData.hasOlderHistory && !historyRequestPending) {
          historyRequestPending = true;
          post("NEED_HISTORY", {});
        }
      }

      function sourceCandles(data) {
        var source = Array.isArray(data.candles) ? data.candles : [];
        if (data.candleMode !== "Heikin-Ashi") return source;
        var previousOpen;
        var previousClose;
        return source.map(function (candle) {
          var close = (candle.open + candle.high + candle.low + candle.close) / 4;
          var open = previousOpen === undefined ? (candle.open + candle.close) / 2 : (previousOpen + previousClose) / 2;
          previousOpen = open;
          previousClose = close;
          return { time: candle.time, open: open, high: Math.max(candle.high, open, close), low: Math.min(candle.low, open, close), close: close, volume: candle.volume };
        });
      }

      function seriesType(data) {
        if (data.chartType === "bars") return "bars";
        if (data.chartType === "line") return "line";
        if (data.chartType === "area") return "area";
        return "candles";
      }

      function createMainSeries(data) {
        var nextType = seriesType(data);
        if (mainSeries && activeSeriesType === nextType) return;
        if (mainSeries) chart.removeSeries(mainSeries);
         lastLevelSignature = "";
        activeSeriesType = nextType;
        var common = { priceLineVisible: false, lastValueVisible: false };
        if (nextType === "bars") {
          mainSeries = chart.addSeries(LC.BarSeries, Object.assign({}, common, {
            upColor: theme.positive, downColor: theme.negative, thinBars: false,
            openVisible: true, wickVisible: true, borderVisible: false
          }));
        } else if (nextType === "line") {
          mainSeries = chart.addSeries(LC.LineSeries, Object.assign({}, common, {
            color: theme.primary, lineWidth: 2, crosshairMarkerVisible: true
          }));
        } else if (nextType === "area") {
          mainSeries = chart.addSeries(LC.AreaSeries, Object.assign({}, common, {
            lineColor: theme.primary, topColor: theme.primary + "47", bottomColor: theme.primary + "05", lineWidth: 2
          }));
        } else {
          mainSeries = chart.addSeries(LC.CandlestickSeries, Object.assign({}, common, {
            upColor: theme.positive, downColor: theme.negative, borderUpColor: theme.positive, borderDownColor: theme.negative,
            wickUpColor: theme.positive, wickDownColor: theme.negative
          }));
        }
      }

      function seriesData(candles) {
        if (activeSeriesType === "line" || activeSeriesType === "area") {
          return candles.map(function (candle) { return { time: candle.time, value: candle.close }; });
        }
        return candles.map(function (candle) {
          return { time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close };
        });
      }

      function updateVolume(candles) {
        if (!volumeSeries) return;
        volumeSeries.setData(candles.map(function (candle) {
          return { time: candle.time, value: Math.max(0, candle.volume || 0), color: candle.close >= candle.open ? theme.positive + "6B" : theme.negative + "6B" };
        }));
      }

      function updateData(data) {
        var candles = sourceCandles(data).filter(function (candle) {
          return safeNumber(candle.time) && safeNumber(candle.open) && safeNumber(candle.high) && safeNumber(candle.low) && safeNumber(candle.close);
        }).sort(function (a, b) { return a.time - b.time; });
        latestData = Object.assign({}, data, { candles: candles });
         var nextSeriesKey = String(data.timeframe || "") + "|" + String(data.candleMode || "") + "|" + seriesType(data);
         if (lastSeriesKey && lastSeriesKey !== nextSeriesKey) {
           candlesByTime = new Map();
           lastTime = 0;
           didFit = false;
           if (mainSeries) mainSeries.setData([]);
           if (volumeSeries) volumeSeries.setData([]);
         }
         lastSeriesKey = nextSeriesKey;
         empty.textContent = data.dataState === "ERROR" ? "No valid market candle data" : "Waiting for the market series";
        empty.className = candles.length ? "" : "visible";
         stateNode.textContent = data.dataState === "LIVE" ? "LIVE" : String(data.dataState || "SYNCING");
          stateNode.style.color = data.dataState === "LIVE" ? theme.positive : theme.warning;
          stateNode.style.borderColor = data.dataState === "LIVE" ? theme.positive + "59" : theme.warning + "59";
        createMainSeries(data);
         if (!candles.length) {
           if (mainSeries) mainSeries.setData([]);
           if (volumeSeries) volumeSeries.setData([]);
           return;
         }

        var nextByTime = new Map(candles.map(function (candle) { return [candle.time, candle]; }));
        var historyChanged = candlesByTime.size === 0 || candles.length < candlesByTime.size || candles.some(function (candle) { return !candlesByTime.has(candle.time); }) && candles[0].time < Array.from(candlesByTime.keys())[0];
        if (historyChanged) {
          mainSeries.setData(seriesData(candles));
        } else {
          candles.forEach(function (candle) {
            if (!candlesByTime.has(candle.time) || candle.time >= lastTime) {
              mainSeries.update(seriesData([candle])[0]);
            }
          });
        }
        candlesByTime = nextByTime;
        lastTime = candles[candles.length - 1].time;
        updateVolume(candles);
        if (!didFit) {
          chart.timeScale().fitContent();
          didFit = true;
        }
        requestAnimationFrame(sendState);
      }

      function clearPriceLines() {
        if (!mainSeries) return;
        priceLines.forEach(function (line) { mainSeries.removePriceLine(line); });
        priceLines = [];
      }

      function addPriceLine(price, title, color, style, visible) {
        if (!visible || !safeNumber(price)) return;
        var line = mainSeries.createPriceLine({
          price: price, color: color, lineWidth: title === "SPOT" ? 1 : 1,
          lineStyle: style || 2, axisLabelVisible: title === "SPOT", lineVisible: true, title: title
        });
        priceLines.push(line);
      }

      function updateLevels(data) {
         var levelSignature = JSON.stringify({
           lastPrice: data.lastPrice,
           dataState: data.dataState,
           displayOnly: data.displayOnly,
           levels: data.levels,
           visibleLayers: data.visibleLayers
         });
         if (levelSignature === lastLevelSignature) return;
         lastLevelSignature = levelSignature;
        clearPriceLines();
        legendNode.textContent = "";
        if (!mainSeries) return;
         addPriceLine(data.lastPrice, "SPOT", theme.primary, 1, safeNumber(data.lastPrice));
        if (!data.levels || data.displayOnly || data.dataState !== "LIVE") return;
        var levels = data.levels;
        var side = levels.direction === "SHORT" ? "sell" : "buy";
        var directionalEntry = side === "buy" ? levels.buyEntry : levels.sellEntry;
        var directionalStop = side === "buy" ? levels.buyStop : levels.sellStop;
         addPriceLine(levels.entry, "ENTRY", theme.context.entry, 2, data.visibleLayers && data.visibleLayers.entries !== false);
         addPriceLine(directionalEntry, side === "buy" ? "BUY ENTRY" : "SELL ENTRY", side === "buy" ? theme.context.long : theme.context.short, 2, data.visibleLayers && data.visibleLayers.entries !== false);
         addPriceLine(directionalStop, "STOP", theme.context.risk, 2, data.visibleLayers && data.visibleLayers.stops !== false);
        var targets = side === "buy" ? levels.buyTargets : levels.sellTargets;
        if (data.visibleLayers && data.visibleLayers.targets !== false && Array.isArray(targets)) {
           targets.forEach(function (target, index) { addPriceLine(target, "TP" + (index + 1), theme.context.target, 3, true); });
        }
        var showSources = !data.visibleLayers || data.visibleLayers.sources !== false;
        var showPivots = !data.visibleLayers || data.visibleLayers.pivots !== false;
        addPriceLine(levels.sourceHigh, "SOURCE HIGH", theme.context.source, 3, showSources);
        addPriceLine(levels.sourceLow, "SOURCE LOW", theme.context.source, 3, showSources);
        addPriceLine(levels.pivotResistance, "PIVOT RESISTANCE", theme.context.pivot, 1, showPivots);
        addPriceLine(levels.pivotSupport, "PIVOT SUPPORT", theme.context.pivot, 1, showPivots);
        legendNode.textContent = "ENTRY " + (safeNumber(levels.entry) ? levels.entry.toFixed(2) : "—") +
           " · " + (side === "buy" ? "BUY ENTRY " : "SELL ENTRY ") + (safeNumber(directionalEntry) ? directionalEntry.toFixed(2) : "—") +
           " · STOP " + (safeNumber(directionalStop) ? directionalStop.toFixed(2) : "—") +
          (Array.isArray(targets) && targets.length ? " · TP1 " + (safeNumber(targets[0]) ? targets[0].toFixed(2) : "—") : "");
      }

      function updateCountdown() {
         if (frame) clearTimeout(frame);
        if (!latestData || !latestData.candles.length) return;
        var latest = latestData.candles[latestData.candles.length - 1];
        var seconds = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN1: 2592000 }[latestData.timeframe] || 900;
        var now = Math.floor(Date.now() / 1000);
        var remaining = Math.max(0, seconds - (now - latest.time));
        var minutes = Math.floor(remaining / 60);
        var secs = remaining % 60;
         countdownNode.textContent = "BAR CLOSE " + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
        frame = setTimeout(updateCountdown, 1000);
      }

      function init(data) {
        if (chart) return;
        chart = LC.createChart(root, {
          autoSize: true,
          layout: { background: { type: "solid", color: theme.background }, textColor: theme.muted, fontSize: 10, attributionLogo: false },
          grid: { vertLines: { color: theme.border + "24" }, horzLines: { color: theme.border + "35" } },
          crosshair: { mode: LC.CrosshairMode.Normal, vertLine: { color: theme.text + "B3", width: 1, style: 2, labelBackgroundColor: theme.raised }, horzLine: { color: theme.text + "B3", width: 1, style: 2, labelBackgroundColor: theme.raised } },
          rightPriceScale: { borderVisible: false, autoScale: true, scaleMargins: { top: .08, bottom: .08 }, entireTextOnly: false },
          timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7, minBarSpacing: 2, fixLeftEdge: false, lockVisibleTimeRangeOnResize: true },
          handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
          handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true, axisDoubleClickReset: true }
        });
        createMainSeries(data);
        try {
          volumeSeries = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", lastValueVisible: false, priceLineVisible: false }, 1);
          chart.panes()[1].setHeight(70);
        } catch (error) {
          volumeSeries = null;
        }
        chart.timeScale().subscribeVisibleLogicalRangeChange(sendState);
        chart.subscribeCrosshairMove(function (param) {
          if (!param || !param.time || !mainSeries) {
             crosshairNode.style.display = "none";
            post("CROSSHAIR", { active: false });
            return;
          }
          var point = param.seriesData && param.seriesData.get(mainSeries);
          var candle = candlesByTime.get(Number(param.time));
          if (!candle) return;
           var date = new Date(Number(param.time) * 1000);
           var hh = String(date.getUTCHours()).padStart(2, "0");
           var mm = String(date.getUTCMinutes()).padStart(2, "0");
           crosshairNode.textContent = hh + ":" + mm + "  O " + candle.open.toFixed(2) + "  H " + candle.high.toFixed(2) + "  L " + candle.low.toFixed(2) + "  C " + candle.close.toFixed(2);
           crosshairNode.style.display = "block";
          post("CROSSHAIR", { active: true, candle: candle, time: Number(param.time), value: point && point.close !== undefined ? point.close : candle.close });
        });
        root.addEventListener("dblclick", function (event) {
          event.preventDefault();
          if (event.clientX > root.clientWidth - 82) chart.priceScale("right").applyOptions({ autoScale: true });
          else chart.timeScale().fitContent();
          post("RESET", {});
        }, { passive: false });
        root.addEventListener("wheel", function (event) {
          if (event.clientX > root.clientWidth - 82) event.preventDefault();
        }, { passive: false });
         root.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
         root.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
         root.addEventListener("touchend", onTouchEnd, { passive: false, capture: true });
         root.addEventListener("touchcancel", onTouchEnd, { passive: false, capture: true });
        updateData(data);
        updateLevels(data);
        updateCountdown();
         hintTimer = setTimeout(function () { gestureHintNode.className = "hidden"; }, 5000);
      }

      function receive(raw) {
        var message;
        try { message = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (error) { return; }
        var data = message && message.payload ? message.payload : {};
        if (message.type === "INIT" || message.type === "DATA") {
          if (!chart) init(data);
          else {
            updateData(data);
            updateLevels(data);
            updateCountdown();
          }
        } else if (message.type === "SCROLL_TO_REALTIME" && chart) {
          chart.timeScale().scrollToRealTime();
          post("VIEWPORT", { awayFromRealtime: false });
        } else if (message.type === "RESET" && chart) {
          chart.timeScale().fitContent();
           priceAxisPadding = 0.08;
           chart.priceScale("right").applyOptions({ autoScale: true, scaleMargins: { top: 0.08, bottom: 0.08 } });
          post("RESET", {});
        }
      }

      document.addEventListener("message", function (event) { receive(event.data); });
      window.addEventListener("message", function (event) { receive(event.data); });
      window.addEventListener("resize", function () { if (chart) chart.resize(root.clientWidth, root.clientHeight); });
       window.addEventListener("beforeunload", function () {
         if (frame) clearTimeout(frame);
          if (hintTimer) clearTimeout(hintTimer);
         root.removeEventListener("touchstart", onTouchStart, true);
         root.removeEventListener("touchmove", onTouchMove, true);
         root.removeEventListener("touchend", onTouchEnd, true);
         root.removeEventListener("touchcancel", onTouchEnd, true);
         post("UNMOUNT", {});
       });
      post("READY", {});
    }());
  </script>
</body>
</html>
`;

export const tradingViewChartHtml = chartPage;
