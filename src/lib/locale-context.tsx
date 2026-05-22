'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Locale, type T } from './i18n'

type LocaleContextType = {
  lang: Locale
  setLang: (lang: Locale) => void
  t: T
}

const LocaleContext = createContext<LocaleContextType>({
  lang: 'ja',
  setLang: () => {},
  t: translations.ja as T,
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Locale>('ja')
  return (
    <LocaleContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextType {
  return useContext(LocaleContext)
}
