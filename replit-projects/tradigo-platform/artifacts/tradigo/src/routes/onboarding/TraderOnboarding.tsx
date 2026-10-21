import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useNavigate } from 'react-router';
import { apiClient } from '../../lib/apiClient';

export const TraderOnboarding = () => {
  const { canonicalUser, traderProfile } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(traderProfile?.onboardingCurrentStep || 1);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    experienceLevel: traderProfile?.experienceLevel || 'BEGINNER',
    instruments: traderProfile?.instruments || [],
    timezone: traderProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const handleNext = async () => {
    const nextStep = step + 1;
    setStep(nextStep);
    
    // Save draft incrementally
    try {
      await apiClient.put('/api/traders/onboarding/draft', {
        ...formData,
        currentStep: nextStep
      });
      // Optionally update local store if needed, but not strictly required
    } catch (err) {
      console.error('Failed to save draft', err);
    }
  };

  const handleBack = () => {
    const nextStep = step - 1;
    setStep(nextStep);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/api/traders/onboarding', formData);
      await useAuthStore.getState().refreshProfile();
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTraderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Welcome to Tradigo!</h2>
      <p className="text-muted-foreground">Let's set up your profile to find the best coaching matches.</p>
      
      <div className="space-y-4 pt-4">
        <Select 
           label="Trading Experience Level" 
           value={formData.experienceLevel} 
           onChange={(e) => setFormData({...formData, experienceLevel: e.target.value as typeof formData.experienceLevel})}
          options={[
            { label: 'Beginner (0-1 years)', value: 'BEGINNER' },
            { label: 'Intermediate (1-3 years)', value: 'INTERMEDIATE' },
            { label: 'Advanced (3-5 years)', value: 'ADVANCED' },
            { label: 'Professional (5+ years)', value: 'PROFESSIONAL' },
          ]}
        />
        
        <Select 
           label="Timezone" 
           value={formData.timezone} 
           onChange={(e) => setFormData({...formData, timezone: e.target.value})}
          options={[
            { label: 'UTC', value: 'UTC' },
            { label: 'America/New_York (EST)', value: 'America/New_York' },
            { label: 'America/Chicago (CST)', value: 'America/Chicago' },
            { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
            { label: 'Europe/London (GMT)', value: 'Europe/London' },
            { label: 'Europe/Berlin (CET)', value: 'Europe/Berlin' },
            { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
            { label: 'Australia/Sydney (AEST)', value: 'Australia/Sydney' },
          ]}
        />
      </div>

      <div className="flex justify-end pt-6">
        <Button onClick={handleNext}>Save & Continue</Button>
      </div>
    </div>
  );

  const renderTraderStep2 = () => {
    const availableInstruments = ['FOREX', 'CRYPTO', 'INDICES', 'COMMODITIES', 'EQUITIES', 'FUTURES', 'OPTIONS'];
    
    const toggleInstrument = (inst: string) => {
      const current = formData.instruments;
      if (current.includes(inst as any)) {
        setFormData({ ...formData, instruments: current.filter(i => i !== inst) });
      } else {
        setFormData({ ...formData, instruments: [...current, inst as any] });
      }
    };

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">What do you trade?</h2>
        <p className="text-muted-foreground">Select all markets you are interested in.</p>
        
        <div className="grid grid-cols-2 gap-3 pt-4">
          {availableInstruments.map(inst => {
            const isSelected = formData.instruments.includes(inst as any);
            return (
              <button
                key={inst}
                onClick={() => toggleInstrument(inst)}
                className={`p-4 border rounded-xl text-left transition-colors ${
                  isSelected 
                    ? 'border-primary bg-primary/10 text-foreground' 
                    : 'border-border text-muted-foreground hover:border-foreground/50'
                }`}
              >
                <div className="font-medium">{inst}</div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between pt-6">
          <Button variant="outline" onClick={handleBack}>Back</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Complete Setup'}
          </Button>
        </div>
      </div>
    );
  };

  if (!canonicalUser) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card p-8 rounded-2xl border border-border shadow-sm">
        {step === 1 && renderTraderStep1()}
        {step === 2 && renderTraderStep2()}
      </div>
    </div>
  );
};
