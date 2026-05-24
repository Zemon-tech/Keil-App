import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const ArrowLeftIcon = memo(({ className, ...props }: SvgProps) => {
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
        d="M12.71 5.71C13.1 5.32 13.1 4.68 12.71 4.29C12.32 3.9 11.68 3.9 11.29 4.29L4.29 11.29C3.9 11.68 3.9 12.32 4.29 12.71L11.29 19.71C11.68 20.1 12.32 20.1 12.71 19.71C13.1 19.32 13.1 18.68 12.71 18.29L7.41 13L19 13C19.55 13 20 12.55 20 12C20 11.45 19.55 11 19 11L7.41 11L12.71 5.71Z"
        fill="currentColor"
      />
    </svg>
  )
})

ArrowLeftIcon.displayName = "ArrowLeftIcon"
