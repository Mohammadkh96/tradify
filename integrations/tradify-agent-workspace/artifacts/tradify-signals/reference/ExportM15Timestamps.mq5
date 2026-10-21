// Read-only diagnostic: exports M15 source timestamps, not prices or account data.
#property strict
#property script_show_inputs

input string BrokerSymbol = "EURUSD"; // Change to the exact Market Watch name, including any suffix
input datetime StartServerTime = D'2026.10.05 00:00';
input datetime EndServerTime   = D'2026.10.16 00:00'; // Exclusive; includes a buffer around UTC Oct 6-14
input string OutputFileName = "Tradify_EURUSD_M15_20261006_14.csv";
input int MaxHistoryWaitSeconds = 30;

void OnStart()
{
   if(StringLen(BrokerSymbol) == 0 || StartServerTime <= 0 || EndServerTime <= StartServerTime)
   {
      Print("[M15 timestamp export] Invalid symbol or server-time range.");
      return;
   }

   if(!SymbolSelect(BrokerSymbol, true))
   {
      PrintFormat("[M15 timestamp export] SymbolSelect failed for '%s'. Use the exact broker symbol.", BrokerSymbol);
      return;
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, false); // Index 0 is the oldest copied bar.
   int copied = -1;
   int lastError = 0;
   int waitSeconds = MaxHistoryWaitSeconds;
   if(waitSeconds < 1) waitSeconds = 1;
   ulong deadline = GetTickCount64() + (ulong)waitSeconds * 1000;

   while(GetTickCount64() <= deadline)
   {
      ResetLastError();
      copied = CopyRates(BrokerSymbol, PERIOD_M15, StartServerTime, EndServerTime - 1, rates);
      lastError = GetLastError();
      if(copied >= 0) break; // A negative result can mean the terminal is still loading history.
      Sleep(1000);
   }

   if(copied < 0)
   {
      PrintFormat("[M15 timestamp export] CopyRates did not complete within %d seconds; error=%d.",
                  waitSeconds, lastError);
      return;
   }

   int file = FileOpen(OutputFileName, FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
   if(file == INVALID_HANDLE)
   {
      PrintFormat("[M15 timestamp export] FileOpen failed; error=%d.", GetLastError());
      return;
   }

   FileWrite(file, "broker_symbol", "source_time_epoch", "source_time_server", "seconds_since_previous");
   for(int i = 0; i < copied; i++)
   {
      long sourceTime = (long)rates[i].time;
      long deltaSeconds = i == 0 ? 0 : sourceTime - (long)rates[i - 1].time;
      FileWrite(file,
                BrokerSymbol,
                sourceTime,
                TimeToString(rates[i].time, TIME_DATE | TIME_SECONDS),
                deltaSeconds);
   }
   FileClose(file);

   PrintFormat("[M15 timestamp export] Wrote %d timestamps for %s to MQL5/Files/%s. Times are unconverted broker-source timestamps.",
               copied, BrokerSymbol, OutputFileName);
}
