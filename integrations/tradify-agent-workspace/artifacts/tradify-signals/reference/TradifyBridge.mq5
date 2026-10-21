//+------------------------------------------------------------------+
//|                                                TradifyBridge.mq5 |
//|                                  Copyright 2026, Tradify Systems |
//|                                             https://tradify.app |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Tradify Systems"
#property link      "https://tradify.app"
#property version   "1.27"
#property strict

// Active development candidate: v1.27. The archived v1.23 snapshots below
// are excluded unless TRADIFY_REFERENCE_ARCHIVED_V1_23 is explicitly defined.
#define TRADIFY_EA_BUILD_FINGERPRINT "tradify-ea-1.27-dev-date-aware-dst-partial-full-customer-scope"

//--- Inputs
input string TradifyBackendUrl = "";                        // Set only to an approved non-production API root
input string BridgeSecret      = "";                        // Shared reference feed secret; leave blank for a customer feed
input string FeedToken         = "";                        // Feed token shown once after Journal-linked Signals consent
input string BridgeId          = "unconfigured-demo";       // Diagnostic label only; feed identity comes from the selected token
input string ReplitExternalAccessToken = "";                // Optional private-development preview token; never log or share
input string TargetSymbols     = "XAUUSD,USTEC,US30,US500,EURUSD,GBPUSD,BTCUSDT,ETHUSDT"; // Comma-separated MT5 broker symbols to stream
input int    PublishIntervalMs = 100;                       // Quote Publish Interval (ms)
input int    CandleSyncSec     = 15;                        // Candle Sync Interval (seconds)

#define M15_HISTORY_LOOKBACK_DAYS 10

//--- Global Variables
ulong    lastHeartbeatTick = 0;
ulong    lastCandleSyncTick = 0;
ulong    lastSubscriptionFetchTick = 0;
ulong    lastSpecSyncTick = 0;
ulong    lastPublishTick = 0;
bool     candleSyncActive = false;
int      candleSymbolCursor = 0;
int      candleTimeframeCursor = 0;
string   targetSymbolList[];
int      targetSymbolCount = 0;
bool     targetSymbolSyncState[];
datetime m15CoverageStartUtc = 0;
datetime m15CoverageEndUtc = 0;
string   quoteSymbolList[];
int      quoteSymbolCount = 0;
string   completedHistoryKeys[];
string   m15BootstrapKeys[];
int      lastSubscriptionVersion = -1;
string   lastGenerationId = "";

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string JsonEscape(string text)
{
   string res = text;
   StringReplace(res, "\\", "\\\\");
   StringReplace(res, "\"", "\\\"");
   StringReplace(res, "\r", "");
   StringReplace(res, "\n", "\\n");
   return res;
}

//+------------------------------------------------------------------+
//| Helper: Parse Comma-Separated Symbols String                     |
//+------------------------------------------------------------------+
int ParseSymbols(string inputStr, string &outputArray[])
{
   ArrayFree(outputArray);
   string temp[];
   ushort u_sep = StringGetCharacter(",", 0);
   int k = StringSplit(inputStr, u_sep, temp);
   int validCount = 0;
   for(int i = 0; i < k; i++)
   {
      string sym = temp[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(StringLen(sym) > 0)
      {
         ArrayResize(outputArray, validCount + 1);
         outputArray[validCount] = sym;
         validCount++;
      }
   }
   return validCount;
}

bool IsStrategyTargetSymbol(string sym)
{
   for(int i = 0; i < targetSymbolCount; i++)
   {
      if(StringCompare(targetSymbolList[i], sym, false) == 0) return true;
   }
   return false;
}

void UpdateQuoteOnlySubscriptions(string response)
{
   string marker = "\"quoteSymbols\":[";
   int symStart = StringFind(response, marker);
   if(symStart < 0) return;

   int startArr = symStart + StringLen(marker);
   int endArr = StringFind(response, "]", startArr);
   if(endArr < startArr) return;

   string listStr = StringSubstr(response, startArr, endArr - startArr);
   StringReplace(listStr, "\"", "");
   string newSymbols[];
   int newCount = ParseSymbols(listStr, newSymbols);

   ArrayFree(quoteSymbolList);
   quoteSymbolCount = 0;
   for(int i = 0; i < newCount; i++)
   {
      string sym = newSymbols[i];
      if(IsStrategyTargetSymbol(sym)) continue;

      bool alreadyIn = false;
      for(int j = 0; j < quoteSymbolCount; j++)
      {
         if(StringCompare(quoteSymbolList[j], sym, false) == 0)
         {
            alreadyIn = true;
            break;
         }
      }
      if(alreadyIn) continue;

      bool selected = SymbolSelect(sym, true);
      if(!selected || !(bool)SymbolInfoInteger(sym, SYMBOL_SELECT))
      {
         PrintFormat("[TradifyBridge] Quote-only symbol '%s' is not available on this MT5 terminal.", sym);
         continue;
      }

      ArrayResize(quoteSymbolList, quoteSymbolCount + 1);
      quoteSymbolList[quoteSymbolCount] = sym;
      quoteSymbolCount++;
   }
   PrintFormat("[TradifyBridge] Active quote-only symbols: %d", quoteSymbolCount);
}

//+------------------------------------------------------------------+
//| Helper: HTTP POST WebRequest                                     |
//+------------------------------------------------------------------+
int SendPostRequest(string endpoint, string jsonPayload, string &responseStr)
{
   string requestEndpoint = endpoint;
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(FeedToken) > 0)
   {
      StringReplace(requestEndpoint, "/api/mt5/bridge/", "/api/mt5/customer/bridge/");
      headers += "x-customer-feed-token: " + FeedToken + "\r\n";
   }
   else
   {
      headers += "x-bridge-secret: " + BridgeSecret + "\r\n";
   }
   string fullUrl = TradifyBackendUrl + requestEndpoint;
    if(StringLen(ReplitExternalAccessToken) > 0)
       headers += "Authorization: Bearer " + ReplitExternalAccessToken + "\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int dataSize = ArraySize(postData);
   if(dataSize > 0 && postData[dataSize - 1] == 0)
   {
      ArrayResize(postData, dataSize - 1);
   }

   ResetLastError();
   int resCode = WebRequest("POST", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest failed to %s! Error code: %d. Check Tools -> Options -> EA WebRequest URLs.", fullUrl, err);
      return -1;
   }
   
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(resCode == 200)
   {
      string trimmed = responseStr;
      StringTrimLeft(trimmed);
      if(StringFind(trimmed, "<!") == 0 || StringFind(trimmed, "<html") == 0 || StringFind(trimmed, "<script") == 0 || StringFind(trimmed, "verifyCanSetCookies") >= 0)
      {
         PrintFormat("[TradifyBridge] ERROR: Backend returned HTML instead of API JSON. Check TradifyBackendUrl / Cloud Run access.");
         string preview = StringSubstr(responseStr, 0, 300);
         PrintFormat("Response preview: %s", preview);
         return -2;
      }
   }
   else
   {
      string preview = StringSubstr(responseStr, 0, 300);
      if(resCode == 401)
      {
         PrintFormat("[TradifyBridge] FEED AUTH REJECTED on %s. Check the selected account's FeedToken or shared BridgeSecret.", endpoint);
      }
      else
      {
         PrintFormat("[TradifyBridge] HTTP Error %d on %s: %s", resCode, endpoint, preview);
      }
   }

   return resCode;
}

//+------------------------------------------------------------------+
//| HTTP GET Request Helper                                          |
//+------------------------------------------------------------------+
int SendGetRequest(string endpoint, string &responseStr)
{
   string requestEndpoint = endpoint;
   string headers = "";
   if(StringLen(FeedToken) > 0)
   {
      StringReplace(requestEndpoint, "/api/mt5/bridge/", "/api/mt5/customer/bridge/");
      headers += "x-customer-feed-token: " + FeedToken + "\r\n";
   }
   else
   {
      headers += "x-bridge-secret: " + BridgeSecret + "\r\n";
   }
   string fullUrl = TradifyBackendUrl + requestEndpoint;
    if(StringLen(ReplitExternalAccessToken) > 0)
       headers += "Authorization: Bearer " + ReplitExternalAccessToken + "\r\n";
   char postData[];
   char resultData[];
   string resultHeaders;

   ResetLastError();
   int resCode = WebRequest("GET", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest GET failed to %s! Error: %d", fullUrl, err);
      return -1;
   }
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return resCode;
}

//+------------------------------------------------------------------+
//| Dynamic Subscriptions Fetch                                       |
//+------------------------------------------------------------------+
void FetchSubscriptions()
{
   string resp;
   ulong ts = GetTickCount64();
   string endpoint = "/api/mt5/bridge/subscriptions?t=" + IntegerToString(ts);
   int code = SendGetRequest(endpoint, resp);
   if(code == 200 && StringLen(resp) > 0)
   {
      int genStart = StringFind(resp, "\"generationId\":\"");
      if(genStart >= 0)
      {
         int startArr = genStart + 16;
         int endArr = StringFind(resp, "\"", startArr);
         if(endArr > startArr)
         {
            string newGenId = StringSubstr(resp, startArr, endArr - startArr);
            if(StringLen(lastGenerationId) > 0 && newGenId != lastGenerationId)
            {
               PrintFormat("[TradifyBridge] Server Generation ID changed to %s. Forcing FULL SYNC.", newGenId);
               for(int i = 0; i < targetSymbolCount; i++)
               {
                  targetSymbolSyncState[i] = false;
                  ResetSymbolHistory(targetSymbolList[i]);
               }
            }
            lastGenerationId = newGenId;
         }
      }

       // A fresh API process has no in-memory candle history. Keep sending
       // full batches until the server confirms every active symbol's M15
       // strategy history is ready, even when the subscription version is
       // unchanged across the restart.
       if(StringFind(resp, "\"requireFullSync\":true") >= 0)
       {
          for(int i = 0; i < targetSymbolCount; i++)
          {
             targetSymbolSyncState[i] = false;
             ResetSymbolHistory(targetSymbolList[i]);
          }
       }

       int verStart = StringFind(resp, "\"version\":");
      if(verStart >= 0)
      {
         int verEnd = StringFind(resp, ",", verStart);
         if(verEnd > verStart)
         {
            int newVersion = (int)StringToInteger(StringSubstr(resp, verStart + 10, verEnd - (verStart + 10)));
             if(newVersion != lastSubscriptionVersion)
             {
                PrintFormat("[TradifyBridge] Subscription version changed from %d to %d", lastSubscriptionVersion, newVersion);
                lastSubscriptionVersion = newVersion;
             }
         }
      }

      int symStart = StringFind(resp, "\"symbols\":[");
      if(symStart >= 0)
      {
         int startArr = symStart + 11;
         int endArr = StringFind(resp, "]", startArr);
         if(endArr > startArr)
         {
            string listStr = StringSubstr(resp, startArr, endArr - startArr);
            StringReplace(listStr, "\"", "");
            string newSyms[];
            int newCount = ParseSymbols(listStr, newSyms);
            
            // Add new symbols
            for(int i = 0; i < newCount; i++)
            {
               string sym = newSyms[i];
               bool alreadyIn = false;
               for(int j = 0; j < targetSymbolCount; j++)
               {
                  if(targetSymbolList[j] == sym) { alreadyIn = true; break; }
               }
               if(!alreadyIn)
               {
                  SymbolSelect(sym, true);
                  if(SymbolInfoInteger(sym, SYMBOL_SELECT))
                  {
                     ArrayResize(targetSymbolList, targetSymbolCount + 1);
                     ArrayResize(targetSymbolSyncState, targetSymbolCount + 1);
                     targetSymbolList[targetSymbolCount] = sym;
                     targetSymbolSyncState[targetSymbolCount] = false;
                     targetSymbolCount++;
                     PrintFormat("[TradifyBridge] ADD %s", sym);
                     PrintFormat("[TradifyBridge] %s selected", sym);
                     PrintFormat("[TradifyBridge] %s synchronized", sym);
                     PrintFormat("[TradifyBridge] %s quote active", sym);
                  }
               }
            }

            // Remove symbols no longer in subscription
            for(int j = targetSymbolCount - 1; j >= 0; j--)
            {
               string currentSym = targetSymbolList[j];
               bool stillRequired = false;
               for(int i = 0; i < newCount; i++)
               {
                  if(newSyms[i] == currentSym) { stillRequired = true; break; }
               }
               if(!stillRequired)
               {
                  PrintFormat("[TradifyBridge] Dynamic subscription removed symbol '%s'", currentSym);
                  ResetSymbolHistory(currentSym);
                  // Shift elements left
                  for(int k = j; k < targetSymbolCount - 1; k++)
                  {
                     targetSymbolList[k] = targetSymbolList[k+1];
                     targetSymbolSyncState[k] = targetSymbolSyncState[k+1];
                  }
                  targetSymbolCount--;
                  ArrayResize(targetSymbolList, targetSymbolCount);
                  ArrayResize(targetSymbolSyncState, targetSymbolCount);
               }
            }
            
            PrintFormat("[TradifyBridge] Active symbols: %d", targetSymbolCount);
            SendSpecifications();
         }
      }
      UpdateQuoteOnlySubscriptions(resp);
   }
}
//+------------------------------------------------------------------+
//| Heartbeat & Symbol Discovery                                     |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string serverName = (StringLen(accountServer) > 0) ? accountServer : company;
   if(StringLen(serverName) == 0) serverName = "MT5-Broker";

   bool isConnected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);

   // Discovery: collect active Market Watch symbols for Admin UI symbol mapping selector
   int mwTotal = SymbolsTotal(true);
   if(mwTotal <= 0) mwTotal = SymbolsTotal(false);

   string symbolsJson = "[";
   int count = 0;
   for(int i = 0; i < mwTotal && count < 200; i++)
   {
      string symName = SymbolName(i, true);
      if(StringLen(symName) == 0) symName = SymbolName(i, false);
      if(StringLen(symName) > 0)
      {
         if(count > 0) symbolsJson += ",";
         symbolsJson += "\"" + JsonEscape(symName) + "\"";
         count++;
      }
   }
   symbolsJson += "]";

   string payload = "{";
   string activeSymsJson = "[";
   for(int i = 0; i < targetSymbolCount; i++)
   {
      if(i > 0) activeSymsJson += ",";
      activeSymsJson += "\"" + targetSymbolList[i] + "\"";
   }
   activeSymsJson += "]";

   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"server\":\"" + JsonEscape(serverName) + "\",";
   payload += "\"connected\":" + (isConnected ? "true" : "false") + ",";
   payload += "\"discovered\":" + IntegerToString(count) + ",";
   payload += "\"active\":" + IntegerToString(targetSymbolCount) + ",";
   payload += "\"subscriptionVersion\":" + IntegerToString(lastSubscriptionVersion) + ",";
   payload += "\"activeSymbols\":" + activeSymsJson + ",";
   payload += "\"symbols\":" + symbolsJson;
   payload += "}";

   string resp;
   int code = SendPostRequest("/api/mt5/bridge/heartbeat", payload, resp);
   if(code == 200)
   {
      PrintFormat("[TradifyBridge] Heartbeat POST 200 | JSON OK | Discovered %d symbols | Server: %s", count, serverName);
   }
}

