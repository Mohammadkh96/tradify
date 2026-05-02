import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, AlertTriangle, Activity, Compass, TrendingDown, Save, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface AlertPreferences {
  drawdownEnabled: boolean;
  drawdownInApp: boolean;
  drawdownEmail: boolean;
  drawdownWarnThreshold: number;
  drawdownCriticalThreshold: number;
  revengeEnabled: boolean;
  revengeInApp: boolean;
  revengeEmail: boolean;
  overtradingEnabled: boolean;
  overtradingInApp: boolean;
  overtradingEmail: boolean;
  overtradingDailyCap: number;
  strategyDeviationEnabled: boolean;
  strategyDeviationInApp: boolean;
  strategyDeviationEmail: boolean;
  cooldownMinutes: number;
}

const DEFAULTS: AlertPreferences = {
  drawdownEnabled: true,
  drawdownInApp: true,
  drawdownEmail: true,
  drawdownWarnThreshold: 70,
  drawdownCriticalThreshold: 90,
  revengeEnabled: true,
  revengeInApp: true,
  revengeEmail: true,
  overtradingEnabled: true,
  overtradingInApp: true,
  overtradingEmail: false,
  overtradingDailyCap: 10,
  strategyDeviationEnabled: true,
  strategyDeviationInApp: true,
  strategyDeviationEmail: false,
  cooldownMinutes: 60,
};

