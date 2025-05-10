import React from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

type AlertVariant = 'default' | 'destructive' | 'success' | 'warning' | 'error';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'default', title, children, ...props }, ref) => {
    const variants: Record<AlertVariant, { container: string; icon: JSX.Element }> = {
      default: {
        container: "bg-blue-50 border-blue-200 text-blue-800",
        icon: <Info className="h-5 w-5 text-blue-500" />
      },
      destructive: {
        container: "bg-red-50 border-red-200 text-red-800",
        icon: <XCircle className="h-5 w-5 text-red-500" />
      },
      success: {
        container: "bg-green-50 border-green-200 text-green-800",
        icon: <CheckCircle className="h-5 w-5 text-green-500" />
      },
      warning: {
        container: "bg-yellow-50 border-yellow-200 text-yellow-800",
        icon: <AlertCircle className="h-5 w-5 text-yellow-500" />
      },
      error: {
        container: "bg-red-50 border-red-200 text-red-800",
        icon: <XCircle className="h-5 w-5 text-red-500" />
      }
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          variants[variant].container,
          className
        )}
        {...props}
      >
        {variants[variant].icon}
        <div className="flex-1">
          {title && <h5 className="mb-1 font-medium">{title}</h5>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    );
  }
);

Alert.displayName = "Alert";

export { Alert };

export default Alert;