//+------------------------------------------------------------------+
//| Stream strategy and quote-only Market Watch symbols              |
//+------------------------------------------------------------------+
int PriceDigitsForSymbol(string sym)
{
   long digits = 0;
   if(!SymbolInfoInteger(sym, SYMBOL_DIGITS, digits) || digits < 0 || digits > 12)
      return -1;
   return (int)digits;
}

void SendQuotes()
{
   int publishSymbolCount = targetSymbolCount + quoteSymbolCount;
   if(publishSymbolCount <= 0) return;

   string quotesJson = "[";
   int validCount = 0;

   for(int i = 0; i < publishSymbolCount; i++)
   {
      string sym = i < targetSymbolCount
         ? targetSymbolList[i]
         : quoteSymbolList[i - targetSymbolCount];
      SymbolSelect(sym, true);

      MqlTick tick;
      if(SymbolInfoTick(sym, tick))
      {
         if(tick.bid > 0 || tick.ask > 0 || tick.last > 0)
         {
             int priceDigits = PriceDigitsForSymbol(sym);
             if(priceDigits < 0)
             {
                PrintFormat("[TradifyBridge] ERROR: Invalid SYMBOL_DIGITS for '%s'; quote skipped.", sym);
                continue;
             }
            long chartModeInt = SymbolInfoInteger(sym, SYMBOL_CHART_MODE);
            string chartModeStr = (chartModeInt == SYMBOL_CHART_MODE_LAST) ? "LAST" : "BID";

            if(validCount > 0) quotesJson += ",";
            quotesJson += "{";
            if(i >= targetSymbolCount) quotesJson += "\"quoteOnly\":true,";
            quotesJson += "\"symbol\":\"" + JsonEscape(sym) + "\",";
            quotesJson += "\"bid\":" + DoubleToString(tick.bid, priceDigits) + ",";
            quotesJson += "\"ask\":" + DoubleToString(tick.ask, priceDigits) + ",";
            quotesJson += "\"last\":" + DoubleToString(tick.last > 0 ? tick.last : (tick.bid + tick.ask)/2.0, priceDigits) + ",";
            quotesJson += "\"chartMode\":\"" + chartModeStr + "\",";
            quotesJson += "\"time\":" + IntegerToString(tick.time) + ",";
            quotesJson += "\"timeMsc\":" + IntegerToString(tick.time_msc);
            quotesJson += "}";
            validCount++;
         }
      }
   }
   quotesJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"quotes\":" + quotesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/quotes", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 | JSON OK | %d quotes sent", validCount);
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 but invalid Content/API response");
   }
   else
   {
      PrintFormat("[TradifyBridge] QUOTE ERROR HTTP %d | %d quotes attempted", resCode, validCount);
   }
}

//+------------------------------------------------------------------+
//| Stream Candles for a Symbol & Timeframe                          |
//+------------------------------------------------------------------+
int SendCandlesForSymbol(string sym, ENUM_TIMEFRAMES tfEnum, string tfName, int barsToFetch, bool fullSync)
{
   int priceDigits = PriceDigitsForSymbol(sym);
   if(priceDigits < 0)
   {
      PrintFormat("[TradifyBridge] ERROR: Invalid SYMBOL_DIGITS for '%s'; candle upload skipped.", sym);
      return 0;
   }
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(sym, tfEnum, 0, barsToFetch, rates);
   if(copied <= 0)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] CANDLE COPY ERROR %s %s | CopyRates failed, error code: %d", sym, tfName, err);
      return 0;
   }
   
   datetime firstTime = rates[copied - 1].time;
   datetime lastTime = rates[0].time;
   PrintFormat("[TradifyBridge] %s %s: firstTime=%s lastTime=%s bars=%d", sym, tfName, TimeToString(firstTime), TimeToString(lastTime), copied);

   string candlesJson = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) candlesJson += ",";
      candlesJson += "{";
      candlesJson += "\"time\":" + IntegerToString(rates[i].time) + ",";
      candlesJson += "\"open\":" + DoubleToString(rates[i].open, priceDigits) + ",";
      candlesJson += "\"high\":" + DoubleToString(rates[i].high, priceDigits) + ",";
      candlesJson += "\"low\":" + DoubleToString(rates[i].low, priceDigits) + ",";
      candlesJson += "\"close\":" + DoubleToString(rates[i].close, priceDigits) + ",";
      candlesJson += "\"volume\":" + IntegerToString(rates[i].tick_volume);
      candlesJson += "}";
   }
   candlesJson += "]";

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   payload += "\"timeframe\":\"" + tfName + "\",";
   payload += "\"syncMode\":\"" + (fullSync ? "FULL" : "INCREMENTAL") + "\",";
   payload += "\"candles\":" + candlesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/candles", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | %s | HTTP 200 | JSON OK", sym, tfName, copied, fullSync ? "FULL" : "INCREMENTAL");
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | Invalid Content/API response", sym, tfName, copied);
   }
   else
   {
      PrintFormat("[TradifyBridge] CANDLE ERROR HTTP %d on %s %s", resCode, sym, tfName);
   }

   // A copied batch is not delivered history until the API acknowledges it.
   return resCode == 200 ? copied : 0;
}

bool HasStringKey(string &keys[], string key)
{
   for(int i = 0; i < ArraySize(keys); i++)
      if(keys[i] == key) return true;
   return false;
}

void AddStringKey(string &keys[], string key)
{
   if(HasStringKey(keys, key)) return;
   int size = ArraySize(keys);
   ArrayResize(keys, size + 1);
   keys[size] = key;
}

void RemoveStringKey(string &keys[], string key)
{
   for(int i = ArraySize(keys) - 1; i >= 0; i--)
   {
      if(keys[i] != key) continue;
      for(int j = i; j < ArraySize(keys) - 1; j++)
         keys[j] = keys[j + 1];
      ArrayResize(keys, ArraySize(keys) - 1);
   }
}

void SetSymbolSyncState(string sym, bool synced)
{
   for(int i = 0; i < targetSymbolCount; i++)
      if(targetSymbolList[i] == sym)
         targetSymbolSyncState[i] = synced;
}

int SendCandlesForDateRange(string sym, ENUM_TIMEFRAMES tf, string tfName,
                            datetime rangeStart, datetime rangeEnd, bool fullSync)
{
   int priceDigits = PriceDigitsForSymbol(sym);
   if(priceDigits < 0)
   {
      PrintFormat("[TradifyBridge] ERROR: Invalid SYMBOL_DIGITS for '%s'; range upload skipped.", sym);
      return 0;
   }
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(sym, tf, rangeStart, rangeEnd - 1, rates);
   PrintFormat("[TradifyBridge] RANGE COPY %s %s requestedStart=%s requestedEnd=%s copied=%d",
               sym, tfName, TimeToString(rangeStart), TimeToString(rangeEnd), copied);
   if(copied <= 0)
   {
      PrintFormat("[TradifyBridge] RANGE COPY ERROR %s %s code=%d",
                  sym, tfName, GetLastError());
      return 0;
   }

   datetime firstTime = rates[copied - 1].time;
   datetime lastTime = rates[0].time;
   PrintFormat("[TradifyBridge] RANGE RESULT %s %s firstTime=%s lastTime=%s copied=%d",
               sym, tfName, TimeToString(firstTime), TimeToString(lastTime), copied);

   string candlesJson = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) candlesJson += ",";
      candlesJson += "{\"time\":" + IntegerToString(rates[i].time) + ",";
      candlesJson += "\"open\":" + DoubleToString(rates[i].open, priceDigits) + ",";
      candlesJson += "\"high\":" + DoubleToString(rates[i].high, priceDigits) + ",";
      candlesJson += "\"low\":" + DoubleToString(rates[i].low, priceDigits) + ",";
      candlesJson += "\"close\":" + DoubleToString(rates[i].close, priceDigits) + ",";
      candlesJson += "\"volume\":" + IntegerToString(rates[i].tick_volume) + "}";
   }
   candlesJson += "]";

   string payload = "{\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"symbol\":\"" + JsonEscape(sym) + "\",\"timeframe\":\"" + tfName + "\",";
   payload += "\"syncMode\":\"" + (fullSync ? "FULL" : "PARTIAL") + "\",";
   if(fullSync && StringCompare(tfName, "M15", false) == 0 &&
      m15CoverageStartUtc > 0 && m15CoverageEndUtc > m15CoverageStartUtc)
   {
      payload += "\"coverageRange\":{";
      payload += "\"startUtc\":" + IntegerToString((long)m15CoverageStartUtc) + ",";
      payload += "\"endUtc\":" + IntegerToString((long)m15CoverageEndUtc) + "},";
   }
   payload += "\"candles\":" + candlesJson + "}";

   string response;
   int resCode = SendPostRequest("/api/mt5/bridge/candles", payload, response);
   int accepted = -1;
   int acceptedPos = StringFind(response, "\"accepted\":");
   if(acceptedPos >= 0)
      accepted = (int)StringToInteger(StringSubstr(response, acceptedPos + 11));
   PrintFormat("[TradifyBridge] RANGE POST %s %s requestedStart=%s requestedEnd=%s copied=%d accepted=%d HTTP=%d mode=%s",
               sym, tfName, TimeToString(rangeStart), TimeToString(rangeEnd), copied,
               accepted, resCode, fullSync ? "FULL" : "PARTIAL");
   return resCode == 200 ? copied : 0;
}

bool RequestM15Coverage(string sym, datetime startUtc, datetime endUtc,
                        bool &complete, datetime &rangeStartServer,
                        datetime &rangeEndServer, datetime &missingStartServer,
                        datetime &missingEndServer)
{
   string payload = "{\"symbol\":\"" + JsonEscape(sym) + "\",";
   payload += "\"startUtc\":" + IntegerToString(startUtc) + ",";
   payload += "\"endUtc\":" + IntegerToString(endUtc) + "}";
   string response;
   int status = SendPostRequest("/api/mt5/bridge/history/coverage", payload, response);
   if(status != 200)
   {
      PrintFormat("[TradifyBridge] M15 COVERAGE ERROR %s requestedStartUtc=%s requestedEndUtc=%s HTTP=%d",
                  sym, TimeToString(startUtc), TimeToString(endUtc), status);
      return false;
   }
   int arrayPos = StringFind(response, "\"missingIntervals\":[");
   string rangeStartMarker = "\"rangeStartServerEpoch\":";
   string rangeEndMarker = "\"rangeEndServerEpoch\":";
   int rangeStartPos = StringFind(response, rangeStartMarker);
   int rangeEndPos = StringFind(response, rangeEndMarker);
   if(rangeStartPos < 0 || rangeEndPos < 0 || arrayPos < 0)
   {
      PrintFormat("[TradifyBridge] M15 COVERAGE INVALID RESPONSE %s", sym);
      return false;
   }
   rangeStartServer = (datetime)StringToInteger(
      StringSubstr(response, rangeStartPos + StringLen(rangeStartMarker)));
   rangeEndServer = (datetime)StringToInteger(
      StringSubstr(response, rangeEndPos + StringLen(rangeEndMarker)));
   if(rangeStartServer <= 0 || rangeEndServer <= rangeStartServer)
      return false;
   complete = StringFind(response, "\"complete\":true") >= 0;
   missingStartServer = 0;
   missingEndServer = 0;
   if(!complete)
   {
      string missingStartMarker = "\"startServerEpoch\":";
      string missingEndMarker = "\"endServerEpoch\":";
      int startPos = StringFind(response, missingStartMarker, arrayPos);
      int endPos = StringFind(response, missingEndMarker, arrayPos);
      if(startPos < 0 || endPos < 0) return false;
      missingStartServer = (datetime)StringToInteger(
         StringSubstr(response, startPos + StringLen(missingStartMarker)));
      missingEndServer = (datetime)StringToInteger(
         StringSubstr(response, endPos + StringLen(missingEndMarker)));
      if(missingStartServer <= 0 || missingEndServer <= missingStartServer) return false;
      PrintFormat("[TradifyBridge] M15 MISSING %s requestedStartUtc=%s requestedEndUtc=%s missingStartServer=%s missingEndServer=%s",
                  sym, TimeToString(startUtc), TimeToString(endUtc),
                  TimeToString(missingStartServer), TimeToString(missingEndServer));
   }
   else
      PrintFormat("[TradifyBridge] M15 COVERAGE COMPLETE %s requestedStartUtc=%s requestedEndUtc=%s",
                  sym, TimeToString(startUtc), TimeToString(endUtc));
   return true;
}

int SyncM15History(string sym, bool initial)
{
   datetime endUtc = (datetime)((long)TimeGMT() / 900 * 900);
   datetime startUtc = endUtc - M15_HISTORY_LOOKBACK_DAYS * 86400;
   m15CoverageStartUtc = startUtc;
   m15CoverageEndUtc = endUtc;
   string bootstrapKey = "M15_BOOTSTRAP:" + sym;
   string historyKey = sym + ":M15";

   bool complete = false;
   datetime rangeStartServer = 0;
   datetime rangeEndServer = 0;
   datetime missingStartServer = 0;
   datetime missingEndServer = 0;
   if(!RequestM15Coverage(sym, startUtc, endUtc, complete,
                          rangeStartServer, rangeEndServer,
                          missingStartServer, missingEndServer))
   {
      RemoveStringKey(completedHistoryKeys, historyKey);
      SetSymbolSyncState(sym, false);
      return 0;
   }

   if(!HasStringKey(m15BootstrapKeys, bootstrapKey))
   {
      int copied = SendCandlesForDateRange(sym, PERIOD_M15, "M15",
                                           rangeStartServer, rangeEndServer, false);
      if(copied > 0)
         AddStringKey(m15BootstrapKeys, bootstrapKey);
      return copied;
   }

   if(!complete)
   {
      RemoveStringKey(completedHistoryKeys, historyKey);
      SetSymbolSyncState(sym, false);
      return SendCandlesForDateRange(sym, PERIOD_M15, "M15",
                                     missingStartServer, missingEndServer, false);
   }

   if(initial)
   {
      int copied = SendCandlesForDateRange(sym, PERIOD_M15, "M15",
                                           rangeStartServer, rangeEndServer, true);
      if(copied > 0)
      {
         AddStringKey(completedHistoryKeys, historyKey);
         PrintFormat("[TradifyBridge] History ready %s M15; session coverage complete.", sym);
      }
      return copied;
   }
   return SendCandlesForSymbol(sym, PERIOD_M15, "M15", 5, false);
}

