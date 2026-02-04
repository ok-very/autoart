/**
 * IntakeFormContext - Provides form context to child components
 *
 * Used to pass formUniqueId to nested components like RecordBlock
 * that need to fetch additional data.
 */

import { createContext, useContext, ReactNode } from 'react';

interface IntakeFormContextValue {
  formUniqueId: string;
}

const IntakeFormContext = createContext<IntakeFormContextValue | null>(null);

interface IntakeFormProviderProps {
  formUniqueId: string;
  children: ReactNode;
}

export function IntakeFormProvider({ formUniqueId, children }: IntakeFormProviderProps) {
  return (
    <IntakeFormContext.Provider value={{ formUniqueId }}>
      {children}
    </IntakeFormContext.Provider>
  );
}

export function useIntakeFormContext(): IntakeFormContextValue {
  const context = useContext(IntakeFormContext);
  if (!context) {
    throw new Error('useIntakeFormContext must be used within IntakeFormProvider');
  }
  return context;
}
