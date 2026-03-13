import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { NoIndexSEO } from "@/components/SEO";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to reset password.");
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Password Reset",
        description: "Your password has been reset successfully.",
      });

      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3" data-testid="text-invalid-link">
            Invalid Reset Link
          </h1>
          <p className="text-muted-foreground mb-8" data-testid="text-invalid-description">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <Link to="/login">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider" data-testid="button-back-to-login">
              <ArrowLeft size={16} className="mr-2" />
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3" data-testid="text-success-heading">
            Password Reset <span className="text-emerald-500">Complete</span>
          </h1>
          <p className="text-muted-foreground mb-8" data-testid="text-success-description">
            Your password has been updated. Redirecting you to login...
          </p>
          <Link to="/login">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider" data-testid="button-go-to-login">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <NoIndexSEO title="Reset Password | TradifyApp" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-emerald-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2" data-testid="text-reset-heading">
            Reset Your <span className="text-emerald-500">Password</span>
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-reset-description">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="bg-muted/50 border-border pr-10"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="bg-muted/50 border-border pr-10"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-confirm"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-amber-500" data-testid="text-password-hint">Password must be at least 8 characters.</p>
          )}

          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500" data-testid="text-mismatch">Passwords do not match.</p>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" data-testid="text-error">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider h-11"
            data-testid="button-reset-password"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </Button>

          <div className="text-center">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-back-to-login">
              <ArrowLeft size={12} className="inline mr-1" />
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
