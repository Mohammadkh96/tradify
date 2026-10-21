import { AlertTriangle, Shield, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type AdminActionField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select";
  defaultValue?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
};

export type AdminActionRequest = {
  title: string;
  description: string;
  fields: AdminActionField[];
  submitLabel: string;
  intent?: "default" | "destructive";
};

export type AdminActionValues = Record<string, string>;

type AdminActionDialogContextValue = {
  openActionDialog: (request: AdminActionRequest) => Promise<AdminActionValues | null>;
};

const AdminActionDialogContext = createContext<AdminActionDialogContextValue | null>(null);

export function useAdminActionDialog() {
  const value = useContext(AdminActionDialogContext);
  if (!value) throw new Error("useAdminActionDialog must be used inside AdminActionDialogProvider");
  return value.openActionDialog;
}

function PortalActionDialog({
  request,
  onResolve,
}: {
  request: AdminActionRequest | null;
  onResolve: (values: AdminActionValues | null) => void;
}) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        (request?.fields ?? []).map((field) => [field.name, field.defaultValue ?? ""]),
      ),
    [request],
  );
  const form = useForm<AdminActionValues>({ defaultValues: defaults });
  const { reset } = form;

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const validateField = (field: AdminActionField) => ({
    validate: (rawValue: string) => {
      const value = rawValue ?? "";
      if (field.required && !value.trim()) return `${field.label} is required.`;
      if (!value.trim() || field.type !== "number") return true;
      const number = Number(value);
      if (!Number.isFinite(number)) return "Enter a valid number.";
      if (field.integer && !Number.isInteger(number)) return "Enter a whole number.";
      if (field.min !== undefined && number < field.min) return `Enter ${field.min} or higher.`;
      if (field.max !== undefined && number > field.max) return `Enter ${field.max} or lower.`;
      return true;
    },
  });

  const submit = (values: AdminActionValues) => onResolve(values);

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && request) onResolve(null);
      }}
    >
      <DialogContent className="portal-action-dialog">
        {request && (
          <>
            <DialogHeader className="portal-action-header">
              <span
                className={`portal-action-icon ${request.intent === "destructive" ? "portal-action-icon-danger" : ""}`}
              >
                {request.intent === "destructive" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <Shield size={18} />
                )}
              </span>
              <div className="portal-action-heading">
                <DialogTitle className="portal-action-title">{request.title}</DialogTitle>
                <DialogDescription className="portal-action-description">
                  {request.description}
                </DialogDescription>
              </div>
            </DialogHeader>
            <Form {...form}>
              <form
                data-testid="portal-action-form"
                className="portal-action-form"
                onSubmit={form.handleSubmit(submit)}
                noValidate
              >
                {request.fields.length > 0 && (
                  <div className="portal-action-fields">
                    {request.fields.map((field) => {
                      const id = `portal-field-${field.name}`;
                      const error = form.formState.errors[field.name]?.message;
                      const registration = form.register(field.name, validateField(field));
                      return (
                        <div className="portal-action-field" key={field.name}>
                          <label className="portal-action-label" htmlFor={id}>
                            {field.label}
                            {field.required && (
                              <span className="portal-action-required">Required</span>
                            )}
                          </label>
                          {field.type === "textarea" ? (
                            <Textarea
                              {...registration}
                              id={id}
                              data-testid={id}
                              rows={field.rows ?? 3}
                              placeholder={field.placeholder}
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${id}-error` : field.helperText ? `${id}-help` : undefined
                              }
                            />
                          ) : field.type === "select" ? (
                            <select
                              {...registration}
                              id={id}
                              data-testid={id}
                              className="portal-action-select"
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${id}-error` : field.helperText ? `${id}-help` : undefined
                              }
                            >
                              {!field.required && <option value="">No selection</option>}
                              {field.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              {...registration}
                              id={id}
                              data-testid={id}
                              type={field.type === "number" ? "number" : "text"}
                              min={field.min}
                              max={field.max}
                              step={field.integer ? 1 : "any"}
                              placeholder={field.placeholder}
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${id}-error` : field.helperText ? `${id}-help` : undefined
                              }
                            />
                          )}
                          {field.helperText && (
                            <p id={`${id}-help`} className="portal-action-help">
                              {field.helperText}
                            </p>
                          )}
                          {typeof error === "string" && (
                            <p id={`${id}-error`} className="portal-action-error" role="alert">
                              {error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <DialogFooter className="portal-action-footer">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="portal-action-cancel"
                    onClick={() => onResolve(null)}
                  >
                    <X size={15} /> Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant={request.intent === "destructive" ? "destructive" : "default"}
                    data-testid="portal-action-submit"
                  >
                    {request.submitLabel}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminActionDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AdminActionRequest | null>(null);
  const resolver = useRef<((values: AdminActionValues | null) => void) | null>(null);

  const openActionDialog = useCallback(
    (nextRequest: AdminActionRequest) =>
      new Promise<AdminActionValues | null>((resolve) => {
        if (resolver.current) {
          resolve(null);
          return;
        }
        resolver.current = resolve;
        setRequest(nextRequest);
      }),
    [],
  );

  const resolveDialog = useCallback((values: AdminActionValues | null) => {
    const finish = resolver.current;
    resolver.current = null;
    setRequest(null);
    finish?.(values);
  }, []);

  useEffect(
    () => () => {
      resolver.current?.(null);
      resolver.current = null;
    },
    [],
  );

  const contextValue = useMemo(() => ({ openActionDialog }), [openActionDialog]);

  return (
    <AdminActionDialogContext.Provider value={contextValue}>
      {children}
      <PortalActionDialog request={request} onResolve={resolveDialog} />
    </AdminActionDialogContext.Provider>
  );
}