void ResetSymbolHistory(string sym)
{
   string prefix = sym + ":";
   for(int i = ArraySize(completedHistoryKeys) - 1; i >= 0; i--)
   {
      if(StringFind(completedHistoryKeys[i], prefix) != 0) continue;
      for(int j = i; j < ArraySize(completedHistoryKeys) - 1; j++)
         completedHistoryKeys[j] = completedHistoryKeys[j + 1];
      ArrayResize(completedHistoryKeys, ArraySize(completedHistoryKeys) - 1);
   }
   string bootstrapPrefix = "M15_BOOTSTRAP:" + sym;
   for(int i = ArraySize(m15BootstrapKeys) - 1; i >= 0; i--)
   {
      if(m15BootstrapKeys[i] != bootstrapPrefix) continue;
      for(int j = i; j < ArraySize(m15BootstrapKeys) - 1; j++)
         m15BootstrapKeys[j] = m15BootstrapKeys[j + 1];
      ArrayResize(m15BootstrapKeys, ArraySize(m15BootstrapKeys) - 1);
   }
}

int SyncTimeframeHistory(string sym, ENUM_TIMEFRAMES tf, string name, int historyBars)
{
   string key = sym + ":" + name;
   bool initial = true;
   for(int i = 0; i < ArraySize(completedHistoryKeys); i++)
      if(completedHistoryKeys[i] == key) { initial = false; break; }

   if(name == "M15")
      return SyncM15History(sym, initial);

   int copied = SendCandlesForSymbol(sym, tf, name, initial ? historyBars : 5, initial);
   // CopyRates starts asynchronous terminal history loading. Retry this
   // timeframe independently until the available history is synchronized
   // and delivered, without resending completed timeframes' full batches.
   int available = Bars(sym, tf);
   int required = MathMin(historyBars, available);
   if(initial && copied > 0 && required > 0 && copied >= required
      && SeriesInfoInteger(sym, tf, SERIES_SYNCHRONIZED))
   {
      int n = ArraySize(completedHistoryKeys);
      ArrayResize(completedHistoryKeys, n + 1);
      completedHistoryKeys[n] = key;
      PrintFormat("[TradifyBridge] History ready %s %s (%d bars).", sym, name, copied);
   }
   else if(initial)
      PrintFormat("[TradifyBridge] History pending %s %s (%d bars delivered); retrying.", sym, name, copied);
   return copied;
}

//+------------------------------------------------------------------+
//| Send ONE history batch, then return control to live quotes       |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(targetSymbolCount <= 0)
   {
      candleSyncActive = false;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
      return;
   }
   ulong now = GetTickCount64();
   if(!candleSyncActive)
   {
      if(lastCandleSyncTick > 0 && now - lastCandleSyncTick < (ulong)CandleSyncSec * 1000) return;
      candleSyncActive = true;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
   }

   // Sweep each timeframe across symbols. Never run all 9 x N blocking
   // WebRequests in one event: quotes must run between history batches.
   ENUM_TIMEFRAMES frames[9] = {PERIOD_M15, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_M1, PERIOD_M5, PERIOD_M30, PERIOD_H1, PERIOD_MN1};
   string names[9] = {"M15", "H4", "D1", "W1", "M1", "M5", "M30", "H1", "MN1"};
   int counts[9] = {500, 500, 500, 300, 500, 500, 500, 500, 240};
   if(candleSymbolCursor >= targetSymbolCount) candleSymbolCursor = 0;
   int i = candleSymbolCursor;
   string sym = targetSymbolList[i];
   if(StringLen(sym) > 0 && SymbolSelect(sym, true))
   {
      int copied = SyncTimeframeHistory(sym, frames[candleTimeframeCursor], names[candleTimeframeCursor], counts[candleTimeframeCursor]);
       if(names[candleTimeframeCursor] == "M15"
          && HasStringKey(completedHistoryKeys, sym + ":M15"))
         targetSymbolSyncState[i] = true;
   }
   candleSymbolCursor++;
   if(candleSymbolCursor >= targetSymbolCount)
   {
      candleSymbolCursor = 0;
      candleTimeframeCursor++;
   }
   if(candleTimeframeCursor >= 9)
   {
      candleSyncActive = false;
      lastCandleSyncTick = GetTickCount64();
   }
}

//+------------------------------------------------------------------+
//| Stream Symbol Contract Specifications (Authoritative MT5 Specs)   |
//+------------------------------------------------------------------+
bool BuildTradingSessionsJson(string sym, string &sessionsJson)
{
   sessionsJson = "[";
   int sessionCount = 0;
   bool complete = true;

   for(int day = 0; day < 7; day++)
   {
      bool finishedDay = false;
      for(int sessionIndex = 0; sessionIndex < 16; sessionIndex++)
      {
         datetime sessionFrom = 0;
         datetime sessionTo = 0;
         if(!SymbolInfoSessionTrade(sym, (ENUM_DAY_OF_WEEK)day, sessionIndex, sessionFrom, sessionTo))
         {
            finishedDay = true;
            break;
         }

         long fromSeconds = (long)sessionFrom % 86400;
         long toSeconds = (long)sessionTo % 86400;
         if((long)sessionTo > 0 && toSeconds == 0)
            toSeconds = 86400;
         if(fromSeconds < 0 || fromSeconds >= 86400 || toSeconds < 0 || toSeconds > 86400 || fromSeconds == toSeconds)
         {
            complete = false;
            break;
         }

         if(sessionCount > 0) sessionsJson += ",";
         sessionsJson += "{";
         sessionsJson += "\"dayOfWeek\":" + IntegerToString(day) + ",";
         sessionsJson += "\"fromSeconds\":" + IntegerToString((int)fromSeconds) + ",";
         sessionsJson += "\"toSeconds\":" + IntegerToString((int)toSeconds);
         sessionsJson += "}";
         sessionCount++;
      }
      if(!finishedDay) complete = false;
   }

   sessionsJson += "]";
   return complete && sessionCount > 0;
}

void SendSpecifications()
{
   if(targetSymbolCount <= 0) return;

   string specsJson = "[";
   int validCount = 0;
   datetime serverTime = TimeTradeServer();
   datetime utcTime = TimeGMT();

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickValueProfit = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_PROFIT);
      double tickValueLoss = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      double contractSize = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
      double volumeMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      double volumeMax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
      double volumeStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
      long digits = SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      string profitCurrency = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);
      string tradingSessionsJson;
      bool sessionsComplete = BuildTradingSessionsJson(sym, tradingSessionsJson);

      if(tickSize > 0 && tickValue > 0 && volumeMin > 0 && volumeMax > 0 && volumeStep > 0)
      {
         if(validCount > 0) specsJson += ",";
         specsJson += "{";
         specsJson += "\"brokerSymbol\":\"" + JsonEscape(sym) + "\",";
         specsJson += "\"tradeTickSize\":" + DoubleToString(tickSize, 6) + ",";
         specsJson += "\"tradeTickValue\":" + DoubleToString(tickValue, 6) + ",";
         if(tickValueProfit > 0)
            specsJson += "\"tradeTickValueProfit\":" + DoubleToString(tickValueProfit, 6) + ",";
         if(tickValueLoss > 0)
            specsJson += "\"tradeTickValueLoss\":" + DoubleToString(tickValueLoss, 6) + ",";
         if(contractSize > 0)
            specsJson += "\"tradeContractSize\":" + DoubleToString(contractSize, 2) + ",";
         specsJson += "\"volumeMin\":" + DoubleToString(volumeMin, 4) + ",";
         specsJson += "\"volumeMax\":" + DoubleToString(volumeMax, 4) + ",";
         specsJson += "\"volumeStep\":" + DoubleToString(volumeStep, 4) + ",";
         specsJson += "\"digits\":" + IntegerToString(digits) + ",";
         specsJson += "\"point\":" + DoubleToString(point, 6) + ",";
         specsJson += "\"profitCurrency\":\"" + JsonEscape(profitCurrency) + "\",";
         specsJson += "\"tradingSessions\":{";
         specsJson += "\"source\":\"MT5_SYMBOL_INFO_SESSION_TRADE\",";
         specsJson += "\"complete\":" + (sessionsComplete ? "true" : "false") + ",";
         specsJson += "\"serverTime\":" + IntegerToString((long)serverTime) + ",";
         specsJson += "\"utcTime\":" + IntegerToString((long)utcTime) + ",";
         specsJson += "\"sessions\":" + tradingSessionsJson;
         specsJson += "}";
         specsJson += "}";
         validCount++;
      }
   }
   specsJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"specs\":" + specsJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/specs", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Specs POST 200 | Sent authoritative specs for %d symbols", validCount);
   }
   else
   {
      PrintFormat("[TradifyBridge] Specs POST ERROR HTTP %d", resCode);
   }
}

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   PrintFormat("[TradifyBridge] Build fingerprint: %s", TRADIFY_EA_BUILD_FINGERPRINT);
   if(PublishIntervalMs < 100 || CandleSyncSec < 1)
   {
      Print("[TradifyBridge] PublishIntervalMs must be >= 100 and CandleSyncSec must be >= 1.");
      return INIT_PARAMETERS_INCORRECT;
   }
   string normalizedBackendUrl = TradifyBackendUrl;
   StringToLower(normalizedBackendUrl);
   if(StringLen(TradifyBackendUrl) == 0 ||
      StringFind(normalizedBackendUrl, "signals.tradifyapp.com") >= 0 ||
      StringFind(normalizedBackendUrl, "tradify-signals.replit.app") >= 0)
   {
      Print("[TradifyBridge] ERROR: Set TradifyBackendUrl to an approved non-production API root; production hosts are blocked in this candidate.");
      return INIT_PARAMETERS_INCORRECT;
   }
   PrintFormat("[TradifyBridge] Initializing multi-symbol bridge '%s' -> %s", BridgeId, TradifyBackendUrl);

   if(StringLen(FeedToken) == 0 && StringLen(BridgeSecret) == 0)
   {
      Print("[TradifyBridge] ERROR: Set a Journal-linked FeedToken or the shared BridgeSecret before launching.");
      return INIT_PARAMETERS_INCORRECT;
   }

   targetSymbolCount = ParseSymbols(TargetSymbols, targetSymbolList);
   ArrayResize(targetSymbolSyncState, targetSymbolCount);
   for(int i = 0; i < targetSymbolCount; i++) targetSymbolSyncState[i] = false;
   PrintFormat("[TradifyBridge] Configured %d target symbols (bootstrap): %s", targetSymbolCount, TargetSymbols);

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      bool sel = SymbolSelect(sym, true);
      if(sel)
      {
         PrintFormat("[TradifyBridge] Activated target symbol '%s' in Market Watch.", sym);
      }
      else
      {
         PrintFormat("[TradifyBridge] WARNING: Target symbol '%s' could not be selected in Market Watch.", sym);
      }
   }

   // Set timer in milliseconds for quote publishing
   int timerMs = PublishIntervalMs;
   if(timerMs < 100) timerMs = 100;
   EventSetMillisecondTimer(timerMs);

   // Network work starts in OnTimer, with quotes ahead of history.

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   PrintFormat("[TradifyBridge] Bridge '%s' stopped. Reason: %d", BridgeId, reason);
}

//+------------------------------------------------------------------+
//| Expert Timer Function (ALL outbound network requests happen here) |
//+------------------------------------------------------------------+
void OnTimer()
{
   ulong tickNow = GetTickCount64();

   // 1. Send Quotes at configured PublishIntervalMs
   if(tickNow - lastPublishTick >= (ulong)PublishIntervalMs)
   {
      SendQuotes();
      lastPublishTick = GetTickCount64();
   }

   // 2. Send Heartbeat every 5 seconds
   if(tickNow - lastHeartbeatTick >= 5000)
   {
      SendHeartbeat();
      lastHeartbeatTick = GetTickCount64();
      return;
   }

   // 3. Send Specifications periodically every 60 seconds
   if(tickNow - lastSpecSyncTick >= 60000)
   {
      SendSpecifications();
      lastSpecSyncTick = GetTickCount64();
      return;
   }

   // 4. Poll subscriptions, returning before any history upload.
   if(tickNow - lastSubscriptionFetchTick >= 10000)
   {
      FetchSubscriptions();
      lastSubscriptionFetchTick = GetTickCount64();
      return;
   }

   // 5. At most one candle POST per event; next event starts with quotes.
   SyncCandles();
}

//+------------------------------------------------------------------+
//| Expert Tick Function (OMITTED / EMPTY - No network sending here) |
//+------------------------------------------------------------------+
void OnTick()
{
   // Empty by design: All outbound network transmissions are driven by OnTimer()
   // to avoid synchronous WebRequest overhead on tick events.
}
//+------------------------------------------------------------------+
#ifdef TRADIFY_REFERENCE_ARCHIVED_V1_23
// Archived v1.23 snapshots below are excluded from normal builds. The active
// v1.27 development candidate above includes precision-aware serialization,
// isolated defaults, partial ingestion, and server-verified M15 full sync.
//+------------------------------------------------------------------+
//|                                                TradifyBridge.mq5 |
//|                                  Copyright 2026, Tradify Systems |
//|                                             https://tradify.app |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Tradify Systems"
#property link      "https://tradify.app"
#property version   "1.23"
#property strict

//--- Inputs
input string TradifyBackendUrl = "https://tradify-signals.replit.app"; // Published Tradify Backend Root URL
input string BridgeSecret      = "";                        // Copy the exact MT5_BRIDGE_SECRET from Replit Secrets into the EA inputs
input string BridgeId          = "laptop-dev-primary";      // Bridge Identifier
input string TargetSymbols     = "XAUUSD,USTEC,US30,US500,EURUSD,GBPUSD,BTCUSDT,ETHUSDT"; // Comma-separated MT5 broker symbols to stream
input int    PublishIntervalMs = 100;                       // Quote Publish Interval (ms)
input int    CandleSyncSec     = 15;                        // Candle Sync Interval (seconds)

