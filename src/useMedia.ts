import { useEffect, useState } from 'react'

/** Live match for a media query. Used to swap layout, not just styling —
 *  the phone layout moves nodes in the DOM rather than only restyling them. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/** One breakpoint, named once, so the CSS and the JS can't disagree. */
export const PHONE = '(max-width: 760px)'
