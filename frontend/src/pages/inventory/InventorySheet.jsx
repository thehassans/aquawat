import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * Right slide-out panel for quick edits (move lines, counts, etc.).
 */
export default function InventorySheet({ open, onClose, title, children, footer }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 end-0 flex max-w-full ps-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <motion.div
                    layout
                    className="flex h-full flex-col bg-white shadow-2xl dark:bg-[#0c111a] border-s border-slate-200/80 dark:border-white/10"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
                      <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                      </Dialog.Title>
                      <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5">
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                    {footer && (
                      <div className="border-t border-slate-200/80 px-5 py-4 dark:border-white/10">
                        {footer}
                      </div>
                    )}
                  </motion.div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
