import React, { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// ═══ BUTTON ═══
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm",
  secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  ghost: "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
  danger: "bg-rose-500 text-white hover:bg-rose-600",
  success: "bg-emerald-500 text-white hover:bg-emerald-600",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[10px]",
  md: "px-3.5 py-1.5 text-[11px]",
  lg: "px-5 py-2.5 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "rounded-lg font-semibold transition-all duration-150 inline-flex items-center gap-1.5",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <span className="animate-spin text-[10px]">⟳</span>}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ═══ INPUT ═══
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">
          {label} {props.required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full px-3 py-2 rounded-lg bg-gray-50 border text-[11px] text-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300",
          "placeholder:text-gray-300 transition-all",
          error ? "border-rose-300 focus:ring-rose-100 focus:border-rose-400" : "border-gray-200",
          className,
        )}
        {...props}
      />
      {error && <p className="text-[9px] text-rose-500 mt-0.5">{error}</p>}
      {hint && !error && <p className="text-[8px] text-gray-300 mt-0.5">{hint}</p>}
    </div>
  ),
);
Input.displayName = "Input";

// ═══ TEXTAREA ═══
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">
          {label} {props.required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full px-3 py-2 rounded-lg bg-gray-50 border text-[11px] text-gray-700 resize-none",
          "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300",
          "placeholder:text-gray-300 transition-all",
          error ? "border-rose-300" : "border-gray-200",
          className,
        )}
        {...props}
      />
      {error && <p className="text-[9px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  ),
);
Textarea.displayName = "Textarea";

// ═══ SELECT ═══
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">
          {label} {props.required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          "w-full px-3 py-2 rounded-lg bg-gray-50 border text-[11px] text-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300",
          error ? "border-rose-300" : "border-gray-200",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-[9px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  ),
);
Select.displayName = "Select";

// ═══ STATUS BADGE ═══
type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-600 border-emerald-200",
  warning: "bg-amber-50 text-amber-600 border-amber-200",
  danger: "bg-rose-50 text-rose-500 border-rose-200",
  info: "bg-sky-50 text-sky-600 border-sky-200",
  neutral: "bg-gray-50 text-gray-500 border-gray-200",
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span className={cn("text-[8px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center", badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

// Helper to map status strings to badge variants
export function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Active: "success", Confirmed: "success", Delivered: "success",
    Processing: "info", Shipped: "info",
    Draft: "neutral", Inactive: "neutral", Expired: "neutral",
    "Low Stock": "warning", Pending: "warning",
    "Out of Stock": "danger", Cancelled: "danger", Failed: "danger",
  };
  return map[status] || "neutral";
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={getStatusVariant(status)}>{status}</Badge>;
}

// ═══ CARD ═══
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 shadow-sm", padding && "p-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("px-5 py-3 border-b border-gray-100 flex items-center justify-between", className)}>
      <h3 className="text-xs font-semibold text-gray-700">{children}</h3>
      {action}
    </div>
  );
}

// ═══ STAT CARD ═══
interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  up?: boolean;
  icon?: string;
  gradient?: string;
}

export function StatCard({ label, value, change, up, icon, gradient = "from-indigo-500 to-violet-500" }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gray-400 font-medium">{label}</div>
        {icon && (
          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-white text-[9px]">{icon}</span>
          </div>
        )}
      </div>
      <div className="text-lg font-bold text-gray-800 tracking-tight">{value}</div>
      {change && (
        <div className={`text-[10px] mt-1 font-medium ${up ? "text-emerald-500" : "text-rose-500"}`}>
          {up ? "↑" : "↓"} {change}
        </div>
      )}
    </Card>
  );
}

// ═══ DATA TABLE ═══
interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = "No data found" }: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th key={col.key} className={cn("text-left px-4 py-2.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-[11px] text-gray-400">{emptyMessage}</td></tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)}
                className={cn("border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors", onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(item)}>
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3", col.className)}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══ PAGINATION ═══
interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  return (
    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
      <span className="text-[9px] text-gray-400">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPageChange(p)}
            className={cn("w-6 h-6 rounded text-[9px] font-medium transition-colors", p === page ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}>
            {p}
          </button>
        ))}
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

// ═══ STEPPER ═══
interface StepperProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  completedSteps?: Set<number>;
}

export function Stepper({ steps, currentStep, onStepClick, completedSteps = new Set() }: StepperProps) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = completedSteps.has(i);
        const isClickable = isCompleted || i <= currentStep;

        return (
          <React.Fragment key={i}>
            <button
              onClick={() => isClickable && onStepClick?.(i)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-[10px]",
                isActive && "bg-indigo-50 border border-indigo-200",
                isCompleted && !isActive && "bg-emerald-50 border border-emerald-200",
                !isActive && !isCompleted && "border border-transparent",
                isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                isActive && "bg-indigo-500 text-white",
                isCompleted && !isActive && "bg-emerald-500 text-white",
                !isActive && !isCompleted && "bg-gray-200 text-gray-400",
              )}>
                {isCompleted && !isActive ? "✓" : i + 1}
              </div>
              <div className="text-left">
                <div className={cn("font-semibold", isActive ? "text-indigo-700" : isCompleted ? "text-emerald-700" : "text-gray-400")}>
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-[8px] text-gray-400">{step.description}</div>
                )}
              </div>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("w-8 h-px", isCompleted ? "bg-emerald-300" : "bg-gray-200")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ═══ EMPTY STATE ═══
export function EmptyState({ icon = "📭", title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {description && <p className="text-[10px] text-gray-400 mt-1 text-center max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ═══ LOADING SKELETON ═══
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-gray-200 rounded", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-gray-100 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-gray-50 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
        </div>
      ))}
    </Card>
  );
}
