import React from 'react';
import { cn } from '../../utils/cn';

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, ...props }, ref) => {
    const [selectedTab, setSelectedTab] = React.useState(value || defaultValue);

    React.useEffect(() => {
      if (value !== undefined) {
        setSelectedTab(value);
      }
    }, [value]);

    const handleTabChange = (newValue: string) => {
      if (value === undefined) {
        setSelectedTab(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        data-selected={selectedTab}
        {...props}
      />
    );
  }
);

Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500",
      className
    )}
    {...props}
  />
));

TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isSelected = context?.selectedTab === value;

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isSelected
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-900",
          className
        )}
        onClick={() => context?.onTabChange(value)}
        {...props}
      />
    );
  }
);

TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const isSelected = context?.selectedTab === value;

  if (!isSelected) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  );
});

TabsContent.displayName = "TabsContent";

const TabsContext = React.createContext<{
  selectedTab: string;
  onTabChange: (value: string) => void;
} | null>(null);

export { Tabs, TabsList, TabsTrigger, TabsContent };