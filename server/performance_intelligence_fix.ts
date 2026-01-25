      // Performance Intelligence Engine
      const sessions = { London: 0, NY: 0, Asia: 0 };
      const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      let totalPl = 0;
      let wins = 0;
      let losses = 0;
      let totalRR = 0;
      let rrCount = 0;
      let maxDrawdown = 0;
      let peak = 0;
      let currentEquity = 0;
      
      const setups: Record<string, { wins: number, total: number }> = {};
      const violations = {
        overRisk: 0,
        outsideSession: 0,
        noStrategy: 0
      };

      trades.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()).forEach(t => {
        const date = new Date(t.createdAt!);
        const hour = date.getUTCHours();
        const day = dayNames[date.getUTCDay()];
        
        const pl = t.netPl;
        totalPl += pl;
        currentEquity += pl;
        
        if (currentEquity > peak) peak = currentEquity;
        const dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (hour >= 8 && hour < 16) sessions.London += pl;
        else if (hour >= 13 && hour < 21) sessions.NY += pl;
        else sessions.Asia += pl;
        
        days[day as keyof typeof days] += pl;
        
        if (t.outcome === "Win") wins++;
        else if (t.outcome === "Loss") losses++;

        if (t.riskReward > 0) {
          totalRR += t.riskReward;
          rrCount++;
        }

        // Violations tracking
        if (hour < 8 || hour >= 21) violations.outsideSession++;
        if (!t.setup || t.setup === "Unknown") violations.noStrategy++;

        if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
        setups[t.setup].total++;
        if (t.outcome === "Win") setups[t.setup].wins++;
      });

      const bestSession = Object.entries(sessions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      const bestDay = Object.entries(days).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      
      const setupStats = Object.entries(setups).map(([name, stat]) => ({
        name,
        winRate: (stat.wins / stat.total) * 100
      }));
      const bestSetup = setupStats.length ? setupStats.reduce((a, b) => a.winRate > b.winRate ? a : b).name : "N/A";

      const profitFactor = Math.abs(totalPl) / (Math.abs(totalPl - currentEquity) || 1); // Simplified
      const winRateVal = trades.length ? (wins / trades.length) * 100 : 0;
      const expectancy = trades.length ? totalPl / trades.length : 0;
      const recoveryFactor = maxDrawdown > 0 ? totalPl / maxDrawdown : totalPl > 0 ? 100 : 0;

      res.json({
        bestSession,
        bestDay,
        bestSetup,
        winRate: winRateVal.toFixed(1),
        avgRR: rrCount ? (totalRR / rrCount).toFixed(2) : "0.00",
        expectancy: expectancy.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        maxDrawdownPercent: peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(2) : "0.00",
        recoveryFactor: recoveryFactor.toFixed(2),
        violations
      });