//--- Global Variables
ulong    lastHeartbeatTick = 0;
ulong    lastCandleSyncTick = 0;
ulong    lastSubscriptionFetchTick = 0;
ulong    lastSpecSyncTick = 0;
ulong    lastPublishTick = 0;
bool     candleSyncActive = false;
int      candleSymbolCursor = 0;
int      candleTimeframeCursor = 0;
string   targetSymbolList[];
int      targetSymbolCount = 0;
bool     targetSymbolSyncState[];
string   completedHistoryKeys[];
int      lastSubscriptionVersion = -1;
string   lastGenerationId = "";

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string JsonEscape(string text)
{
   string res = text;
   StringReplace(res, "\\", "\\\\");
   StringReplace(res, "\"", "\\\"");
   StringReplace(res, "\r", "");
   StringReplace(res, "\n", "\\n");
   return res;
}

//+------------------------------------------------------------------+
//| Helper: Parse Comma-Separated Symbols String                     |
//+------------------------------------------------------------------+
int ParseSymbols(string inputStr, string &outputArray[])
{
   ArrayFree(outputArray);
   string temp[];
   ushort u_sep = StringGetCharacter(",", 0);
   int k = StringSplit(inputStr, u_sep, temp);
   int validCount = 0;
   for(int i = 0; i < k; i++)
   {
      string sym = temp[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(StringLen(sym) > 0)
      {
         ArrayResize(outputArray, validCount + 1);
         outputArray[validCount] = sym;
         validCount++;
      }
   }
   return validCount;
}

//+------------------------------------------------------------------+
//| Helper: HTTP POST WebRequest                                     |
//+------------------------------------------------------------------+
int SendPostRequest(string endpoint, string jsonPayload, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "Content-Type: application/json\r\nx-bridge-secret: " + BridgeSecret + "\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int dataSize = ArraySize(postData);
   if(dataSize > 0 && postData[dataSize - 1] == 0)
   {
      ArrayResize(postData, dataSize - 1);
   }

   ResetLastError();
   int resCode = WebRequest("POST", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest failed to %s! Error code: %d. Check Tools -> Options -> EA WebRequest URLs.", fullUrl, err);
      return -1;
   }
   
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(resCode == 200)
   {
      string trimmed = responseStr;
      StringTrimLeft(trimmed);
      if(StringFind(trimmed, "<!") == 0 || StringFind(trimmed, "<html") == 0 || StringFind(trimmed, "<script") == 0 || StringFind(trimmed, "verifyCanSetCookies") >= 0)
      {
         PrintFormat("[TradifyBridge] ERROR: Backend returned HTML instead of API JSON. Check TradifyBackendUrl / Cloud Run access.");
         string preview = StringSubstr(responseStr, 0, 300);
         PrintFormat("Response preview: %s", preview);
         return -2;
      }
   }
   else
   {
      string preview = StringSubstr(responseStr, 0, 300);
      if(resCode == 401)
      {
         PrintFormat("[TradifyBridge] BRIDGE AUTH REJECTED on %s. Set BridgeSecret to the exact MT5_BRIDGE_SECRET configured in Replit Secrets.", endpoint);
      }
      else
      {
         PrintFormat("[TradifyBridge] HTTP Error %d on %s: %s", resCode, endpoint, preview);
      }
   }

   return resCode;
}

//+------------------------------------------------------------------+
//| HTTP GET Request Helper                                          |
//+------------------------------------------------------------------+
int SendGetRequest(string endpoint, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "x-bridge-secret: " + BridgeSecret + "\r\n";
   char postData[];
   char resultData[];
   string resultHeaders;

   ResetLastError();
   int resCode = WebRequest("GET", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest GET failed to %s! Error: %d", fullUrl, err);
      return -1;
   }
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return resCode;
}

//+------------------------------------------------------------------+
//| Dynamic Subscriptions Fetch                                       |
//+------------------------------------------------------------------+
void FetchSubscriptions()
{
   string resp;
   ulong ts = GetTickCount64();
   string endpoint = "/api/mt5/bridge/subscriptions?t=" + IntegerToString(ts);
   int code = SendGetRequest(endpoint, resp);
   if(code == 200 && StringLen(resp) > 0)
   {
      int genStart = StringFind(resp, "\"generationId\":\"");
      if(genStart >= 0)
      {
         int startArr = genStart + 16;
         int endArr = StringFind(resp, "\"", startArr);
         if(endArr > startArr)
         {
            string newGenId = StringSubstr(resp, startArr, endArr - startArr);
            if(StringLen(lastGenerationId) > 0 && newGenId != lastGenerationId)
            {
               PrintFormat("[TradifyBridge] Server Generation ID changed to %s. Forcing FULL SYNC.", newGenId);
               for(int i = 0; i < targetSymbolCount; i++)
               {
                  targetSymbolSyncState[i] = false;
                  ResetSymbolHistory(targetSymbolList[i]);
               }
            }
            lastGenerationId = newGenId;
         }
      }

       // A fresh API process has no in-memory candle history. Keep sending
       // full batches until the server confirms every active symbol's M15
       // strategy history is ready, even when the subscription version is
       // unchanged across the restart.
       if(StringFind(resp, "\"requireFullSync\":true") >= 0)
       {
          for(int i = 0; i < targetSymbolCount; i++)
          {
             targetSymbolSyncState[i] = false;
             ResetSymbolHistory(targetSymbolList[i]);
          }
       }

       int verStart = StringFind(resp, "\"version\":");
      if(verStart >= 0)
      {
         int verEnd = StringFind(resp, ",", verStart);
         if(verEnd > verStart)
         {
            int newVersion = (int)StringToInteger(StringSubstr(resp, verStart + 10, verEnd - (verStart + 10)));
             if(newVersion != lastSubscriptionVersion)
             {
                PrintFormat("[TradifyBridge] Subscription version changed from %d to %d", lastSubscriptionVersion, newVersion);
                lastSubscriptionVersion = newVersion;
             }
         }
      }

      int symStart = StringFind(resp, "\"symbols\":[");
      if(symStart >= 0)
      {
         int startArr = symStart + 11;
         int endArr = StringFind(resp, "]", startArr);
         if(endArr > startArr)
         {
            string listStr = StringSubstr(resp, startArr, endArr - startArr);
            StringReplace(listStr, "\"", "");
            string newSyms[];
            int newCount = ParseSymbols(listStr, newSyms);
            
            // Add new symbols
            for(int i = 0; i < newCount; i++)
            {
               string sym = newSyms[i];
               bool alreadyIn = false;
               for(int j = 0; j < targetSymbolCount; j++)
               {
                  if(targetSymbolList[j] == sym) { alreadyIn = true; break; }
               }
               if(!alreadyIn)
               {
                  SymbolSelect(sym, true);
                  if(SymbolInfoInteger(sym, SYMBOL_SELECT))
                  {
                     ArrayResize(targetSymbolList, targetSymbolCount + 1);
                     ArrayResize(targetSymbolSyncState, targetSymbolCount + 1);
                     targetSymbolList[targetSymbolCount] = sym;
                     targetSymbolSyncState[targetSymbolCount] = false;
                     targetSymbolCount++;
                     PrintFormat("[TradifyBridge] ADD %s", sym);
                     PrintFormat("[TradifyBridge] %s selected", sym);
                     PrintFormat("[TradifyBridge] %s synchronized", sym);
                     PrintFormat("[TradifyBridge] %s quote active", sym);
                  }
               }
            }

            // Remove symbols no longer in subscription
            for(int j = targetSymbolCount - 1; j >= 0; j--)
            {
               string currentSym = targetSymbolList[j];
               bool stillRequired = false;
               for(int i = 0; i < newCount; i++)
               {
                  if(newSyms[i] == currentSym) { stillRequired = true; break; }
               }
               if(!stillRequired)
               {
                  PrintFormat("[TradifyBridge] Dynamic subscription removed symbol '%s'", currentSym);
                  ResetSymbolHistory(currentSym);
                  // Shift elements left
                  for(int k = j; k < targetSymbolCount - 1; k++)
                  {
                     targetSymbolList[k] = targetSymbolList[k+1];
                     targetSymbolSyncState[k] = targetSymbolSyncState[k+1];
                  }
                  targetSymbolCount--;
                  ArrayResize(targetSymbolList, targetSymbolCount);
                  ArrayResize(targetSymbolSyncState, targetSymbolCount);
               }
            }
            
            PrintFormat("[TradifyBridge] Active symbols: %d", targetSymbolCount);
            SendSpecifications();
         }
      }
   }
}
//+------------------------------------------------------------------+
//| Heartbeat & Symbol Discovery                                     |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string serverName = (StringLen(accountServer) > 0) ? accountServer : company;
   if(StringLen(serverName) == 0) serverName = "MT5-Broker";

   bool isConnected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);

   // Discovery: collect active Market Watch symbols for Admin UI symbol mapping selector
   int mwTotal = SymbolsTotal(true);
   if(mwTotal <= 0) mwTotal = SymbolsTotal(false);

   string symbolsJson = "[";
   int count = 0;
   for(int i = 0; i < mwTotal && count < 200; i++)
   {
      string symName = SymbolName(i, true);
      if(StringLen(symName) == 0) symName = SymbolName(i, false);
      if(StringLen(symName) > 0)
      {
         if(count > 0) symbolsJson += ",";
         symbolsJson += "\"" + JsonEscape(symName) + "\"";
         count++;
      }
   }
   symbolsJson += "]";

   string payload = "{";
   string activeSymsJson = "[";
   for(int i = 0; i < targetSymbolCount; i++)
   {
      if(i > 0) activeSymsJson += ",";
      activeSymsJson += "\"" + targetSymbolList[i] + "\"";
   }
   activeSymsJson += "]";

   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"server\":\"" + JsonEscape(serverName) + "\",";
   payload += "\"connected\":" + (isConnected ? "true" : "false") + ",";
   payload += "\"discovered\":" + IntegerToString(count) + ",";
   payload += "\"active\":" + IntegerToString(targetSymbolCount) + ",";
   payload += "\"subscriptionVersion\":" + IntegerToString(lastSubscriptionVersion) + ",";
   payload += "\"activeSymbols\":" + activeSymsJson + ",";
   payload += "\"symbols\":" + symbolsJson;
   payload += "}";

   string resp;
   int code = SendPostRequest("/api/mt5/bridge/heartbeat", payload, resp);
   if(code == 200)
   {
      PrintFormat("[TradifyBridge] Heartbeat POST 200 | JSON OK | Discovered %d symbols | Server: %s", count, serverName);
   }
}

//+------------------------------------------------------------------+
//| Stream Real-Time Quotes (ONLY for TargetSymbols)                 |
//+------------------------------------------------------------------+
void SendQuotes()
{
   if(targetSymbolCount <= 0) return;

   string quotesJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      MqlTick tick;
      if(SymbolInfoTick(sym, tick))
      {
         if(tick.bid > 0 || tick.ask > 0 || tick.last > 0)
         {
            long chartModeInt = SymbolInfoInteger(sym, SYMBOL_CHART_MODE);
            string chartModeStr = (chartModeInt == SYMBOL_CHART_MODE_LAST) ? "LAST" : "BID";

            if(validCount > 0) quotesJson += ",";
            quotesJson += "{";
            quotesJson += "\"symbol\":\"" + JsonEscape(sym) + "\",";
            quotesJson += "\"bid\":" + DoubleToString(tick.bid, 5) + ",";
            quotesJson += "\"ask\":" + DoubleToString(tick.ask, 5) + ",";
            quotesJson += "\"last\":" + DoubleToString(tick.last > 0 ? tick.last : (tick.bid + tick.ask)/2.0, 5) + ",";
            quotesJson += "\"chartMode\":\"" + chartModeStr + "\",";
            quotesJson += "\"time\":" + IntegerToString(tick.time) + ",";
            quotesJson += "\"timeMsc\":" + IntegerToString(tick.time_msc);
            quotesJson += "}";
            validCount++;
         }
      }
   }
   quotesJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"quotes\":" + quotesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/quotes", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 | JSON OK | %d quotes sent", validCount);
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 but invalid Content/API response");
   }
   else
   {
      PrintFormat("[TradifyBridge] QUOTE ERROR HTTP %d | %d quotes attempted", resCode, validCount);
   }
}

//+------------------------------------------------------------------+
//| Stream Candles for a Symbol & Timeframe                          |
//+------------------------------------------------------------------+
int SendCandlesForSymbol(string sym, ENUM_TIMEFRAMES tfEnum, string tfName, int barsToFetch, bool fullSync)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(sym, tfEnum, 0, barsToFetch, rates);
   if(copied <= 0)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] CANDLE COPY ERROR %s %s | CopyRates failed, error code: %d", sym, tfName, err);
      return 0;
   }
   
   datetime firstTime = rates[copied - 1].time;
   datetime lastTime = rates[0].time;
   PrintFormat("[TradifyBridge] %s %s: firstTime=%s lastTime=%s bars=%d", sym, tfName, TimeToString(firstTime), TimeToString(lastTime), copied);

   string candlesJson = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) candlesJson += ",";
      candlesJson += "{";
      candlesJson += "\"time\":" + IntegerToString(rates[i].time) + ",";
      candlesJson += "\"open\":" + DoubleToString(rates[i].open, 5) + ",";
      candlesJson += "\"high\":" + DoubleToString(rates[i].high, 5) + ",";
      candlesJson += "\"low\":" + DoubleToString(rates[i].low, 5) + ",";
      candlesJson += "\"close\":" + DoubleToString(rates[i].close, 5) + ",";
      candlesJson += "\"volume\":" + IntegerToString(rates[i].tick_volume);
      candlesJson += "}";
   }
   candlesJson += "]";

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   payload += "\"timeframe\":\"" + tfName + "\",";
   payload += "\"syncMode\":\"" + (fullSync ? "FULL" : "INCREMENTAL") + "\",";
   payload += "\"candles\":" + candlesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/candles", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | %s | HTTP 200 | JSON OK", sym, tfName, copied, fullSync ? "FULL" : "INCREMENTAL");
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | Invalid Content/API response", sym, tfName, copied);
   }
   else
   {
      PrintFormat("[TradifyBridge] CANDLE ERROR HTTP %d on %s %s", resCode, sym, tfName);
   }

   // A copied batch is not delivered history until the API acknowledges it.
   return resCode == 200 ? copied : 0;
}

void ResetSymbolHistory(string sym)
{
   string prefix = sym + ":";
   for(int i = ArraySize(completedHistoryKeys) - 1; i >= 0; i--)
   {
      if(StringFind(completedHistoryKeys[i], prefix) != 0) continue;
      for(int j = i; j < ArraySize(completedHistoryKeys) - 1; j++)
         completedHistoryKeys[j] = completedHistoryKeys[j + 1];
      ArrayResize(completedHistoryKeys, ArraySize(completedHistoryKeys) - 1);
   }
}

