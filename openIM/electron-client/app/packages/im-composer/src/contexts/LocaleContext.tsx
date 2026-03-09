"use client"

import { createContext, useContext } from "react"
import type { IMComposerLocale } from "../types"
import { defaultLocale } from "../types"

const LocaleContext = createContext<IMComposerLocale>(defaultLocale)

export function LocaleProvider({
  locale,
  children,
}: {
  locale?: IMComposerLocale
  children: React.ReactNode
}) {
  const mergedLocale = { ...defaultLocale, ...locale }
  return (
    <LocaleContext.Provider value={mergedLocale}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): IMComposerLocale {
  return useContext(LocaleContext)
}
