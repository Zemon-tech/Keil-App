import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const SunIcon = memo(({ className, ...props }: SvgProps) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 1C12.55 1 13 1.45 13 2V4C13 4.55 12.55 5 12 5C11.45 5 11 4.55 11 4V2C11 1.45 11.45 1 12 1Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z"
        fill="currentColor"
      />
      <path
        d="M13 20C13 19.45 12.55 19 12 19C11.45 19 11 19.45 11 20V22C11 22.55 11.45 23 12 23C12.55 23 13 22.55 13 22V20Z"
        fill="currentColor"
      />
      <path
        d="M4.22 4.22C4.61 3.83 5.25 3.83 5.64 4.22L7.05 5.63C7.44 6.02 7.44 6.66 7.05 7.05C6.66 7.44 6.02 7.44 5.63 7.05L4.22 5.64C3.83 5.25 3.83 4.61 4.22 4.22Z"
        fill="currentColor"
      />
      <path
        d="M18.37 16.95C17.98 16.56 17.34 16.56 16.95 16.95C16.56 17.34 16.56 17.98 16.95 18.37L18.36 19.78C18.75 20.17 19.39 20.17 19.78 19.78C20.17 19.39 20.17 18.75 19.78 18.36L18.37 16.95Z"
        fill="currentColor"
      />
      <path
        d="M1 12C1 11.45 1.45 11 2 11H4C4.55 11 5 11.45 5 12C5 12.55 4.55 13 4 13H2C1.45 13 1 12.55 1 12Z"
        fill="currentColor"
      />
      <path
        d="M20 11C19.45 11 19 11.45 19 12C19 12.55 19.45 13 20 13H22C22.55 13 23 12.55 23 12C23 11.45 22.55 11 22 11H20Z"
        fill="currentColor"
      />
      <path
        d="M7.05 16.95C7.44 17.34 7.44 17.98 7.05 18.37L5.64 19.78C5.25 20.17 4.61 20.17 4.22 19.78C3.83 19.39 3.83 18.75 4.22 18.36L5.63 16.95C6.02 16.56 6.66 16.56 7.05 16.95Z"
        fill="currentColor"
      />
      <path
        d="M19.78 5.64C20.17 5.25 20.17 4.61 19.78 4.22C19.39 3.83 18.75 3.83 18.36 4.22L16.95 5.63C16.56 6.02 16.56 6.66 16.95 7.05C17.34 7.44 17.98 7.44 18.37 7.05L19.78 5.64Z"
        fill="currentColor"
      />
    </svg>
  )
})

SunIcon.displayName = "SunIcon"
