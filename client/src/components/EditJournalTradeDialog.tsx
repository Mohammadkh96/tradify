import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateTrade } from "@/hooks/use-trades";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditableTrade = {
  id: number;
  pair: string;
  direction: string;
  timeframe?: string | null;
  outcome: string;
  netPl: string | number;
  notes?: string | null;
};

export default function EditJournalTradeDialog({
  trade,
  onClose,
}: {
  trade: EditableTrade;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const updateTrade = useUpdateTrade();
  const [pair, setPair] = useState(trade.pair);
  const [direction, setDirection] = useState(trade.direction);
  const [timeframe, setTimeframe] = useState(trade.timeframe || "H1");
  const [outcome, setOutcome] = useState(trade.outcome);
  const [netPl, setNetPl] = useState(String(trade.netPl ?? "0"));
  const [notes, setNotes] = useState(trade.notes || "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pair.trim() || !Number.isFinite(Number(netPl))) return;

    updateTrade.mutate(
      {
        id: trade.id,
        pair: pair.trim().toUpperCase(),
        direction,
        timeframe: timeframe.trim(),
        outcome,
        netPl: netPl.trim(),
        notes: notes.trim() || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !updateTrade.isPending) onClose(); }}>
      <DialogContent data-testid="dialog-edit-trade">
        <DialogHeader>
          <DialogTitle>{t("journal.editTrade")}: {trade.pair}</DialogTitle>
          <DialogDescription>{t("journal.editTradeDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-trade-pair">{t("journal.instrument")}</Label>
              <Input
                id="edit-trade-pair"
                data-testid="input-edit-trade-pair"
                value={pair}
                onChange={(event) => setPair(event.target.value)}
                required
                maxLength={32}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-trade-timeframe">{t("journal.timeframe")}</Label>
              <Input
                id="edit-trade-timeframe"
                data-testid="input-edit-trade-timeframe"
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
                maxLength={16}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-trade-direction">{t("journal.direction")}</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger id="edit-trade-direction" data-testid="select-edit-trade-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Buy", "Sell", "Long", "Short"].map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-trade-outcome">{t("journal.outcome")}</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="edit-trade-outcome" data-testid="select-edit-trade-outcome"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Win">{t("journal.outcomeWin")}</SelectItem>
                  <SelectItem value="Loss">{t("journal.outcomeLoss")}</SelectItem>
                  <SelectItem value="Breakeven">{t("journal.outcomeBreakeven")}</SelectItem>
                  <SelectItem value="Break-even">{t("journal.outcomeBreakeven")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-trade-netpl">{t("journal.netPL")}</Label>
            <Input
              id="edit-trade-netpl"
              data-testid="input-edit-trade-netpl"
              type="number"
              step="0.01"
              value={netPl}
              onChange={(event) => setNetPl(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-trade-notes">{t("journal.tradeNotes")}</Label>
            <Textarea
              id="edit-trade-notes"
              data-testid="textarea-edit-trade-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={updateTrade.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" data-testid="button-save-trade-edit" disabled={updateTrade.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
