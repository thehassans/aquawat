import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  promptMaqderWebAppInstall,
  subscribePwaInstallPrompt,
  isMaqderWebAppInstalled,
} from './pwaInstall'

/**
 * Hook for “Install web based application of Maqder” menu actions.
 * Call initMaqderPwaInstall() once from main.jsx.
 */
export default function useMaqderWebAppInstall(language = 'en') {
  const [canPrompt, setCanPrompt] = useState(false)
  const [installed, setInstalled] = useState(() => isMaqderWebAppInstalled())

  useEffect(() => {
    const unsub = subscribePwaInstallPrompt((prompt) => {
      setCanPrompt(Boolean(prompt))
      setInstalled(isMaqderWebAppInstalled())
    })
    setInstalled(isMaqderWebAppInstalled())
    return () => { unsub?.() }
  }, [])

  const install = useCallback(async () => {
    const result = await promptMaqderWebAppInstall()

    if (result === 'accepted') {
      setInstalled(true)
      toast.success(language === 'ar' ? 'تم تثبيت تطبيق مقدر على جهازك' : 'Maqder web app installed on your device')
      return result
    }

    if (result === 'installed') {
      toast.success(language === 'ar' ? 'تطبيق مقدر مثبت بالفعل' : 'Maqder web app is already installed')
      return result
    }

    if (result === 'ios') {
      toast(
        language === 'ar'
          ? 'على iPhone/iPad: اضغط مشاركة ← إضافة إلى الشاشة الرئيسية'
          : 'On iPhone/iPad: tap Share → Add to Home Screen',
        { duration: 6000 }
      )
      return result
    }

    if (result === 'unavailable') {
      toast(
        language === 'ar'
          ? 'افتح قائمة المتصفح ← تثبيت التطبيق / تثبيت مقدر'
          : 'Open your browser menu → Install app / Install Maqder',
        { duration: 5500 }
      )
      return result
    }

    return result
  }, [language])

  return { install, canPrompt, installed }
}
