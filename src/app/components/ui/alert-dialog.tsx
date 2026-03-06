import * as React from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({ open: false });

export function AlertDialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange } = React.useContext(AlertDialogContext);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => onOpenChange?.(false)}>
      <div className={cn('w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl', className)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-2', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-bold', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm text-gray-600', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />;
}

export function AlertDialogCancel(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return <Button variant="outline" onClick={() => onOpenChange?.(false)} {...props} />;
}

export function AlertDialogAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return (
    <Button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) onOpenChange?.(false);
      }}
    />
  );
}