int SyncTimeframeHistory(string sym, ENUM_TIMEFRAMES tf, string name, int historyBars)
{
   string key = sym + ":" + name;
   bool initial = true;
   for(int i = 0; i < ArraySize(completedHistoryKeys); i++)
      if(completedHistoryKeys[i] == key) { initial = false; break; }

   int copied = SendCandlesForSymbol(sym, tf, name, initial ? historyBars : 5, initial);
   // CopyRates starts asynchronous terminal history loading. Retry this
   // timeframe independently until the available history is synchronized
   // and delivered, without resending completed timeframes' full batches.
   int available = Bars(sym, tf);
   int required = MathMin(historyBars, available);
   if(name == "M15") required = MathMax(51, required);
   if(initial && copied > 0 && required > 0 && copied >= required
      && SeriesInfoInteger(sym, tf, SERIES_SYNCHRONIZED))
   {
      int n = ArraySize(completedHistoryKeys);
      ArrayResize(completedHistoryKeys, n + 1);
      completedHistoryKeys[n] = key;
      PrintFormat("[TradifyBridge] History ready %s %s (%d bars).", sym, name, copied);
   }
   else if(initial)
      PrintFormat("[TradifyBridge] History pending %s %s (%d bars delivered); retrying.", sym, name, copied);
   return copied;
}

//+------------------------------------------------------------------+
//| Send ONE history batch, then return control to live quotes       |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(targetSymbolCount <= 0)
   {
      candleSyncActive = false;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
      return;
   }
   ulong now = GetTickCount64();
   if(!candleSyncActive)
   {
      if(lastCandleSyncTick > 0 && now - lastCandleSyncTick < (ulong)CandleSyncSec * 1000) return;
      candleSyncActive = true;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
   }

   // Sweep each timeframe across symbols. Never run all 9 x N blocking
   // WebRequests in one event: quotes must run between history batches.
   ENUM_TIMEFRAMES frames[9] = {PERIOD_M15, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_M1, PERIOD_M5, PERIOD_M30, PERIOD_H1, PERIOD_MN1};
   string names[9] = {"M15", "H4", "D1", "W1", "M1", "M5", "M30", "H1", "MN1"};
   int counts[9] = {500, 500, 500, 300, 500, 500, 500, 500, 240};
   if(candleSymbolCursor >= targetSymbolCount) candleSymbolCursor = 0;
   int i = candleSymbolCursor;
   string sym = targetSymbolList[i];
   if(StringLen(sym) > 0 && SymbolSelect(sym, true))
   {
      int copied = SyncTimeframeHistory(sym, frames[candleTimeframeCursor], names[candleTimeframeCursor], counts[candleTimeframeCursor]);
      if(names[candleTimeframeCursor] == "M15" && copied >= 51)
         targetSymbolSyncState[i] = true;
   }
   candleSymbolCursor++;
   if(candleSymbolCursor >= targetSymbolCount)
   {
      candleSymbolCursor = 0;
      candleTimeframeCursor++;
   }
   if(candleTimeframeCursor >= 9)
   {
      candleSyncActive = false;
      lastCandleSyncTick = GetTickCount64();
   }
}

//+------------------------------------------------------------------+
//| Stream Symbol Contract Specifications (Authoritative MT5 Specs)   |
//+------------------------------------------------------------------+
void SendSpecifications()
{
   if(targetSymbolCount <= 0) return;

   string specsJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickValueProfit = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_PROFIT);
      double tickValueLoss = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      double contractSize = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
      double volumeMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      double volumeMax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
      double volumeStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
      long digits = SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      string profitCurrency = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);

      if(tickSize > 0 && tickValue > 0 && volumeMin > 0 && volumeMax > 0 && volumeStep > 0)
      {
         if(validCount > 0) specsJson += ",";
         specsJson += "{";
         specsJson += "\"brokerSymbol\":\"" + JsonEscape(sym) + "\",";
         specsJson += "\"tradeTickSize\":" + DoubleToString(tickSize, 6) + ",";
         specsJson += "\"tradeTickValue\":" + DoubleToString(tickValue, 6) + ",";
         if(tickValueProfit > 0)
            specsJson += "\"tradeTickValueProfit\":" + DoubleToString(tickValueProfit, 6) + ",";
         if(tickValueLoss > 0)
            specsJson += "\"tradeTickValueLoss\":" + DoubleToString(tickValueLoss, 6) + ",";
         if(contractSize > 0)
            specsJson += "\"tradeContractSize\":" + DoubleToString(contractSize, 2) + ",";
         specsJson += "\"volumeMin\":" + DoubleToString(volumeMin, 4) + ",";
         specsJson += "\"volumeMax\":" + DoubleToString(volumeMax, 4) + ",";
         specsJson += "\"volumeStep\":" + DoubleToString(volumeStep, 4) + ",";
         specsJson += "\"digits\":" + IntegerToString(digits) + ",";
         specsJson += "\"point\":" + DoubleToString(point, 6) + ",";
         specsJson += "\"profitCurrency\":\"" + JsonEscape(profitCurrency) + "\"";
         specsJson += "}";
         validCount++;
      }
   }
   specsJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"specs\":" + specsJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/specs", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Specs POST 200 | Sent authoritative specs for %d symbols", validCount);
   }
   else
   {
      PrintFormat("[TradifyBridge] Specs POST ERROR HTTP %d", resCode);
   }
}

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(PublishIntervalMs < 100 || CandleSyncSec < 1)
   {
      Print("[TradifyBridge] PublishIntervalMs must be >= 100 and CandleSyncSec must be >= 1.");
      return INIT_PARAMETERS_INCORRECT;
   }
   PrintFormat("[TradifyBridge] Initializing multi-symbol bridge '%s' -> %s", BridgeId, TradifyBackendUrl);

   if(StringLen(BridgeSecret) == 0)
   {
      Print("[TradifyBridge] ERROR: BridgeSecret input parameter is empty! Please set your BridgeSecret in EA Inputs before launching.");
      return INIT_PARAMETERS_INCORRECT;
   }

   targetSymbolCount = ParseSymbols(TargetSymbols, targetSymbolList);
   ArrayResize(targetSymbolSyncState, targetSymbolCount);
   for(int i = 0; i < targetSymbolCount; i++) targetSymbolSyncState[i] = false;
   PrintFormat("[TradifyBridge] Configured %d target symbols (bootstrap): %s", targetSymbolCount, TargetSymbols);

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      bool sel = SymbolSelect(sym, true);
      if(sel)
      {
         PrintFormat("[TradifyBridge] Activated target symbol '%s' in Market Watch.", sym);
      }
      else
      {
         PrintFormat("[TradifyBridge] WARNING: Target symbol '%s' could not be selected in Market Watch.", sym);
      }
   }

   // Set timer in milliseconds for quote publishing
   int timerMs = PublishIntervalMs;
   if(timerMs < 100) timerMs = 100;
   EventSetMillisecondTimer(timerMs);

   // Network work starts in OnTimer, with quotes ahead of history.

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   PrintFormat("[TradifyBridge] Bridge '%s' stopped. Reason: %d", BridgeId, reason);
}

//+------------------------------------------------------------------+
//| Expert Timer Function (ALL outbound network requests happen here) |
//+------------------------------------------------------------------+
void OnTimer()
{
   ulong tickNow = GetTickCount64();

   // 1. Send Quotes at configured PublishIntervalMs
   if(tickNow - lastPublishTick >= (ulong)PublishIntervalMs)
   {
      SendQuotes();
      lastPublishTick = GetTickCount64();
   }

   // 2. Send Heartbeat every 5 seconds
   if(tickNow - lastHeartbeatTick >= 5000)
   {
      SendHeartbeat();
      lastHeartbeatTick = GetTickCount64();
      return;
   }

   // 3. Send Specifications periodically every 60 seconds
   if(tickNow - lastSpecSyncTick >= 60000)
   {
      SendSpecifications();
      lastSpecSyncTick = GetTickCount64();
      return;
   }

   // 4. Poll subscriptions, returning before any history upload.
   if(tickNow - lastSubscriptionFetchTick >= 10000)
   {
      FetchSubscriptions();
      lastSubscriptionFetchTick = GetTickCount64();
      return;
   }

   // 5. At most one candle POST per event; next event starts with quotes.
   SyncCandles();
}

//+------------------------------------------------------------------+
//| Expert Tick Function (OMITTED / EMPTY - No network sending here) |
//+------------------------------------------------------------------+
void OnTick()
{
   // Empty by design: All outbound network transmissions are driven by OnTimer()
   // to avoid synchronous WebRequest overhead on tick events.
}
//+------------------------------------------------------------------+
#endif
#ifdef TRADIFY_REFERENCE_ARCHIVED_V1_23
//+------------------------------------------------------------------+
//|                                                TradifyBridge.mq5 |
//|                                  Copyright 2026, Tradify Systems |
//|                                             https://tradify.app |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Tradify Systems"
#property link      "https://tradify.app"
#property version   "1.23"
#property strict

//--- Inputs
input string TradifyBackendUrl = "https://tradify-signals.replit.app"; // Published Tradify Backend Root URL
input string BridgeSecret      = "";                        // Copy the exact MT5_BRIDGE_SECRET from Replit Secrets into the EA inputs
input string BridgeId          = "laptop-dev-primary";      // Bridge Identifier
input string TargetSymbols     = "XAUUSD,USTEC,US30,US500,EURUSD,GBPUSD,BTCUSDT,ETHUSDT"; // Comma-separated MT5 broker symbols to stream
input int    PublishIntervalMs = 100;                       // Quote Publish Interval (ms)
input int    CandleSyncSec     = 15;                        // Candle Sync Interval (seconds)

//--- Global Variables
ulong    lastHeartbeatTick = 0;
ulong    lastCandleSyncTick = 0;
ulong    lastSubscriptionFetchTick = 0;
ulong    lastSpecSyncTick = 0;
ulong    lastPublishTick = 0;
bool     candleSyncActive = false;
int      candleSymbolCursor = 0;
int      candleTimeframeCursor = 0;
string   targetSymbolList[];
int      targetSymbolCount = 0;
bool     targetSymbolSyncState[];
string   completedHistoryKeys[];
int      lastSubscriptionVersion = -1;
string   lastGenerationId = "";

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string JsonEscape(string text)
{
   string res = text;
   StringReplace(res, "\\", "\\\\");
   StringReplace(res, "\"", "\\\"");
   StringReplace(res, "\r", "");
   StringReplace(res, "\n", "\\n");
   return res;
}

