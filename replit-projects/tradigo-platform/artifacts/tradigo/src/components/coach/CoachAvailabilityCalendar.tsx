import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, Plus, Trash2, Sparkles, Shield, Save } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CoachAvailabilityCalendarProps {
  coachName?: string;
  onSave?: (availability: Record<string, string[]>) => void;
  className?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 02:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
  '06:00 PM - 08:00 PM',
];

export const CoachAvailabilityCalendar: React.FC<CoachAvailabilityCalendarProps> = ({
  coachName = 'Marcus Sterling',
  onSave,
  className,
}) => {
  // Initial dummy availability mapping: day -> array of active time slots
  const [availability, setAvailability] = useState<Record<string, string[]>>({
    Monday: ['09:00 AM - 11:00 AM', '02:00 PM - 05:00 PM'],
    Tuesday: ['10:00 AM - 01:00 PM', '03:00 PM - 06:00 PM'],
    Wednesday: ['09:00 AM - 12:00 PM', '02:00 PM - 04:00 PM'],
    Thursday: ['09:00 AM - 11:00 AM', '01:00 PM - 05:00 PM'],
    Friday: ['10:00 AM - 02:00 PM'],
    Saturday: [],
    Sunday: [],
  });

  const [savedStatus, setSavedStatus] = useState<boolean>(false);
  const [customSlot, setCustomSlot] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

  const toggleSlot = (day: string, slot: string) => {
    setAvailability(prev => {
      const currentSlots = prev[day] || [];
      const exists = currentSlots.includes(slot);
      const updated = exists 
        ? currentSlots.filter(s => s !== slot)
        : [...currentSlots, slot];
      return { ...prev, [day]: updated };
    });
    setSavedStatus(false);
  };

  const handleAddCustomSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSlot.trim()) return;
    setAvailability(prev => {
      const currentSlots = prev[selectedDay] || [];
      if (currentSlots.includes(customSlot)) return prev;
      return { ...prev, [selectedDay]: [...currentSlots, customSlot] };
    });
    setCustomSlot('');
    setSavedStatus(false);
  };

  const handleSave = () => {
    setSavedStatus(true);
    if (onSave) {
      onSave(availability);
    }
    setTimeout(() => setSavedStatus(false), 4000);
  };

  return (
    <div className={cn("bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl text-slate-100 space-y-6 backdrop-blur-md", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold tracking-tight text-slate-100">Coach Availability & Recurring Schedule</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-3 h-3 mr-1" /> Weekly Grid
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure active hours for live mentorship sessions and instant match availability.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedStatus && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Schedule Saved</span>
            </div>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>Save Availability</span>
          </button>
        </div>
      </div>

      {/* Quick Add Custom Time Slot */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-200">Add Custom Time Window</h4>
            <p className="text-xs text-slate-400">Select day and specify hours (e.g. 03:00 PM - 05:00 PM)</p>
          </div>
        </div>

        <form onSubmit={handleAddCustomSlot} className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
          >
            {DAYS.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="e.g. 07:00 PM - 09:00 PM"
            value={customSlot}
            onChange={(e) => setCustomSlot(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
          />
          <button
            type="submit"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs border border-slate-700 flex items-center space-x-1 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {DAYS.map((day) => {
          const activeSlots = availability[day] || [];
          return (
            <div
              key={day}
              className={cn(
                "rounded-xl p-4 border flex flex-col justify-between transition-all",
                activeSlots.length > 0
                  ? "bg-slate-950/80 border-indigo-500/40 shadow-md"
                  : "bg-slate-950/30 border-slate-800/80 opacity-75"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-xs text-slate-200">{day}</span>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded",
                    activeSlots.length > 0
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-slate-800 text-slate-500"
                  )}>
                    {activeSlots.length} active
                  </span>
                </div>

                {/* Predefined Slots Toggle */}
                <div className="space-y-1.5 mb-3">
                  {TIME_SLOTS.map((slot) => {
                    const isActive = activeSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => toggleSlot(day, slot)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-between",
                          isActive
                            ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 shadow-sm"
                            : "bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-slate-800"
                        )}
                      >
                        <span className="truncate">{slot}</span>
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Slots list */}
                {activeSlots.filter(s => !TIME_SLOTS.includes(s)).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Custom Windows</span>
                    {activeSlots.filter(s => !TIME_SLOTS.includes(s)).map((custom) => (
                      <div
                        key={custom}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]"
                      >
                        <span className="truncate">{custom}</span>
                        <button
                          onClick={() => toggleSlot(day, custom)}
                          className="text-emerald-400 hover:text-red-400 transition-colors ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
