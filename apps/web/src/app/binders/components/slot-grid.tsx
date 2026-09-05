import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { buildSlotGrid, metalFamily, type FaceValueCents } from '@mynt/core'

import { countryFlag, countryName } from '@/app/lib/countries'
import { formatFaceValue } from '@/app/lib/format'
import type { CollectionEntry } from '@/app/collection/hooks/use-collection'

const FILL = {
  COPPER: 'bg-copper border-copper-edge',
  NORDIC_GOLD: 'bg-nordic border-nordic-edge',
  BIMETAL: 'bg-silver border-silver-edge',
} as const

export interface SlotCoin extends CollectionEntry {
  slotRow: number
  slotColumn: number
}

export interface SlotTarget {
  row: number
  column: number
  coin: SlotCoin | null
}

interface Props {
  rowCount: number
  columnCount: number
  coins: readonly SlotCoin[]
  onSelect: (slot: SlotTarget) => void
  /** Dropped onto another hole: free means a move, occupied means an exchange. */
  onMove: (dragged: SlotCoin, target: SlotTarget) => void
}

const holeId = (row: number, column: number) => `hole-${row}-${column}`

function coinLabel(coin: SlotCoin) {
  return `${countryName(coin.countryCode)} ${formatFaceValue(coin.faceValueCents)} ${coin.year}`
}

/** The disc itself, shared by the grid and the drag overlay. */
function Disc({ coin, children }: { coin: SlotCoin | null; children?: ReactNode }) {
  return (
    <span
      aria-hidden
      className={`flex size-16 flex-col items-center justify-center gap-0.5 rounded-full border ${
        coin
          ? FILL[metalFamily(coin.faceValueCents as FaceValueCents)]
          : 'border-dashed border-field'
      }`}
    >
      {coin && (
        <>
          <span className="text-lg leading-none">{countryFlag(coin.countryCode)}</span>
          {/* Struck on the coin itself, so it belongs inside the circle rather
              than in the caption. The metal already says which family it is,
              never which value. */}
          <span className="tnum text-[10px] leading-none font-[500] whitespace-nowrap text-on-metal">
            {formatFaceValue(coin.faceValueCents)}
          </span>
        </>
      )}
      {children}
    </span>
  )
}

function Hole({
  row,
  column,
  coin,
  onSelect,
}: {
  row: number
  column: number
  coin: SlotCoin | null
  onSelect: (slot: SlotTarget) => void
}) {
  const { t } = useTranslation()
  const position = { row, column }

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: holeId(row, column),
    data: { row, column, coin },
  })
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({
    id: coin?.id ?? holeId(row, column),
    disabled: coin === null,
    data: { coin },
  })

  const label = coin
    ? t('binders.slotFilled', { ...position, country: countryName(coin.countryCode), value: formatFaceValue(coin.faceValueCents), year: coin.year })
    : t('binders.slotFree', position)

  return (
    <button
      ref={(node) => {
        setDropRef(node)
        setDragRef(node)
      }}
      type="button"
      aria-label={label}
      onClick={() => onSelect({ ...position, coin })}
      {...attributes}
      {...listeners}
      className={`flex touch-none flex-col items-center gap-1 rounded-[10px] p-1 ${
        isOver ? 'bg-accent-wash' : 'hover:bg-hover'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <Disc coin={coin} />
      <span className="tnum h-3 text-[10px] leading-3 text-muted">{coin ? coin.year : ''}</span>
    </button>
  )
}

export function SlotGrid({ rowCount, columnCount, coins, onSelect, onMove }: Props) {
  const { t } = useTranslation()
  const grid = buildSlotGrid(rowCount, columnCount, coins)
  const [dragged, setDragged] = useState<SlotCoin | null>(null)

  // Mouse and touch are split on purpose rather than sharing one PointerSensor.
  //
  // A finger has to hold still for a moment before a drag begins, or the grid
  // would swallow every attempt to scroll the page -- and this app gets used on
  // a phone. A mouse has no such conflict: the page scrolls with the wheel, so
  // the drag can start on the first few pixels of movement and feel immediate.
  // Both leave a plain click alone, so tapping a hole still opens the dialog.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  // dnd-kit announces in English by default, and these are the only strings a
  // screen reader gets during a drag.
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const coin = active.data.current?.coin as SlotCoin | undefined
      return coin ? t('binders.dnd.start', { coin: coinLabel(coin) }) : undefined
    },
    onDragOver: ({ over }) => {
      const data = over?.data.current as SlotTarget | undefined
      if (!data) return undefined
      return data.coin
        ? t('binders.dnd.overFilled', { row: data.row, column: data.column, coin: coinLabel(data.coin) })
        : t('binders.dnd.overFree', { row: data.row, column: data.column })
    },
    onDragEnd: ({ over }) => {
      const data = over?.data.current as SlotTarget | undefined
      return data
        ? t('binders.dnd.dropped', { row: data.row, column: data.column })
        : t('binders.dnd.cancelled')
    },
    onDragCancel: () => t('binders.dnd.cancelled'),
  }

  function onDragStart(event: DragStartEvent) {
    setDragged((event.active.data.current?.coin as SlotCoin | undefined) ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    const coin = event.active.data.current?.coin as SlotCoin | undefined
    const target = event.over?.data.current as SlotTarget | undefined
    setDragged(null)
    if (!coin || !target) return
    // Dropped back where it started.
    if (target.row === coin.slotRow && target.column === coin.slotColumn) return
    onMove(coin, target)
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <div className="flex flex-col gap-4">
        <p className="tnum text-sm text-muted">
          {t('binders.occupancy', { occupied: grid.occupied, total: rowCount * columnCount })}
        </p>

        <div className="overflow-x-auto">
          <div
            className="grid w-fit gap-2"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {grid.rows.flatMap((row, rowIndex) =>
              row.map((coin, columnIndex) => (
                <Hole
                  key={`${rowIndex + 1}-${columnIndex + 1}`}
                  row={rowIndex + 1}
                  column={columnIndex + 1}
                  coin={coin}
                  onSelect={onSelect}
                />
              )),
            )}
          </div>
        </div>

        {grid.outOfBounds.length > 0 && (
          <p role="alert" className="text-sm text-danger">
            {t('binders.outOfBounds', { count: grid.outOfBounds.length })}
          </p>
        )}
      </div>

      {/* Follows the pointer while the hole it left shows through at low
          opacity, so the page never looks like it lost a coin mid-gesture. */}
      <DragOverlay>{dragged ? <Disc coin={dragged} /> : null}</DragOverlay>
    </DndContext>
  )
}