//+------------------------------------------------------------------+
//| Helper: Parse Comma-Separated Symbols String                     |
//+------------------------------------------------------------------+
int ParseSymbols(string inputStr, string &outputArray[])
{
   ArrayFree(outputArray);
   string temp[];
   ushort u_sep = StringGetCharacter(",", 0);
   int k = StringSplit(inputStr, u_sep, temp);
   int validCount = 0;
   for(int i = 0; i < k; i++)
   {
      string sym = temp[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(StringLen(sym) > 0)
      {
         ArrayResize(outputArray, validCount + 1);
         outputArray[validCount] = sym;
         validCount++;
      }
   }
   return validCount;
}

//+------------------------------------------------------------------+
//| Helper: HTTP POST WebRequest                                     |
//+------------------------------------------------------------------+
int SendPostRequest(string endpoint, string jsonPayload, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "Content-Type: application/json\r\nx-bridge-secret: " + BridgeSecret + "\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int dataSize = ArraySize(postData);
   if(dataSize > 0 && postData[dataSize - 1] == 0)
   {
      ArrayResize(postData, dataSize - 1);
   }

   ResetLastError();
   int resCode = WebRequest("POST", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest failed to %s! Error code: %d. Check Tools -> Options -> EA WebRequest URLs.", fullUrl, err);
      return -1;
   }
   
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(resCode == 200)
   {
      string trimmed = responseStr;
      StringTrimLeft(trimmed);
      if(StringFind(trimmed, "<!") == 0 || StringFind(trimmed, "<html") == 0 || StringFind(trimmed, "<script") == 0 || StringFind(trimmed, "verifyCanSetCookies") >= 0)
      {
         PrintFormat("[TradifyBridge] ERROR: Backend returned HTML instead of API JSON. Check TradifyBackendUrl / Cloud Run access.");
         string preview = StringSubstr(responseStr, 0, 300);
         PrintFormat("Response preview: %s", preview);
         return -2;
      }
   }
   else
   {
      string preview = StringSubstr(responseStr, 0, 300);
      if(resCode == 401)
      {
         PrintFormat("[TradifyBridge] BRIDGE AUTH REJECTED on %s. Set BridgeSecret to the exact MT5_BRIDGE_SECRET configured in Replit Secrets.", endpoint);
      }
      else
      {
         PrintFormat("[TradifyBridge] HTTP Error %d on %s: %s", resCode, endpoint, preview);
      }
   }

   return resCode;
}

//+------------------------------------------------------------------+
//| HTTP GET Request Helper                                          |
//+------------------------------------------------------------------+
int SendGetRequest(string endpoint, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "x-bridge-secret: " + BridgeSecret + "\r\n";
   char postData[];
   char resultData[];
   string resultHeaders;

   ResetLastError();
   int resCode = WebRequest("GET", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest GET failed to %s! Error: %d", fullUrl, err);
      return -1;
   }
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return resCode;
}

//+------------------------------------------------------------------+
//| Dynamic Subscriptions Fetch                                       |
//+------------------------------------------------------------------+
void FetchSubscriptions()
{
   string resp;
   ulong ts = GetTickCount64();
   string endpoint = "/api/mt5/bridge/subscriptions?t=" + IntegerToString(ts);
   int code = SendGetRequest(endpoint, resp);
   if(code == 200 && StringLen(resp) > 0)
   {
      int genStart = StringFind(resp, "\"generationId\":\"");
      if(genStart >= 0)
      {
         int startArr = genStart + 16;
         int endArr = StringFind(resp, "\"", startArr);
         if(endArr > startArr)
         {
            string newGenId = StringSubstr(resp, startArr, endArr - startArr);
            if(StringLen(lastGenerationId) > 0 && newGenId != lastGenerationId)
            {
               PrintFormat("[TradifyBridge] Server Generation ID changed to %s. Forcing FULL SYNC.", newGenId);
               for(int i = 0; i < targetSymbolCount; i++)
               {
                  targetSymbolSyncState[i] = false;
                  ResetSymbolHistory(targetSymbolList[i]);
               }
            }
            lastGenerationId = newGenId;
         }
      }

       // A fresh API process has no in-memory candle history. Keep sending
       // full batches until the server confirms every active symbol's M15
       // strategy history is ready, even when the subscription version is
       // unchanged across the restart.
       if(StringFind(resp, "\"requireFullSync\":true") >= 0)
       {
          for(int i = 0; i < targetSymbolCount; i++)
          {
             targetSymbolSyncState[i] = false;
             ResetSymbolHistory(targetSymbolList[i]);
          }
       }

       int verStart = StringFind(resp, "\"version\":");
      if(verStart >= 0)
      {
         int verEnd = StringFind(resp, ",", verStart);
         if(verEnd > verStart)
         {
            int newVersion = (int)StringToInteger(StringSubstr(resp, verStart + 10, verEnd - (verStart + 10)));
             if(newVersion != lastSubscriptionVersion)
             {
                PrintFormat("[TradifyBridge] Subscription version changed from %d to %d", lastSubscriptionVersion, newVersion);
                lastSubscriptionVersion = newVersion;
             }
         }
      }

      int symStart = StringFind(resp, "\"symbols\":[");
      if(symStart >= 0)
      {
         int startArr = symStart + 11;
         int endArr = StringFind(resp, "]", startArr);
         if(endArr > startArr)
         {
            string listStr = StringSubstr(resp, startArr, endArr - startArr);
            StringReplace(listStr, "\"", "");
            string newSyms[];
            int newCount = ParseSymbols(listStr, newSyms);
            
            // Add new symbols
            for(int i = 0; i < newCount; i++)
            {
               string sym = newSyms[i];
               bool alreadyIn = false;
               for(int j = 0; j < targetSymbolCount; j++)
               {
                  if(targetSymbolList[j] == sym) { alreadyIn = true; break; }
               }
               if(!alreadyIn)
               {
                  SymbolSelect(sym, true);
                  if(SymbolInfoInteger(sym, SYMBOL_SELECT))
                  {
                     ArrayResize(targetSymbolList, targetSymbolCount + 1);
                     ArrayResize(targetSymbolSyncState, targetSymbolCount + 1);
                     targetSymbolList[targetSymbolCount] = sym;
                     targetSymbolSyncState[targetSymbolCount] = false;
                     targetSymbolCount++;
                     PrintFormat("[TradifyBridge] ADD %s", sym);
                     PrintFormat("[TradifyBridge] %s selected", sym);
                     PrintFormat("[TradifyBridge] %s synchronized", sym);
                     PrintFormat("[TradifyBridge] %s quote active", sym);
                  }
               }
            }

            // Remove symbols no longer in subscription
            for(int j = targetSymbolCount - 1; j >= 0; j--)
            {
               string currentSym = targetSymbolList[j];
               bool stillRequired = false;
               for(int i = 0; i < newCount; i++)
               {
                  if(newSyms[i] == currentSym) { stillRequired = true; break; }
               }
               if(!stillRequired)
               {
                  PrintFormat("[TradifyBridge] Dynamic subscription removed symbol '%s'", currentSym);
                  ResetSymbolHistory(currentSym);
                  // Shift elements left
                  for(int k = j; k < targetSymbolCount - 1; k++)
                  {
                     targetSymbolList[k] = targetSymbolList[k+1];
                     targetSymbolSyncState[k] = targetSymbolSyncState[k+1];
                  }
                  targetSymbolCount--;
                  ArrayResize(targetSymbolList, targetSymbolCount);
                  ArrayResize(targetSymbolSyncState, targetSymbolCount);
               }
            }
            
            PrintFormat("[TradifyBridge] Active symbols: %d", targetSymbolCount);
            SendSpecifications();
         }
      }
   }
}
//+------------------------------------------------------------------+
//| Heartbeat & Symbol Discovery                                     |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string serverName = (StringLen(accountServer) > 0) ? accountServer : company;
   if(StringLen(serverName) == 0) serverName = "MT5-Broker";

   bool isConnected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);

   // Discovery: collect active Market Watch symbols for Admin UI symbol mapping selector
   int mwTotal = SymbolsTotal(true);
   if(mwTotal <= 0) mwTotal = SymbolsTotal(false);

   string symbolsJson = "[";
   int count = 0;
   for(int i = 0; i < mwTotal && count < 200; i++)
   {
      string symName = SymbolName(i, true);
      if(StringLen(symName) == 0) symName = SymbolName(i, false);
      if(StringLen(symName) > 0)
      {
         if(count > 0) symbolsJson += ",";
         symbolsJson += "\"" + JsonEscape(symName) + "\"";
         count++;
      }
   }
   symbolsJson += "]";

   string payload = "{";
   string activeSymsJson = "[";
   for(int i = 0; i < targetSymbolCount; i++)
   {
      if(i > 0) activeSymsJson += ",";
      activeSymsJson += "\"" + targetSymbolList[i] + "\"";
   }
   activeSymsJson += "]";

   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"server\":\"" + JsonEscape(serverName) + "\",";
   payload += "\"connected\":" + (isConnected ? "true" : "false") + ",";
   payload += "\"discovered\":" + IntegerToString(count) + ",";
   payload += "\"active\":" + IntegerToString(targetSymbolCount) + ",";
   payload += "\"subscriptionVersion\":" + IntegerToString(lastSubscriptionVersion) + ",";
   payload += "\"activeSymbols\":" + activeSymsJson + ",";
   payload += "\"symbols\":" + symbolsJson;
   payload += "}";

   string resp;
   int code = SendPostRequest("/api/mt5/bridge/heartbeat", payload, resp);
   if(code == 200)
   {
      PrintFormat("[TradifyBridge] Heartbeat POST 200 | JSON OK | Discovered %d symbols | Server: %s", count, serverName);
   }
}

//+------------------------------------------------------------------+
//| Stream Real-Time Quotes (ONLY for TargetSymbols)                 |
//+------------------------------------------------------------------+
void SendQuotes()
{
   if(targetSymbolCount <= 0) return;

   string quotesJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      MqlTick tick;
      if(SymbolInfoTick(sym, tick))
      {
         if(tick.bid > 0 || tick.ask > 0 || tick.last > 0)
         {
            long chartModeInt = SymbolInfoInteger(sym, SYMBOL_CHART_MODE);
            string chartModeStr = (chartModeInt == SYMBOL_CHART_MODE_LAST) ? "LAST" : "BID";

            if(validCount > 0) quotesJson += ",";
            quotesJson += "{";
            quotesJson += "\"symbol\":\"" + JsonEscape(sym) + "\",";
            quotesJson += "\"bid\":" + DoubleToString(tick.bid, 5) + ",";
            quotesJson += "\"ask\":" + DoubleToString(tick.ask, 5) + ",";
            quotesJson += "\"last\":" + DoubleToString(tick.last > 0 ? tick.last : (tick.bid + tick.ask)/2.0, 5) + ",";
            quotesJson += "\"chartMode\":\"" + chartModeStr + "\",";
            quotesJson += "\"time\":" + IntegerToString(tick.time) + ",";
            quotesJson += "\"timeMsc\":" + IntegerToString(tick.time_msc);
            quotesJson += "}";
            validCount++;
         }
      }
   }
   quotesJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"quotes\":" + quotesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/quotes", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 | JSON OK | %d quotes sent", validCount);
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 but invalid Content/API response");
   }
   else
   {
      PrintFormat("[TradifyBridge] QUOTE ERROR HTTP %d | %d quotes attempted", resCode, validCount);
   }
}

//+------------------------------------------------------------------+
//| Stream Candles for a Symbol & Timeframe                          |
//+------------------------------------------------------------------+
int SendCandlesForSymbol(string sym, ENUM_TIMEFRAMES tfEnum, string tfName, int barsToFetch, bool fullSync)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(sym, tfEnum, 0, barsToFetch, rates);
   if(copied <= 0)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] CANDLE COPY ERROR %s %s | CopyRates failed, error code: %d", sym, tfName, err);
      return 0;
   }
   
   datetime firstTime = rates[copied - 1].time;
   datetime lastTime = rates[0].time;
   PrintFormat("[TradifyBridge] %s %s: firstTime=%s lastTime=%s bars=%d", sym, tfName, TimeToString(firstTime), TimeToString(lastTime), copied);

   string candlesJson = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) candlesJson += ",";
      candlesJson += "{";
      candlesJson += "\"time\":" + IntegerToString(rates[i].time) + ",";
      candlesJson += "\"open\":" + DoubleToString(rates[i].open, 5) + ",";
      candlesJson += "\"high\":" + DoubleToString(rates[i].high, 5) + ",";
      candlesJson += "\"low\":" + DoubleToString(rates[i].low, 5) + ",";
      candlesJson += "\"close\":" + DoubleToString(rates[i].close, 5) + ",";
      candlesJson += "\"volume\":" + IntegerToString(rates[i].tick_volume);
      candlesJson += "}";
   }
   candlesJson += "]";

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   payload += "\"timeframe\":\"" + tfName + "\",";
   payload += "\"syncMode\":\"" + (fullSync ? "FULL" : "INCREMENTAL") + "\",";
   payload += "\"candles\":" + candlesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/candles", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | %s | HTTP 200 | JSON OK", sym, tfName, copied, fullSync ? "FULL" : "INCREMENTAL");
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | Invalid Content/API response", sym, tfName, copied);
   }
   else
   {
      PrintFormat("[TradifyBridge] CANDLE ERROR HTTP %d on %s %s", resCode, sym, tfName);
   }

   // A copied batch is not delivered history until the API acknowledges it.
   return resCode == 200 ? copied : 0;
}

void ResetSymbolHistory(string sym)
{
   string prefix = sym + ":";
   for(int i = ArraySize(completedHistoryKeys) - 1; i >= 0; i--)
   {
      if(StringFind(completedHistoryKeys[i], prefix) != 0) continue;
      for(int j = i; j < ArraySize(completedHistoryKeys) - 1; j++)
         completedHistoryKeys[j] = completedHistoryKeys[j + 1];
      ArrayResize(completedHistoryKeys, ArraySize(completedHistoryKeys) - 1);
   }
}

int SyncTimeframeHistory(string sym, ENUM_TIMEFRAMES tf, string name, int historyBars)
{
   string key = sym + ":" + name;
   bool initial = true;
   for(int i = 0; i < ArraySize(completedHistoryKeys); i++)
      if(completedHistoryKeys[i] == key) { initial = false; break; }

   int copied = SendCandlesForSymbol(sym, tf, name, initial ? historyBars : 5, initial);
   // CopyRates starts asynchronous terminal history loading. Retry this
   // timeframe independently until the available history is synchronized
   // and delivered, without resending completed timeframes' full batches.
   int available = Bars(sym, tf);
   int required = MathMin(historyBars, available);
   if(name == "M15") required = MathMax(51, required);
   if(initial && copied > 0 && required > 0 && copied >= required
      && SeriesInfoInteger(sym, tf, SERIES_SYNCHRONIZED))
   {
      int n = ArraySize(completedHistoryKeys);
      ArrayResize(completedHistoryKeys, n + 1);
      completedHistoryKeys[n] = key;
      PrintFormat("[TradifyBridge] History ready %s %s (%d bars).", sym, name, copied);
   }
   else if(initial)
      PrintFormat("[TradifyBridge] History pending %s %s (%d bars delivered); retrying.", sym, name, copied);
   return copied;
}

//+------------------------------------------------------------------+
//| Send ONE history batch, then return control to live quotes       |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(targetSymbolCount <= 0)
   {
      candleSyncActive = false;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
      return;
   }
   ulong now = GetTickCount64();
   if(!candleSyncActive)
   {
      if(lastCandleSyncTick > 0 && now - lastCandleSyncTick < (ulong)CandleSyncSec * 1000) return;
      candleSyncActive = true;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
   }

   // Sweep each timeframe across symbols. Never run all 9 x N blocking
   // WebRequests in one event: quotes must run between history batches.
   ENUM_TIMEFRAMES frames[9] = {PERIOD_M15, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_M1, PERIOD_M5, PERIOD_M30, PERIOD_H1, PERIOD_MN1};
   string names[9] = {"M15", "H4", "D1", "W1", "M1", "M5", "M30", "H1", "MN1"};
   int counts[9] = {500, 500, 500, 300, 500, 500, 500, 500, 240};
   if(candleSymbolCursor >= targetSymbolCount) candleSymbolCursor = 0;
   int i = candleSymbolCursor;
   string sym = targetSymbolList[i];
   if(StringLen(sym) > 0 && SymbolSelect(sym, true))
   {
      int copied = SyncTimeframeHistory(sym, frames[candleTimeframeCursor], names[candleTimeframeCursor], counts[candleTimeframeCursor]);
      if(names[candleTimeframeCursor] == "M15" && copied >= 51)
         targetSymbolSyncState[i] = true;
   }
   candleSymbolCursor++;
   if(candleSymbolCursor >= targetSymbolCount)
   {
      candleSymbolCursor = 0;
      candleTimeframeCursor++;
   }
   if(candleTimeframeCursor >= 9)
   {
      candleSyncActive = false;
      lastCandleSyncTick = GetTickCount64();
   }
}