export function AlertSettingsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery<AlertPreferences>({
    queryKey: ["/api/alert-preferences"],
  });

  useEffect(() => {
    if (data) {
      setPrefs({ ...DEFAULTS, ...data });
      setDirty(false);
    }
  }, [data]);

  const update = (patch: Partial<AlertPreferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/alert-preferences", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-preferences"] });
      setDirty(false);
      toast({ title: t("widgets.alerts.toast.savedTitle"), description: t("widgets.alerts.toast.savedDesc") });
    },
    onError: (err: any) => {
      toast({
        title: t("widgets.alerts.toast.errorTitle"),
        description: err?.message || t("widgets.alerts.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  return (
    <Card data-testid="card-alert-settings">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle data-testid="text-alert-settings-title">{t("widgets.alerts.title")}</CardTitle>
        </div>
        <CardDescription>
          {t("widgets.alerts.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground" data-testid="loading-alert-settings">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {t("widgets.alerts.loading")}
          </div>
        ) : (
          <>
            {/* DRAWDOWN */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <TrendingDown className="h-4 w-4 mt-1 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold block">{t("widgets.alerts.drawdown.label")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("widgets.alerts.drawdown.desc")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.drawdownEnabled}
                  onCheckedChange={(v) => update({ drawdownEnabled: v })}
                  data-testid="switch-drawdown-enabled"
                />
              </div>
              {prefs.drawdownEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 ml-7">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("widgets.alerts.drawdown.warnAt")}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={10}
                        max={99}
                        value={prefs.drawdownWarnThreshold}
                        onChange={(e) => update({ drawdownWarnThreshold: Number(e.target.value) })}
                        className="pr-7"
                        data-testid="input-drawdown-warn"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("widgets.alerts.drawdown.criticalAt")}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={20}
                        max={100}
                        value={prefs.drawdownCriticalThreshold}
                        onChange={(e) => update({ drawdownCriticalThreshold: Number(e.target.value) })}
                        className="pr-7"
                        data-testid="input-drawdown-critical"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start sm:gap-3 pt-5">
                    <Label className="text-xs text-muted-foreground">{t("widgets.alerts.inApp")}</Label>
                    <Switch
                      checked={prefs.drawdownInApp}
                      onCheckedChange={(v) => update({ drawdownInApp: v })}
                      data-testid="switch-drawdown-inapp"
                    />
                    <Label className="text-xs text-muted-foreground ml-3">{t("widgets.alerts.email")}</Label>
                    <Switch
                      checked={prefs.drawdownEmail}
                      onCheckedChange={(v) => update({ drawdownEmail: v })}
                      data-testid="switch-drawdown-email"
                    />
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* REVENGE TRADING */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <AlertTriangle className="h-4 w-4 mt-1 text-red-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold block">{t("widgets.alerts.revenge.label")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("widgets.alerts.revenge.desc")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.revengeEnabled}
                  onCheckedChange={(v) => update({ revengeEnabled: v })}
                  data-testid="switch-revenge-enabled"
                />
              </div>
              {prefs.revengeEnabled && (
                <div className="ml-7 flex items-center justify-between sm:justify-start sm:gap-3">
                  <Label className="text-xs text-muted-foreground">{t("widgets.alerts.inApp")}</Label>
                  <Switch
                    checked={prefs.revengeInApp}
                    onCheckedChange={(v) => update({ revengeInApp: v })}
                    data-testid="switch-revenge-inapp"
                  />
                  <Label className="text-xs text-muted-foreground ml-3">{t("widgets.alerts.email")}</Label>
                  <Switch
                    checked={prefs.revengeEmail}
                    onCheckedChange={(v) => update({ revengeEmail: v })}
                    data-testid="switch-revenge-email"
                  />
                </div>
              )}
            </section>

            <Separator />

            {/* OVERTRADING */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <Activity className="h-4 w-4 mt-1 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold block">{t("widgets.alerts.overtrading.label")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("widgets.alerts.overtrading.desc")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.overtradingEnabled}
                  onCheckedChange={(v) => update({ overtradingEnabled: v })}
                  data-testid="switch-overtrading-enabled"
                />
              </div>
              {prefs.overtradingEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-7">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t("widgets.alerts.overtrading.dailyCap")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={prefs.overtradingDailyCap}
                      onChange={(e) => update({ overtradingDailyCap: Number(e.target.value) })}
                      data-testid="input-overtrading-cap"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-start sm:gap-3 pt-5">
                    <Label className="text-xs text-muted-foreground">{t("widgets.alerts.inApp")}</Label>
                    <Switch
                      checked={prefs.overtradingInApp}
                      onCheckedChange={(v) => update({ overtradingInApp: v })}
                      data-testid="switch-overtrading-inapp"
                    />
                    <Label className="text-xs text-muted-foreground ml-3">{t("widgets.alerts.email")}</Label>
                    <Switch
                      checked={prefs.overtradingEmail}
                      onCheckedChange={(v) => update({ overtradingEmail: v })}
                      data-testid="switch-overtrading-email"
                    />
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* STRATEGY DEVIATION */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <Compass className="h-4 w-4 mt-1 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold block">{t("widgets.alerts.strategy.label")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("widgets.alerts.strategy.desc")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.strategyDeviationEnabled}
                  onCheckedChange={(v) => update({ strategyDeviationEnabled: v })}
                  data-testid="switch-strategy-enabled"
                />
              </div>
              {prefs.strategyDeviationEnabled && (
                <div className="ml-7 flex items-center justify-between sm:justify-start sm:gap-3">
                  <Label className="text-xs text-muted-foreground">{t("widgets.alerts.inApp")}</Label>
                  <Switch
                    checked={prefs.strategyDeviationInApp}
                    onCheckedChange={(v) => update({ strategyDeviationInApp: v })}
                    data-testid="switch-strategy-inapp"
                  />
                  <Label className="text-xs text-muted-foreground ml-3">{t("widgets.alerts.email")}</Label>
                  <Switch
                    checked={prefs.strategyDeviationEmail}
                    onCheckedChange={(v) => update({ strategyDeviationEmail: v })}
                    data-testid="switch-strategy-email"
                  />
                </div>
              )}
            </section>

            <Separator />

            {/* COOLDOWN */}
            <section className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">{t("widgets.alerts.cooldown.label")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("widgets.alerts.cooldown.desc")}
                </p>
              </div>
              <div className="max-w-[200px]">
                <div className="relative">
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={prefs.cooldownMinutes}
                    onChange={(e) => update({ cooldownMinutes: Number(e.target.value) })}
                    className="pr-16"
                    data-testid="input-cooldown-minutes"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t("widgets.alerts.minutes")}</span>
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => save.mutate()}
                disabled={!dirty || save.isPending}
                data-testid="button-save-alert-settings"
                className="gap-2"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("widgets.alerts.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
