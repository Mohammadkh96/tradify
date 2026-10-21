import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Save, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { Button } from '../ui/Button';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type DayRule = { weekday: number; enabled: boolean; startMinute: number; endMinute: number };

function minuteToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function timeToMinute(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export const CoachAvailabilityEditor = () => {
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(120);
  const [bookingHorizonDays, setBookingHorizonDays] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [rules, setRules] = useState<DayRule[]>(DAYS.map((_, weekday) => ({ weekday, enabled: false, startMinute: 9 * 60, endMinute: 17 * 60 })));
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [blackoutStart, setBlackoutStart] = useState('');
  const [blackoutEnd, setBlackoutEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await apiClient.get('/api/marketplace/coaches/me/availability');
      const data = response.availability;
      if (!data) return;
      setTimezone(data.timezone);
      setMinNoticeMinutes(data.minNoticeMinutes);
      setBookingHorizonDays(data.bookingHorizonDays);
      setBufferMinutes(data.bufferMinutes);
      setRules(DAYS.map((_, weekday) => {
        const existing = data.rules.find((rule: any) => rule.weekday === weekday);
        return existing
          ? { weekday, enabled: true, startMinute: existing.startMinute, endMinute: existing.endMinute }
          : { weekday, enabled: false, startMinute: 9 * 60, endMinute: 17 * 60 };
      }));
      setExceptions(data.exceptions ?? []);
    } catch {
      setMessage('Availability could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled).map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })), [rules]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiClient.put('/api/marketplace/coaches/me/availability', {
        timezone, minNoticeMinutes, bookingHorizonDays, bufferMinutes,
        rules: activeRules,
        exceptions: exceptions.map((exception) => ({ startsAt: exception.startsAt, endsAt: exception.endsAt, note: exception.note })),
      });
      setExceptions(response.availability?.exceptions ?? exceptions);
      setMessage('Calendar rules saved. Traders will see only these published slots.');
    } catch (error: any) {
      setMessage(error.message || 'Availability could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const addBlackout = () => {
    if (!blackoutStart || !blackoutEnd || new Date(blackoutEnd) <= new Date(blackoutStart)) {
      setMessage('Choose a blackout end after its start.');
      return;
    }
    setExceptions([...exceptions, { startsAt: new Date(blackoutStart).toISOString(), endsAt: new Date(blackoutEnd).toISOString(), note: 'Coach calendar blackout' }]);
    setBlackoutStart('');
    setBlackoutEnd('');
    setMessage(null);
  };

  if (loading) return <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading your scheduling rules…</section>;

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Scheduled availability</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Publish recurring learning hours. Tradigo applies your timezone, notice, horizon, buffers, and blackouts server-side.</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save calendar'}</Button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-xs font-semibold text-muted-foreground">Timezone
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Minimum notice (minutes)
          <input type="number" min={0} max={43200} value={minNoticeMinutes} onChange={(event) => setMinNoticeMinutes(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Booking horizon (days)
          <input type="number" min={1} max={365} value={bookingHorizonDays} onChange={(event) => setBookingHorizonDays(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
      </div>
      <label className="mt-4 block max-w-xs text-xs font-semibold text-muted-foreground">Buffer before and after (minutes)
        <input type="number" min={0} max={180} value={bufferMinutes} onChange={(event) => setBufferMinutes(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
      </label>
      <div className="mt-5 space-y-2">
        {rules.map((rule) => (
          <div key={rule.weekday} className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={rule.enabled} onChange={(event) => setRules(rules.map((item) => item.weekday === rule.weekday ? { ...item, enabled: event.target.checked } : item))} />{DAYS[rule.weekday]}</label>
            <span className="text-xs text-muted-foreground">from</span>
            <input type="time" disabled={!rule.enabled} value={minuteToTime(rule.startMinute)} onChange={(event) => setRules(rules.map((item) => item.weekday === rule.weekday ? { ...item, startMinute: timeToMinute(event.target.value) } : item))} className="rounded border border-border bg-background px-2 py-1.5 disabled:opacity-50" />
            <input type="time" disabled={!rule.enabled} value={minuteToTime(rule.endMinute)} onChange={(event) => setRules(rules.map((item) => item.weekday === rule.weekday ? { ...item, endMinute: timeToMinute(event.target.value) } : item))} className="rounded border border-border bg-background px-2 py-1.5 disabled:opacity-50" />
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-amber-300/40 bg-amber-50/40 p-4 dark:bg-amber-950/20">
        <div className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-amber-600" />Calendar blackouts</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="datetime-local" value={blackoutStart} onChange={(event) => setBlackoutStart(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
          <input type="datetime-local" value={blackoutEnd} onChange={(event) => setBlackoutEnd(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
          <Button type="button" variant="outline" onClick={addBlackout}>Add blackout</Button>
        </div>
        {exceptions.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{exceptions.map((exception, index) => <li key={`${exception.startsAt}-${index}`} className="flex justify-between gap-3"><span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(exception.startsAt))} – {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(exception.endsAt))}</span><button type="button" onClick={() => setExceptions(exceptions.filter((_, itemIndex) => itemIndex !== index))} className="font-semibold text-destructive">Remove</button></li>)}</ul>}
      </div>
      {message && <p role="status" className="mt-4 text-sm font-medium text-muted-foreground">{message}</p>}
    </section>
  );
};