//+------------------------------------------------------------------+
//| Stream Symbol Contract Specifications (Authoritative MT5 Specs)   |
//+------------------------------------------------------------------+
void SendSpecifications()
{
   if(targetSymbolCount <= 0) return;

   string specsJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickValueProfit = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_PROFIT);
      double tickValueLoss = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      double contractSize = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
      double volumeMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      double volumeMax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
      double volumeStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
      long digits = SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      string profitCurrency = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);

      if(tickSize > 0 && tickValue > 0 && volumeMin > 0 && volumeMax > 0 && volumeStep > 0)
      {
         if(validCount > 0) specsJson += ",";
         specsJson += "{";
         specsJson += "\"brokerSymbol\":\"" + JsonEscape(sym) + "\",";
         specsJson += "\"tradeTickSize\":" + DoubleToString(tickSize, 6) + ",";
         specsJson += "\"tradeTickValue\":" + DoubleToString(tickValue, 6) + ",";
         if(tickValueProfit > 0)
            specsJson += "\"tradeTickValueProfit\":" + DoubleToString(tickValueProfit, 6) + ",";
         if(tickValueLoss > 0)
            specsJson += "\"tradeTickValueLoss\":" + DoubleToString(tickValueLoss, 6) + ",";
         if(contractSize > 0)
            specsJson += "\"tradeContractSize\":" + DoubleToString(contractSize, 2) + ",";
         specsJson += "\"volumeMin\":" + DoubleToString(volumeMin, 4) + ",";
         specsJson += "\"volumeMax\":" + DoubleToString(volumeMax, 4) + ",";
         specsJson += "\"volumeStep\":" + DoubleToString(volumeStep, 4) + ",";
         specsJson += "\"digits\":" + IntegerToString(digits) + ",";
         specsJson += "\"point\":" + DoubleToString(point, 6) + ",";
         specsJson += "\"profitCurrency\":\"" + JsonEscape(profitCurrency) + "\"";
         specsJson += "}";
         validCount++;
      }
   }
   specsJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"specs\":" + specsJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/specs", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Specs POST 200 | Sent authoritative specs for %d symbols", validCount);
   }
   else
   {
      PrintFormat("[TradifyBridge] Specs POST ERROR HTTP %d", resCode);
   }
}

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(PublishIntervalMs < 100 || CandleSyncSec < 1)
   {
      Print("[TradifyBridge] PublishIntervalMs must be >= 100 and CandleSyncSec must be >= 1.");
      return INIT_PARAMETERS_INCORRECT;
   }
   PrintFormat("[TradifyBridge] Initializing multi-symbol bridge '%s' -> %s", BridgeId, TradifyBackendUrl);

   if(StringLen(BridgeSecret) == 0)
   {
      Print("[TradifyBridge] ERROR: BridgeSecret input parameter is empty! Please set your BridgeSecret in EA Inputs before launching.");
      return INIT_PARAMETERS_INCORRECT;
   }

   targetSymbolCount = ParseSymbols(TargetSymbols, targetSymbolList);
   ArrayResize(targetSymbolSyncState, targetSymbolCount);
   for(int i = 0; i < targetSymbolCount; i++) targetSymbolSyncState[i] = false;
   PrintFormat("[TradifyBridge] Configured %d target symbols (bootstrap): %s", targetSymbolCount, TargetSymbols);

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      bool sel = SymbolSelect(sym, true);
      if(sel)
      {
         PrintFormat("[TradifyBridge] Activated target symbol '%s' in Market Watch.", sym);
      }
      else
      {
         PrintFormat("[TradifyBridge] WARNING: Target symbol '%s' could not be selected in Market Watch.", sym);
      }
   }

   // Set timer in milliseconds for quote publishing
   int timerMs = PublishIntervalMs;
   if(timerMs < 100) timerMs = 100;
   EventSetMillisecondTimer(timerMs);

   // Network work starts in OnTimer, with quotes ahead of history.

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   PrintFormat("[TradifyBridge] Bridge '%s' stopped. Reason: %d", BridgeId, reason);
}

//+------------------------------------------------------------------+
//| Expert Timer Function (ALL outbound network requests happen here) |
//+------------------------------------------------------------------+
void OnTimer()
{
   ulong tickNow = GetTickCount64();

   // 1. Send Quotes at configured PublishIntervalMs
   if(tickNow - lastPublishTick >= (ulong)PublishIntervalMs)
   {
      SendQuotes();
      lastPublishTick = GetTickCount64();
   }

   // 2. Send Heartbeat every 5 seconds
   if(tickNow - lastHeartbeatTick >= 5000)
   {
      SendHeartbeat();
      lastHeartbeatTick = GetTickCount64();
      return;
   }

   // 3. Send Specifications periodically every 60 seconds
   if(tickNow - lastSpecSyncTick >= 60000)
   {
      SendSpecifications();
      lastSpecSyncTick = GetTickCount64();
      return;
   }

   // 4. Poll subscriptions, returning before any history upload.
   if(tickNow - lastSubscriptionFetchTick >= 10000)
   {
      FetchSubscriptions();
      lastSubscriptionFetchTick = GetTickCount64();
      return;
   }

   // 5. At most one candle POST per event; next event starts with quotes.
   SyncCandles();
}

//+------------------------------------------------------------------+
//| Expert Tick Function (OMITTED / EMPTY - No network sending here) |
//+------------------------------------------------------------------+
void OnTick()
{
   // Empty by design: All outbound network transmissions are driven by OnTimer()
   // to avoid synchronous WebRequest overhead on tick events.
}
//+------------------------------------------------------------------+
#endif
//+------------------------------------------------------------------+
//|                                                TradifyBridge.mq5 |
//|                                  Copyright 2026, Tradify Systems |
//|                                             https://tradify.app |
//+------------------------------------------------------------------+
#ifdef TRADIFY_REFERENCE_ARCHIVED_V1_23
#property copyright "Copyright 2026, Tradify Systems"
#property link      "https://tradify.app"
#property version   "1.23"
#property strict

//--- Inputs
input string TradifyBackendUrl = "https://tradify-signals.replit.app"; // Published Tradify Backend Root URL
input string BridgeSecret      = "";                        // Copy the exact MT5_BRIDGE_SECRET from Replit Secrets into the EA inputs
input string BridgeId          = "laptop-dev-primary";      // Bridge Identifier
input string TargetSymbols     = "XAUUSD,USTEC,US30,US500,EURUSD,GBPUSD,BTCUSDT,ETHUSDT"; // Comma-separated MT5 broker symbols to stream
input int    PublishIntervalMs = 100;                       // Quote Publish Interval (ms)
input int    CandleSyncSec     = 15;                        // Candle Sync Interval (seconds)

//--- Global Variables
ulong    lastHeartbeatTick = 0;
ulong    lastCandleSyncTick = 0;
ulong    lastSubscriptionFetchTick = 0;
ulong    lastSpecSyncTick = 0;
ulong    lastPublishTick = 0;
bool     candleSyncActive = false;
int      candleSymbolCursor = 0;
int      candleTimeframeCursor = 0;
string   targetSymbolList[];
int      targetSymbolCount = 0;
bool     targetSymbolSyncState[];
string   completedHistoryKeys[];
int      lastSubscriptionVersion = -1;
string   lastGenerationId = "";

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string JsonEscape(string text)
{
   string res = text;
   StringReplace(res, "\\", "\\\\");
   StringReplace(res, "\"", "\\\"");
   StringReplace(res, "\r", "");
   StringReplace(res, "\n", "\\n");
   return res;
}

//+------------------------------------------------------------------+
//| Helper: Parse Comma-Separated Symbols String                     |
//+------------------------------------------------------------------+
int ParseSymbols(string inputStr, string &outputArray[])
{
   ArrayFree(outputArray);
   string temp[];
   ushort u_sep = StringGetCharacter(",", 0);
   int k = StringSplit(inputStr, u_sep, temp);
   int validCount = 0;
   for(int i = 0; i < k; i++)
   {
      string sym = temp[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(StringLen(sym) > 0)
      {
         ArrayResize(outputArray, validCount + 1);
         outputArray[validCount] = sym;
         validCount++;
      }
   }
   return validCount;
}

//+------------------------------------------------------------------+
//| Helper: HTTP POST WebRequest                                     |
//+------------------------------------------------------------------+
int SendPostRequest(string endpoint, string jsonPayload, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "Content-Type: application/json\r\nx-bridge-secret: " + BridgeSecret + "\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int dataSize = ArraySize(postData);
   if(dataSize > 0 && postData[dataSize - 1] == 0)
   {
      ArrayResize(postData, dataSize - 1);
   }

   ResetLastError();
   int resCode = WebRequest("POST", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest failed to %s! Error code: %d. Check Tools -> Options -> EA WebRequest URLs.", fullUrl, err);
      return -1;
   }
   
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(resCode == 200)
   {
      string trimmed = responseStr;
      StringTrimLeft(trimmed);
      if(StringFind(trimmed, "<!") == 0 || StringFind(trimmed, "<html") == 0 || StringFind(trimmed, "<script") == 0 || StringFind(trimmed, "verifyCanSetCookies") >= 0)
      {
         PrintFormat("[TradifyBridge] ERROR: Backend returned HTML instead of API JSON. Check TradifyBackendUrl / Cloud Run access.");
         string preview = StringSubstr(responseStr, 0, 300);
         PrintFormat("Response preview: %s", preview);
         return -2;
      }
   }
   else
   {
      string preview = StringSubstr(responseStr, 0, 300);
      if(resCode == 401)
      {
         PrintFormat("[TradifyBridge] BRIDGE AUTH REJECTED on %s. Set BridgeSecret to the exact MT5_BRIDGE_SECRET configured in Replit Secrets.", endpoint);
      }
      else
      {
         PrintFormat("[TradifyBridge] HTTP Error %d on %s: %s", resCode, endpoint, preview);
      }
   }

   return resCode;
}

//+------------------------------------------------------------------+
//| HTTP GET Request Helper                                          |
//+------------------------------------------------------------------+
int SendGetRequest(string endpoint, string &responseStr)
{
   string fullUrl = TradifyBackendUrl + endpoint;
   string headers = "x-bridge-secret: " + BridgeSecret + "\r\n";
   char postData[];
   char resultData[];
   string resultHeaders;

   ResetLastError();
   int resCode = WebRequest("GET", fullUrl, headers, 5000, postData, resultData, resultHeaders);
   if(resCode == -1)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] WebRequest GET failed to %s! Error: %d", fullUrl, err);
      return -1;
   }
   responseStr = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return resCode;
}

//+------------------------------------------------------------------+
//| Dynamic Subscriptions Fetch                                       |
//+------------------------------------------------------------------+
void FetchSubscriptions()
{
   string resp;
   ulong ts = GetTickCount64();
   string endpoint = "/api/mt5/bridge/subscriptions?t=" + IntegerToString(ts);
   int code = SendGetRequest(endpoint, resp);
   if(code == 200 && StringLen(resp) > 0)
   {
      int genStart = StringFind(resp, "\"generationId\":\"");
      if(genStart >= 0)
      {
         int startArr = genStart + 16;
         int endArr = StringFind(resp, "\"", startArr);
         if(endArr > startArr)
         {
            string newGenId = StringSubstr(resp, startArr, endArr - startArr);
            if(StringLen(lastGenerationId) > 0 && newGenId != lastGenerationId)
            {
               PrintFormat("[TradifyBridge] Server Generation ID changed to %s. Forcing FULL SYNC.", newGenId);
               for(int i = 0; i < targetSymbolCount; i++)
               {
                  targetSymbolSyncState[i] = false;
                  ResetSymbolHistory(targetSymbolList[i]);
               }
            }
            lastGenerationId = newGenId;
         }
      }

       // A fresh API process has no in-memory candle history. Keep sending
       // full batches until the server confirms every active symbol's M15
       // strategy history is ready, even when the subscription version is
       // unchanged across the restart.
       if(StringFind(resp, "\"requireFullSync\":true") >= 0)
       {
          for(int i = 0; i < targetSymbolCount; i++)
          {
             targetSymbolSyncState[i] = false;
             ResetSymbolHistory(targetSymbolList[i]);
          }
       }

       int verStart = StringFind(resp, "\"version\":");
      if(verStart >= 0)
      {
         int verEnd = StringFind(resp, ",", verStart);
         if(verEnd > verStart)
         {
            int newVersion = (int)StringToInteger(StringSubstr(resp, verStart + 10, verEnd - (verStart + 10)));
             if(newVersion != lastSubscriptionVersion)
             {
                PrintFormat("[TradifyBridge] Subscription version changed from %d to %d", lastSubscriptionVersion, newVersion);
                lastSubscriptionVersion = newVersion;
             }
         }
      }

      int symStart = StringFind(resp, "\"symbols\":[");
      if(symStart >= 0)
      {
         int startArr = symStart + 11;
         int endArr = StringFind(resp, "]", startArr);
         if(endArr > startArr)
         {
            string listStr = StringSubstr(resp, startArr, endArr - startArr);
            StringReplace(listStr, "\"", "");
            string newSyms[];
            int newCount = ParseSymbols(listStr, newSyms);
            
            // Add new symbols
            for(int i = 0; i < newCount; i++)
            {
               string sym = newSyms[i];
               bool alreadyIn = false;
               for(int j = 0; j < targetSymbolCount; j++)
               {
                  if(targetSymbolList[j] == sym) { alreadyIn = true; break; }
               }
               if(!alreadyIn)
               {
                  SymbolSelect(sym, true);
                  if(SymbolInfoInteger(sym, SYMBOL_SELECT))
                  {
                     ArrayResize(targetSymbolList, targetSymbolCount + 1);
                     ArrayResize(targetSymbolSyncState, targetSymbolCount + 1);
                     targetSymbolList[targetSymbolCount] = sym;
                     targetSymbolSyncState[targetSymbolCount] = false;
                     targetSymbolCount++;
                     PrintFormat("[TradifyBridge] ADD %s", sym);
                     PrintFormat("[TradifyBridge] %s selected", sym);
                     PrintFormat("[TradifyBridge] %s synchronized", sym);
                     PrintFormat("[TradifyBridge] %s quote active", sym);
                  }
               }
            }

            // Remove symbols no longer in subscription
            for(int j = targetSymbolCount - 1; j >= 0; j--)
            {
               string currentSym = targetSymbolList[j];
               bool stillRequired = false;
               for(int i = 0; i < newCount; i++)
               {
                  if(newSyms[i] == currentSym) { stillRequired = true; break; }
               }
               if(!stillRequired)
               {
                  PrintFormat("[TradifyBridge] Dynamic subscription removed symbol '%s'", currentSym);
                  ResetSymbolHistory(currentSym);
                  // Shift elements left
                  for(int k = j; k < targetSymbolCount - 1; k++)
                  {
                     targetSymbolList[k] = targetSymbolList[k+1];
                     targetSymbolSyncState[k] = targetSymbolSyncState[k+1];
                  }
                  targetSymbolCount--;
                  ArrayResize(targetSymbolList, targetSymbolCount);
                  ArrayResize(targetSymbolSyncState, targetSymbolCount);
               }
            }
            
            PrintFormat("[TradifyBridge] Active symbols: %d", targetSymbolCount);
            SendSpecifications();
         }
      }
   }
}
//+------------------------------------------------------------------+
//| Heartbeat & Symbol Discovery                                     |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string serverName = (StringLen(accountServer) > 0) ? accountServer : company;
   if(StringLen(serverName) == 0) serverName = "MT5-Broker";

   bool isConnected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);

   // Discovery: collect active Market Watch symbols for Admin UI symbol mapping selector
   int mwTotal = SymbolsTotal(true);
   if(mwTotal <= 0) mwTotal = SymbolsTotal(false);

   string symbolsJson = "[";
   int count = 0;
   for(int i = 0; i < mwTotal && count < 200; i++)
   {
      string symName = SymbolName(i, true);
      if(StringLen(symName) == 0) symName = SymbolName(i, false);
      if(StringLen(symName) > 0)
      {
         if(count > 0) symbolsJson += ",";
         symbolsJson += "\"" + JsonEscape(symName) + "\"";
         count++;
      }
   }
   symbolsJson += "]";

   string payload = "{";
   string activeSymsJson = "[";
   for(int i = 0; i < targetSymbolCount; i++)
   {
      if(i > 0) activeSymsJson += ",";
      activeSymsJson += "\"" + targetSymbolList[i] + "\"";
   }
   activeSymsJson += "]";

   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"server\":\"" + JsonEscape(serverName) + "\",";
   payload += "\"connected\":" + (isConnected ? "true" : "false") + ",";
   payload += "\"discovered\":" + IntegerToString(count) + ",";
   payload += "\"active\":" + IntegerToString(targetSymbolCount) + ",";
   payload += "\"subscriptionVersion\":" + IntegerToString(lastSubscriptionVersion) + ",";
   payload += "\"activeSymbols\":" + activeSymsJson + ",";
   payload += "\"symbols\":" + symbolsJson;
   payload += "}";

   string resp;
   int code = SendPostRequest("/api/mt5/bridge/heartbeat", payload, resp);
   if(code == 200)
   {
      PrintFormat("[TradifyBridge] Heartbeat POST 200 | JSON OK | Discovered %d symbols | Server: %s", count, serverName);
   }
}

