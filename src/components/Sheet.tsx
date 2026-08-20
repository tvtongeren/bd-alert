import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** A bottom sheet, the shape iOS users expect for "add" and "edit". */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Tapping outside closes the sheet. Hidden from assistive tech, which
          has the labelled close button and Escape instead. */}
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92vh] animate-sheet-up flex-col rounded-t-3xl bg-slate-50 shadow-2xl dark:bg-slate-950"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-500 transition active:scale-90 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 px-4 pb-safe pt-3 dark:border-slate-800">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
