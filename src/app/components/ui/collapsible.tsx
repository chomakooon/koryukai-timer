import * as React from 'react';

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({ open: false });

export function Collapsible({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return <CollapsibleContext.Provider value={{ open, onOpenChange }}>{children}</CollapsibleContext.Provider>;
}

export function CollapsibleTrigger({ children, className }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, onOpenChange } = React.useContext(CollapsibleContext);
  return (
    <button className={className} type="button" onClick={() => onOpenChange?.(!open)}>
      {children}
    </button>
  );
}

export function CollapsibleContent({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(CollapsibleContext);
  if (!open) return null;
  return <div className={className}>{children}</div>;
}