//+------------------------------------------------------------------+
//| Stream Real-Time Quotes (ONLY for TargetSymbols)                 |
//+------------------------------------------------------------------+
void SendQuotes()
{
   if(targetSymbolCount <= 0) return;

   string quotesJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      MqlTick tick;
      if(SymbolInfoTick(sym, tick))
      {
         if(tick.bid > 0 || tick.ask > 0 || tick.last > 0)
         {
            long chartModeInt = SymbolInfoInteger(sym, SYMBOL_CHART_MODE);
            string chartModeStr = (chartModeInt == SYMBOL_CHART_MODE_LAST) ? "LAST" : "BID";

            if(validCount > 0) quotesJson += ",";
            quotesJson += "{";
            quotesJson += "\"symbol\":\"" + JsonEscape(sym) + "\",";
            quotesJson += "\"bid\":" + DoubleToString(tick.bid, 5) + ",";
            quotesJson += "\"ask\":" + DoubleToString(tick.ask, 5) + ",";
            quotesJson += "\"last\":" + DoubleToString(tick.last > 0 ? tick.last : (tick.bid + tick.ask)/2.0, 5) + ",";
            quotesJson += "\"chartMode\":\"" + chartModeStr + "\",";
            quotesJson += "\"time\":" + IntegerToString(tick.time) + ",";
            quotesJson += "\"timeMsc\":" + IntegerToString(tick.time_msc);
            quotesJson += "}";
            validCount++;
         }
      }
   }
   quotesJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"quotes\":" + quotesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/quotes", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 | JSON OK | %d quotes sent", validCount);
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Quotes POST 200 but invalid Content/API response");
   }
   else
   {
      PrintFormat("[TradifyBridge] QUOTE ERROR HTTP %d | %d quotes attempted", resCode, validCount);
   }
}

//+------------------------------------------------------------------+
//| Stream Candles for a Symbol & Timeframe                          |
//+------------------------------------------------------------------+
int SendCandlesForSymbol(string sym, ENUM_TIMEFRAMES tfEnum, string tfName, int barsToFetch, bool fullSync)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(sym, tfEnum, 0, barsToFetch, rates);
   if(copied <= 0)
   {
      int err = GetLastError();
      PrintFormat("[TradifyBridge] CANDLE COPY ERROR %s %s | CopyRates failed, error code: %d", sym, tfName, err);
      return 0;
   }
   
   datetime firstTime = rates[copied - 1].time;
   datetime lastTime = rates[0].time;
   PrintFormat("[TradifyBridge] %s %s: firstTime=%s lastTime=%s bars=%d", sym, tfName, TimeToString(firstTime), TimeToString(lastTime), copied);

   string candlesJson = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) candlesJson += ",";
      candlesJson += "{";
      candlesJson += "\"time\":" + IntegerToString(rates[i].time) + ",";
      candlesJson += "\"open\":" + DoubleToString(rates[i].open, 5) + ",";
      candlesJson += "\"high\":" + DoubleToString(rates[i].high, 5) + ",";
      candlesJson += "\"low\":" + DoubleToString(rates[i].low, 5) + ",";
      candlesJson += "\"close\":" + DoubleToString(rates[i].close, 5) + ",";
      candlesJson += "\"volume\":" + IntegerToString(rates[i].tick_volume);
      candlesJson += "}";
   }
   candlesJson += "]";

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   payload += "\"timeframe\":\"" + tfName + "\",";
   payload += "\"syncMode\":\"" + (fullSync ? "FULL" : "INCREMENTAL") + "\",";
   payload += "\"candles\":" + candlesJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/candles", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | %s | HTTP 200 | JSON OK", sym, tfName, copied, fullSync ? "FULL" : "INCREMENTAL");
   }
   else if(resCode == -2)
   {
      PrintFormat("[TradifyBridge] Candle POST %s %s %d bars | Invalid Content/API response", sym, tfName, copied);
   }
   else
   {
      PrintFormat("[TradifyBridge] CANDLE ERROR HTTP %d on %s %s", resCode, sym, tfName);
   }

   // A copied batch is not delivered history until the API acknowledges it.
   return resCode == 200 ? copied : 0;
}

void ResetSymbolHistory(string sym)
{
   string prefix = sym + ":";
   for(int i = ArraySize(completedHistoryKeys) - 1; i >= 0; i--)
   {
      if(StringFind(completedHistoryKeys[i], prefix) != 0) continue;
      for(int j = i; j < ArraySize(completedHistoryKeys) - 1; j++)
         completedHistoryKeys[j] = completedHistoryKeys[j + 1];
      ArrayResize(completedHistoryKeys, ArraySize(completedHistoryKeys) - 1);
   }
}

int SyncTimeframeHistory(string sym, ENUM_TIMEFRAMES tf, string name, int historyBars)
{
   string key = sym + ":" + name;
   bool initial = true;
   for(int i = 0; i < ArraySize(completedHistoryKeys); i++)
      if(completedHistoryKeys[i] == key) { initial = false; break; }

   int copied = SendCandlesForSymbol(sym, tf, name, initial ? historyBars : 5, initial);
   // CopyRates starts asynchronous terminal history loading. Retry this
   // timeframe independently until the available history is synchronized
   // and delivered, without resending completed timeframes' full batches.
   int available = Bars(sym, tf);
   int required = MathMin(historyBars, available);
   if(name == "M15") required = MathMax(51, required);
   if(initial && copied > 0 && required > 0 && copied >= required
      && SeriesInfoInteger(sym, tf, SERIES_SYNCHRONIZED))
   {
      int n = ArraySize(completedHistoryKeys);
      ArrayResize(completedHistoryKeys, n + 1);
      completedHistoryKeys[n] = key;
      PrintFormat("[TradifyBridge] History ready %s %s (%d bars).", sym, name, copied);
   }
   else if(initial)
      PrintFormat("[TradifyBridge] History pending %s %s (%d bars delivered); retrying.", sym, name, copied);
   return copied;
}

//+------------------------------------------------------------------+
//| Send ONE history batch, then return control to live quotes       |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(targetSymbolCount <= 0)
   {
      candleSyncActive = false;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
      return;
   }
   ulong now = GetTickCount64();
   if(!candleSyncActive)
   {
      if(lastCandleSyncTick > 0 && now - lastCandleSyncTick < (ulong)CandleSyncSec * 1000) return;
      candleSyncActive = true;
      candleSymbolCursor = 0;
      candleTimeframeCursor = 0;
   }

   // Sweep each timeframe across symbols. Never run all 9 x N blocking
   // WebRequests in one event: quotes must run between history batches.
   ENUM_TIMEFRAMES frames[9] = {PERIOD_M15, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_M1, PERIOD_M5, PERIOD_M30, PERIOD_H1, PERIOD_MN1};
   string names[9] = {"M15", "H4", "D1", "W1", "M1", "M5", "M30", "H1", "MN1"};
   int counts[9] = {500, 500, 500, 300, 500, 500, 500, 500, 240};
   if(candleSymbolCursor >= targetSymbolCount) candleSymbolCursor = 0;
   int i = candleSymbolCursor;
   string sym = targetSymbolList[i];
   if(StringLen(sym) > 0 && SymbolSelect(sym, true))
   {
      int copied = SyncTimeframeHistory(sym, frames[candleTimeframeCursor], names[candleTimeframeCursor], counts[candleTimeframeCursor]);
      if(names[candleTimeframeCursor] == "M15" && copied >= 51)
         targetSymbolSyncState[i] = true;
   }
   candleSymbolCursor++;
   if(candleSymbolCursor >= targetSymbolCount)
   {
      candleSymbolCursor = 0;
      candleTimeframeCursor++;
   }
   if(candleTimeframeCursor >= 9)
   {
      candleSyncActive = false;
      lastCandleSyncTick = GetTickCount64();
   }
}

//+------------------------------------------------------------------+
//| Stream Symbol Contract Specifications (Authoritative MT5 Specs)   |
//+------------------------------------------------------------------+
void SendSpecifications()
{
   if(targetSymbolCount <= 0) return;

   string specsJson = "[";
   int validCount = 0;

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      SymbolSelect(sym, true);

      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickValueProfit = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_PROFIT);
      double tickValueLoss = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      double contractSize = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
      double volumeMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      double volumeMax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
      double volumeStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
      long digits = SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      string profitCurrency = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);

      if(tickSize > 0 && tickValue > 0 && volumeMin > 0 && volumeMax > 0 && volumeStep > 0)
      {
         if(validCount > 0) specsJson += ",";
         specsJson += "{";
         specsJson += "\"brokerSymbol\":\"" + JsonEscape(sym) + "\",";
         specsJson += "\"tradeTickSize\":" + DoubleToString(tickSize, 6) + ",";
         specsJson += "\"tradeTickValue\":" + DoubleToString(tickValue, 6) + ",";
         if(tickValueProfit > 0)
            specsJson += "\"tradeTickValueProfit\":" + DoubleToString(tickValueProfit, 6) + ",";
         if(tickValueLoss > 0)
            specsJson += "\"tradeTickValueLoss\":" + DoubleToString(tickValueLoss, 6) + ",";
         if(contractSize > 0)
            specsJson += "\"tradeContractSize\":" + DoubleToString(contractSize, 2) + ",";
         specsJson += "\"volumeMin\":" + DoubleToString(volumeMin, 4) + ",";
         specsJson += "\"volumeMax\":" + DoubleToString(volumeMax, 4) + ",";
         specsJson += "\"volumeStep\":" + DoubleToString(volumeStep, 4) + ",";
         specsJson += "\"digits\":" + IntegerToString(digits) + ",";
         specsJson += "\"point\":" + DoubleToString(point, 6) + ",";
         specsJson += "\"profitCurrency\":\"" + JsonEscape(profitCurrency) + "\"";
         specsJson += "}";
         validCount++;
      }
   }
   specsJson += "]";

   if(validCount == 0) return;

   string payload = "{";
   payload += "\"bridgeId\":\"" + JsonEscape(BridgeId) + "\",";
   payload += "\"specs\":" + specsJson;
   payload += "}";

   string resp;
   int resCode = SendPostRequest("/api/mt5/bridge/specs", payload, resp);
   if(resCode == 200)
   {
      PrintFormat("[TradifyBridge] Specs POST 200 | Sent authoritative specs for %d symbols", validCount);
   }
   else
   {
      PrintFormat("[TradifyBridge] Specs POST ERROR HTTP %d", resCode);
   }
}

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(PublishIntervalMs < 100 || CandleSyncSec < 1)
   {
      Print("[TradifyBridge] PublishIntervalMs must be >= 100 and CandleSyncSec must be >= 1.");
      return INIT_PARAMETERS_INCORRECT;
   }
   PrintFormat("[TradifyBridge] Initializing multi-symbol bridge '%s' -> %s", BridgeId, TradifyBackendUrl);

   if(StringLen(BridgeSecret) == 0)
   {
      Print("[TradifyBridge] ERROR: BridgeSecret input parameter is empty! Please set your BridgeSecret in EA Inputs before launching.");
      return INIT_PARAMETERS_INCORRECT;
   }

   targetSymbolCount = ParseSymbols(TargetSymbols, targetSymbolList);
   ArrayResize(targetSymbolSyncState, targetSymbolCount);
   for(int i = 0; i < targetSymbolCount; i++) targetSymbolSyncState[i] = false;
   PrintFormat("[TradifyBridge] Configured %d target symbols (bootstrap): %s", targetSymbolCount, TargetSymbols);

   for(int i = 0; i < targetSymbolCount; i++)
   {
      string sym = targetSymbolList[i];
      bool sel = SymbolSelect(sym, true);
      if(sel)
      {
         PrintFormat("[TradifyBridge] Activated target symbol '%s' in Market Watch.", sym);
      }
      else
      {
         PrintFormat("[TradifyBridge] WARNING: Target symbol '%s' could not be selected in Market Watch.", sym);
      }
   }

   // Set timer in milliseconds for quote publishing
   int timerMs = PublishIntervalMs;
   if(timerMs < 100) timerMs = 100;
   EventSetMillisecondTimer(timerMs);

   // Network work starts in OnTimer, with quotes ahead of history.

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   PrintFormat("[TradifyBridge] Bridge '%s' stopped. Reason: %d", BridgeId, reason);
}

//+------------------------------------------------------------------+
//| Expert Timer Function (ALL outbound network requests happen here) |
//+------------------------------------------------------------------+
void OnTimer()
{
   ulong tickNow = GetTickCount64();

   // 1. Send Quotes at configured PublishIntervalMs
   if(tickNow - lastPublishTick >= (ulong)PublishIntervalMs)
   {
      SendQuotes();
      lastPublishTick = GetTickCount64();
   }

   // 2. Send Heartbeat every 5 seconds
   if(tickNow - lastHeartbeatTick >= 5000)
   {
      SendHeartbeat();
      lastHeartbeatTick = GetTickCount64();
      return;
   }

   // 3. Send Specifications periodically every 60 seconds
   if(tickNow - lastSpecSyncTick >= 60000)
   {
      SendSpecifications();
      lastSpecSyncTick = GetTickCount64();
      return;
   }

   // 4. Poll subscriptions, returning before any history upload.
   if(tickNow - lastSubscriptionFetchTick >= 10000)
   {
      FetchSubscriptions();
      lastSubscriptionFetchTick = GetTickCount64();
      return;
   }

   // 5. At most one candle POST per event; next event starts with quotes.
   SyncCandles();
}

//+------------------------------------------------------------------+
//| Expert Tick Function (OMITTED / EMPTY - No network sending here) |
//+------------------------------------------------------------------+
void OnTick()
{
   // Empty by design: All outbound network transmissions are driven by OnTimer()
   // to avoid synchronous WebRequest overhead on tick events.
}
//+------------------------------------------------------------------+
#endif
