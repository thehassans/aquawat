import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AccountingPageActionsContext = createContext({
  pageActions: null,
  setPageActions: () => {},
})

/**
 * Route-scoped primary actions for Accounting.
 * Child panels register CTAs; AccountingLayout / page chrome renders them.
 * Prevents a global "+ New journal" from bleeding across all sections.
 */
export function AccountingPageActionsProvider({ children }) {
  const [pageActions, setPageActionsState] = useState(null)
  const setPageActions = useCallback((next) => {
    setPageActionsState(next)
  }, [])
  const value = useMemo(() => ({ pageActions, setPageActions }), [pageActions, setPageActions])
  return (
    <AccountingPageActionsContext.Provider value={value}>
      {children}
    </AccountingPageActionsContext.Provider>
  )
}

export function useAccountingPageActions() {
  return useContext(AccountingPageActionsContext)
}

/** Register (and clear on unmount) the header action slot for the active panel. */
export function useRegisterAccountingPageActions(node, deps = []) {
  const { setPageActions } = useAccountingPageActions()
  useEffect(() => {
    setPageActions(node ?? null)
    return () => setPageActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
  }, deps)
}
