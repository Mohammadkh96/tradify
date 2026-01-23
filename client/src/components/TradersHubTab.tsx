import { Zap, Users, TrendingUp, Award, Shield } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function TradersHubTab() {
  const [providers] = useState([
    {
      id: 1,
      name: 'Alpha Trading Pro',
      winRate: 68,
      followers: 1240,
      verified: true,
      tier: 'elite',
    },
    {
      id: 2,
      name: 'Swing Master',
      winRate: 62,
      followers: 850,
      verified: true,
      tier: 'pro',
    },
    {
      id: 3,
      name: 'Momentum Trader',
      winRate: 58,
      followers: 340,
      verified: false,
      tier: 'basic',
    },
  ])

  return (
    <div className="min-h-screen text-slate-50 pb-20 md:pb-0">
      <main className="md:ml-64 p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-8 h-8 text-yellow-500" />
        <h1 className="text-3xl font-bold text-white tracking-tight">Traders Hub Marketplace</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={<Users className="w-6 h-6" />} label="Signal Providers" value="2,840" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label="Avg Win Rate" value="62.4%" />
        <StatCard icon={<Award className="w-6 h-6" />} label="Verified Traders" value="1,240" />
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-widest text-xs">Featured Signal Providers</h2>
        
        <div className="grid gap-4">
          {providers.map(provider => (
            <Card
              key={provider.id}
              className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-colors group"
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                      {provider.verified && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          ✓ Verified
                        </Badge>
                      )}
                      <Badge className={
                        provider.tier === 'elite' ? 'bg-purple-500/20 text-purple-400 border-purple-500/20' :
                        provider.tier === 'pro' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20' :
                        'bg-slate-800 text-slate-400'
                      }>
                        {provider.tier.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-8">
                    Subscribe
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <Metric label="WIN RATE" value={`${provider.winRate}%`} color="text-emerald-400" />
                  <Metric label="FOLLOWERS" value={provider.followers.toLocaleString()} color="text-cyan-400" />
                  <Metric label="RATING" value="4.8★" color="text-yellow-400" />
                  <Metric label="SIGNALS/MO" value="24" color="text-purple-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-slate-900/30 border-slate-800/50">
        <CardContent className="p-6 flex gap-4">
          <Shield className="w-6 h-6 text-cyan-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-white mb-1">Platform Safety & Compliance</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Traders Hub is a technology marketplace for discovering trading signals. We do not execute trades, hold funds, or provide financial advice. All signal providers are independently verified through our rule-based audit system. Trading involves significant risk.
            </p>
          </div>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-slate-500 text-[10px] font-bold tracking-widest mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 bg-slate-800/50 rounded-lg text-emerald-500">
          {icon}
        </div>
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

import { cn } from "@/lib/utils"
