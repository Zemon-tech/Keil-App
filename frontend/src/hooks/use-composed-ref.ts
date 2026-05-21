"use client"

import { useCallback, useRef } from "react"

// basically Exclude<React.ClassAttributes<T>["ref"], string>
type UserRef<T> =
  | ((instance: T | null) => void)
  | React.RefObject<T | null>
  | null
  | undefined

const updateRef = <T>(ref: NonNullable<UserRef<T>>, value: T | null) => {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref && typeof ref === "object" && "current" in ref) {
    // Safe assignment without MutableRefObject
    ;(ref as { current: T | null }).current = value
  }
}

export const useComposedRef = <T extends HTMLElement>(
  libRef: React.RefObject<T | null>,
  userRef: UserRef<T>
) => {
  // Store both refs in a container so we always have the latest values
  // without the useCallback needing to depend on them.
  const refsRef = useRef({ libRef, userRef })
  refsRef.current = { libRef, userRef }

  // Empty deps [] means this callback is created exactly once and never
  // recreated. React will never run cleanup/setup on this ref unnecessarily,
  // which prevents the infinite ref-loop that caused React Error #185.
  return useCallback((instance: T | null) => {
    const { libRef: lr, userRef: ur } = refsRef.current

    if (lr && "current" in lr) {
      ;(lr as { current: T | null }).current = instance
    }

    if (ur) {
      updateRef(ur, instance)
    }
  }, [])
}

export default useComposedRef
