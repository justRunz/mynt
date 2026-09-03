import { useMemo, useState } from 'react'
import { useCombobox } from 'downshift'
import { useTranslation } from 'react-i18next'

import { countryFlag, countryName, sortCountryCodes } from '../lib/countries'
import { fold } from '../lib/search'

interface Props {
  codes: readonly string[]
  value: string | null
  onChange: (code: string | null) => void
  inputRef?: React.Ref<HTMLInputElement>
  /**
   * Text the field starts with, for editing an existing coin. Callers remount
   * with a key when the subject changes rather than syncing it in an effect.
   */
  initialQuery?: string
}

/**
 * Type-to-filter country picker.
 *
 * A native select would be simpler, but its typeahead is poor on mobile, and
 * this is the field the user hits first on every single coin. Downshift rather
 * than Radix: Radix has no combobox primitive, and Base UI's is still a release
 * candidate. Downshift brings behaviour and ARIA only, no styles.
 */
export function CountryCombobox({
  codes,
  value,
  onChange,
  inputRef,
  initialQuery = '',
}: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(initialQuery)

  const sorted = useMemo(() => sortCountryCodes(codes), [codes])
  const matches = useMemo(() => {
    const needle = fold(query.trim())
    if (!needle) return sorted
    return sorted.filter((code) => fold(countryName(code)).includes(needle))
  }, [sorted, query])

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    closeMenu,
  } = useCombobox({
    items: matches,
    inputValue: query,
    selectedItem: value,
    itemToString: (code) => (code ? countryName(code) : ''),
    // The first match is highlighted as soon as the user types, so "esp" then
    // Enter picks Spain. Without it the field would keep showing "esp" with
    // nothing actually selected -- a field that lies about its own state, on
    // the screen where every second counts twice.
    defaultHighlightedIndex: 0,
    onInputValueChange: ({ inputValue }) => setQuery(inputValue ?? ''),
    onSelectedItemChange: ({ selectedItem }) => {
      onChange(selectedItem ?? null)
      setQuery(selectedItem ? countryName(selectedItem) : '')
    },
    stateReducer: (state, { type, changes }) => {
      // Leaving the field must never leave half-typed text behind: snap the
      // input back to whatever is actually selected, or empty it.
      if (type === useCombobox.stateChangeTypes.InputBlur) {
        const selected = changes.selectedItem ?? state.selectedItem
        return { ...changes, inputValue: selected ? countryName(selected) : '' }
      }
      return changes
    },
  })

  return (
    <div className="relative flex flex-col gap-1.5">
      <label {...getLabelProps()} className="text-sm font-[450] text-muted">
        {t('quickAdd.country')}
      </label>
      <input
        {...getInputProps({
          ref: inputRef,
          onKeyDown: (event) => {
            // Enter commits the top match explicitly. Relying on the highlight
            // alone left the field showing "esp" with nothing selected, and a
            // field that lies about its own state is worse than a slow one.
            if (event.key === 'Enter' && matches.length > 0) {
              event.preventDefault()
              const code = matches[highlightedIndex >= 0 ? highlightedIndex : 0] ?? null
              if (code) {
                onChange(code)
                setQuery(countryName(code))
                closeMenu()
              }
            }
          },
        })}
        placeholder={t('quickAdd.countryPlaceholder')}
        className="h-11 w-64 rounded-md border border-field bg-raised px-4 text-base text-ink
                   placeholder:text-muted"
      />
      <ul
        {...getMenuProps()}
        className={`absolute top-full z-10 mt-2 max-h-64 w-64 overflow-y-auto rounded-md
                    bg-raised py-2 shadow-popover ${isOpen ? '' : 'hidden'}`}
      >
        {isOpen && matches.length === 0 && (
          <li className="px-4 py-2 text-base text-muted">{t('quickAdd.countryNoResult')}</li>
        )}
        {isOpen &&
          matches.map((code, index) => (
            <li
              key={code}
              {...getItemProps({ item: code, index })}
              className={`cursor-pointer px-4 py-2 text-base ${
                highlightedIndex === index ? 'bg-card' : ''
              }`}
            >
              <span aria-hidden>{countryFlag(code)}</span> {countryName(code)}
            </li>
          ))}
      </ul>
    </div>
  )
}
